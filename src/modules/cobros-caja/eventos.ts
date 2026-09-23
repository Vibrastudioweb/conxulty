/**
 * Eventos de dominio del módulo cobros-caja.
 *
 * El módulo emite estos eventos sin saber quién los escucha: es un punto de
 * extensión para futuros suscriptores (hoy ninguno configurado). El núcleo
 * de cobros/caja no depende de ningún suscriptor externo.
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
