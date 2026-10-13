/**
 * Envío de email transaccional con Resend (API REST, sin SDK).
 *
 * Variables de entorno (configurar en Render → Environment):
 *   RESEND_API_KEY          obligatoria para que se envíe; sin ella solo se registra un aviso.
 *   RESEND_FROM             remitente verificado en Resend. Por defecto
 *                           "Conxulty <onboarding@resend.dev>" (solo entrega al email dueño
 *                           de la cuenta de Resend hasta que verifiques un dominio).
 *   SOLICITUDES_NOTIFY_TO   destinatario de los avisos. Por defecto soporte@conxulty.com.
 *
 * El envío es "best effort": un fallo se registra pero nunca hace fallar la
 * solicitud (la solicitud ya quedó guardada y visible en /superadmin).
 */

export interface ResultadoEmail {
  enviado: boolean;
  motivo?: string;
}

export async function enviarEmail(input: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<ResultadoEmail> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[solicitudes] RESEND_API_KEY no está configurada: no se envió la notificación por email.",
    );
    return { enviado: false, motivo: "RESEND_API_KEY ausente" };
  }

  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "Conxulty <onboarding@resend.dev>",
        to: [input.to],
        subject: input.subject,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      console.error(
        `[solicitudes] Resend respondió ${respuesta.status}: ${detalle.slice(0, 300)}`,
      );
      return { enviado: false, motivo: `Resend ${respuesta.status}` };
    }
    return { enviado: true };
  } catch (error) {
    console.error("[solicitudes] Error enviando email con Resend:", error);
    return { enviado: false, motivo: "error de red" };
  }
}

export async function notificarNuevaSolicitud(s: {
  nombre: string;
  nombreConsultorio: string;
  email: string;
  telefono: string;
  especialidad: string | null;
}): Promise<ResultadoEmail> {
  const to = process.env.SOLICITUDES_NOTIFY_TO ?? "soporte@conxulty.com";

  return enviarEmail({
    to,
    replyTo: s.email,
    subject: `Nueva solicitud de acceso — ${s.nombre} — ${s.nombreConsultorio}`,
    text: [
      `Nueva solicitud de acceso — ${s.nombre} — ${s.nombreConsultorio} — ${s.email} — ${s.telefono}`,
      "",
      `Nombre: ${s.nombre}`,
      `Consultorio: ${s.nombreConsultorio}`,
      `Email: ${s.email}`,
      `Teléfono: ${s.telefono}`,
      `Especialidad: ${s.especialidad ?? "—"}`,
      "",
      "Revísala y actívala desde /superadmin.",
    ].join("\n"),
  });
}
