import type { EstadoCita, ModalidadCita } from "@prisma/client";
import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { validarConsistenciaCita } from "@/db/consistenciaOrganizacional";
import { PacienteArchivadoError } from "@/modules/core/pacientes";
import {
  ESTADOS_ACTIVOS,
  TRANSICIONES_PERMITIDAS,
  type EstadoCitaAccionable,
} from "@/modules/core/citasEstado";

/**
 * Casos de uso de Cita. Toda lectura y escritura va scoped por
 * organizacionId + medicoId de la sesión, nunca por medicoId enviado por el
 * cliente.
 *
 * La matriz de transiciones de estado (`ESTADOS_ACTIVOS`,
 * `TRANSICIONES_PERMITIDAS`, `EstadoCitaAccionable`) vive en
 * `citasEstado.ts`, no aquí (ver ese archivo) — este módulo importa prisma
 * y no puede llegar nunca a un Client Component.
 */

// 09/11 — alineado a 60 (antes 30) a pedido del usuario: las consultas duran
// 1h en la práctica, y el directorio público (conxulty.com, repo vitalud)
// ya usa 60min como el tamaño de turno de su grilla de día×hora — con este
// valor en 30 una reserva pública a las 9:00 no bloqueaba hasta las 10:00,
// dejando un choque de horario sin detectar entre 9:30 y 10:00.
export const DURACION_MINUTOS_DEFECTO = 60;
/**
 * Cota superior de duración. Nació como una optimización para acotar la
 * ventana de la consulta de conflictos (ver `hayConflictoHorario`), pero
 * NO es opcional: si una cita durara más que esto, `hayConflictoHorario`
 * dejaría de verla y se podrían montar dos pacientes a la misma hora sin
 * que nada avise.
 *
 * 13-nov-2026 (auditoría Bloque 3): esa invariante se cumplía de casualidad
 * —el `max(480)` de un zod en agenda/actions.ts— y nada ataba los dos
 * números. Subir el máximo del formulario habría roto la detección de
 * choques en silencio. Ahora se valida acá, que es el borde real.
 */
export const DURACION_MINUTOS_MAXIMA = 480;
export const DURACION_MINUTOS_MINIMA = 5;

export class CitaDuracionInvalidaError extends Error {
  constructor() {
    super(
      `La duración de una cita tiene que estar entre ${DURACION_MINUTOS_MINIMA} y ${DURACION_MINUTOS_MAXIMA} minutos.`,
    );
    this.name = "CitaDuracionInvalidaError";
  }
}

function exigirDuracionValida(duracionMinutos: number): void {
  if (
    !Number.isInteger(duracionMinutos) ||
    duracionMinutos < DURACION_MINUTOS_MINIMA ||
    duracionMinutos > DURACION_MINUTOS_MAXIMA
  ) {
    throw new CitaDuracionInvalidaError();
  }
}

const ESTADOS_QUE_BLOQUEAN_HORARIO: EstadoCita[] = [
  "PENDIENTE",
  "CONFIRMADA",
  "ATENDIDA",
];

const ACCION_TRAZABILIDAD_POR_ESTADO: Record<EstadoCitaAccionable, string> = {
  CONFIRMADA: "confirmar_cita",
  CANCELADA: "cancelar_cita",
  ATENDIDA: "marcar_atendida",
  NO_ASISTIO: "marcar_no_asistio",
};

export class CitaNoCanceladaError extends Error {
  constructor() {
    super("Solo se puede reabrir una cita que está cancelada.");
    this.name = "CitaNoCanceladaError";
  }
}

export class CitaConflictoHorarioError extends Error {
  constructor() {
    super("Ya existe una cita para este médico en ese horario.");
    this.name = "CitaConflictoHorarioError";
  }
}

export class CitaInexistenteError extends Error {
  constructor() {
    super("La cita no existe o no pertenece a este médico.");
    this.name = "CitaInexistenteError";
  }
}

export class TransicionEstadoInvalidaError extends Error {
  constructor(desde: string, hacia: string) {
    super(`No se puede pasar una cita de "${desde}" a "${hacia}".`);
    this.name = "TransicionEstadoInvalidaError";
  }
}

