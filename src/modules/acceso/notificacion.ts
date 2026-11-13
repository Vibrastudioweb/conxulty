import type { SolicitudAcceso } from "@prisma/client";
import { enviarCorreo } from "@/modules/correo/enviar";

const DESTINO_POR_DEFECTO = "soporte@conxulty.com";

/**
 * Avisa por email que llegó una solicitud de acceso nueva.
 *
 * Best-effort a propósito: la solicitud ya está guardada cuando se llama
 * aquí, y un fallo del proveedor de email no debe perderla ni mostrarle un
 * error al médico. Por eso nunca lanza; devuelve si se envió.
 *
 * 13-nov-2026: el bloque de fetch a Resend que vivía acá se mudó a
 * `modules/correo/enviar.ts` — era el mismo en tres flujos. El destino
 * sigue saliendo de SOLICITUDES_EMAIL_TO (default soporte@conxulty.com).
 */
export async function notificarSolicitudAcceso(
  solicitud: Pick<
    SolicitudAcceso,
    "nombre" | "nombreConsultorio" | "email" | "telefono" | "especialidad"
  >,
): Promise<boolean> {
  const texto = [
    `Nueva solicitud de acceso — ${solicitud.nombre} — ${solicitud.nombreConsultorio} — ${solicitud.email} — ${solicitud.telefono}`,
    solicitud.especialidad ? `Especialidad: ${solicitud.especialidad}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return enviarCorreo({
    origen: "acceso",
    para: process.env.SOLICITUDES_EMAIL_TO ?? DESTINO_POR_DEFECTO,
    responderA: solicitud.email,
    asunto: `Nueva solicitud de acceso — ${solicitud.nombreConsultorio}`,
    texto,
  });
}
