import { prisma } from "@/db/client";
import type { Prisma } from "@prisma/client";

/**
 * Trazabilidad funcional: quién hizo qué, sobre qué entidad, cuándo y qué
 * cambió. Distinta de un log técnico — está pensada para poder responder
 * preguntas del negocio ("¿quién modificó este paciente y cuándo?"),
 * especialmente relevante cuando una organización tiene varios usuarios.
 *
 * Los casos de uso de cada módulo llaman a este servicio explícitamente en
 * vez de escribir directamente en RegistroTrazabilidad, para mantener el
 * formato de "accion"/"entidadTipo" consistente en todo el sistema.
 */

export interface RegistrarEventoInput {
  organizacionId: string;
  actorId: string;
  accion: string;
  entidadTipo: string;
  entidadId: string;
  pacienteId?: string;
  cambios?: Prisma.InputJsonValue;
}

export async function registrarEvento(input: RegistrarEventoInput) {
  return prisma.registroTrazabilidad.create({
    data: {
      organizacionId: input.organizacionId,
      actorId: input.actorId,
      accion: input.accion,
      entidadTipo: input.entidadTipo,
      entidadId: input.entidadId,
      pacienteId: input.pacienteId,
      cambios: input.cambios,
    },
  });
}
