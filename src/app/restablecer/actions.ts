"use server";

import { redirect } from "next/navigation";
import { restablecerContrasena, TokenRecuperacionInvalidoError } from "@/modules/acceso/recuperacion";

export async function restablecerAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmarPassword") ?? "");

  if (password.length < 8) {
    redirect(`/restablecer?token=${encodeURIComponent(token)}&error=corta`);
  }
  if (password !== confirmar) {
    redirect(`/restablecer?token=${encodeURIComponent(token)}&error=no_coincide`);
  }

  try {
    await restablecerContrasena(token, password);
  } catch (err) {
    if (err instanceof TokenRecuperacionInvalidoError) {
      redirect(`/restablecer?token=${encodeURIComponent(token)}&error=vencido`);
    }
    throw err;
  }

  redirect("/login?restablecida=1");
}
