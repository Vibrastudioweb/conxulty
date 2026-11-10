"use server";

import { redirect } from "next/navigation";
import { solicitarRecuperacion } from "@/modules/acceso/recuperacion";

/**
 * Siempre redirige al mismo "enviado=1" exista o no la cuenta — mismo
 * criterio de no revelar correos registrados que ya usa `auth/index.ts`
 * (HASH_DUMMY) para el login. `solicitarRecuperacion` nunca lanza.
 */
export async function recuperarAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  await solicitarRecuperacion(email);
  redirect("/recuperar?enviado=1");
}