export class CitaConsultaEnCursoError extends Error {
  constructor() {
    super(
      "La cita tiene una consulta en curso: ciérrala desde la consulta en vez de cambiar el estado de la cita.",
    );
    this.name = "CitaConsultaEnCursoError";
  }
}

export class CitaNoEditableError extends Error {
  constructor() {
    super("Solo se puede editar o reprogramar una cita pendiente o confirmada.");
    this.name = "CitaNoEditableError";
  }
}

function calcularFin(fechaHora: Date, duracionMinutos: number): Date {
  return new Date(fechaHora.getTime() + duracionMinutos * 60_000);
}

/**
 * Detecta solapamiento de horario para un médico considerando duración, no
 * solo coincidencia exacta de instante. Dos citas se solapan si el inicio de
 * una es anterior al fin de la otra y viceversa. Una cita CANCELADA o
 * NO_ASISTIO no bloquea el horario (el turno quedó libre); una cita
 * ATENDIDA sí, porque ya ocupó ese espacio real de agenda.
 *
 * La ventana de búsqueda se acota con DURACION_MINUTOS_MAXIMA en vez de
 * calcular el fin de cada candidata en SQL, para no depender de una columna
 * generada — más simple y suficiente para el volumen de una agenda médica.
 */
/// Exportada para citasPublicas.ts (Task #15) — la reserva pública usa
/// exactamente la misma regla de conflicto que la agenda del OS, nunca
/// una reimplementación aparte que pudiera desincronizarse.
export async function hayConflictoHorario(input: {
  organizacionId: string;
  medicoId: string;
  fechaHora: Date;
  duracionMinutos: number;
  excluirCitaId?: string;
}): Promise<boolean> {
  const fin = calcularFin(input.fechaHora, input.duracionMinutos);
  const desde = new Date(
    input.fechaHora.getTime() - DURACION_MINUTOS_MAXIMA * 60_000,
  );

  const candidatas = await prisma.cita.findMany({
    where: {
      organizacionId: input.organizacionId,
      medicoId: input.medicoId,
      estado: { in: ESTADOS_QUE_BLOQUEAN_HORARIO },
      fechaHora: { gte: desde, lt: fin },
      ...(input.excluirCitaId ? { id: { not: input.excluirCitaId } } : {}),
    },
    select: { fechaHora: true, duracionMinutos: true },
  });

  return candidatas.some((candidata) => {
    const finCandidata = calcularFin(
      candidata.fechaHora,
      candidata.duracionMinutos,
    );
    return candidata.fechaHora < fin && finCandidata > input.fechaHora;
  });
}

/**
 * Intervalos ya tomados de la agenda de un médico en un rango (12-nov-2026,
 * auditoría: la ficha pública ofrecía horarios ocupados). Usa los mismos
 * estados que `hayConflictoHorario`, así lo que la ficha muestra como
 * libre es exactamente lo que la reserva va a aceptar. Devuelve solo
 * inicio y fin: nada del paciente ni del motivo sale de acá.
 */
export async function listarIntervalosOcupados(input: {
  organizacionId: string;
  medicoId: string;
  desde: Date;
  hasta: Date;
}): Promise<{ inicio: Date; fin: Date }[]> {
  const citas = await prisma.cita.findMany({
    where: {
      organizacionId: input.organizacionId,
      medicoId: input.medicoId,
      estado: { in: ESTADOS_QUE_BLOQUEAN_HORARIO },
      fechaHora: {
        gte: new Date(input.desde.getTime() - DURACION_MINUTOS_MAXIMA * 60_000),
        lt: input.hasta,
      },
    },
    select: { fechaHora: true, duracionMinutos: true },
    orderBy: { fechaHora: "asc" },
  });
  return citas
    .map((c) => ({ inicio: c.fechaHora, fin: calcularFin(c.fechaHora, c.duracionMinutos) }))
    .filter((i) => i.fin > input.desde);
}

