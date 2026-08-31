import type { EventoCobrosCaja } from "@/modules/cobros-caja/eventos";

/**
 * Integración opcional con CUADRAO (plataforma administrativa/contable
 * independiente). CONXULTY funciona completamente sin esta integración.
 *
 * Se suscribe a eventos de dominio de cobros-caja (ver
 * src/modules/cobros-caja/eventos.ts) para evitar doble registro contable.
 * Comunicación saliente únicamente (CONXULTY -> CUADRAO); sin dependencia en
 * sentido inverso ni acoplamiento de esquema de base de datos.
 *
 * Fase 0: sin implementación real ni credenciales. Desactivada por defecto.
 */
export interface IntegracionCuadrao {
  habilitada: boolean;
  manejarEvento(evento: EventoCobrosCaja): Promise<void>;
}

export class IntegracionCuadraoDesactivada implements IntegracionCuadrao {
  habilitada = false;

  async manejarEvento(): Promise<void> {
    // No-op: integración opcional, no configurada en esta organización.
  }
}
