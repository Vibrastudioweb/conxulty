/**
 * Único lugar donde el OS habla con Resend (13-nov-2026).
 *
 * Antes cada flujo que mandaba un correo repetía el mismo bloque de fetch
 * —clave, remitente, tiempo de espera, manejo de error—: recuperación de
 * contraseña y aviso de solicitud de acceso. Al sumar los avisos de pago
 * iban a ser tres copias de lo mismo, y con eso tres sitios donde ajustar
 * un tiempo de espera o cambiar el remitente. Acá está una sola vez.
 *
 * Siempre best-effort, nunca lanza: un correo es un aviso, no el trabajo.
 * Ningún flujo de este producto se cae porque Resend esté lento — el dato
 * ya quedó guardado antes de llamar acá.
 *
 * Variables de entorno:
 *  - RESEND_API_KEY (obligatoria; sin ella solo queda un warning en el log)
 *  - RESEND_FROM_EMAIL (opcional; debe ser de un dominio verificado en Resend)
 *  - APP_URL (opcional; para armar enlaces absolutos, ver `urlBase`)
 */

const REMITENTE_POR_DEFECTO = "Conxulty <no-reply@conxulty.com>";
const TIEMPO_ESPERA_MS = 5000;

export interface CorreoAEnviar {
  para: string | string[];
  asunto: string;
  texto: string;
  /** A dónde contesta quien recibe (ej. el correo del médico). */
  responderA?: string;
  /** Prefijo del log, para saber de qué flujo vino una falla. */
  origen: string;
}

/** @returns si se envió — para quien quiera registrarlo, nunca para decidir. */
export async function enviarCorreo(correo: CorreoAEnviar): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[${correo.origen}] RESEND_API_KEY no configurada: no se envió el correo.`);
    return false;
  }

  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? REMITENTE_POR_DEFECTO,
        to: Array.isArray(correo.para) ? correo.para : [correo.para],
        ...(correo.responderA ? { reply_to: correo.responderA } : {}),
        subject: correo.asunto,
        text: correo.texto,
      }),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });

    if (!respuesta.ok) {
      console.error(`[${correo.origen}] Resend respondió ${respuesta.status}: ${await respuesta.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[${correo.origen}] Falló el envío del correo:`, err);
    return false;
  }
}

/** Base para armar enlaces absolutos dentro de un correo. */
export function urlBase(): string {
  return (process.env.APP_URL ?? "https://app.conxulty.com").replace(/\/+$/, "");
}
