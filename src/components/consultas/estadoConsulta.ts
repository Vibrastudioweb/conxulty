import type { BadgeTone } from "@/components/ui/Badge";

/**
 * Compartido entre /consultas/[id] y la Historia clínica de /pacientes/[id]
 * para no duplicar el mapeo estado -> etiqueta/tono. Los estados son
 * exactamente los de EstadoConsulta en el schema — ninguno inventado.
 */
export const ETIQUETAS_ESTADO_CONSULTA: Record<string, string> = {
  EN_CURSO: "En curso",
  CERRADA: "Cerrada",
  ANULADA: "Anulada",
};

export const TONO_ESTADO_CONSULTA: Record<string, BadgeTone> = {
  EN_CURSO: "info",
  CERRADA: "success",
  ANULADA: "danger",
};