export async function listarCitasDelDia(input: {
  organizacionId: string;
  medicoId: string;
  fecha: Date;
  estado?: EstadoCita;
  modalidad?: ModalidadCita;
}) {
  const inicio = new Date(input.fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);

  return prisma.cita.findMany({
    where: {
      organizacionId: input.organizacionId,
      medicoId: input.medicoId,
      fechaHora: { gte: inicio, lt: fin },
      ...(input.estado ? { estado: input.estado } : {}),
      ...(input.modalidad ? { modalidad: input.modalidad } : {}),
    },
    include: {
      paciente: { select: { id: true, nombre: true, apellido: true } },
      consulta: { select: { id: true, estado: true } },
    },
    orderBy: { fechaHora: "asc" },
  });
}

/**
 * Igual que listarCitasDelDia, pero con los datos adicionales del paciente
 * que necesita la tarjeta de "Detalle de la cita" (ver changelog punto 60):
 * teléfono, fecha de nacimiento, sexo y documento para la vista rápida, más
 * sus alergias activas (mismo filtro que usa `listarAntecedentesDelPaciente`
 * y `AlertaAlergias`: tipo ALERGIA + activo). Se separa de
 * `listarCitasDelDia` para no cargar estos campos extra en los llamados que
 * no los necesitan (p.ej. `citasAyer` en /hoy, que solo cuenta para los
 * deltas). Solo la usan la vista Día de /agenda y la cita de "hoy" en /hoy,
 * que son los dos lugares donde existe el panel de detalle.
 */
export async function listarCitasDelDiaConDetalle(input: {
  organizacionId: string;
  medicoId: string;
  fecha: Date;
  estado?: EstadoCita;
  modalidad?: ModalidadCita;
}) {
  const inicio = new Date(input.fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);

  return prisma.cita.findMany({
    where: {
      organizacionId: input.organizacionId,
      medicoId: input.medicoId,
      fechaHora: { gte: inicio, lt: fin },
      ...(input.estado ? { estado: input.estado } : {}),
      ...(input.modalidad ? { modalidad: input.modalidad } : {}),
    },
    include: {
      paciente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          telefono: true,
          fechaNacimiento: true,
          sexo: true,
          documentoIdentidad: true,
          antecedentesMedicos: {
            where: { tipo: "ALERGIA", activo: true },
            select: { id: true, descripcion: true },
          },
        },
      },
      consulta: { select: { id: true, estado: true } },
    },
    orderBy: { fechaHora: "asc" },
  });
}

/**
 * Igual que listarCitasDelDia pero para un rango [inicio, fin) arbitrario —
 * usado por las vistas de semana y mes, que necesitan varios días en una
 * sola consulta en vez de repetir listarCitasDelDia por cada día.
 */
export async function listarCitasEnRango(input: {
  organizacionId: string;
  medicoId: string;
  inicio: Date;
  fin: Date;
  estado?: EstadoCita;
  modalidad?: ModalidadCita;
}) {
  return prisma.cita.findMany({
    where: {
      organizacionId: input.organizacionId,
      medicoId: input.medicoId,
      fechaHora: { gte: input.inicio, lt: input.fin },
      ...(input.estado ? { estado: input.estado } : {}),
      ...(input.modalidad ? { modalidad: input.modalidad } : {}),
    },
    include: {
      paciente: { select: { id: true, nombre: true, apellido: true } },
      consulta: { select: { id: true, estado: true } },
    },
    orderBy: { fechaHora: "asc" },
  });
}

/**
 * Todas las citas de un paciente (cualquier médico de la organización que lo
 * haya atendido), más recientes primero — para la sección "Citas" de la
 * ficha del paciente. La UI separa próximas/anteriores comparando
 * `fechaHora` contra "ahora"; el dominio devuelve la lista completa porque
 * separar es una decisión de presentación, no de negocio.
 */
export async function listarCitasDelPaciente(input: {
  organizacionId: string;
  pacienteId: string;
}) {
  return prisma.cita.findMany({
    where: {
      organizacionId: input.organizacionId,
      pacienteId: input.pacienteId,
    },
    include: {
      medico: { select: { id: true, usuario: { select: { nombre: true } } } },
      consulta: { select: { id: true, estado: true } },
    },
    orderBy: { fechaHora: "desc" },
  });
}

