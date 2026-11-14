/**
 * Segunda revisión del núcleo clínico: lo que un médico puede hacer por
 * error y de lo que antes no podía volver.
 *
 * POR QUÉ ESTE FLUJO: la primera auditoría miró si los datos estaban bien
 * guardados y aislados. Esta miró lo otro — qué pasa cuando el médico se
 * equivoca de botón. Cada bloque de acá es un error de un clic que antes
 * era irreversible o que perdía lo escrito sin avisar:
 *
 *  - Cerrar la consulta sin haber pulsado Guardar: se perdía la nota y la
 *    consulta quedaba sellada vacía.
 *  - Desactivar una alergia: desaparecía sin dejar señal ni vuelta atrás.
 *  - Doble clic en "Iniciar consulta": consultas vacías duplicadas.
 *  - Anular una consulta nacida de una cita: la cita quedaba bloqueada.
 *
 *   node pruebas/revision2.test.mjs
 */

import {
  BASE_URL,
  comprobar,
  correr,
  ejecutar,
  esperarEnBase,
  exigirAppViva,
  navegadorConSesion,
  valor,
} from "./entorno.mjs";
import { EMAIL_MEDICO, MEDICO, ORG, PACIENTE, PACIENTE_2, USUARIO, crearCita, limpiar, sembrar } from "./sembrar.mjs";

const contar = async (sql) => Number(await valor(sql));

