import type { SolicitudAcceso } from "@prisma/client";

const DESTINO_POR_DEFECTO = "soporte@conxulty.com";
const REMITENTE_POR_DEFECTO = "Conxulty <no-reply@conxulty.com>";

/**
 * Avisa por email (Resend) que llegó una solicitud de acceso nueva.
 *
 * Best-effort a propósito: la solicitud ya está guardada cuando se llama
 * aquí, y un fallo del proveedor de email no debe perderla ni mostrarle un
 * error al médico. Por eso nunca lanza; devuelve si se envió.
 *
 * Usa la API HTTP de Resend con fetch (sin dependencia nueva). Variables:
 *  - RESEND_API_KEY (obligatoria; sin ella solo se registra un warning)
 *  - SOLICITUDES_EMAIL_TO (opcional, default soporte@conxulty.com)
 *  - RESEND_FROM_EMAIL (opcional; debe ser de un dominio verificado en Resend)
 */
export async function notificarSolicitudAcceso(
  solicitud: Pick<
    SolicitudAcceso,
    "nombre" | "nombreConsultorio" | "email" | "telefono" | "especialidad"
  >,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[acceso] RESEND_API_KEY no configurada: no se envió la notificación de solicitud.",
    );
    return false;
  }

  const texto = [
    `Nueva solicitud de acceso — ${solicitud.nombre} — ${solicitud.nombreConsultorio} — ${solicitud.email} — ${solicitud.telefono}`,
    solicitud.especialidad ? `Especialidad: ${solicitud.especialidad}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? REMITENTE_POR_DEFECTO,
        to: [process.env.SOLICITUDES_EMAIL_TO ?? DESTINO_POR_DEFECTO],
        reply_to: solicitud.email,
        subject: `Nueva solicitud de acceso — ${solicitud.nombreConsultorio}`,
        text: texto,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!respuesta.ok) {
      console.error(
        `[acceso] Resend respondió ${respuesta.status}: ${await respuesta.text()}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[acceso] Falló el envío de la notificación:", err);
    return false;
  }
}