export async function obtenerCita(input: {
  organizacionId: string;
  citaId: string;
}) {
  return prisma.cita.findFirst({
    where: { id: input.citaId, organizacionId: input.organizacionId },
    include: {
      paciente: { select: { id: true, nombre: true, apellido: true } },
      consulta: { select: { id: true, estado: true } },
    },
  });
}

/**
 * Igual que obtenerCita pero además exige que pertenezca al médico de la
 * sesión — punto de entrada obligatorio para editar/reprogramar/cambiar
 * estado, donde "pertenece a la organización" no basta: cada médico solo
 * puede actuar sobre sus propias citas (mismo criterio que Consulta en
 * modules/core/consultas.ts).
 */
async function obtenerCitaDelMedico(input: {
  organizacionId: string;
  medicoId: string;
  citaId: string;
}) {
  const cita = await prisma.cita.findFirst({
    where: {
      id: input.citaId,
      organizacionId: input.organizacionId,
      medicoId: input.medicoId,
    },
    include: {
      consulta: { select: { id: true, estado: true } },
    },
  });

  if (!cita) {
    throw new CitaInexistenteError();
  }

  return cita;
}

/**
 * Crea una cita para el médico de la sesión. Valida consistencia
 * organizacional (paciente/médico) antes de escribir, igual que el resto de
 * los casos de uso que escriben Cita/Consulta. Un paciente archivado no
 * puede recibir citas nuevas (ver PacienteArchivadoError) — puede seguir
 * consultándose, solo se bloquea la creación.
 */
export async function crearCita(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  pacienteId: string;
  fechaHora: Date;
  duracionMinutos: number;
  modalidad: ModalidadCita;
  motivo?: string | null;
  notas?: string | null;
}): Promise<{ citaId: string }> {
  exigirDuracionValida(input.duracionMinutos);

  await validarConsistenciaCita({
    organizacionId: input.organizacionId,
    pacienteId: input.pacienteId,
    medicoId: input.medicoId,
  });

  const paciente = await prisma.paciente.findUnique({
    where: { id: input.pacienteId },
    select: { activo: true },
  });
  if (!paciente?.activo) {
    throw new PacienteArchivadoError();
  }

  const conflicto = await hayConflictoHorario({
    organizacionId: input.organizacionId,
    medicoId: input.medicoId,
    fechaHora: input.fechaHora,
    duracionMinutos: input.duracionMinutos,
  });

  if (conflicto) {
    throw new CitaConflictoHorarioError();
  }

  const cita = await prisma.cita.create({
    data: {
      organizacionId: input.organizacionId,
      pacienteId: input.pacienteId,
      medicoId: input.medicoId,
      fechaHora: input.fechaHora,
      duracionMinutos: input.duracionMinutos,
      modalidad: input.modalidad,
      motivo: input.motivo ?? null,
      notas: input.notas ?? null,
    },
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "crear_cita",
    entidadTipo: "Cita",
    entidadId: cita.id,
    pacienteId: input.pacienteId,
  });

  return { citaId: cita.id };
}

/**
 * Edita/reprograma una cita existente del médico de la sesión. Solo
 * permitido mientras la cita está activa (PENDIENTE/CONFIRMADA) — una cita
 * cancelada, atendida o no asistida es historial, no se retoca. Si cambia
 * fecha/hora, vuelve a validar conflicto de horario excluyéndose a sí misma.
 *
 * Trazabilidad: si cambió fecha u hora se registra como reprogramación con
 * el instante anterior y el nuevo (dato operativo, no clínico); el resto de
 * los cambios se registran solo por nombre de campo, igual que
 * guardarConsulta en modules/core/consultas.ts.
 */
