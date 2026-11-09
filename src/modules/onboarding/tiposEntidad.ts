/**
 * Catálogo cerrado de tipos de entidad — ver changelog punto 90/92. Mismo
 * criterio que `profesiones.ts`: un arreglo de ids + un mapa de etiquetas,
 * nada más (no hay "elegibilidad Pro" acá porque las entidades no tienen
 * Plan Pro — registro gratis, ver changelog punto 90).
 */
export const TIPOS_ENTIDAD = ["CLINICA", "FARMACIA"] as const;
export type TipoEntidadId = (typeof TIPOS_ENTIDAD)[number];

export const LABEL_TIPO_ENTIDAD: Record<TipoEntidadId, string> = {
  CLINICA: "Clínica",
  FARMACIA: "Farmacia",
};

/** Solo FARMACIA tiene horario de turno (changelog punto 90) — la UI para
 *  editarlo se construye en una tarea aparte, esta función ya queda lista
 *  para que esa pantalla sepa cuándo mostrarse. */
export function tieneHorarioTurno(tipo: TipoEntidadId): boolean {
  return tipo === "FARMACIA";
}
