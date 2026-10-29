import { prisma } from "@/db/client";

export type ResumenMoneda = {
  moneda: string;
  ingresos: number;
  gastos: number;
  ganancia: number;
};

/**
 * Resumen financiero por rango de fechas (29-oct-2026 — ver changelog
 * punto 17/44, pedido directo del usuario: "cuánta plata le entró y qué
 * gastos tuvo su consultorio y cuánto quedó de ganancia"). Independiente
 * del estado de Caja (abierta/cerrada): se agrega directo sobre `Cobro` y
 * `Gasto` por `fecha` + `organizacionId`, los mismos campos reales que ya
 * existían — este reporte no depende de si hubo una, varias, o ninguna
 * caja abierta en el medio del rango.
 *
 * Por moneda, nunca sumadas entre sí (USD y Bs no se mezclan — mismo
 * criterio que `obtenerTotalCobradoDelDia` en Hoy, y la razón por la que
 * el arqueo de Caja hoy está mal: suma monedas distintas sin separar).
 * "Ingresos" usa `estado !== ANULADO` (incluye PENDIENTE/PARCIAL/PAGADO),
 * mismo criterio ya establecido en `obtenerTotalCobradoDelDia` — significa
 * "cobros registrados en el rango", no necesariamente ya saldados.
 */
export async function obtenerResumenFinanciero(input: {
  organizacionId: string;
  inicio: Date;
  fin: Date;
}): Promise<ResumenMoneda[]> {
  const [ingresosPorMoneda, gastosPorMoneda] = await Promise.all([
    prisma.cobro.groupBy({
      by: ["moneda"],
      where: {
        organizacionId: input.organizacionId,
        estado: { not: "ANULADO" },
        fecha: { gte: input.inicio, lt: input.fin },
      },
      _sum: { monto: true },
    }),
    prisma.gasto.groupBy({
      by: ["moneda"],
      where: {
        organizacionId: input.organizacionId,
        fecha: { gte: input.inicio, lt: input.fin },
      },
      _sum: { monto: true },
    }),
  ]);

  const monedas = new Set<string>([
    ...ingresosPorMoneda.map((f) => f.moneda),
    ...gastosPorMoneda.map((f) => f.moneda),
  ]);

  return Array.from(monedas)
    .sort()
    .map((moneda) => {
      const ingresos = Number(
        ingresosPorMoneda.find((f) => f.moneda === moneda)?._sum.monto ?? 0,
      );
      const gastos = Number(
        gastosPorMoneda.find((f) => f.moneda === moneda)?._sum.monto ?? 0,
      );
      return { moneda, ingresos, gastos, ganancia: ingresos - gastos };
    });
}