export async function actualizarCita(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  citaId: string;
  fechaHora: Date;
  duracionMinutos: number;
  modalidad: ModalidadCita;
  motivo?: string | null;
  notas?: string | null;
}): Promise<void> {
  exigirDuracionValida(input.duracionMinutos);

  const cita = await obtenerCitaDelMedico({
    organizacionId: input.organizacionId,
    medicoId: input.medicoId,
    citaId: input.citaId,
  });

  if (!ESTADOS_ACTIVOS.includes(cita.estado)) {
    throw new CitaNoEditableError();
  }

  const fechaCambio = cita.fechaHora.getTime() !== input.fechaHora.getTime();

  if (fechaCambio || cita.duracionMinutos !== input.duracionMinutos) {
    const conflicto = await hayConflictoHorario({
      organizacionId: input.organizacionId,
      medicoId: input.medicoId,
      fechaHora: input.fechaHora,
      duracionMinutos: input.duracionMinutos,
      excluirCitaId: input.citaId,
    });
    if (conflicto) {
      throw new CitaConflictoHorarioError();
    }
  }

  const motivoNuevo = input.motivo ?? null;
  const notasNuevas = input.notas ?? null;
  const camposModificados: string[] = [];
  if (cita.duracionMinutos !== input.duracionMinutos) camposModificados.push("duracionMinutos");
  if (cita.modalidad !== input.modalidad) camposModificados.push("modalidad");
  if ((cita.motivo ?? null) !== motivoNuevo) camposModificados.push("motivo");
  if ((cita.notas ?? null) !== notasNuevas) camposModificados.push("notas");

  if (!fechaCambio && camposModificados.length === 0) {
    return;
  }

  await prisma.cita.update({
    where: { id: input.citaId },
    data: {
      fechaHora: input.fechaHora,
      duracionMinutos: input.duracionMinutos,
      modalidad: input.modalidad,
      motivo: motivoNuevo,
      notas: notasNuevas,
    },
  });

  if (fechaCambio) {
    await registrarEvento({
      organizacionId: input.organizacionId,
      actorId: input.actorId,
      accion: "reprogramar_cita",
      entidadTipo: "Cita",
      entidadId: input.citaId,
      pacienteId: cita.pacienteId,
      cambios: {
        fechaHoraAnterior: cita.fechaHora.toISOString(),
        fechaHoraNueva: input.fechaHora.toISOString(),
      },
    });
  }

  if (camposModificados.length > 0) {
    await registrarEvento({
      organizacionId: input.organizacionId,
      actorId: input.actorId,
      accion: "editar_cita",
      entidadTipo: "Cita",
      entidadId: input.citaId,
      pacienteId: cita.pacienteId,
      cambios: { camposModificados },
    });
  }
}

/**
 * Cambia el estado de una cita del médico de la sesión, validando la
 * transición contra TRANSICIONES_PERMITIDAS y contra concurrencia (el
 * `updateMany` con `estado: cita.estado` en el where falla en 0 filas si el
 * estado cambió entre la lectura y la escritura, mismo patrón que
 * cerrarConsulta en modules/core/consultas.ts).
 *
 * Si la cita tiene una Consulta EN_CURSO asociada, ningún cambio de estado
 * terminal (cancelar/atendida/no asistió) se permite desde aquí: esa cita ya
 * está siendo atendida y su estado ATENDIDA solo debe llegar por
 * cerrarConsulta, para no dejar Cita y Consulta inconsistentes entre sí.
 */
async function cambiarEstadoCita(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  citaId: string;
  estadoNuevo: EstadoCitaAccionable;
}): Promise<void> {
  const cita = await obtenerCitaDelMedico({
    organizacionId: input.organizacionId,
    medicoId: input.medicoId,
    citaId: input.citaId,
  });

  if (!TRANSICIONES_PERMITIDAS[cita.estado].includes(input.estadoNuevo)) {
    throw new TransicionEstadoInvalidaError(cita.estado, input.estadoNuevo);
  }

  if (cita.consulta?.estado === "EN_CURSO") {
    throw new CitaConsultaEnCursoError();
  }

  const resultado = await prisma.cita.updateMany({
    where: {
      id: input.citaId,
      organizacionId: input.organizacionId,
      estado: cita.estado,
    },
    data: { estado: input.estadoNuevo },
  });

  if (resultado.count !== 1) {
    throw new TransicionEstadoInvalidaError(cita.estado, input.estadoNuevo);
  }

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: ACCION_TRAZABILIDAD_POR_ESTADO[input.estadoNuevo],
    entidadTipo: "Cita",
    entidadId: input.citaId,
    pacienteId: cita.pacienteId,
    cambios: { estadoAnterior: cita.estado, estadoNuevo: input.estadoNuevo },
  });
}

