/**
 * Odontograma básico — ver changelog punto 51 (pedido explícito: "lo más
 * básico que necesiten sin complicarlo"). Investigado contra la
 * documentación pública de Open Dental (software dental libre/abierto,
 * usado como referencia de la industria, no inventado) —
 * https://opendental.com/manual/graphicaltoothchart.html — que confirma
 * dos cosas: (1) la numeración FDI (11-48) es una de las estándar de la
 * industria junto con la Universal (1-32, más usada en EE.UU.) — se eligió
 * FDI porque es la de uso corriente en Venezuela/Latinoamérica, no la
 * Universal; (2) un odontograma completo de verdad es por SUPERFICIE de
 * cada diente (vestibular/lingual/mesial/distal/oclusal) con decenas de
 * códigos de procedimiento — eso es lo que se decidió NO construir
 * ("sin complicarlo"): este MVP es un estado ÚNICO por diente completo,
 * sin superficies ni historial de procedimientos.
 */

/** Dentición permanente, 32 piezas, en notación FDI — 4 cuadrantes de 8. */
export const CUADRANTES_FDI = [
  { nombre: "Superior derecho", dientes: ["18", "17", "16", "15", "14", "13", "12", "11"] },
  { nombre: "Superior izquierdo", dientes: ["21", "22", "23", "24", "25", "26", "27", "28"] },
  { nombre: "Inferior izquierdo", dientes: ["31", "32", "33", "34", "35", "36", "37", "38"] },
  { nombre: "Inferior derecho", dientes: ["48", "47", "46", "45", "44", "43", "42", "41"] },
] as const;

export const DIENTES_FDI: readonly string[] = CUADRANTES_FDI.flatMap((c) => c.dientes);

/** Catálogo cerrado de estados — el subconjunto que cualquier consultorio
 * general necesita, sin entrar en superficies ni tratamientos específicos. */
export const ESTADOS_DIENTE = [
  "SANO",
  "CARIES",
  "OBTURADO",
  "AUSENTE",
  "CORONA",
  "ENDODONCIA",
] as const;

export type EstadoDiente = (typeof ESTADOS_DIENTE)[number];

export const LABEL_ESTADO_DIENTE: Record<EstadoDiente, string> = {
  SANO: "Sano",
  CARIES: "Caries",
  OBTURADO: "Obturado",
  AUSENTE: "Ausente/extraído",
  CORONA: "Corona",
  ENDODONCIA: "Endodoncia",
};

export type Odontograma = Partial<Record<string, EstadoDiente>>;

export function esEstadoDiente(valor: string): valor is EstadoDiente {
  return (ESTADOS_DIENTE as readonly string[]).includes(valor);
}
