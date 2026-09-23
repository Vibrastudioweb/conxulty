"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSesion } from "@/modules/core/autorizacion";
import { abrirCaja, CajaYaAbiertaError, CajaNoAbiertaError } from "@/modules/cobros-caja/caja";
import {
  registrarCobro,
  ConsultaNoCerradaError,
  ConceptoRequeridoError,
} from "@/modules/cobros-caja/cobros";
import { ConsultaNoEncontradaError } from "@/modules/core/consultas";

const montoInicialSchema = z.coerce.number().min(0);
const montoCobroSchema = z.coerce.number().positive();

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
