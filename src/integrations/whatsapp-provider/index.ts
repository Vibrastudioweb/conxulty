import type { Mensaje } from "@/modules/comunicacion/types";

/**
 * Puerto del proveedor de WhatsApp. La integración real (API oficial de
 * WhatsApp Business u otro proveedor) se implementa en fases posteriores.
 *
 * El resto del sistema (módulo comunicacion, IA) depende de esta interfaz,
 * nunca del SDK del proveedor directamente.
 */
export interface ProveedorWhatsApp {
  enviarMensaje(input: {
    conversacionId: string;
    contenido: string;
  }): Promise<Mensaje>;
}

/** Fase 0: sin proveedor real conectado. */
export class ProveedorWhatsAppNoConfigurado implements ProveedorWhatsApp {
  async enviarMensaje(): Promise<Mensaje> {
    throw new Error(
      "Proveedor de WhatsApp no configurado todavía. Arquitectura preparada en Fase 0, integración real pendiente.",
    );
  }
}
