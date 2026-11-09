/**
 * Catálogo cerrado de métodos de pago (ver changelog punto 11/46). Antes
 * `Cobro.metodoPago` era texto libre y `Gasto` no tenía ningún campo de
 * método — eso hacía imposible calcular "saldo en cuentas" por método o
 * confiar en que "efectivo" significara plata física de verdad.
 *
 * Cada método tiene moneda y "es efectivo" FIJOS, nunca se piden por
 * separado en un formulario: se derivan de aquí en registrarCobro()/
 * registrarGasto() para que no puedan contradecirse (p.ej. un Zelle
 * marcado como efectivo por error). Este archivo es texto plano (no
 * Server/Client Component), así que se puede importar tanto desde
 * Server Actions/módulos como desde el formulario en page.tsx.
 */
export const METODOS_PAGO = [
  "EFECTIVO_USD",
  "EFECTIVO_BS",
  "PAGO_MOVIL",
  "TRANSFERENCIA",
  "TARJETA",
  "ZELLE",
] as const;

export type MetodoPagoId = (typeof METODOS_PAGO)[number];

export interface InfoMetodoPago {
  label: string;
  moneda: "USD" | "Bs";
  /** Si cuenta como plata física en la gaveta para el arqueo de Caja. */
  esEfectivo: boolean;
}

export const INFO_METODO_PAGO: Record<MetodoPagoId, InfoMetodoPago> = {
  EFECTIVO_USD: { label: "Efectivo ($)", moneda: "USD", esEfectivo: true },
  EFECTIVO_BS: { label: "Efectivo (Bs)", moneda: "Bs", esEfectivo: true },
  PAGO_MOVIL: { label: "Pago móvil (Bs)", moneda: "Bs", esEfectivo: false },
  TRANSFERENCIA: { label: "Transferencia (Bs)", moneda: "Bs", esEfectivo: false },
  TARJETA: { label: "Tarjeta (Bs)", moneda: "Bs", esEfectivo: false },
  ZELLE: { label: "Zelle ($)", moneda: "USD", esEfectivo: false },
};
