"use server";

import { requireMedico } from "@/modules/core/autorizacion";
import { crearSesionDePago, SpidiNoConfiguradoError } from "@/modules/suscripcion/spidi";

export interface CambiarPlanResultado {
  ok: boolean;
  error?: string;
}

/**
 * Ambos botones de /ajustes (subir a Pro, agregar método de pago) pasan
 * por acá — hoy siempre falla con un mensaje claro en vez de simular un
 * pago, porque `crearSesionDePago` todavía no está conectado a SPIDI (ver
 * spidi.ts). No hay nada que mockear: cuando esté conectado, esta función
 * redirige al checkout real que devuelva SPIDI.
 */
export async function iniciarCambioPlan(
  plan: "FICHA" | "PRO",
): Promise<CambiarPlanResultado> {
  const session = await requireMedico();

  try {
    await crearSesionDePago({
      organizacionId: session.user.organizacionId,
      plan,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof SpidiNoConfiguradoError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}
