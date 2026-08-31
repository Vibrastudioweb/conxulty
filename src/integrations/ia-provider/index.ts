import type { AsistenteIA } from "@/modules/ia/ports";

/**
 * Adaptador del proveedor de IA. Implementa el puerto AsistenteIA.
 *
 * Fase 0: no hay proveedor real conectado. Esta clase existe únicamente para
 * dejar la arquitectura lista (el resto del sistema ya puede depender del
 * puerto AsistenteIA) sin construir la integración real todavía.
 */
export class ProveedorIANoConfigurado implements AsistenteIA {
  private noImplementado(): never {
    throw new Error(
      "Proveedor de IA no configurado todavía. Arquitectura preparada en Fase 0, implementación pendiente.",
    );
  }

  sugerirRespuestaConversacion: AsistenteIA["sugerirRespuestaConversacion"] =
    async () => this.noImplementado();

  clasificarConversacion: AsistenteIA["clasificarConversacion"] = async () =>
    this.noImplementado();

  redactarBorradorDocumento: AsistenteIA["redactarBorradorDocumento"] =
    async () => this.noImplementado();

  resumirConsulta: AsistenteIA["resumirConsulta"] = async () =>
    this.noImplementado();
}
