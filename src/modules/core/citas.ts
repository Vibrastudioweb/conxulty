import type { EstadoCita, ModalidadCita } from "@prisma/client";
import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { validarConsistenciaCita } from "@/db/consistenciaOrganizacional";
import { PacienteArchivadoError } from "@/modules/core/pacientes";

/**
 * Casos de uso de Cita. Toda lectura y escritura va scoped por
 * organizacionId + medicoId de la sesión, nunca por medicoId enviado por el
 * cliente.
 */

export const DURACION_MINUTOS_DEFECTO = 30;
/** Cota superior de duración usada para acotar la ventana de la consulta de
 *  conflictos (ver `hayConflictoHorario`). No es una regla de negocio, es
 *  una optimización: ninguna cita real dura más de 8 horas. */
const DURACION_MINUTOS_MAXIMA = 480;

const ESTADOS_QUE_BLOQUEAN_HORARIO: EstadoCita[] = [
  "PENDIENTE",
  "CONFIRMADA",
  "ATENDIDA",
];

/** Estados sobre los que todavía tiene sentido actuar (editar, reprogramar,
 *  cambiar de estado). Un estado terminal (CANCELADA/ATENDIDA/NO_ASISTIO)
 *  no admite más acciones en este bloque. */
const ESTADOS_ACTIVOS: EstadoCita[] = ["PENDIENTE", "CONFIRMADA"];

type EstadoCitaAccionable = "CONFIRMADA" | "CANCELADA" | "ATENDIDA" | "NO_ASISTIO";

/** Transiciones de estado permitidas. Una cita cancelada, atendida o
 *  marcada como no asistió es terminal: no hay acción en este bloque que la
 *  regrese a un estado anterior (ver AGENTS del bloque, sección 3 — si se
 *  necesita reabrir una cita, debe ser una acción explícita de un bloque
 *  futuro, no una transición implícita). */
const TRANSICIONES_PERMITIDAS: Record<EstadoCita, EstadoCitaAccionable[]> = {
  PENDIENTE: ["CONFIRMADA", "CANCELADA", "ATENDIDA", "NO_ASISTIO"],
  CONFIRMADA: ["CANCELADA", "ATENDIDA", "NO_ASISTIO"],
  ATENDIDA: [],
  CANCELADA: [],
  NO_ASISTIO: [],
};

const ACCION_TRAZABILIDAD_POR_ESTADO: Record<EstadoCitaAccionable, string> = {
  CONFIRMADA: "confirmar_cita",
  CANCELADA: "cancelar_cita",
  ATENDIDA: "marcar_atendida",
  NO_ASISTIO: "marcar_no_asistio",
};

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
async function hayConflictoHorario(input: {
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

/**
 * Transiciones de estado válidas desde `estado`, para que la UI (agenda)
 * decida qué botones mostrar sin reimplementar la matriz de transiciones.
 */
export function accionesDeEstadoDisponibles(
  estado: EstadoCita,
): EstadoCitaAccionable[] {
  return TRANSICIONES_PERMITIDAS[estado];
}

export function citaEsEditable(estado: EstadoCita): boolean {
  return ESTADOS_ACTIVOS.includes(estado);
}

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
