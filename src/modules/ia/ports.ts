/**
 * Puerto de asistencia IA transversal.
 *
 * Cualquier módulo (comunicacion, core, documentos, soporte) que necesite ayuda
 * de IA depende de esta interfaz, nunca de un SDK de proveedor directamente.
 * La implementación concreta vive en src/integrations/ia-provider y es
 * intercambiable sin tocar los módulos consumidores.
 *
 * Regla no negociable: toda sugerencia de IA nace en estado "sugerido" y
 * requiere aprobación explícita de un médico antes de convertirse en contenido
 * clínico, documento o mensaje enviado a un paciente. La IA nunca decide ni
 * publica de forma autónoma.
 */

export type EstadoSugerenciaIA = "sugerido" | "aprobado" | "descartado";

export interface SugerenciaIA {
  contenido: string;
  estado: EstadoSugerenciaIA;
  contexto: Record<string, unknown>;
}

export interface AsistenteIA {
  sugerirRespuestaConversacion(input: {
    conversacionId: string;
    mensajes: { rol: "paciente" | "medico" | "ia"; contenido: string }[];
  }): Promise<SugerenciaIA>;

  clasificarConversacion(input: {
    conversacionId: string;
    mensajes: { rol: "paciente" | "medico" | "ia"; contenido: string }[];
  }): Promise<{ categoria: string; requiereEscalarAMedico: boolean }>;

  redactarBorradorDocumento(input: {
    tipoDocumento: string;
    datosConsulta: Record<string, unknown>;
  }): Promise<SugerenciaIA>;

  resumirConsulta(input: {
    consultaId: string;
    datosConsulta: Record<string, unknown>;
  }): Promise<SugerenciaIA>;
}
