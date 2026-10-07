"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { CategoriaGasto } from "@prisma/client";
import { requireSesion } from "@/modules/core/autorizacion";
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

export async function cerrarCajaAction(formData: FormData) {
  const session = await requireSesion();

  // Distingo "campo ausente/vacío" de "0 real": Number("") es 0 en JS, así
  // que si dejara que Zod coercionara directo, un campo vacío pasaría como
  // si fuera un monto contado de 0. Reviso la presencia del dato primero.
  const rawMontoContado = formData.get("montoContado");
  if (rawMontoContado === null || String(rawMontoContado).trim() === "") {
    redirect("/caja?error=monto_contado_requerido");
  }

  const parseo = z.coerce.number().min(0).safeParse(rawMontoContado);
  if (!parseo.success) {
    redirect("/caja?error=monto_invalido");
  }

  let resultado: { montoEsperado: string; diferencia: string };
  try {
    resultado = await cerrarCaja({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      montoContado: parseo.data,
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
    esperado: resultado.montoEsperado,
    diferencia: resultado.diferencia,
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
  const medicoId = leerTexto(formData, "medicoId");
  const concepto = leerTexto(formData, "concepto");
  const parseoMonto = montoCobroSchema.safeParse(formData.get("monto"));

  if (!pacienteId || !medicoId || !parseoMonto.success) {
    redirect("/caja?error=monto_invalido");
  }
  if (!concepto) {
    redirect("/caja?error=concepto_requerido");
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
