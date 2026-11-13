"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { CategoriaGasto } from "@prisma/client";
import { requireSesion, requirePro } from "@/modules/core/autorizacion";
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
  DescuentoMotivoRequeridoError,
} from "@/modules/cobros-caja/cobros";
import { registrarGasto } from "@/modules/cobros-caja/gastos";
import { ConsultaNoEncontradaError } from "@/modules/core/consultas";
import { METODOS_PAGO, type MetodoPagoId } from "@/modules/cobros-caja/metodosPago";

const montoInicialSchema = z.coerce.number().min(0);
const montoCobroSchema = z.coerce.number().positive();
const descuentoSchema = z.coerce.number().min(0);
const CATEGORIAS_GASTO = ["ALQUILER", "INSUMOS", "PERSONAL", "SERVICIOS", "OTRO"] as const;
const categoriaGastoSchema = z.enum(CATEGORIAS_GASTO);
const metodoPagoSchema = z.enum(METODOS_PAGO);

function leerTexto(formData: FormData, campo: string): string | null {
  const valor = formData.get(campo);
  if (valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

/** Campo vacío ("") se trata como 0 — el descuento es opcional en el formulario. */
function leerDescuento(formData: FormData): number {
  const raw = formData.get("descuentoMonto");
  if (raw === null || String(raw).trim() === "") return 0;
  const parseo = descuentoSchema.safeParse(raw);
  return parseo.success ? parseo.data : 0;
}

export async function abrirCajaAction(formData: FormData) {
  const session = await requireSesion();
  await requirePro("caja");

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
  await requirePro("caja");

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

const tipoCobroSchema = z.enum(["consulta", "directo"]);

/**
 * Un solo formulario de "Registrar cobro" (antes eran dos tarjetas
 * separadas — ver nota del usuario 10-nov-2026: "aca no deberia haber dos
 * cuadros de cobro uno solo y seleccionar concepto"). El selector "Tipo de
 * cobro" decide qué campos se leen, pero ambas ramas siguen llamando a la
 * misma `registrarCobro()` de siempre — no se duplica ninguna regla de
 * negocio, solo se unifica la UI que ya apuntaba a la misma función.
 */
export async function registrarCobroAction(formData: FormData) {
  const session = await requireSesion();
  await requirePro("caja");

  const parseoTipo = tipoCobroSchema.safeParse(formData.get("tipo"));
  const parseoMonto = montoCobroSchema.safeParse(formData.get("monto"));
  const parseoMetodo = metodoPagoSchema.safeParse(formData.get("metodoPago"));
  if (!parseoTipo.success || !parseoMonto.success || !parseoMetodo.success) {
    redirect("/caja?error=monto_invalido");
  }

  const base = {
    organizacionId: session.user.organizacionId,
    actorId: session.user.id,
    monto: parseoMonto.data,
    metodoPago: parseoMetodo.data as MetodoPagoId,
    descuentoMonto: leerDescuento(formData),
    descuentoMotivo: leerTexto(formData, "descuentoMotivo"),
  };

  let resultado: { cobroId: string };
  try {
    if (parseoTipo.data === "consulta") {
      const consultaId = leerTexto(formData, "consultaId");
      if (!consultaId) {
        redirect("/caja?error=monto_invalido");
      }
      resultado = await registrarCobro({
        ...base,
        consultaId,
        concepto: leerTexto(formData, "conceptoConsulta"),
      });
    } else {
      const pacienteId = leerTexto(formData, "pacienteId");
      const concepto = leerTexto(formData, "conceptoDirecto");
      if (!pacienteId) {
        redirect("/caja?error=monto_invalido");
      }
      if (!concepto) {
        redirect("/caja?error=concepto_requerido");
      }

      // 29-oct-2026: CONXULTY es de un médico por organización (HECHO
      // confirmado por el usuario) — el médico ya no se escribe a mano, se
      // deriva siempre de la organización, igual que ocurre cuando el
      // cobro viene con consultaId (ahí lo deriva registrarCobro() de la
      // propia Consulta).
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

      resultado = await registrarCobro({
        ...base,
        pacienteId,
        medicoId,
        concepto,
      });
    }
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
    if (err instanceof ConceptoRequeridoError) {
      redirect("/caja?error=concepto_requerido");
    }
    if (err instanceof DescuentoMotivoRequeridoError) {
      redirect("/caja?error=descuento_motivo_requerido");
    }
    throw err;
  }

  redirect(`/caja/comprobante/${resultado.cobroId}`);
}

export async function registrarGastoAction(formData: FormData) {
  const session = await requireSesion();
  await requirePro("caja");

  const parseoCategoria = categoriaGastoSchema.safeParse(formData.get("categoria"));
  const parseoMonto = montoCobroSchema.safeParse(formData.get("monto"));
  const parseoMetodo = metodoPagoSchema.safeParse(formData.get("metodoPago"));
  if (!parseoCategoria.success || !parseoMonto.success || !parseoMetodo.success) {
    redirect("/caja?error=monto_invalido");
  }

  try {
    await registrarGasto({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      categoria: parseoCategoria.data as CategoriaGasto,
      monto: parseoMonto.data,
      nota: leerTexto(formData, "nota"),
      metodoPago: parseoMetodo.data as MetodoPagoId,
    });
  } catch (err) {
    if (err instanceof CajaNoAbiertaError) {
      redirect("/caja?error=caja_cerrada");
    }
    throw err;
  }

  redirect("/caja?gasto=1");
}

