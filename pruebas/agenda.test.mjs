/**
 * Cancelar una cita y poder deshacerlo.
 *
 * POR QUÉ ESTE FLUJO: cancelar es un clic sin confirmación, al lado de
 * "Confirmar", y en el móvil los dos botones están a un dedo de distancia.
 * La red de seguridad no es un "¿seguro?" —se termina aceptando sin leer—
 * sino poder deshacerlo. Y lo delicado de deshacer no es devolver la cita:
 * es NO devolverla cuando, mientras estaba cancelada, el consultorio le dio
 * ese hueco a otro paciente. Si eso falla, quedan dos personas citadas a la
 * misma hora y nadie se entera hasta que las dos llegan.
 *
 * Necesita navegador: es la agenda.
 *
 *   node pruebas/agenda.test.mjs
 */

import {
  BASE_URL,
  comprobar,
  correr,
  ejecutar,
  esperarTexto,
  exigirAppViva,
  navegadorConSesion,
  valor,
} from "./entorno.mjs";
import { EMAIL_MEDICO, ORG, PACIENTE, PACIENTE_2, USUARIO, crearCita, limpiar, sembrar } from "./sembrar.mjs";

const CITA = "prueba-cita";
const CITA_INTRUSA = "prueba-cita-2";

const estadoDe = (id) => valor(`select estado from citas where id = '${id}'`);

await correr("Cancelar una cita y deshacerlo", async () => {
  await exigirAppViva();
  await sembrar();
  await crearCita(CITA, PACIENTE);

  const { navegador, pagina } = await navegadorConSesion({
    email: EMAIL_MEDICO,
    usuarioId: USUARIO,
    organizacionId: ORG,
    rol: "MEDICO",
    nombre: "Dra. de Prueba",
  });

  const manana = await valor(`select to_char(current_date + 1, 'YYYY-MM-DD')`);
  const irALaAgenda = () => pagina.goto(`${BASE_URL}/agenda?fecha=${manana}`);
  const cancelar = async () => {
    await pagina.getByRole("button", { name: "Cancelar", exact: true }).first().click();
    return esperarTexto(pagina, "Cita cancelada.");
  };

  // ── 1. Cancelar ofrece deshacer en el acto ────────────────────────
  await irALaAgenda();
  let texto = (await pagina.locator("main").innerText()).replace(/\s+/g, " ").trim();
  comprobar("La cita aparece en la agenda", texto.includes("Ana") && texto.includes("Pérez"), texto.slice(0, 200));

  texto = await cancelar();
  comprobar("Tras cancelar ofrece deshacerlo ahí mismo", texto.includes("Cita cancelada.") && texto.includes("Deshacer"), texto.slice(0, 250));
  comprobar("Y la cita quedó cancelada", (await estadoDe(CITA)) === "CANCELADA", await estadoDe(CITA));

  // ── 2. Deshacer la devuelve a la agenda ───────────────────────────
  await pagina.getByRole("button", { name: "Deshacer" }).click();
  texto = await esperarTexto(pagina, "volvió a tu agenda");
  comprobar("Deshacer la devuelve a la agenda", texto.includes("volvió a tu agenda"), texto.slice(0, 250));
  comprobar("Y vuelve a estar pendiente", (await estadoDe(CITA)) === "PENDIENTE", await estadoDe(CITA));
  comprobar("Ya no sigue ofreciendo deshacer", !texto.includes("Cita cancelada."), texto.slice(0, 200));

  // ── 3. EL CASO QUE IMPORTA ────────────────────────────────────────
  // Entre la cancelación y el arrepentimiento, otro paciente tomó el
  // horario. Deshacer tiene que negarse.
  await irALaAgenda();
  await cancelar();
  await ejecutar(`
    insert into citas (id, "organizacionId", "pacienteId", "medicoId", "fechaHora", "duracionMinutos", estado, modalidad, "updatedAt")
    values ('${CITA_INTRUSA}', '${ORG}', '${PACIENTE_2}', (select "medicoId" from citas where id = '${CITA}'),
            (select "fechaHora" from citas where id = '${CITA}'), 30, 'CONFIRMADA', 'PRESENCIAL', now())`);

  await pagina.getByRole("button", { name: "Deshacer" }).click();
  texto = await esperarTexto(pagina, "ese horario ya está ocupado");
  comprobar("Si le dieron el hueco a otro, se niega a reabrirla", texto.includes("ese horario ya está ocupado"), texto.slice(0, 250));
  comprobar("La cita cancelada sigue cancelada", (await estadoDe(CITA)) === "CANCELADA", await estadoDe(CITA));
  comprobar("Y la del otro paciente queda intacta", (await estadoDe(CITA_INTRUSA)) === "CONFIRMADA", await estadoDe(CITA_INTRUSA));

  await ejecutar(`delete from citas where id = '${CITA_INTRUSA}'`);

  // ── 4. Deshacer no es una puerta trasera para reabrir cualquier cosa ─
  // Una cita ya atendida es definitiva: forzar la URL no debe revivirla.
  await ejecutar(`update citas set estado = 'ATENDIDA' where id = '${CITA}'`);
  await pagina.goto(`${BASE_URL}/agenda?fecha=${manana}&cancelada=${CITA}`);
  await pagina.getByRole("button", { name: "Deshacer" }).click();
  texto = await esperarTexto(pagina, "ya no está cancelada");
  comprobar(
    "Una cita ya atendida no se reabre ni forzando la dirección",
    texto.includes("ya no está cancelada") && (await estadoDe(CITA)) === "ATENDIDA",
    `${texto.slice(0, 150)} / estado ${await estadoDe(CITA)}`,
  );

  await navegador.close();
  await limpiar();
});
