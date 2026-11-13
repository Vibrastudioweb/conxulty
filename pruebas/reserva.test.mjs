/**
 * Reserva de cita desde el Directorio → OS.
 *
 * POR QUÉ ESTE FLUJO Y NO OTRO: es el único donde una falla la ve un
 * paciente y no el consultorio, y ya se rompió dos veces sin que nadie se
 * enterara. Una, el endpoint llevaba quién sabe cuánto devolviendo 503 en
 * producción por una variable de entorno que faltaba. Otra, las citas se
 * guardaban con cuatro horas de corrimiento porque el servidor pensaba en
 * UTC y Venezuela está en UTC-4. Ninguna de las dos se ve leyendo el
 * código: las dos se ven mandando una reserva de verdad y mirando qué
 * quedó guardado.
 *
 * No necesita navegador: es servidor contra servidor, igual que en
 * producción, donde quien llama es el Worker de vitalud.
 *
 *   node pruebas/reserva.test.mjs
 */

import {
  BASE_URL,
  comprobar,
  consultar,
  correr,
  ejecutar,
  exigirAppViva,
  secretoSync,
  valor,
} from "./entorno.mjs";
import { FICHA_DIRECTORIO, ORG, limpiar, sembrar } from "./sembrar.mjs";

const UN_DIA = 24 * 60 * 60 * 1000;

/** Una fecha futura, a la hora que se pida EN VENEZUELA (UTC-4 todo el año). */
function enVenezuela(diasAdelante, hora, minuto = 0) {
  const d = new Date(Date.now() + diasAdelante * UN_DIA);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(hora).padStart(2, "0");
  const mi = String(minuto).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00-04:00`;
}

async function reservar(cuerpo, { secreto = secretoSync() } = {}) {
  const r = await fetch(`${BASE_URL}/api/directorio/reservar-cita`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-conxulty-secret": secreto },
    body: JSON.stringify(cuerpo),
  });
  return { estado: r.status, cuerpo: await r.json().catch(() => null) };
}

function reservaValida(extra = {}) {
  return {
    fichaDirectorioId: FICHA_DIRECTORIO,
    nombrePaciente: "Carmen Rodríguez",
    telefonoPaciente: "04141234567",
    fechaHoraIso: enVenezuela(3, 10),
    motivo: "Primera consulta",
    ipCliente: `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
    ...extra,
  };
}

