"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/modules/core/autorizacion";
import { confirmarPago, rechazarPago } from "@/modules/suscripcion/pagoManual";

async function conPagoId(formData: FormData, fn: (pagoId: string) => Promise<void>) {
  await requireSuperadmin();
  const pagoId = String(formData.get("pagoId") ?? "");
  if (pagoId) await fn(pagoId);
  revalidatePath("/superadmin/pagos");
  redirect("/superadmin/pagos");
}

export async function confirmarPagoAction(formData: FormData) {
  await conPagoId(formData, confirmarPago);
}

export async function rechazarPagoAction(formData: FormData) {
  await conPagoId(formData, rechazarPago);
}
