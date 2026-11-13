/**
 * Crear y editar citas desde la agenda del médico (no desde el Directorio).
 *
 * POR QUÉ ESTE FLUJO: es el corazón del OS, lo que el médico usa todos los
 * días. La reserva pública ya tenía sus pruebas; esto no tenía ninguna.
 *
 * Lo que cubre de verdad son los casos que no se ven usando el producto
 * normal, porque el navegador los evita — pero una Server Action es un
 * endpoint público y recibe lo que le manden:
 *
 *  - Una hora como "99:99" pasa cualquier validación de formato y el
 *    constructor de Date la DESBORDA en silencio a otro día: el paciente
 *    quedaba citado cuatro días después sin un solo error.
 *  - Una duración mayor a 480 minutos rompe la detección de choques, que
 *    busca en una ventana de ese tamaño. Dos pacientes a la misma hora y
 *    nadie avisa.
 *
 *   node pruebas/citas-os.test.mjs
 */

import { comprobar, correr, ejecutar, exigirAppViva, navegadorConSesion, valor, BASE_URL } from "./entorno.mjs";
import { EMAIL_MEDICO, ORG, PACIENTE, PACIENTE_2, USUARIO, limpiar, sembrar } from "./sembrar.mjs";

const citasDe = async (dia) =>
  Number(await valor(`select count(*) from citas where "organizacionId" = '${ORG}' and ("fechaHora" at time zone 'America/Caracas')::date = '${dia}'`));

await correr("Crear y editar citas desde el OS", async () => {
  await exigirAppViva();
  await sembrar();

  const { navegador, pagina } = await navegadorConSesion({
    email: EMAIL_MEDICO,
    usuarioId: USUARIO,
    organizacionId: ORG,
    rol: "MEDICO",
    nombre: "Dra. de Prueba",
  });

  const manana = await valor(`select to_char(current_date + 1, 'YYYY-MM-DD')`);

  /**
   * Llena el formulario real de nueva cita y lo envía.
   *
   * Los valores se escriben directo en los <input> con JS, saltándose la
   * validación del navegador: justo lo que hace falta para probar "99:99",
   * que un <input type="time"> nunca dejaría escribir pero una Server
   * Action sí puede recibir. El envío va por `requestSubmit()`, que es el
   * del navegador — así la petición sale igual que la de un médico de
   * verdad, con todo lo que Next necesita para ejecutar la acción.
   */
  async function crear({ fecha, hora, duracion = "60", pacienteId = PACIENTE }) {
    await pagina.goto(`${BASE_URL}/agenda/nueva?fecha=${manana}&pacienteId=${pacienteId}`);
    try {
      await pagina.locator('input[name="hora"]').waitFor({ timeout: 8000 });
    } catch {
      // Que el formulario ni siquiera aparezca es un resultado válido: es
      // lo que pasa con un paciente de otra organización. Nada que enviar.
      return "sin-formulario";
    }
    await pagina.evaluate(
      ([f, h, d]) => {
        const form = document.querySelector('input[name="hora"]').form;
        form.querySelector('input[name="fecha"]').value = f;
        form.querySelector('input[name="hora"]').value = h;
        form.querySelector('input[name="duracionMinutos"]').value = d;
        form.requestSubmit();
      },
      [fecha, hora, duracion],
    );
    await pagina.waitForTimeout(1500);
    return "enviado";
  }

  // ── 1. Lo normal sigue funcionando ────────────────────────────────
  const antes = await citasDe(manana);
  await crear({ fecha: manana, hora: "09:00" });
  const despues = await citasDe(manana);
  comprobar("Se puede crear una cita normal", despues === antes + 1, `${antes} → ${despues}`);

  // ── 2. No se puede montar dos pacientes a la misma hora ───────────
  await crear({ fecha: manana, hora: "09:00", pacienteId: PACIENTE_2 });
  comprobar(
    "No deja dos pacientes en el mismo horario",
    (await citasDe(manana)) === antes + 1,
    `quedaron ${await citasDe(manana)}`,
  );

  // ── 3. EL CASO QUE IMPORTA: una hora imposible ────────────────────
  // "99:99" pasa el formato y Date la desborda: antes creaba la cita
  // cuatro días más adelante, sin error.
  await ejecutar(`delete from citas where "organizacionId" = '${ORG}'`);
  await crear({ fecha: manana, hora: "99:99" });
  comprobar(
    'Una hora imposible ("99:99") no crea ninguna cita',
    Number(await valor(`select count(*) from citas where "organizacionId" = '${ORG}'`)) === 0,
    `${await valor(`select count(*) from citas where "organizacionId" = '${ORG}'`)} citas creadas`,
  );

  // ── 4. Una fecha imposible tampoco ────────────────────────────────
  await crear({ fecha: "2026-13-45", hora: "09:00" });
  comprobar(
    'Una fecha imposible ("2026-13-45") no crea ninguna cita',
    Number(await valor(`select count(*) from citas where "organizacionId" = '${ORG}'`)) === 0,
    `${await valor(`select count(*) from citas where "organizacionId" = '${ORG}'`)} citas creadas`,
  );

  // ── 5. Una duración fuera de rango no entra ───────────────────────
  // Si entrara, la detección de choques dejaría de verla.
  await crear({ fecha: manana, hora: "10:00", duracion: "600" });
  comprobar(
    "Una duración de 600 minutos no entra (rompería la detección de choques)",
    Number(await valor(`select count(*) from citas where "organizacionId" = '${ORG}'`)) === 0,
    await valor(`select coalesce(max("duracionMinutos"),0) from citas where "organizacionId" = '${ORG}'`),
  );

  await crear({ fecha: manana, hora: "10:00", duracion: "0" });
  comprobar(
    "Una duración de 0 minutos tampoco",
    Number(await valor(`select count(*) from citas where "organizacionId" = '${ORG}'`)) === 0,
  );

  // ── 6. Una cita no se le puede robar a otra organización ──────────
  await ejecutar(`
    insert into organizaciones (id, nombre, plan, "updatedAt") values ('prueba-org-ajena', 'Ajena', 'FICHA', now())
    on conflict (id) do nothing`);
  await ejecutar(`
    insert into pacientes (id, "organizacionId", nombre, apellido, telefono, "updatedAt")
    values ('prueba-pac-ajeno', 'prueba-org-ajena', 'Ajeno', 'Ajeno', '04120000000', now())
    on conflict (id) do nothing`);
  const ajeno = await crear({ fecha: manana, hora: "11:00", pacienteId: "prueba-pac-ajeno" });
  comprobar(
    "Con un paciente de otra organización ni se abre el formulario",
    ajeno === "sin-formulario",
    ajeno,
  );
  comprobar(
    "Y no queda ninguna cita suya",
    Number(await valor(`select count(*) from citas where "pacienteId" = 'prueba-pac-ajeno'`)) === 0,
  );
  await ejecutar(`delete from pacientes where id = 'prueba-pac-ajeno'`);
  await ejecutar(`delete from organizaciones where id = 'prueba-org-ajena'`);

  // ── 7. Un paciente archivado no se puede citar ────────────────────
  await ejecutar(`update pacientes set activo = false where id = '${PACIENTE}'`);
  await crear({ fecha: manana, hora: "12:00" });
  comprobar(
    "No se puede citar a un paciente archivado",
    Number(await valor(`select count(*) from citas where "organizacionId" = '${ORG}'`)) === 0,
  );
  await ejecutar(`update pacientes set activo = true where id = '${PACIENTE}'`);

  await navegador.close();
  await limpiar();
});
