/**
 * Compartido entre la sección Documentos de /consultas/[id] y la vista de
 * detalle. Solo RECETA existe en el schema hoy — al agregar
 * INFORME/CONSTANCIA/ORDEN en el futuro, solo hace falta añadir su entrada
 * aquí.
 */
export const ETIQUETAS_TIPO_DOCUMENTO: Record<string, string> = {
  RECETA: "Receta médica",
};
