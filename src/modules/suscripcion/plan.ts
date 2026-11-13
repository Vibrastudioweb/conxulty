import { prisma } from "@/db/client";
import type { PlanOrganizacion } from "@prisma/client";

/**
 * Qué incluye cada plan (13-nov-2026). Es la misma promesa que hace la
 * landing en conxulty.com/os, y esta es su única traducción a código:
 *
 *   Ficha ($5/mes, primer mes gratis)
 *     · ficha pública en el Directorio
 *     · agenda de citas
 *     · pacientes: lista y datos de contacto
 *     · reseñas
 *
 *   Pro ($20/mes, sin mes gratis)
 *     · todo lo anterior
 *     · consultas y notas clínicas (incluye antecedentes y odontograma)
 *     · recetas y documentos
 *     · caja, cobros y gastos
 *     · reportes
 *
 * Antes de esto el plan no se consultaba en ningún lado: quien estaba en
 * Ficha veía exactamente lo mismo que quien pagaba Pro, así que no había
 * razón para pagar los $20 (auditoría pre-lanzamiento, hallazgo C2).
 */
export type ModuloPro = "consultas" | "documentos" | "caja" | "reportes";

export const NOMBRE_MODULO: Record<ModuloPro, string> = {
  consultas: "Consultas y notas clínicas",
  documentos: "Recetas y documentos",
  caja: "Caja y cobros",
  reportes: "Reportes",
};

const MODULOS_POR_PLAN: Record<PlanOrganizacion, readonly ModuloPro[]> = {
  FICHA: [],
  PRO: ["consultas", "documentos", "caja", "reportes"],
};

export function planIncluyeModulo(plan: PlanOrganizacion, modulo: ModuloPro): boolean {
  return MODULOS_POR_PLAN[plan].includes(modulo);
}

export async function planDeOrganizacion(organizacionId: string): Promise<PlanOrganizacion> {
  const organizacion = await prisma.organizacion.findUniqueOrThrow({
    where: { id: organizacionId },
    select: { plan: true },
  });
  return organizacion.plan;
}
