import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";

export class CajaYaAbiertaError extends Error {
  constructor() {
    super("Ya hay una caja abierta para esta organización.");
    this.name = "CajaYaAbiertaError";
  }
}

/**
 * Caja ABIERTA actual de la organización, o null si no hay ninguna. Usada
 * tanto para decidir qué mostrar en pantalla como para que registrarCobro/
 * registrarGasto (próximos pasos) puedan exigir "caja abierta" sin duplicar
 * esta misma consulta.
 */
export async function obtenerCajaAbierta(input: { organizacionId: string }) {
  return prisma.caja.findFirst({
    where: { organizacionId: input.organizacionId, estado: "ABIERTA" },
  });
}

/**
 * Abre una caja para la organización. Cualquier usuario autenticado puede
 * hacerlo (MEDICO, STAFF o ADMIN) — no hay distinción de permisos en este
 * módulo. Bloquea si ya existe una Caja ABIERTA para la organización: solo
 * una caja abierta a la vez.
 *
 * No pasa por consistenciaOrganizacional.ts: la única entidad relacionada
 * (abiertaPorId) es el propio actor autenticado, ya confiable por venir de
 * la sesión y no de un formulario. El aislamiento entre organizaciones es
 * el propio `where: { organizacionId }` de la búsqueda de abajo.
 *
 * Nota: existe una ventana de carrera entre el findFirst y el create — dos
 * requests simultáneas podrían crear dos cajas ABIERTAS. Aceptado por ahora
 * (alcance mínimo de esta ronda); un candado real requeriría un índice
 * único parcial a nivel de base de datos, fuera de alcance aquí.
 */
export async function abrirCaja(input: {
  organizacionId: string;
  actorId: string;
  montoInicial: number | string;
}): Promise<{ cajaId: string }> {
  const cajaAbierta = await prisma.caja.findFirst({
    where: { organizacionId: input.organizacionId, estado: "ABIERTA" },
    select: { id: true },
  });

  if (cajaAbierta) {
    throw new CajaYaAbiertaError();
  }

  const caja = await prisma.caja.create({
    data: {
      organizacionId: input.organizacionId,
      abiertaPorId: input.actorId,
      montoInicial: input.montoInicial,
    },
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "abrir_caja",
    entidadTipo: "Caja",
    entidadId: caja.id,
  });

  return { cajaId: caja.id };
}
