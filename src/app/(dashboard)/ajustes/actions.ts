"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMedico } from "@/modules/core/autorizacion";
import {
  pedirBajaAFicha,
  registrarPagoRealizado,
  YaHayPagoPendienteError,
  ComprobanteInvalidoError,
} from "@/modules/suscripcion/pagoManual";

const TAMANO_MAXIMO_COMPROBANTE = 3 * 1024 * 1024; // 3MB — margen bajo el límite de 4MB de next.config.ts (el resto es overhead de multipart).

/**
 * "Ya pagué" en /ajustes — crea el `Pago` en PENDIENTE (ver pagoManual.ts),
 * con la captura del comprobante adjunta en el mismo formulario (10-nov-
 * 2026: antes se mandaba aparte por WhatsApp, "no por whatsapp aca
 * dentro"). No hay nada que validar del lado de SPIDI acá (cuenta
 * personal, sin API): confirmar que el pago existió de verdad lo sigue
 * haciendo una persona en /superadmin/pagos, ahora viendo el comprobante
 * directo ahí.
 */
export async function confirmarPagoRealizadoAction(formData: FormData) {
  const session = await requireMedico();
  const plan = formData.get("plan");
  if (plan !== "FICHA" && plan !== "PRO") return;

  const archivo = formData.get("comprobante");
  let comprobante: { bytes: Buffer; tipo: string } | null = null;

  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > TAMANO_MAXIMO_COMPROBANTE) {
      redirect("/ajustes?errorComprobante=muy_grande");
    }
    comprobante = {
      bytes: Buffer.from(await archivo.arrayBuffer()),
      tipo: archivo.type,
    };
  } else {
    // El comprobante es obligatorio ahora que reemplaza el paso de
    // WhatsApp — sin él, /superadmin/pagos no tendría nada contra qué
    // confirmar.
    redirect("/ajustes?errorComprobante=falta");
  }

  try {
    await registrarPagoRealizado(session.user.organizacionId, plan, comprobante);
  } catch (err) {
    if (err instanceof ComprobanteInvalidoError) {
      redirect("/ajustes?errorComprobante=tipo_invalido");
    }
    if (!(err instanceof YaHayPagoPendienteError)) throw err;
  }
  revalidatePath("/ajustes");
}

export async function pedirBajaAFichaAction() {
  const session = await requireMedico();
  await pedirBajaAFicha(session.user.organizacionId);
  revalidatePath("/ajustes");
}
