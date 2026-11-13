/**
 * Datos de prueba. Idempotente: se puede correr mil veces.
 *
 * Todo lo que crea lleva el prefijo `prueba-` en el id, así que es fácil de
 * reconocer y de borrar, y ninguna prueba toca una fila que no haya creado
 * ella. Los correos usan el dominio `.test`, reservado por norma (RFC 2606):
 * nunca va a existir de verdad, así que un correo que se escape no llega a
 * nadie.
 *
 *   node pruebas/sembrar.mjs
 */

import { ejecutar, consultar, cerrarBase, exigirBaseLocal } from "./entorno.mjs";

exigirBaseLocal();

export const ORG = "prueba-org";
export const ORG_EQUIPO = "prueba-org-equipo";
export const USUARIO = "prueba-usr";
export const USUARIO_EQUIPO = "prueba-usr-equipo";
export const MEDICO = "prueba-med";
export const PACIENTE = "prueba-pac";
export const PACIENTE_2 = "prueba-pac-2";
export const SUSCRIPCION = "prueba-sus";
export const FICHA_DIRECTORIO = "prueba-ficha-directorio";

export const EMAIL_MEDICO = "medica@conxulty.test";
export const EMAIL_EQUIPO = "equipo@conxulty.test";

/**
 * Borra lo que hayan dejado corridas anteriores, en orden de dependencia.
 *
 * El orden importa y no es obvio: `registros_trazabilidad` apunta a
 * `usuarios`, así que cualquier acción que deje huella de auditoría —casi
 * todas— bloquea el borrado del usuario si no se limpia antes. Si agregás
 * una tabla nueva que cuelgue de la organización, va en esta lista.
 */
export async function limpiar() {
  const orgs = `('${ORG}', '${ORG_EQUIPO}')`;
  for (const sql of [
    `delete from consultas where "organizacionId" in ${orgs}`,
    `delete from documentos where "organizacionId" in ${orgs}`,
    `delete from cobros where "organizacionId" in ${orgs}`,
    `delete from antecedentes_medicos where "organizacionId" in ${orgs}`,
    `delete from movimientos_caja where "organizacionId" in ${orgs}`,
    `delete from gastos where "organizacionId" in ${orgs}`,
    `delete from cajas where "organizacionId" in ${orgs}`,
    `delete from citas where "organizacionId" in ${orgs}`,
    `delete from pagos where "organizacionId" in ${orgs}`,
    `delete from suscripciones where "organizacionId" in ${orgs}`,
    `delete from pacientes where "organizacionId" in ${orgs}`,
    `delete from sedes where "organizacionId" in ${orgs}`,
    `delete from registros_trazabilidad where "organizacionId" in ${orgs}`,
    `delete from entidades where "organizacionId" in ${orgs}`,
    `delete from tokens_recuperacion where "usuarioId" in (select id from usuarios where "organizacionId" in ${orgs})`,
    `delete from medicos where "organizacionId" in ${orgs}`,
    `delete from usuarios where "organizacionId" in ${orgs}`,
    `delete from organizaciones where id in ${orgs}`,
  ]) {
    await ejecutar(sql);
  }
}

export async function sembrar() {
  await limpiar();

  await ejecutar(`
    insert into organizaciones (id, nombre, plan, "fichaDirectorioId", "fichaDirectorioSincronizada", "updatedAt")
    values ('${ORG}', 'Consultorio de prueba', 'FICHA', '${FICHA_DIRECTORIO}', true, now())`);

  // El equipo (SUPERADMIN) vive en su propia organización, igual que en producción.
  await ejecutar(`
    insert into organizaciones (id, nombre, plan, "updatedAt")
    values ('${ORG_EQUIPO}', 'Equipo Conxulty', 'PRO', now())`);

  await ejecutar(`
    insert into usuarios (id, "organizacionId", nombre, email, "passwordHash", rol, "updatedAt")
    values ('${USUARIO}', '${ORG}', 'Dra. de Prueba', '${EMAIL_MEDICO}', 'no-se-usa', 'MEDICO', now()),
           ('${USUARIO_EQUIPO}', '${ORG_EQUIPO}', 'Equipo', '${EMAIL_EQUIPO}', 'no-se-usa', 'SUPERADMIN', now())`);

  await ejecutar(`
    insert into medicos (id, "usuarioId", "organizacionId", especialidad, profesion, modalidades, "telefonoPublico", "updatedAt")
    values ('${MEDICO}', '${USUARIO}', '${ORG}', 'Medicina general', 'MEDICO',
            ARRAY['PRESENCIAL']::"ModalidadAtencion"[], '04121112233', now())`);

  await ejecutar(`
    insert into pacientes (id, "organizacionId", nombre, apellido, telefono, "updatedAt")
    values ('${PACIENTE}', '${ORG}', 'Ana', 'Pérez', '04121112233', now()),
           ('${PACIENTE_2}', '${ORG}', 'Luis', 'Gómez', '04121112244', now())`);

  // Mes gratis en curso: es el estado en el que nace toda cuenta nueva.
  await ejecutar(`
    insert into suscripciones (id, "organizacionId", estado, "inicioPeriodoActual", "finPeriodoActual", "updatedAt")
    values ('${SUSCRIPCION}', '${ORG}', 'PRUEBA', now(), now() + interval '30 days', now())`);
}

/** Una cita de mañana, a una hora que siempre cae dentro de lo razonable. */
export async function crearCita(id, pacienteId, estado = "PENDIENTE", horaVenezuela = 9) {
  await ejecutar(`
    insert into citas (id, "organizacionId", "pacienteId", "medicoId", "fechaHora", "duracionMinutos", estado, modalidad, motivo, "updatedAt")
    values ('${id}', '${ORG}', '${pacienteId}', '${MEDICO}',
            (current_date + 1 + time '${String(horaVenezuela).padStart(2, "0")}:00') at time zone 'America/Caracas',
            30, '${estado}', 'PRESENCIAL', 'Control', now())`);
  const [fila] = await consultar(`select "fechaHora" from citas where id = '${id}'`);
  return fila.fechaHora;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await sembrar();
  console.log("✓ Datos de prueba listos.");
  await cerrarBase();
}