await correr("Reserva desde el Directorio", async () => {
  await exigirAppViva();
  await sembrar();

  // ── Sin el secreto compartido no entra nadie ──────────────────────
  // El endpoint es público en internet: lo único que lo protege es este
  // secreto. Si un día deja de verificarse, cualquiera puede llenar de
  // citas falsas la agenda de un médico.
  const sinSecreto = await reservar(reservaValida(), { secreto: "secreto-equivocado" });
  comprobar("Rechaza un secreto que no es el suyo", sinSecreto.estado === 401, sinSecreto.estado);

  // ── El caso que importa: la hora que se guarda es la que pidió ────
  // Acá vivía el error de las cuatro horas. La prueba no se fía de lo que
  // devuelve el endpoint: va a la base y compara contra el instante exacto
  // que se pidió.
  const fechaPedida = enVenezuela(3, 10);
  const buena = await reservar(reservaValida({ fechaHoraIso: fechaPedida }));
  comprobar("Acepta una reserva normal", buena.estado === 200 && buena.cuerpo?.ok === true, JSON.stringify(buena.cuerpo));

  if (buena.cuerpo?.citaId) {
    const [cita] = await consultar(
      `select "fechaHora", estado, modalidad from citas where id = '${buena.cuerpo.citaId}'`,
    );
    const guardada = new Date(cita.fechaHora).toISOString();
    const esperada = new Date(fechaPedida).toISOString();
    comprobar(
      "Guarda la hora exacta que pidió el paciente (sin corrimiento de zona)",
      guardada === esperada,
      `guardada ${guardada}, esperada ${esperada}`,
    );
    comprobar("La cita nace PENDIENTE, para que el médico la confirme", cita.estado === "PENDIENTE", cita.estado);
    comprobar("Devuelve un token para que el paciente pueda opinar después", typeof buena.cuerpo.tokenResena === "string" && buena.cuerpo.tokenResena.length > 10);
  }

  // ── Ese cupo ya no se puede dar dos veces ─────────────────────────
  const repetida = await reservar(
    reservaValida({ fechaHoraIso: fechaPedida, telefonoPaciente: "04149998877", nombrePaciente: "Otro Paciente" }),
  );
  comprobar("No permite dos pacientes en el mismo horario", repetida.estado === 409, `${repetida.estado} ${JSON.stringify(repetida.cuerpo)}`);
  comprobar(
    "Y se lo explica al paciente en su idioma, no con un error técnico",
    typeof repetida.cuerpo?.error === "string" && repetida.cuerpo.error.includes("elige otro"),
    repetida.cuerpo?.error,
  );

  // ── Cordura de la fecha ───────────────────────────────────────────
  const ayer = await reservar(reservaValida({ fechaHoraIso: enVenezuela(-1, 10) }));
  comprobar("Rechaza una fecha que ya pasó", ayer.estado === 400, ayer.estado);

  const lejos = await reservar(reservaValida({ fechaHoraIso: enVenezuela(120, 10) }));
  comprobar("Rechaza reservar a más de 90 días", lejos.estado === 400, lejos.estado);

  // Las 3 de la mañana: ninguna ficha ofrece eso, y si llega es porque
  // alguien está golpeando el endpoint a mano.
  const madrugada = await reservar(reservaValida({ fechaHoraIso: enVenezuela(4, 3) }));
  comprobar("Rechaza una hora de madrugada", madrugada.estado === 400, madrugada.estado);

  // ── Teléfono: es el ÚNICO modo de contactar al paciente ───────────
  // No hay correo ni WhatsApp automático en este flujo. Un teléfono
  // incompleto es una cita que el consultorio no puede confirmar nunca.
  const telCorto = await reservar(reservaValida({ telefonoPaciente: "123", fechaHoraIso: enVenezuela(5, 11) }));
  comprobar("Rechaza un teléfono incompleto", telCorto.estado === 400, `${telCorto.estado} ${JSON.stringify(telCorto.cuerpo)}`);

  // ── Una ficha que no existe no revela nada del sistema ────────────
  const fantasma = await reservar(
    reservaValida({ fichaDirectorioId: "no-existe-esta-ficha", fechaHoraIso: enVenezuela(6, 11) }),
  );
  comprobar("Responde 404 si la ficha no existe", fantasma.estado === 404, fantasma.estado);
  comprobar(
    "Y le dice al paciente qué hacer, sin hablarle de ids ni de sincronización",
    typeof fantasma.cuerpo?.error === "string" &&
      fantasma.cuerpo.error.includes("WhatsApp") &&
      !/id|sincroniz/i.test(fantasma.cuerpo.error),
    fantasma.cuerpo?.error,
  );

  // ── Un mismo teléfono no puede acumular citas sin confirmar ───────
  // Tope de 3 pendientes: sin esto, una persona (o un script) llena la
  // agenda de un médico con citas que nadie va a ocupar.
  await ejecutar(`delete from citas where "organizacionId" = '${ORG}'`);
  const telefonoInsistente = "04145556677";
  const estados = [];
  for (let i = 0; i < 5; i++) {
    const r = await reservar(
      reservaValida({
        telefonoPaciente: telefonoInsistente,
        nombrePaciente: "Paciente Insistente",
        fechaHoraIso: enVenezuela(10 + i, 9),
        ipCliente: `10.1.0.${i + 1}`,
      }),
    );
    estados.push(r.estado);
  }
  const pendientes = Number(
    await valor(
      `select count(*) from citas c join pacientes p on p.id = c."pacienteId"
        where c."organizacionId" = '${ORG}' and p.telefono like '%5556677'`,
    ),
  );
  comprobar(
    "Corta al cuarto intento del mismo teléfono (tope de 3 pendientes)",
    estados.slice(0, 3).every((e) => e === 200) && estados.slice(3).every((e) => e === 429),
    estados.join(","),
  );
  comprobar("Y en la base quedan 3, no 5", pendientes === 3, pendientes);

  await limpiar();
});
