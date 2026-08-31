/**
 * Eventos de dominio del módulo cobros-caja.
 *
 * El módulo emite estos eventos sin saber quién los escucha. La integración
 * opcional con CUADRAO (src/integrations/cuadrao) es un suscriptor más: si no
 * está configurada, el evento simplemente no tiene listener. El núcleo de
 * cobros/caja no importa nada de src/integrations/cuadrao.
 */

export interface CobroRegistrado {
  tipo: "CobroRegistrado";
  cobroId: string;
  organizacionId: string;
  monto: string;
  moneda: string;
  fecha: Date;
}

export interface CajaCerrada {
  tipo: "CajaCerrada";
  cajaId: string;
  organizacionId: string;
  fechaCierre: Date;
}

export type EventoCobrosCaja = CobroRegistrado | CajaCerrada;

export interface PublicadorEventosCobrosCaja {
  publicar(evento: EventoCobrosCaja): Promise<void>;
}
