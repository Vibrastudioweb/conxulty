import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";

export class CajaYaAbiertaError extends Error {
  constructor() {
    super("Ya hay una caja abierta para esta organización.");
    this.name = "CajaYaAbiertaError";
  }
}

export class CajaNoAbiertaError extends Error {
  constructor() {
    super("No hay una caja abierta para esta organización.");
    this.name = "CajaNoAbiertaError";
  }
}

export class MontoContadoRequeridoError extends Error {
  constructor() {
    super("El monto contado es obligatorio para cerrar la caja.");
    this.name = "MontoContadoRequeridoError";
  }
}

/**
 * Caja ABIERTA actual de la organización, o null si no hay ninguna. Usada
 * tanto para decidir qué mostrar en pantalla como para que registrarCobro/
 * registrarGasto (próximos pasos) puedan exigir "caja abierta" sin duplicar
 * esta misma consulta.
 */
export async function obtenerCajaAbierta(input: { organizacionId: string }) {
  return prisma.caja.findFirst({
    where: { organizacionId: input.organizacionId, estado: "ABIERTA" },
  });
}

/**
 * Abre una caja para la organización. Cualquier usuario autenticado puede
 * hacerlo (MEDICO, STAFF o ADMIN) — no hay distinción de permisos en este
 * módulo. Bloquea si ya existe una Caja ABIERTA para la organización: solo
 * una caja abierta a la vez.
 *
 * No pasa por consistenciaOrganizacional.ts: la única entidad relacionada
 * (abiertaPorId) es el propio actor autenticado, ya confiable por venir de
 * la sesión y no de un formulario. El aislamiento entre organizaciones es
 * el propio `where: { organizacionId }` de la búsqueda de abajo.
 *
 * El findFirst es solo la vía rápida: entre él y el create hay una ventana
 * de carrera. El candado real es el índice único parcial
 * cajas_una_abierta_por_organizacion en la base de datos — si dos requests
 * simultáneas pasan el findFirst, el segundo create falla con P2002 y aquí
 * se traduce al mismo CajaYaAbiertaError.
 */
export async function abrirCaja(input: {
  organizacionId: string;
  actorId: string;
  montoInicialUsd: number | string;
  montoInicialBs: number | string;
}): Promise<{ cajaId: string }> {
  const cajaAbierta = await prisma.caja.findFirst({
    where: { organizacionId: input.organizacionId, estado: "ABIERTA" },
    select: { id: true },
  });

  if (cajaAbierta) {
    throw new CajaYaAbiertaError();
  }

  let caja;
  try {
    caja = await prisma.caja.create({
      data: {
        organizacionId: input.organizacionId,
        abiertaPorId: input.actorId,
        montoInicialUsd: input.montoInicialUsd,
        montoInicialBs: input.montoInicialBs,
      },
    });
  } catch (err) {
    // Aparte de la PK (cuid), el único unique de `cajas` es el índice parcial.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new CajaYaAbiertaError();
    }
    throw err;
  }

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "abrir_caja",
    entidadTipo: "Caja",
    entidadId: caja.id,
  });

  return { cajaId: caja.id };
}

/**
 * Cierra la caja abierta actual de la organización con arqueo: calcula
 * montoEsperadoUsd/Bs a partir de montoInicialUsd/Bs + movimientos EFECTIVO
 * (esEfectivo: true) de esa caja, agrupados por moneda y nunca sumados
 * entre sí (ver changelog punto 46 — el cálculo anterior mezclaba USD y Bs,
 * y contaba pagos no físicos como si fueran plata en la gaveta). Recibe
 * montoContadoUsd/Bs (ambos obligatorios, incluso si son 0 — lo que se
 * rechaza es la AUSENCIA del dato, no el valor cero) y guarda
 * diferenciaUsd/Bs = montoContado - montoEsperado por moneda. Si no cuadra,
 * la diferencia queda registrada y visible — no hay reversión automática.
 *
 * No recibe cajaId: usa la caja abierta actual, mismo criterio que
 * registrarCobro/registrarGasto. Toda la aritmética de dinero usa
 * Prisma.Decimal (.plus()/.minus()), nunca operadores nativos de JS.
 */
