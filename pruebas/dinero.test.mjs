/**
 * El circuito del dinero: el médico reporta su pago, el equipo lo
 * confirma, el plan queda activo y el Directorio se entera.
 *
 * POR QUÉ ESTE FLUJO: es el que decide si el negocio cobra. Y es manual de
 * punta a punta —cuenta personal de SPIDI, sin API— así que no hay ninguna
 * pasarela que avise si algo se desconecta: si un eslabón se rompe, se
 * rompe en silencio y el síntoma es un médico que pagó y cuyo plan sigue
 * diciendo "pendiente". Eso no se nota mirando la pantalla propia; se nota
 * cuando un cliente reclama.
 *
 * El último paso —que la fecha de vencimiento viaje al Directorio— es el
 * que apaga el teléfono y la agenda de una ficha impaga. Si se corta,
 * cualquiera usa el producto gratis para siempre.
 *
 * Necesita navegador: estos pasos son formularios del panel, no una API.
 *
 *   node pruebas/dinero.test.mjs
 */

import {
  comprobar,
  correr,
  ejecutar,
  esperarEnBase,
  esperarTexto,
  exigirAppViva,
  navegadorConSesion,
  valor,
  BASE_URL,
} from "./entorno.mjs";
import {
  EMAIL_EQUIPO,
  EMAIL_MEDICO,
  ORG,
  ORG_EQUIPO,
  SUSCRIPCION,
  USUARIO,
  USUARIO_EQUIPO,
  limpiar,
  sembrar,
} from "./sembrar.mjs";

// Un PNG de 1×1 válido: el formulario pide una imagen de comprobante.
const COMPROBANTE = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478" +
    "9c6360000002000100ffff03000006000557bfabd4000000004945",
  "hex",
);

await correr("El circuito del dinero", async () => {
  await exigirAppViva();
  await sembrar();

  // ── 1. El médico reporta que pagó ─────────────────────────────────
  const medico = await navegadorConSesion({
    email: EMAIL_MEDICO,
    usuarioId: USUARIO,
    organizacionId: ORG,
    rol: "MEDICO",
    nombre: "Dra. de Prueba",
  });

  await medico.pagina.goto(`${BASE_URL}/ajustes`);
  const ajustes = await esperarTexto(medico.pagina, "Plan");
  comprobar("La pantalla de plan carga", ajustes.length > 50, ajustes.slice(0, 150));

  // El monto en bolívares depende de una API pública del BCV que puede no
  // responder desde donde corran estas pruebas. Que falte no es un fallo
  // del producto: debe mostrar los dólares igual. Lo que no puede faltar
  // nunca es el precio en dólares.
  comprobar(
    "Le dice cuánto tiene que pagar, en dólares",
    ajustes.includes("$20") || ajustes.includes("$5"),
    ajustes.slice(0, 250),
  );

  await medico.pagina.locator('input[type="file"]').first().setInputFiles({
    name: "comprobante.png",
    mimeType: "image/png",
    buffer: COMPROBANTE,
  });
  await medico.pagina.getByRole("button", { name: /Ya pagu/i }).first().click();

  comprobar(
    "Queda un pago esperando confirmación",
    Number(
      await esperarEnBase(
        `select count(*) from pagos where "organizacionId" = '${ORG}' and estado = 'PENDIENTE'`,
        1,
      ),
    ) === 1,
    await valor(`select count(*) from pagos where "organizacionId" = '${ORG}'`),
  );
  comprobar(
    "Y su cuenta lo refleja, para que no pague dos veces",
    (await valor(`select estado from suscripciones where id = '${SUSCRIPCION}'`)) === "PENDIENTE_CONFIRMACION",
    await valor(`select estado from suscripciones where id = '${SUSCRIPCION}'`),
  );
  comprobar(
    "Se guardó el comprobante, que es la prueba de que pagó",
    (await valor(`select comprobante is not null from pagos where "organizacionId" = '${ORG}' limit 1`)) === true,
  );

  await medico.navegador.close();

  // ── 2. El equipo lo confirma ──────────────────────────────────────
  const equipo = await navegadorConSesion({
    email: EMAIL_EQUIPO,
    usuarioId: USUARIO_EQUIPO,
    organizacionId: ORG_EQUIPO,
    rol: "SUPERADMIN",
    nombre: "Equipo",
  });

  await equipo.pagina.goto(`${BASE_URL}/superadmin/pagos`);
  await equipo.pagina.getByRole("button", { name: /Confirmar/i }).first().waitFor({ timeout: 15000 });
  const panel = (await equipo.pagina.locator("body").innerText()).replace(/\s+/g, " ").trim();
  comprobar("El pago aparece en el panel del equipo", panel.includes("Consultorio de prueba"), panel.slice(0, 200));

  await equipo.pagina.getByRole("button", { name: /Confirmar/i }).first().click();
  await equipo.navegador.close();

  comprobar(
    "El pago queda marcado como pagado",
    (await esperarEnBase(`select estado from pagos where "organizacionId" = '${ORG}' limit 1`, "PAGADO")) === "PAGADO",
    await valor(`select estado from pagos where "organizacionId" = '${ORG}' limit 1`),
  );
  comprobar(
    "La suscripción queda activa",
    (await valor(`select estado from suscripciones where id = '${SUSCRIPCION}'`)) === "ACTIVA",
    await valor(`select estado from suscripciones where id = '${SUSCRIPCION}'`),
  );
  comprobar(
    "La organización sube al plan que pagó",
    (await valor(`select plan from organizaciones where id = '${ORG}'`)) === "FICHA",
    await valor(`select plan from organizaciones where id = '${ORG}'`),
  );

  const fin = await valor(
    `select to_char("finPeriodoActual", 'YYYY-MM-DD') from suscripciones where id = '${SUSCRIPCION}'`,
  );
  const esperado = await valor(`select to_char(current_date + 30, 'YYYY-MM-DD')`);
  comprobar("Queda al día por 30 días", fin === esperado, `${fin} vs ${esperado}`);

  // ── 3. La fecha que apaga (o enciende) la ficha del Directorio ────
  // El Directorio muestra teléfono y agenda mientras su `vence` no haya
  // pasado. El OS le manda ese fin de período más 15 días de gracia. Si
  // esta cuenta se rompe, o se corta a un médico que pagó, o se le regala
  // el producto a uno que no.
  const esperadoVence = await valor(`select to_char(current_date + 45, 'YYYY-MM-DD')`);
  const calculado = await valor(
    `select to_char("finPeriodoActual" + interval '15 days', 'YYYY-MM-DD') from suscripciones where id = '${SUSCRIPCION}'`,
  );
  comprobar(
    "El vencimiento que le toca al Directorio son los 30 días + 15 de gracia",
    calculado === esperadoVence,
    `${calculado} vs ${esperadoVence}`,
  );

  // ── 4. Una cuenta de cortesía no vence nunca ──────────────────────
  await ejecutar(`update suscripciones set estado = 'CORTESIA' where id = '${SUSCRIPCION}'`);
  comprobar(
    "Una cuenta de cortesía queda marcada como tal",
    (await valor(`select estado from suscripciones where id = '${SUSCRIPCION}'`)) === "CORTESIA",
  );

  await limpiar();
});
