import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { validarConsistenciaCita } from "@/db/consistenciaOrganizacional";

/**
 * Casos de uso de Cita. Toda lectura y escritura va scoped por
 * organizacionId + medicoId de la sesión, nunca por medicoId enviado por el
 * cliente. Reagendar/cancelar/confirmar cita siguen fuera de alcance (Bloque
 * Agenda/Citas v1 — ver plan aprobado): esta fase solo cubre listar y crear.
 */

export class CitaConflictoHorarioError extends Error {
  constructor() {
    super("Ya existe una cita para este médico en ese horario.");
    this.name = "CitaConflictoHorarioError";
  }
}

export async function listarCitasDelDia(input: {
  organizacionId: string;
  medicoId: string;
  fecha: Date;
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
    },
    include: {
      paciente: { select: { id: true, nombre: true, apellido: true } },
      consulta: { select: { id: true, estado: true } },
    },
    orderBy: { fechaHora: "asc" },
  });
}

export async function obtenerCita(input: {
  organizacionId: string;
  citaId: string;
}) {
  return prisma.cita.findFirst({
    where: { id: input.citaId, organizacionId: input.organizacionId },
    include: {
      consulta: { select: { id: true, estado: true } },
    },
  });
}

/**
 * Crea una cita para el médico de la sesión. Valida consistencia
 * organizacional (paciente/médico) antes de escribir, igual que el resto de
 * los casos de uso que escriben Cita/Consulta.
 *
 * Conflicto de horario: el schema actual solo tiene `fechaHora` (un instante
 * puntual, sin duración), así que el único conflicto detectable sin inventar
 * una regla de negocio no definida es una coincidencia exacta de horario
 * para el mismo médico. Una cita CANCELADA o NO_ASISTIO no bloquea ese
 * horario (el turno quedó libre). Detectar solapamientos por duración
 * requeriría un campo de duración que hoy no existe — ver informe.
 */
export async function crearCita(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  pacienteId: string;
  fechaHora: Date;
  motivo?: string | null;
}): Promise<{ citaId: string }> {
  await validarConsistenciaCita({
    organizacionId: input.organizacionId,
    pacienteId: input.pacienteId,
    medicoId: input.medicoId,
  });

  const conflicto = await prisma.cita.findFirst({
    where: {
      organizacionId: input.organizacionId,
      medicoId: input.medicoId,
      fechaHora: input.fechaHora,
      estado: { notIn: ["CANCELADA", "NO_ASISTIO"] },
    },
    select: { id: true },
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
      motivo: input.motivo ?? null,
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