export async function cerrarCaja(input: {
  organizacionId: string;
  actorId: string;
  montoContadoUsd: number | string | null | undefined;
  montoContadoBs: number | string | null | undefined;
}): Promise<{
  cajaId: string;
  montoEsperadoUsd: string;
  montoEsperadoBs: string;
  diferenciaUsd: string;
  diferenciaBs: string;
}> {
  if (
    input.montoContadoUsd === null ||
    input.montoContadoUsd === undefined ||
    input.montoContadoBs === null ||
    input.montoContadoBs === undefined
  ) {
    throw new MontoContadoRequeridoError();
  }

  const cajaAbierta = await prisma.caja.findFirst({
    where: { organizacionId: input.organizacionId, estado: "ABIERTA" },
  });
  if (!cajaAbierta) {
    throw new CajaNoAbiertaError();
  }

  const montoContadoUsd = new Prisma.Decimal(input.montoContadoUsd);
  const montoContadoBs = new Prisma.Decimal(input.montoContadoBs);

  const { montoEsperadoUsd, montoEsperadoBs, diferenciaUsd, diferenciaBs } =
    await prisma.$transaction(async (tx) => {
      // El arqueo solo le importa al EFECTIVO: los movimientos con métodos
      // no físicos (Zelle, transferencia, etc.) no entran en esta cuenta —
      // ver changelog punto 46. Se agrupa por `moneda` porque un cobro en
      // USD y uno en Bs nunca deben sumarse entre sí.
      const [ingresos, egresos] = await Promise.all([
        tx.movimientoCaja.groupBy({
          by: ["moneda"],
          where: { cajaId: cajaAbierta.id, tipo: "INGRESO", esEfectivo: true },
          _sum: { monto: true },
        }),
        tx.movimientoCaja.groupBy({
          by: ["moneda"],
          where: { cajaId: cajaAbierta.id, tipo: "EGRESO", esEfectivo: true },
          _sum: { monto: true },
        }),
      ]);

      const totalPorMoneda = (
        filas: Array<{ moneda: string; _sum: { monto: Prisma.Decimal | null } }>,
        moneda: string,
      ) =>
        filas.find((f) => f.moneda === moneda)?._sum.monto ?? new Prisma.Decimal(0);

      // Hoy el formulario no deja elegir moneda (siempre "USD" por default
      // del schema) — todo lo que no sea "USD" se cuenta como Bs. Cuando el
      // selector de moneda exista (Caja 10-15), esto sigue siendo correcto
      // sin cambios.
      const totalIngresosUsd = totalPorMoneda(ingresos, "USD");
      const totalEgresosUsd = totalPorMoneda(egresos, "USD");
      const totalIngresosBs = ingresos
        .filter((f) => f.moneda !== "USD")
        .reduce((acc, f) => acc.plus(f._sum.monto ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));
      const totalEgresosBs = egresos
        .filter((f) => f.moneda !== "USD")
        .reduce((acc, f) => acc.plus(f._sum.monto ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));

      const montoEsperadoUsd = cajaAbierta.montoInicialUsd
        .plus(totalIngresosUsd)
        .minus(totalEgresosUsd);
      const montoEsperadoBs = cajaAbierta.montoInicialBs
        .plus(totalIngresosBs)
        .minus(totalEgresosBs);
      const diferenciaUsd = montoContadoUsd.minus(montoEsperadoUsd);
      const diferenciaBs = montoContadoBs.minus(montoEsperadoBs);

      const actualizada = await tx.caja.updateMany({
        where: { id: cajaAbierta.id, organizacionId: input.organizacionId, estado: "ABIERTA" },
        data: {
          estado: "CERRADA",
          fechaCierre: new Date(),
          montoContadoUsd,
          montoContadoBs,
          montoEsperadoUsd,
          montoEsperadoBs,
          diferenciaUsd,
          diferenciaBs,
        },
      });

      if (actualizada.count !== 1) {
        throw new CajaNoAbiertaError();
      }

      return { montoEsperadoUsd, montoEsperadoBs, diferenciaUsd, diferenciaBs };
    });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "cerrar_caja",
    entidadTipo: "Caja",
    entidadId: cajaAbierta.id,
    cambios: {
      montoContadoUsd: montoContadoUsd.toString(),
      montoContadoBs: montoContadoBs.toString(),
      montoEsperadoUsd: montoEsperadoUsd.toString(),
      montoEsperadoBs: montoEsperadoBs.toString(),
      diferenciaUsd: diferenciaUsd.toString(),
      diferenciaBs: diferenciaBs.toString(),
    },
  });

  return {
    cajaId: cajaAbierta.id,
    montoEsperadoUsd: montoEsperadoUsd.toString(),
    montoEsperadoBs: montoEsperadoBs.toString(),
    diferenciaUsd: diferenciaUsd.toString(),
    diferenciaBs: diferenciaBs.toString(),
  };
}
