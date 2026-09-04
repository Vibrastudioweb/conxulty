export const ETIQUETAS_TIPO_ANTECEDENTE: Record<string, string> = {
  ALERGIA: "Alergia",
  ENFERMEDAD_CRONICA: "Enfermedad crónica",
  CIRUGIA: "Cirugía",
  MEDICAMENTO_HABITUAL: "Medicamento habitual",
  HABITO: "Hábito",
  ANTECEDENTE_FAMILIAR: "Antecedente familiar",
  ANTECEDENTE_PERSONAL: "Antecedente personal",
  OBSERVACION: "Observación",
};

export const ORDEN_TIPO_ANTECEDENTE = [
  "ALERGIA",
  "ENFERMEDAD_CRONICA",
  "MEDICAMENTO_HABITUAL",
  "CIRUGIA",
  "ANTECEDENTE_PERSONAL",
  "ANTECEDENTE_FAMILIAR",
  "HABITO",
  "OBSERVACION",
] as const;
