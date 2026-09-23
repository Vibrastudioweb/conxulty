import type { CategoriaGasto } from "@prisma/client";
import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { obtenerCajaAbierta, CajaNoAbiertaError } from "@/modules/cobros-caja/caja";

export { CajaNoAbiertaError };

/**
 * Registra un gasto operativo del consultorio y su salida de dinero (Gasto +
 * MovimientoCaja de egreso, en una sola transacción). Requiere caja abierta.
 *
 * No recibe `cajaId` como input: siempre usa la caja abierta actual de la
 * organización (solo puede haber una a la vez), igual que registrarCobro —
 * un gasto tardío se registra contra la caja de hoy, con la fecha real en
 * la nota si hace falta aclararlo.
 */
export async function registrarGasto(input: {
  organizacionId: string;
  actorId: string;
  categoria: CategoriaGasto;
  monto: number | string;
  nota?: string | null;
}): Promise<{ gastoId: string }> {
  const cajaAbierta = await obtenerCajaAbierta({
    organizacionId: input.organizacionId,
  });
  if (!cajaAbierta) {
    throw new CajaNoAbiertaError();
  }

  const gasto = await prisma.$transaction(async (tx) => {
    const gastoCreado = await tx.gasto.create({
      data: {
        organizacionId: input.organizacionId,
        cajaId: cajaAbierta.id,
        categoria: input.categoria,
        monto: input.monto,
        nota: input.nota?.trim() || null,
        registradoPorId: input.actorId,
      },
    });

    await tx.movimientoCaja.create({
      data: {
        organizacionId: input.organizacionId,
        cajaId: cajaAbierta.id,
        gastoId: gastoCreado.id,
        tipo: "EGRESO",
        origen: "GASTO",
        monto: input.monto,
        moneda: gastoCreado.moneda,
        registradoPorId: input.actorId,
      },
    });

    return gastoCreado;
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "registrar_gasto",
    entidadTipo: "Gasto",
    entidadId: gasto.id,
  });

  return { gastoId: gasto.id };
}
