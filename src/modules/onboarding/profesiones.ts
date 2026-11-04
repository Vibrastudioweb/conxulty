/** Catálogo cerrado — ver changelog punto 29/49 (Bloque 3). */
export const PROFESIONES = ["MEDICO", "ODONTOLOGO", "PSICOLOGO", "OTRA"] as const;
export type ProfesionId = (typeof PROFESIONES)[number];

export const LABEL_PROFESION: Record<ProfesionId, string> = {
  MEDICO: "Médico",
  ODONTOLOGO: "Odontólogo",
  PSICOLOGO: "Psicólogo",
  OTRA: "Otra",
};

/**
 * Profesiones a las que se les ofrece Plan Pro — la lista que el usuario
 * nombró explícitamente (changelog punto 29) sigue siendo HIPÓTESIS, no
 * cerrada para siempre: "esto puede cambiar" si se amplía a profesiones no
 * clínicas.
 */
export const PROFESIONES_ELEGIBLES_PRO: readonly ProfesionId[] = [
  "MEDICO",
  "ODONTOLOGO",
  "PSICOLOGO",
];

export function esProfesionElegiblePro(profesion: ProfesionId): boolean {
  return PROFESIONES_ELEGIBLES_PRO.includes(profesion);
}
