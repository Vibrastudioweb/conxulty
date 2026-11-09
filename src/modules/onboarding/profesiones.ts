/**
 * Catálogo cerrado — ver changelog punto 29/49 (Bloque 3) y punto 84
 * (ampliado de 3 a los 11 tipos de profesional de la salud que ya existía
 * del lado del Directorio, `vitalud-esquema.sql` / `tipos_profesional`).
 */
export const PROFESIONES = [
  "MEDICO",
  "ODONTOLOGO",
  "PSICOLOGO",
  "NUTRICIONISTA",
  "FISIOTERAPEUTA",
  "ENFERMERO",
  "TERAPEUTA_LENGUAJE",
  "TERAPEUTA_OCUPACIONAL",
  "PSICOPEDAGOGO",
  "PODOLOGO",
  "OPTOMETRISTA",
  "OTRA",
] as const;
export type ProfesionId = (typeof PROFESIONES)[number];

export const LABEL_PROFESION: Record<ProfesionId, string> = {
  MEDICO: "Médico",
  ODONTOLOGO: "Odontólogo",
  PSICOLOGO: "Psicólogo",
  NUTRICIONISTA: "Nutricionista",
  FISIOTERAPEUTA: "Fisioterapeuta",
  ENFERMERO: "Enfermero/a",
  TERAPEUTA_LENGUAJE: "Terapeuta del lenguaje",
  TERAPEUTA_OCUPACIONAL: "Terapeuta ocupacional",
  PSICOPEDAGOGO: "Psicopedagogo/a",
  PODOLOGO: "Podólogo",
  OPTOMETRISTA: "Optometrista",
  OTRA: "Otra",
};

/**
 * Profesiones a las que se les ofrece Plan Pro — ampliado a las 11 del
 * punto 84 (DECISIÓN del usuario: "si para todos"). Queda afuera
 * deliberadamente OTRA: no es una profesión definida (texto libre, sin
 * tipos_profesional correspondiente del lado del Directorio), así que no
 * se asumió que "todos" la incluyera — confirmar si corresponde también.
 */
export const PROFESIONES_ELEGIBLES_PRO: readonly ProfesionId[] = [
  "MEDICO",
  "ODONTOLOGO",
  "PSICOLOGO",
  "NUTRICIONISTA",
  "FISIOTERAPEUTA",
  "ENFERMERO",
  "TERAPEUTA_LENGUAJE",
  "TERAPEUTA_OCUPACIONAL",
  "PSICOPEDAGOGO",
  "PODOLOGO",
  "OPTOMETRISTA",
];

export function esProfesionElegiblePro(profesion: ProfesionId): boolean {
  return PROFESIONES_ELEGIBLES_PRO.includes(profesion);
}
