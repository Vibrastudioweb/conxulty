"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { CategoriaGasto } from "@prisma/client";
import { requireSesion } from "@/modules/core/autorizacion";
import {
  obtenerMedicoDeOrganizacion,
  MedicoNoEncontradoError,
} from "@/modules/core/sesionMedica";
import {
  abrirCaja,
  cerrarCaja,
  CajaYaAbiertaError,
  CajaNoAbiertaError,
  MontoContadoRequeridoError,
} from "@/modules/cobros-caja/caja";
import {
  registrarCobro,
  ConsultaNoCerradaError,
  ConceptoRequeridoError,
} from "@/modules/cobros-caja/cobros";
import { registrarGasto } from "@/modules/cobros-caja/gastos";
import { ConsultaNoEncontradaError } from "@/modules/core/consultas";

const montoInicialSchema = z.coerce.number().min(0);
const montoCobroSchema = z.coerce.number().positive();
const CATEGORIAS_GASTO = ["ALQUILER", "INSUMOS", "PERSONAL", "SERVICIOS", "OTRO"] as const;
const categoriaGastoSchema = z.enum(CATEGORIAS_GASTO);

function leerTexto(formData: FormData, campo: string): string | null {
  const valor = formData.get(campo);
  if (valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

// Un checkbox ausente (desmarcado) no manda ningún par clave/valor en el
// FormData — por eso "presente" ya significa "marcado", sin importar el
// value. Ver changelog punto 46 (esEfectivo en Cobro/Gasto).
function leerBooleano(formData: FormData, campo: string): boolean {
  return formData.get(campo) !== null;
}

export async function abrirCajaAction(formData: FormData) {
  const session = await requireSesion();

  const parseoUsd = montoInicialSchema.safeParse(formData.get("montoInicialUsd"));
  const parseoBs = montoInicialSchema.safeParse(formData.get("montoInicialBs"));
  if (!parseoUsd.success || !parseoBs.success) {
    redirect("/caja?error=monto_invalido");
  }

  try {
    await abrirCaja({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      montoInicialUsd: parseoUsd.data,
      montoInicialBs: parseoBs.data,
    });
  } catch (err) {
    if (err instanceof CajaYaAbiertaError) {
      redirect("/caja?error=ya_abierta");
    }
    throw err;
  }

  redirect("/caja?abierta=1");
}

export async function cerrarCajaAction(formData: FormData) {
  const session = await requireSesion();

  // Distingo "campo ausente/vacío" de "0 real": Number("") es 0 en JS, así
  // que si dejara que Zod coercionara directo, un campo vacío pasaría como
  // si fuera un monto contado de 0. Reviso la presencia del dato primero.
  const rawMontoContadoUsd = formData.get("montoContadoUsd");
  const rawMontoContadoBs = formData.get("montoContadoBs");
  if (
    rawMontoContadoUsd === null ||
    String(rawMontoContadoUsd).trim() === "" ||
    rawMontoContadoBs === null ||
    String(rawMontoContadoBs).trim() === ""
  ) {
    redirect("/caja?error=monto_contado_requerido");
  }

  const parseoUsd = z.coerce.number().min(0).safeParse(rawMontoContadoUsd);
  const parseoBs = z.coerce.number().min(0).safeParse(rawMontoContadoBs);
  if (!parseoUsd.success || !parseoBs.success) {
    redirect("/caja?error=monto_invalido");
  }

  let resultado: {
    montoEsperadoUsd: string;
    montoEsperadoBs: string;
    diferenciaUsd: string;
    diferenciaBs: string;
  };
  try {
    resultado = await cerrarCaja({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      montoContadoUsd: parseoUsd.data,
      montoContadoBs: parseoBs.data,
    });
  } catch (err) {
    if (err instanceof MontoContadoRequeridoError) {
      redirect("/caja?error=monto_contado_requerido");
    }
    if (err instanceof CajaNoAbiertaError) {
      redirect("/caja?error=caja_cerrada");
    }
    throw err;
  }

  const params = new URLSearchParams({
    cierre: "1",
    esperadoUsd: resultado.montoEsperadoUsd,
    esperadoBs: resultado.montoEsperadoBs,
    diferenciaUsd: resultado.diferenciaUsd,
    diferenciaBs: resultado.diferenciaBs,
  });
  redirect(`/caja?${params.toString()}`);
}

export async function registrarCobroConConsultaAction(formData: FormData) {
  const session = await requireSesion();

  const consultaId = leerTexto(formData, "consultaId");
  const parseoMonto = montoCobroSchema.safeParse(formData.get("monto"));
  if (!consultaId || !parseoMonto.success) {
    redirect("/caja?error=monto_invalido");
  }

  try {
    await registrarCobro({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      consultaId,
      concepto: leerTexto(formData, "concepto"),
      monto: parseoMonto.data,
      metodoPago: leerTexto(formData, "metodoPago"),
      esEfectivo: leerBooleano(formData, "esEfectivo"),
    });
  } catch (err) {
    if (err instanceof CajaNoAbiertaError) {
      redirect("/caja?error=caja_cerrada");
    }
    if (err instanceof ConsultaNoEncontradaError) {
      redirect("/caja?error=consulta_no_encontrada");
    }
    if (err instanceof ConsultaNoCerradaError) {
      redirect("/caja?error=consulta_no_cerrada");
    }
    throw err;
  }

  redirect("/caja?cobro=1");
}

export async function registrarGastoAction(formData: FormData) {
  const session = await requireSesion();

  const parseoCategoria = categoriaGastoSchema.safeParse(formData.get("categoria"));
  const parseoMonto = montoCobroSchema.safeParse(formData.get("monto"));
  if (!parseoCategoria.success || !parseoMonto.success) {
    redirect("/caja?error=monto_invalido");
  }

  try {
    await registrarGasto({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      categoria: parseoCategoria.data as CategoriaGasto,
      monto: parseoMonto.data,
      nota: leerTexto(formData, "nota"),
      esEfectivo: leerBooleano(formData, "esEfectivo"),
    });
  } catch (err) {
    if (err instanceof CajaNoAbiertaError) {
      redirect("/caja?error=caja_cerrada");
    }
    throw err;
  }

  redirect("/caja?gasto=1");
}

export async function registrarCobroRapidoAction(formData: FormData) {
  const session = await requireSesion();

  const pacienteId = leerTexto(formData, "pacienteId");
  const concepto = leerTexto(formData, "concepto");
  const parseoMonto = montoCobroSchema.safeParse(formData.get("monto"));

  if (!pacienteId || !parseoMonto.success) {
    redirect("/caja?error=monto_invalido");
  }
  if (!concepto) {
    redirect("/caja?error=concepto_requerido");
  }

  // 29-oct-2026: CONXULTY es de un médico por organización (HECHO
  // confirmado por el usuario) — el médico ya no se escribe a mano, se
  // deriva siempre de la organización, igual que ya ocurre cuando el
  // cobro viene con consultaId (ver registrarCobroConConsultaAction).
  let medicoId: string;
  try {
    medicoId = (
      await obtenerMedicoDeOrganizacion({
        organizacionId: session.user.organizacionId,
      })
    ).id;
  } catch (err) {
    if (err instanceof MedicoNoEncontradoError) {
      redirect("/caja?error=sin_medico");
    }
    throw err;
  }

  try {
    await registrarCobro({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      pacienteId,
      medicoId,
      concepto,
      monto: parseoMonto.data,
      metodoPago: leerTexto(formData, "metodoPago"),
      esEfectivo: leerBooleano(formData, "esEfectivo"),
    });
  } catch (err) {
    if (err instanceof CajaNoAbiertaError) {
      redirect("/caja?error=caja_cerrada");
    }
    if (err instanceof ConceptoRequeridoError) {
      redirect("/caja?error=concepto_requerido");
    }
    throw err;
  }

  redirect("/caja?cobro=1");
}