await correr("Errores de un clic en el núcleo clínico", async () => {
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

  /** Envía el formulario que contiene `selector`, como lo haría el navegador. */
  async function enviar(selector, valores = {}, boton = null) {
    await pagina.locator(selector).first().waitFor({ state: "attached", timeout: 10000 });
    await pagina.evaluate(
      ([sel, vals, btn]) => {
        const form = document.querySelector(sel).closest("form");
        for (const [nombre, v] of Object.entries(vals)) {
          const campo = form.querySelector(`[name="${nombre}"]`);
          if (campo) campo.value = v;
        }
        const submitter = btn
          ? [...form.querySelectorAll("button")].find((b) => b.textContent.includes(btn))
          : undefined;
        form.requestSubmit(submitter);
      },
      [selector, valores, boton],
    );
    await pagina.waitForTimeout(1800);
  }

  const iniciarSinCita = async (pacienteId = PACIENTE) => {
    await pagina.goto(`${BASE_URL}/pacientes/${pacienteId}`);
    await pagina.getByRole("button", { name: "Iniciar consulta" }).first().click();
    await pagina.waitForURL(/\/consultas\//, { timeout: 10000 });
    return pagina.url().split("/consultas/")[1].split(/[/?]/)[0];
  };

  // ── 1. Cerrar guarda lo escrito ───────────────────────────────────
  const c1 = await iniciarSinCita();
  await enviar('textarea[name="diagnostico"]', { diagnostico: "Migraña sin aura", motivoConsulta: "Cefalea" }, "cerrar");
  comprobar(
    "Cerrar sin pulsar Guardar NO pierde la nota",
    (await esperarEnBase(`select diagnostico from consultas where id = '${c1}'`, "Migraña sin aura")) === "Migraña sin aura",
    await valor(`select coalesce(diagnostico,'(vacío)') from consultas where id = '${c1}'`),
  );
  comprobar("Y la consulta queda cerrada", (await valor(`select estado from consultas where id = '${c1}'`)) === "CERRADA");

  // ── 6. Una cerrada se corrige agregando, no editando ──────────────
  await pagina.goto(`${BASE_URL}/consultas/${c1}`);
  await enviar('textarea[name="textoAclaratoria"]', { textoAclaratoria: "El diagnóstico correcto es cefalea tensional." });
  comprobar(
    "Se puede agregar una nota aclaratoria a una consulta cerrada",
    (await contar(`select count(*) from notas_aclaratorias where "consultaId" = '${c1}'`)) === 1,
  );
  comprobar(
    "Sin tocar lo que estaba escrito",
    (await valor(`select diagnostico from consultas where id = '${c1}'`)) === "Migraña sin aura",
  );

  // ── 3. Doble clic no duplica ──────────────────────────────────────
  await ejecutar(`delete from notas_aclaratorias where "organizacionId" = '${ORG}'`);
  await ejecutar(`delete from consultas where "organizacionId" = '${ORG}'`);
  const a = await iniciarSinCita();
  const b = await iniciarSinCita();
  comprobar("Iniciar consulta dos veces continúa la misma", a === b, `${a} vs ${b}`);
  comprobar(
    "Y en la historia hay una sola",
    (await contar(`select count(*) from consultas where "pacienteId" = '${PACIENTE}'`)) === 1,
  );
  await ejecutar(`update consultas set "createdAt" = now() - interval '3 days' where id = '${a}'`);
  const c = await iniciarSinCita();
  comprobar("Pero una que quedó abierta hace días NO se reutiliza: es otra visita", c !== a, `${c} vs ${a}`);

  // ── 9. Un envío sin los signos vitales no los borra ───────────────
  await ejecutar(`update consultas set temperatura = 37.5 where id = '${c}'`);
  await pagina.goto(`${BASE_URL}/consultas/${c}`);
  await pagina.evaluate(() => document.querySelector('[name="temperatura"]').remove());
  await enviar('textarea[name="diagnostico"]', { diagnostico: "Gripe" }, "Guardar");
  await esperarEnBase(`select diagnostico from consultas where id = '${c}'`, "Gripe");
  comprobar(
    "Guardar sin el campo de temperatura conserva la que había",
    Number(await valor(`select temperatura from consultas where id = '${c}'`)) === 37.5,
    await valor(`select coalesce(temperatura::text,'(borrada)') from consultas where id = '${c}'`),
  );

  // ── 4. Anular libera la cita ──────────────────────────────────────
  await ejecutar(`delete from consultas where "organizacionId" = '${ORG}'`);
  await crearCita("prueba-cita-r2", PACIENTE, "CONFIRMADA", 10);
  await ejecutar(`
    insert into consultas (id, "organizacionId", "pacienteId", "medicoId", "citaId", estado, "updatedAt")
    values ('prueba-c-cita', '${ORG}', '${PACIENTE}', '${MEDICO}', 'prueba-cita-r2', 'EN_CURSO', now())`);
  await pagina.goto(`${BASE_URL}/consultas/prueba-c-cita`);
  await pagina.locator("summary", { hasText: "Anular esta consulta" }).click();
  await enviar('input[name="motivoAnulacion"]', { motivoAnulacion: "Se abrió antes de tiempo" });
  comprobar(
    "La consulta anulada suelta su cita",
    (await esperarEnBase(`select "citaId" is null from consultas where id = 'prueba-c-cita'`, "true")) === true,
  );
  comprobar(
    "Y la auditoría recuerda cuál era",
    String(await valor(`select cambios::text from registros_trazabilidad where accion = 'anular_consulta' and "entidadId" = 'prueba-c-cita'`)).includes("prueba-cita-r2"),
  );

  // ── 5. La cita tiene que ser del mismo paciente ───────────────────
  await pagina.goto(`${BASE_URL}/pacientes/${PACIENTE_2}`);
  await pagina.evaluate(() => {
    const form = [...document.querySelectorAll("form")].find((f) =>
      [...f.querySelectorAll("button")].some((b) => b.textContent.includes("Iniciar consulta")),
    );
    let campo = form.querySelector('[name="citaId"]');
    if (!campo) {
      campo = document.createElement("input");
      campo.type = "hidden";
      campo.name = "citaId";
      form.appendChild(campo);
    }
    campo.value = "prueba-cita-r2";
    form.requestSubmit();
  });
  await pagina.waitForTimeout(2000);
  comprobar(
    "No se puede abrir la consulta de un paciente sobre la cita de otro",
    (await contar(`select count(*) from consultas where "pacienteId" = '${PACIENTE_2}'`)) === 0,
  );

  // ── 2 y 8. Antecedentes: desactivar tiene vuelta, corregir no pisa ─
  await ejecutar(`delete from antecedentes_medicos where "organizacionId" = '${ORG}'`);
  await ejecutar(`
    insert into antecedentes_medicos (id, "organizacionId", "pacienteId", "medicoId", tipo, descripcion, "updatedAt")
    values ('prueba-alergia', '${ORG}', '${PACIENTE}', '${MEDICO}', 'ALERGIA', 'Alergia a penicilina', now())`);

  await pagina.goto(`${BASE_URL}/pacientes/${PACIENTE}?tab=antecedentes`);
  await pagina.getByRole("button", { name: "Desactivar" }).first().click();
  await esperarEnBase(`select activo from antecedentes_medicos where id = 'prueba-alergia'`, "false");
  await pagina.goto(`${BASE_URL}/pacientes/${PACIENTE}?tab=antecedentes`);
  const texto = (await pagina.locator("main").innerText()).replace(/\s+/g, " ");
  comprobar("Una alergia desactivada sigue a la vista, en «Ya no vigentes»", texto.includes("Ya no vigentes (1)"), texto.slice(0, 200));

  await pagina.locator("summary", { hasText: "Ya no vigentes" }).click();
  await pagina.getByRole("button", { name: "Reactivar" }).first().click();
  comprobar(
    "Y se puede reactivar",
    (await esperarEnBase(`select activo from antecedentes_medicos where id = 'prueba-alergia'`, "true")) === true,
  );

  await pagina.goto(`${BASE_URL}/pacientes/${PACIENTE}?tab=antecedentes`);
  await enviar('input[name="antecedenteId"][value="prueba-alergia"] ~ textarea[name="descripcion"], form:has(input[value="prueba-alergia"]) textarea[name="descripcion"]', { descripcion: "Alergia a sulfas" });
  await esperarEnBase(`select count(*) from antecedentes_medicos where "pacienteId" = '${PACIENTE}'`, 2);
  comprobar(
    "Corregir un antecedente conserva lo que decía antes",
    (await valor(`select descripcion from antecedentes_medicos where id = 'prueba-alergia'`)) === "Alergia a penicilina" &&
      (await valor(`select "reemplazadoPorId" is not null from antecedentes_medicos where id = 'prueba-alergia'`)) === true,
    await valor(`select descripcion from antecedentes_medicos where id = 'prueba-alergia'`),
  );
  comprobar(
    "Y queda una sola versión vigente, con el texto nuevo",
    (await valor(`select string_agg(descripcion, '|') from antecedentes_medicos where "pacienteId" = '${PACIENTE}' and activo`)) === "Alergia a sulfas",
    await valor(`select string_agg(descripcion, '|') from antecedentes_medicos where "pacienteId" = '${PACIENTE}' and activo`),
  );

  // ── 7. Un error al emitir la receta no borra lo tecleado ──────────
  await ejecutar(`
    insert into consultas (id, "organizacionId", "pacienteId", "medicoId", estado, "updatedAt")
    values ('prueba-c-receta', '${ORG}', '${PACIENTE}', '${MEDICO}', 'EN_CURSO', now())`);
  await pagina.goto(`${BASE_URL}/consultas/prueba-c-receta/documentos/nueva`);
  await pagina.locator('[name="medicamentoNombre1"]').fill("Ibuprofeno 400 mg");
  await pagina.locator('[name="medicamentoNombre1"]').press("Enter");
  await pagina.waitForURL(/error=/, { timeout: 10000 });
  await pagina.waitForTimeout(800);
  comprobar(
    "La receta rechazada vuelve con lo que el médico había escrito",
    (await pagina.locator('[name="medicamentoNombre1"]').inputValue()) === "Ibuprofeno 400 mg",
    await pagina.locator('[name="medicamentoNombre1"]').inputValue(),
  );

  // ── 10. La misma cédula escrita distinto es el mismo paciente ─────
  await pagina.goto(`${BASE_URL}/pacientes/${PACIENTE}/editar`);
  await enviar('input[name="documentoIdentidad"]', { documentoIdentidad: "v-12.345.678" });
  comprobar(
    "La cédula se guarda en una sola forma",
    (await esperarEnBase(`select "documentoIdentidad" from pacientes where id = '${PACIENTE}'`, "V12345678")) === "V12345678",
    await valor(`select "documentoIdentidad" from pacientes where id = '${PACIENTE}'`),
  );
  await pagina.goto(`${BASE_URL}/pacientes/${PACIENTE_2}/editar`);
  await enviar('input[name="documentoIdentidad"]', { documentoIdentidad: "12345678" });
  comprobar(
    "Y otro paciente no puede quedarse con la misma, escrita sin la V",
    (await valor(`select "documentoIdentidad" from pacientes where id = '${PACIENTE_2}'`)) === null,
    await valor(`select "documentoIdentidad" from pacientes where id = '${PACIENTE_2}'`),
  );

  await navegador.close();
  for (const t of ["notas_aclaratorias", "documentos", "consultas", "antecedentes_medicos", "citas"]) {
    await ejecutar(`delete from ${t} where "organizacionId" = '${ORG}'`);
  }
  await limpiar();
});
