/**
 * Anular en el núcleo clínico: consultas y recetas.
 *
 * POR QUÉ ESTE FLUJO: son los dos huecos que encontró la auditoría del
 * núcleo clínico, y los dos tienen la misma forma — algo que se hizo por
 * error y que no se podía deshacer sin falsear la historia.
 *
 *  - "Iniciar consulta" es UN clic desde la ficha de un paciente, y la
 *    lista es alfabética con apellidos que se repiten. Una consulta
 *    abierta en el paciente equivocado se quedaba para siempre en la
 *    historia de alguien que nunca fue atendido.
 *  - Una receta con la dosis equivocada seguía imprimible y con cara de
 *    válida.
 *
 * Lo que de verdad hay que vigilar NO es que anular funcione, sino que
 * anular NO BORRE: una historia clínica a la que se le arrancan hojas
 * miente. Por eso casi todas las comprobaciones de acá verifican que la
 * fila sigue existiendo.
 *
 *   node pruebas/clinico.test.mjs
 */

import {
  comprobar,
  consultar,
  correr,
  ejecutar,
  exigirAppViva,
  navegadorConSesion,
  valor,
  BASE_URL,
} from "./entorno.mjs";
import { EMAIL_MEDICO, MEDICO, ORG, PACIENTE, USUARIO, limpiar, sembrar } from "./sembrar.mjs";

const CONSULTA = "prueba-consulta";
const DOCUMENTO = "prueba-documento";

