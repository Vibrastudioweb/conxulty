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

/**
 * HECHO del producto (confirmado por el usuario, 29-oct-2026, resolviendo
 * una contradicción que había quedado anotada sin resolver en el
 * changelog de la demo): CONXULTY es de UN médico por organización. Esta
 * función resuelve ese único médico sin depender de quién está logueado
 * — a diferencia de `resolverMedicoAutenticado`, que exige que el usuario
 * autenticado SEA el médico. Existe porque ADMIN/STAFF también operan
 * Caja (`requireSesion`, no `requireMedico`) y necesitan poder registrar
 * un cobro atribuido al médico de la organización sin que nadie tenga que
 * escribir su ID a mano — ese campo manual ("ID del médico" en Cobro
 * rápido) era justamente el síntoma de la contradicción sin resolver.
 *
 * No hay una restricción de esquema que impida más de un Medico por
 * organización (eso sería un cambio de modelo aparte, no pedido); si
 * algún día existiera más de uno, esta función toma el primero creado,
 * de forma determinística, en vez de fallar — pero el supuesto de
 * producto vigente es que eso no ocurre.
 */
export async function obtenerMedicoDeOrganizacion(input: {
  organizacionId: string;
}) {
  const medico = await prisma.medico.findFirst({
    where: { organizacionId: input.organizacionId },
    select: { id: true, organizacionId: true },
    orderBy: { createdAt: "asc" },
  });

  if (!medico) {
    throw new MedicoNoEncontradoError();
  }

  return medico;
}
