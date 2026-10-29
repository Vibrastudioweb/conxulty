import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { validarConsistenciaCobro } from "@/db/consistenciaOrganizacional";
import { ConsultaNoEncontradaError } from "@/modules/core/consultas";
import { obtenerCajaAbierta, CajaNoAbiertaError } from "@/modules/cobros-caja/caja";
import { INFO_METODO_PAGO, type MetodoPagoId } from "@/modules/cobros-caja/metodosPago";

export class ConsultaNoCerradaError extends Error {
  constructor() {
    super("Solo se puede cobrar una consulta que está cerrada.");
    this.name = "ConsultaNoCerradaError";
  }
}

export class ConceptoRequeridoError extends Error {
  constructor() {
    super("El concepto es obligatorio cuando el cobro no está ligado a una consulta.");
    this.name = "ConceptoRequeridoError";
  }
}

/**
 * Registra un cobro y su cobro efectivo (Cobro + MovimientoCaja de entrada,
 * en una sola transacción) — no hay flujo de PENDIENTE en esta ronda: el
 * Cobro queda PAGADO desde su creación. Requiere caja abierta.
 *
 * Dos formas de uso:
 * - Con `consultaId`: pacienteId/medicoId se derivan de la Consulta
 *   encontrada, ignorando lo que venga del formulario para esos dos campos
 *   (el cliente dice a qué consulta se refiere, no de quién es — mismo
 *   criterio que `abrirOCrearConsulta`). La Consulta debe estar CERRADA.
 * - Sin `consultaId` ("cobro rápido"): pacienteId/medicoId deben venir
 *   informados, y `concepto` es obligatorio.
 */
export async function registrarCobro(input: {
  organizacionId: string;
  actorId: string;
  consultaId?: string | null;
  pacienteId?: string;
  medicoId?: string;
  concepto?: string | null;
  monto: number | string;
  /** Catálogo cerrado — ver changelog punto 11/46. */
  metodoPago: MetodoPagoId;
}): Promise<{ cobroId: string }> {
  const infoMetodo = INFO_METODO_PAGO[input.metodoPago];
  const cajaAbierta = await obtenerCajaAbierta({
    organizacionId: input.organizacionId,
  });
  if (!cajaAbierta) {
    throw new CajaNoAbiertaError();
  }

  let pacienteId: string;
  let medicoId: string;

  if (input.consultaId) {
    const consulta = await prisma.consulta.findFirst({
      where: { id: input.consultaId, organizacionId: input.organizacionId },
      select: { estado: true, pacienteId: true, medicoId: true },
    });

    if (!consulta) {
      throw new ConsultaNoEncontradaError();
    }
    if (consulta.estado !== "CERRADA") {
      throw new ConsultaNoCerradaError();
    }

    pacienteId = consulta.pacienteId;
    medicoId = consulta.medicoId;
  } else {
    if (!input.pacienteId || !input.medicoId) {
      throw new Error("Falta paciente o médico para un cobro sin consulta.");
    }
    if (!input.concepto?.trim()) {
      throw new ConceptoRequeridoError();
    }

    pacienteId = input.pacienteId;
    medicoId = input.medicoId;

    await validarConsistenciaCobro({
      organizacionId: input.organizacionId,
      pacienteId,
      medicoId,
      consultaId: null,
    });
  }

  const cobro = await prisma.$transaction(async (tx) => {
    const cobroCreado = await tx.cobro.create({
      data: {
        organizacionId: input.organizacionId,
        consultaId: input.consultaId ?? null,
        pacienteId,
        medicoId,
        concepto: input.concepto?.trim() || null,
        monto: input.monto,
        metodoPago: input.metodoPago,
        moneda: infoMetodo.moneda,
        esEfectivo: infoMetodo.esEfectivo,
        estado: "PAGADO",
      },
    });

    await tx.movimientoCaja.create({
      data: {
        organizacionId: input.organizacionId,
        cajaId: cajaAbierta.id,
        cobroId: cobroCreado.id,
        tipo: "INGRESO",
        origen: "COBRO",
        monto: input.monto,
        moneda: cobroCreado.moneda,
        esEfectivo: cobroCreado.esEfectivo,
        metodoPago: cobroCreado.metodoPago,
        registradoPorId: input.actorId,
      },
    });

    return cobroCreado;
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "registrar_cobro",
    entidadTipo: "Cobro",
    entidadId: cobro.id,
    pacienteId,
  });

  return { cobroId: cobro.id };
}

/**
 * Total cobrado por un médico en el rango de un día calendario, agrupado
 * por moneda (un cobro en USD y uno en Bs no se suman entre sí — ver
 * changelog de la demo, punto 11). Usado por el dashboard de "Hoy" para el
 * KPI "Cobros del día"; no incluye cobros `ANULADO` (sí incluye
 * PENDIENTE/PARCIAL/PAGADO, porque "cobrado" aquí significa "registrado
 * hoy", no necesariamente ya saldado — ver punto 15c del changelog sobre el
 * flujo de cobranzas que todavía no existe).
 */
export async function obtenerTotalCobradoDelDia(input: {
  organizacionId: string;
  medicoId: string;
  fecha: Date;
}): Promise<Array<{ moneda: string; total: number }>> {
  const inicio = new Date(input.fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);

  const agrupado = await prisma.cobro.groupBy({
    by: ["moneda"],
    where: {
      organizacionId: input.organizacionId,
      medicoId: input.medicoId,
      estado: { not: "ANULADO" },
      fecha: { gte: inicio, lt: fin },
    },
    _sum: { monto: true },
  });

  return agrupado.map((fila) => ({
    moneda: fila.moneda,
    total: Number(fila._sum.monto ?? 0),
  }));
}
