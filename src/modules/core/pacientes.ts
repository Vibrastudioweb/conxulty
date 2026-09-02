import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";

/**
 * Casos de uso de Paciente para Fase 1: crear y buscar/consultar. Editar
 * paciente no está en el alcance de esta fase (ver plan aprobado).
 *
 * Toda lectura por ID usa findFirst con organizacionId en el where —
 * findUnique no permite combinar id + organizacionId sin una unique
 * compuesta, así que no se usa aquí a propósito.
 */

export interface DatosPaciente {
  nombre: string;
  apellido: string;
  fechaNacimiento?: Date | null;
  sexo?: string | null;
  telefono?: string | null;
  email?: string | null;
}

export async function obtenerPaciente(input: {
  organizacionId: string;
  pacienteId: string;
}) {
  return prisma.paciente.findFirst({
    where: { id: input.pacienteId, organizacionId: input.organizacionId },
  });
}

export async function listarPacientes(input: { organizacionId: string }) {
  return prisma.paciente.findMany({
    where: { organizacionId: input.organizacionId },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    take: 20,
  });
}

export async function buscarPacientes(input: {
  organizacionId: string;
  texto: string;
}) {
  const texto = input.texto.trim();
  if (!texto) return [];

  return prisma.paciente.findMany({
    where: {
      organizacionId: input.organizacionId,
      OR: [
        { nombre: { contains: texto, mode: "insensitive" } },
        { apellido: { contains: texto, mode: "insensitive" } },
      ],
    },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    take: 20,
  });
}

export async function crearPaciente(input: {
  organizacionId: string;
  actorId: string;
  datos: DatosPaciente;
}) {
  const paciente = await prisma.paciente.create({
    data: {
      organizacionId: input.organizacionId,
      nombre: input.datos.nombre,
      apellido: input.datos.apellido,
      fechaNacimiento: input.datos.fechaNacimiento ?? null,
      sexo: input.datos.sexo ?? null,
      telefono: input.datos.telefono ?? null,
      email: input.datos.email ?? null,
    },
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "crear_paciente",
    entidadTipo: "Paciente",
    entidadId: paciente.id,
    pacienteId: paciente.id,
  });

  return paciente;
}
