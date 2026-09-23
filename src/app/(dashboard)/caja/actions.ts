"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSesion } from "@/modules/core/autorizacion";
import { abrirCaja, CajaYaAbiertaError } from "@/modules/cobros-caja/caja";

const montoInicialSchema = z.coerce.number().min(0);

export async function abrirCajaAction(formData: FormData) {
  const session = await requireSesion();

  const parseo = montoInicialSchema.safeParse(formData.get("montoInicial"));
  if (!parseo.success) {
    redirect("/caja?error=monto_invalido");
  }

  try {
    await abrirCaja({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      montoInicial: parseo.data,
    });
  } catch (err) {
    if (err instanceof CajaYaAbiertaError) {
      redirect("/caja?error=ya_abierta");
    }
    throw err;
  }

  redirect("/caja?abierta=1");
}
