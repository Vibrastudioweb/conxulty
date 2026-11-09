import { prisma } from "@/db/client";
import type { EstadoSuscripcion, PlanOrganizacion } from "@prisma/client";

export interface EstadoSuscripcionVista {
  planActual: PlanOrganizacion;
  estado: EstadoSuscripcion;
  planAlRenovar: PlanOrganizacion | null;
  finPeriodoActual: Date | null;
  metodoPagoResumen: string | null;
}

/**
 * No toda Organizacion tiene fila en `suscripciones` — solo se crea una al
 * primer intento real de pago/cambio de plan (ver actions.ts). Una
 * organización que nunca salió de Ficha, o que es anterior a este
 * changelog punto 89, simplemente no tiene fila: se sintetiza acá en vez
 * de forzar un backfill que no cambiaría ningún comportamiento (nadie dejó
 * de estar en Ficha por no tener la fila).
 */
export async function obtenerEstadoSuscripcion(
  organizacionId: string,
): Promise<EstadoSuscripcionVista> {
  const [organizacion, suscripcion] = await Promise.all([
    prisma.organizacion.findUniqueOrThrow({
      where: { id: organizacionId },
      select: { plan: true },
    }),
    prisma.suscripcion.findUnique({
      where: { organizacionId },
      select: {
        estado: true,
        planAlRenovar: true,
        finPeriodoActual: true,
        metodoPagoResumen: true,
      },
    }),
  ]);

  if (!suscripcion) {
    return {
      planActual: organizacion.plan,
      estado: "SIN_METODO_DE_PAGO",
      planAlRenovar: null,
      finPeriodoActual: null,
      metodoPagoResumen: null,
    };
  }

  return {
    planActual: organizacion.plan,
    estado: suscripcion.estado,
    planAlRenovar: suscripcion.planAlRenovar,
    finPeriodoActual: suscripcion.finPeriodoActual,
    metodoPagoResumen: suscripcion.metodoPagoResumen,
  };
}
