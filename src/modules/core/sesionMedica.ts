import { prisma } from "@/db/client";

/**
 * Resuelve el perfil Medico del usuario autenticado. Nunca se acepta un
 * medicoId enviado por el cliente: siempre se deriva de organizacionId +
 * usuarioId, ambos provenientes de la sesión.
 */

export class MedicoNoEncontradoError extends Error {
  constructor() {
    super("El usuario autenticado no tiene un perfil médico asociado.");
    this.name = "MedicoNoEncontradoError";
  }
}

export async function resolverMedicoAutenticado(input: {
  organizacionId: string;
  usuarioId: string;
}) {
  const medico = await prisma.medico.findFirst({
    where: {
      usuarioId: input.usuarioId,
      organizacionId: input.organizacionId,
    },
    select: { id: true, organizacionId: true },
  });

  if (!medico) {
    throw new MedicoNoEncontradoError();
  }

  return medico;
}
