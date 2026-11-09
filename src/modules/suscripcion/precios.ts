import type { PlanOrganizacion } from "@prisma/client";

/**
 * Fuente única del precio — hoy vive repetido a mano en la landing (/os,
 * repo vitalud), Faq.svelte y acá. Changelog punto 89: cuando SPIDI esté
 * integrado, el precio real de cobro vive en SUS productos (su panel, no
 * este archivo) — esto queda como lo que se le muestra al médico antes de
 * pagar, debe coincidir con lo configurado del lado de SPIDI o el cobro no
 * va a coincidir con lo que vio en pantalla.
 */
export const PRECIO_CENTAVOS_USD: Record<PlanOrganizacion, number> = {
  FICHA: 500,
  PRO: 2000,
};

export function precioFormateado(plan: PlanOrganizacion): string {
  return `$${(PRECIO_CENTAVOS_USD[plan] / 100).toFixed(0)}`;
}
