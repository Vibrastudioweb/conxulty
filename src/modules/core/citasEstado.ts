import type { EstadoCita } from "@prisma/client";

/**
 * Matriz de transiciones de estado de Cita, separada de
 * `modules/core/citas.ts` a propósito (08-nov-2026, ver changelog punto
 * 60 — bug encontrado al construirlo): este archivo NO importa `prisma`
 * ni nada que termine resolviendo el driver `pg` (que usa `fs`, inexistente
 * en el navegador). `CitaAccionesEstado.tsx` necesita estas dos funciones
 * puras, y ahora se usa también desde un Client Component
 * (`ListaDiaConDetalle.tsx`) — si las sigue importando de `citas.ts`,
 * Next.js intenta empaquetar TODO ese módulo (incluida la conexión a
 * Postgres) para el navegador y el build revienta con
 * "Module not found: Can't resolve 'fs'". `citas.ts` importa estas mismas
 * constantes de aquí para no duplicar la matriz de transiciones.
 */

export type EstadoCitaAccionable =
  | "CONFIRMADA"
  | "CANCELADA"
  | "ATENDIDA"
  | "NO_ASISTIO";

/** Estados sobre los que todavía tiene sentido actuar (editar, reprogramar,
 *  cambiar de estado). Un estado terminal (CANCELADA/ATENDIDA/NO_ASISTIO)
 *  no admite más acciones en este bloque. */
export const ESTADOS_ACTIVOS: EstadoCita[] = ["PENDIENTE", "CONFIRMADA"];

/** Transiciones de estado permitidas. Una cita cancelada, atendida o
 *  marcada como no asistió es terminal: no hay acción en este bloque que la
 *  regrese a un estado anterior (ver AGENTS del bloque, sección 3 — si se
 *  necesita reabrir una cita, debe ser una acción explícita de un bloque
 *  futuro, no una transición implícita). */
export const TRANSICIONES_PERMITIDAS: Record<EstadoCita, EstadoCitaAccionable[]> = {
  PENDIENTE: ["CONFIRMADA", "CANCELADA", "ATENDIDA", "NO_ASISTIO"],
  CONFIRMADA: ["CANCELADA", "ATENDIDA", "NO_ASISTIO"],
  ATENDIDA: [],
  CANCELADA: [],
  NO_ASISTIO: [],
};

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
