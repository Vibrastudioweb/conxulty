"use server";

import { revalidatePath } from "next/cache";
import { requireMedico } from "@/modules/core/autorizacion";
import {
  pedirBajaAFicha,
  registrarPagoRealizado,
  YaHayPagoPendienteError,
} from "@/modules/suscripcion/pagoManual";

/**
 * "Ya pagué" en /ajustes — crea el `Pago` en PENDIENTE (ver pagoManual.ts).
 * No hay nada que validar del lado de SPIDI acá (cuenta personal, sin
 * API): confirmar que el pago existió de verdad lo hace una persona en
 * /superadmin/pagos, viendo el comprobante que el médico manda aparte.
 */
export async function confirmarPagoRealizadoAction(formData: FormData) {
  const session = await requireMedico();
  const plan = formData.get("plan");
  if (plan !== "FICHA" && plan !== "PRO") return;

  try {
    await registrarPagoRealizado(session.user.organizacionId, plan);
  } catch (err) {
    if (!(err instanceof YaHayPagoPendienteError)) throw err;
  }
  revalidatePath("/ajustes");
}

export async function pedirBajaAFichaAction() {
  const session = await requireMedico();
  await pedirBajaAFicha(session.user.organizacionId);
  revalidatePath("/ajustes");
}
