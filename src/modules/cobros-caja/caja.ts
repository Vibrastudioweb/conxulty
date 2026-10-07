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
  montoInicial: number | string;
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
        montoInicial: input.montoInicial,
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
 * montoEsperado a partir de montoInicial + movimientos de esa caja (nunca
 * editado a mano), recibe montoContado (obligatorio, incluso si es 0 — lo
 * que se rechaza es la AUSENCIA del dato, no el valor cero) y guarda
 * diferencia = montoContado - montoEsperado. Si no cuadra, la diferencia
 * queda registrada y visible — no hay reversión automática.
 *
 * No recibe cajaId: usa la caja abierta actual, mismo criterio que
 * registrarCobro/registrarGasto. Toda la aritmética de dinero usa
 * Prisma.Decimal (.plus()/.minus()), nunca operadores nativos de JS.
 */
export async function cerrarCaja(input: {
  organizacionId: string;
  actorId: string;
  montoContado: number | string | null | undefined;
}): Promise<{ cajaId: string; montoEsperado: string; diferencia: string }> {
  if (input.montoContado === null || input.montoContado === undefined) {
    throw new MontoContadoRequeridoError();
  }

  const cajaAbierta = await prisma.caja.findFirst({
    where: { organizacionId: input.organizacionId, estado: "ABIERTA" },
  });
  if (!cajaAbierta) {
    throw new CajaNoAbiertaError();
  }

  const montoContado = new Prisma.Decimal(input.montoContado);

  const { montoEsperado, diferencia } = await prisma.$transaction(async (tx) => {
    const [ingresos, egresos] = await Promise.all([
      tx.movimientoCaja.aggregate({
        where: { cajaId: cajaAbierta.id, tipo: "INGRESO" },
        _sum: { monto: true },
      }),
      tx.movimientoCaja.aggregate({
        where: { cajaId: cajaAbierta.id, tipo: "EGRESO" },
        _sum: { monto: true },
      }),
    ]);

    const totalIngresos = ingresos._sum.monto ?? new Prisma.Decimal(0);
    const totalEgresos = egresos._sum.monto ?? new Prisma.Decimal(0);
    const montoEsperado = cajaAbierta.montoInicial.plus(totalIngresos).minus(totalEgresos);
    const diferencia = montoContado.minus(montoEsperado);

    const actualizada = await tx.caja.updateMany({
      where: { id: cajaAbierta.id, organizacionId: input.organizacionId, estado: "ABIERTA" },
      data: {
        estado: "CERRADA",
        fechaCierre: new Date(),
        montoContado,
        montoEsperado,
        diferencia,
      },
    });

    if (actualizada.count !== 1) {
      throw new CajaNoAbiertaError();
    }

    return { montoEsperado, diferencia };
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "cerrar_caja",
    entidadTipo: "Caja",
    entidadId: cajaAbierta.id,
    cambios: {
      montoContado: montoContado.toString(),
      montoEsperado: montoEsperado.toString(),
      diferencia: diferencia.toString(),
    },
  });

  return {
    cajaId: cajaAbierta.id,
    montoEsperado: montoEsperado.toString(),
    diferencia: diferencia.toString(),
  };
}
