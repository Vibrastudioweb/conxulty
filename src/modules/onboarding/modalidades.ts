/** Catálogo cerrado, multi-select — ver changelog punto 30 (addendum). */
export const MODALIDADES_ATENCION = ["PRESENCIAL", "DOMICILIO", "ONLINE"] as const;
export type ModalidadAtencionId = (typeof MODALIDADES_ATENCION)[number];

export const LABEL_MODALIDAD: Record<ModalidadAtencionId, string> = {
  PRESENCIAL: "Presencial en consultorio",
  DOMICILIO: "A domicilio",
  ONLINE: "Online (videollamada)",
};