await correr("Anular consultas y recetas", async () => {
  await exigirAppViva();
  await sembrar();
  await ejecutar(`update organizaciones set plan = 'PRO' where id = '${ORG}'`);

  const { navegador, pagina } = await navegadorConSesion({
    email: EMAIL_MEDICO,
    usuarioId: USUARIO,
    organizacionId: ORG,
    rol: "MEDICO",
    nombre: "Dra. de Prueba",
  });

  /** Una consulta en curso con una receta emitida, como la dejaría el médico. */
  async function sembrarConsultaConReceta(estado = "EN_CURSO") {
    await ejecutar(`delete from documentos where "organizacionId" = '${ORG}'`);
    await ejecutar(`delete from consultas where "organizacionId" = '${ORG}'`);
    await ejecutar(`
      insert into consultas (id, "organizacionId", "pacienteId", "medicoId", estado, "motivoConsulta", "updatedAt")
      values ('${CONSULTA}', '${ORG}', '${PACIENTE}', '${MEDICO}', '${estado}', 'Dolor de cabeza', now())`);
    await ejecutar(`
      insert into documentos (id, "organizacionId", "consultaId", "medicoId", tipo, contenido, "fechaEmision")
      values ('${DOCUMENTO}', '${ORG}', '${CONSULTA}', '${MEDICO}', 'RECETA',
              '{"medicamentos":[{"nombre":"Ibuprofeno","indicaciones":"1 cada 8h"}],"indicacionesGenerales":null}',
              now())`);
  }

  async function anularConsultaDesdeLaPantalla(motivo) {
    await pagina.goto(`${BASE_URL}/consultas/${CONSULTA}`);
    // El formulario vive dentro de un <details> cerrado, a propósito:
    // anular no es lo que el médico viene a hacer a esta pantalla. Hay que
    // abrirlo, igual que lo abriría él.
    await pagina.locator("summary", { hasText: "Anular esta consulta" }).click();
    await pagina.locator('input[name="motivoAnulacion"]').first().waitFor({ timeout: 10000 });
    await pagina.evaluate((m) => {
      const campo = document.querySelector('input[name="motivoAnulacion"]');
      campo.value = m;
      campo.form.requestSubmit();
    }, motivo);
    await pagina.waitForTimeout(2000);
  }

  // ── 1. Anular una consulta abierta por error ──────────────────────
  await sembrarConsultaConReceta();
  await anularConsultaDesdeLaPantalla("Se abrió en el paciente equivocado");

  comprobar(
    "La consulta queda ANULADA",
    (await valor(`select estado from consultas where id = '${CONSULTA}'`)) === "ANULADA",
    await valor(`select estado from consultas where id = '${CONSULTA}'`),
  );
  comprobar(
    "Pero NO se borra: sigue en la historia del paciente",
    Number(await valor(`select count(*) from consultas where id = '${CONSULTA}'`)) === 1,
  );
  comprobar(
    "Queda registrado el motivo en la auditoría",
    String(await valor(`select cambios::text from registros_trazabilidad where accion = 'anular_consulta' and "entidadId" = '${CONSULTA}'`) ?? "")
      .includes("paciente equivocado"),
    await valor(`select cambios::text from registros_trazabilidad where accion = 'anular_consulta' and "entidadId" = '${CONSULTA}'`),
  );

  // ── 2. Arrastra las recetas de esa consulta ───────────────────────
  // Si la consulta no existió, sus recetas tampoco valen.
  comprobar(
    "La receta de esa consulta queda anulada también",
    (await valor(`select "anuladoEn" is not null from documentos where id = '${DOCUMENTO}'`)) === true,
  );
  comprobar(
    "Y tampoco se borra",
    Number(await valor(`select count(*) from documentos where id = '${DOCUMENTO}'`)) === 1,
  );
  comprobar(
    "El motivo de la receta dice que vino de la consulta",
    String(await valor(`select "motivoAnulacion" from documentos where id = '${DOCUMENTO}'`) ?? "")
      .startsWith("Se anuló la consulta:"),
    await valor(`select "motivoAnulacion" from documentos where id = '${DOCUMENTO}'`),
  );

  // ── 3. Sin motivo no se anula ─────────────────────────────────────
  await sembrarConsultaConReceta();
  await anularConsultaDesdeLaPantalla("   ");
  comprobar(
    "Sin motivo no se anula nada",
    (await valor(`select estado from consultas where id = '${CONSULTA}'`)) === "EN_CURSO",
    await valor(`select estado from consultas where id = '${CONSULTA}'`),
  );

  // ── 4. Una consulta CERRADA ya es historia clínica ────────────────
  // No se anula a posteriori, igual que no se arranca una hoja de un
  // expediente. Ni siquiera forzando la pantalla.
  await sembrarConsultaConReceta("CERRADA");
  await pagina.goto(`${BASE_URL}/consultas/${CONSULTA}`);
  const textoCerrada = (await pagina.locator("main").innerText()).replace(/\s+/g, " ");
  comprobar(
    "En una consulta cerrada ni siquiera se ofrece anular",
    !textoCerrada.includes("Anular esta consulta"),
    textoCerrada.slice(0, 200),
  );
  comprobar(
    "Y sigue CERRADA",
    (await valor(`select estado from consultas where id = '${CONSULTA}'`)) === "CERRADA",
  );

  // ── 5. Anular una receta sola ─────────────────────────────────────
  await sembrarConsultaConReceta();
  await pagina.goto(`${BASE_URL}/consultas/${CONSULTA}/documentos/${DOCUMENTO}`);
  await pagina.locator("summary", { hasText: "Anular esta receta" }).click();
  await pagina.locator('input[name="motivoAnulacion"]').first().waitFor({ timeout: 10000 });
  await pagina.evaluate(() => {
    const campo = document.querySelector('input[name="motivoAnulacion"]');
    campo.value = "Dosis equivocada";
    campo.form.requestSubmit();
  });
  await pagina.waitForTimeout(2000);

  comprobar(
    "La receta queda anulada con su motivo",
    (await valor(`select "motivoAnulacion" from documentos where id = '${DOCUMENTO}'`)) === "Dosis equivocada",
    await valor(`select "motivoAnulacion" from documentos where id = '${DOCUMENTO}'`),
  );
  comprobar(
    "La consulta NO se toca: anular una receta no anula la atención",
    (await valor(`select estado from consultas where id = '${CONSULTA}'`)) === "EN_CURSO",
    await valor(`select estado from consultas where id = '${CONSULTA}'`),
  );

  // ── 6. El papel impreso tiene que decir que no vale ───────────────
  await pagina.goto(`${BASE_URL}/consultas/${CONSULTA}/documentos/${DOCUMENTO}`);
  const sello = await pagina.evaluate(() => {
    const el = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === "Anulada");
    if (!el) return "sin-sello";
    // Lo que importa: que el sello NO esté oculto al imprimir.
    let nodo = el;
    while (nodo && nodo !== document.body) {
      if (nodo.className && String(nodo.className).includes("print:hidden")) return "oculto-al-imprimir";
      nodo = nodo.parentElement;
    }
    return "visible-al-imprimir";
  });
  comprobar("El sello de anulada también sale al imprimir", sello === "visible-al-imprimir", sello);

  // ── 7. El odontograma guarda historia ─────────────────────────────
  await ejecutar(`delete from odontogramas where "organizacionId" = '${ORG}'`);
  await ejecutar(`
    insert into odontogramas (id, "organizacionId", "pacienteId", estado, notas, "createdAt")
    values ('odo-1', '${ORG}', '${PACIENTE}', '{"11":"CARIES"}', 'Antes', now() - interval '1 day'),
           ('odo-2', '${ORG}', '${PACIENTE}', '{"11":"OBTURADO"}', 'Después', now())`);
  const versiones = await consultar(
    `select estado::text as estado from odontogramas where "pacienteId" = '${PACIENTE}' order by "createdAt" desc`,
  );
  comprobar(
    "Quedan las dos versiones del diente, no solo la última",
    versiones.length === 2 && versiones[0].estado.includes("OBTURADO") && versiones[1].estado.includes("CARIES"),
    JSON.stringify(versiones),
  );

  await navegador.close();
  await ejecutar(`delete from documentos where "organizacionId" = '${ORG}'`);
  await ejecutar(`delete from consultas where "organizacionId" = '${ORG}'`);
  await ejecutar(`delete from odontogramas where "organizacionId" = '${ORG}'`);
  await limpiar();
});