// `accionesDeEstadoDisponibles` y `citaEsEditable` viven en
// `citasEstado.ts` (ver nota de cabecera de este archivo). Se reexportan
// acá por compatibilidad con quien ya las importaba de `citas.ts`
// (`agenda/[id]/editar/page.tsx`, un Server Component sin problema de
// bundling) — `CitaAccionesEstado.tsx`, que sí puede llegar a un Client
// Component, las importa directo de `citasEstado.ts`.
export { accionesDeEstadoDisponibles, citaEsEditable } from "@/modules/core/citasEstado";

export async function confirmarCita(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  citaId: string;
}): Promise<void> {
  await cambiarEstadoCita({ ...input, estadoNuevo: "CONFIRMADA" });
}

export async function cancelarCita(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  citaId: string;
}): Promise<void> {
  await cambiarEstadoCita({ ...input, estadoNuevo: "CANCELADA" });
}

/**
 * Deshace una cancelación: devuelve la cita a PENDIENTE (13-nov-2026,
 * hallazgo de la auditoría).
 *
 * Por qué existe: cancelar era un clic sin confirmación y sin vuelta
 * atrás —`TRANSICIONES_PERMITIDAS.CANCELADA` está vacío a propósito— así
 * que un clic equivocado, en el móvil, al lado de "Confirmar", mataba la
 * cita de un paciente real y había que crearla de nuevo a mano. La
 * alternativa era un "¿seguro?" en cada cancelación, pero cancelar es una
 * acción legítima y frecuente (los pacientes cancelan todo el tiempo): un
 * cuadro de confirmación que se ve siempre se termina aceptando sin leer,
 * así que estorba en el caso normal y no protege en el malo. Mejor sin
 * fricción y reversible.
 *
 * Es una acción EXPLÍCITA y aparte, no una transición más en la matriz
 * (ver la nota de `TRANSICIONES_PERMITIDAS` en citasEstado.ts, que pide
 * justamente eso): así reabrir no aparece como un botón genérico de
 * cambio de estado, y ATENDIDA/NO_ASISTIO siguen siendo terminales de
 * verdad.
 *
 * Revalida el choque de horario, que es el punto fino: mientras la cita
 * estaba cancelada su hueco quedó libre y se lo pudieron dar a otro
 * paciente (desde la agenda o desde el Directorio). Reabrirla a ciegas
 * dejaría dos pacientes citados a la misma hora.
 */
export async function reabrirCita(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  citaId: string;
}): Promise<void> {
  const cita = await obtenerCitaDelMedico({
    organizacionId: input.organizacionId,
    medicoId: input.medicoId,
    citaId: input.citaId,
  });

  if (cita.estado !== "CANCELADA") {
    throw new CitaNoCanceladaError();
  }

  const conflicto = await hayConflictoHorario({
    organizacionId: input.organizacionId,
    medicoId: input.medicoId,
    fechaHora: cita.fechaHora,
    duracionMinutos: cita.duracionMinutos,
    excluirCitaId: input.citaId,
  });
  if (conflicto) {
    throw new CitaConflictoHorarioError();
  }

  // Mismo patrón de concurrencia que `cambiarEstadoCita`: si alguien tocó
  // el estado entre la lectura y esta escritura, actualiza 0 filas.
  const resultado = await prisma.cita.updateMany({
    where: {
      id: input.citaId,
      organizacionId: input.organizacionId,
      estado: "CANCELADA",
    },
    data: { estado: "PENDIENTE" },
  });

  if (resultado.count !== 1) {
    throw new CitaNoCanceladaError();
  }

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "reabrir_cita",
    entidadTipo: "Cita",
    entidadId: input.citaId,
    pacienteId: cita.pacienteId,
    cambios: { estadoAnterior: "CANCELADA", estadoNuevo: "PENDIENTE" },
  });
}

export async function marcarCitaAtendida(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  citaId: string;
}): Promise<void> {
  await cambiarEstadoCita({ ...input, estadoNuevo: "ATENDIDA" });
}

export async function marcarCitaNoAsistio(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  citaId: string;
}): Promise<void> {
  await cambiarEstadoCita({ ...input, estadoNuevo: "NO_ASISTIO" });
}
