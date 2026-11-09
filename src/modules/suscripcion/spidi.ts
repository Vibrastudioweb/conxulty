/**
 * Cliente de SPIDI (docs.mispidi.com) — pasarela elegida para el Plan Pro
 * (changelog punto 89). SIN TERMINAR A PROPÓSITO: lo único que tengo de su
 * API es la página conceptual del SDK ("pagar dentro de tu app" vs. la API
 * de Productos con link de redirección) — no la Referencia de API
 * (endpoints, autenticación, payload de crear sesión de pago/suscripción,
 * formato y firma del webhook de confirmación). Escribir esas llamadas
 * ahora sería inventar un contrato que no existe — exactamente lo que el
 * método VIBRA pide no hacer.
 *
 * Lo que SÍ está decidido y no cambia cuando se complete esto:
 * - La API key de SPIDI vive en el servidor como variable de entorno
 *   (`SPIDI_API_KEY`) — nunca se tipea, pega ni maneja desde acá. La
 *   configura el usuario directamente en Render/donde corra el servidor.
 * - Todo lo que haga falta crear del lado de SPIDI (comercio, productos
 *   Ficha/Pro con los precios de `precios.ts`) se hace en su panel, no por
 *   código.
 *
 * Para terminar este módulo hace falta, de "Referencia" y "Credenciales"
 * en docs.mispidi.com: el endpoint y payload para crear una sesión de
 * pago/suscripción, y el formato (+ firma) del webhook que confirma un
 * cobro — ese webhook es lo que mueve `Suscripcion.estado` a ACTIVA y crea
 * la fila en `Pago`, no una llamada que el usuario haga desde la UI.
 */

export class SpidiNoConfiguradoError extends Error {
  constructor() {
    super(
      "La integración con SPIDI todavía no está conectada — falta su Referencia de API (endpoint de pago/suscripción y formato del webhook).",
    );
    this.name = "SpidiNoConfiguradoError";
  }
}

/**
 * Punto único por el que debe pasar cualquier botón de "Cambiar plan" /
 * "Agregar método de pago" en /ajustes — hoy siempre lanza
 * `SpidiNoConfiguradoError`, a propósito, para que la UI muestre un estado
 * honesto ("pronto") en vez de simular un pago que no ocurre.
 */
export async function crearSesionDePago(_params: {
  organizacionId: string;
  plan: "FICHA" | "PRO";
}): Promise<never> {
  throw new SpidiNoConfiguradoError();
}
