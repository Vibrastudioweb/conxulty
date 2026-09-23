import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { validarConsistenciaCobro } from "@/db/consistenciaOrganizacional";
import { ConsultaNoEncontradaError } from "@/modules/core/consultas";
import { obtenerCajaAbierta, CajaNoAbiertaError } from "@/modules/cobros-caja/caja";

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
  metodoPago?: string | null;
}): Promise<{ cobroId: string }> {
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
        metodoPago: input.metodoPago ?? null,
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
