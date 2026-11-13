"use server";

import { revalidatePath } from "next/cache";
import { requireSesion } from "@/modules/core/autorizacion";
import { reenviarVerificacion } from "@/modules/acceso/verificacionEmail";

/**
 * Reenvía el correo de confirmación al usuario de la sesión.
 *
 * No recibe ningún dato del formulario a propósito: el destinatario sale
 * de la sesión, nunca de lo que mande el cliente. Así el botón no sirve
 * para mandarle correos a nadie más.
 */
export async function reenviarVerificacionAction(): Promise<void> {
  const session = await requireSesion();
  await reenviarVerificacion(session.user.id);
  revalidatePath("/", "layout");
}
