"use server";

import { redirect } from "next/navigation";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import {
  obtenerConsulta,
  guardarConsulta,
  cerrarConsulta,
  type CamposClinicos,
  type CamposVitales,
} from "@/modules/core/consultas";

function leerCampo(formData: FormData, campo: string): string | null | undefined {
  const valor = formData.get(campo);
  if (valor === null) return undefined;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

/**
 * Igual que leerCampo pero numérico — un campo vacío se guarda como null
 * (no se registró), y un valor no numérico se trata como "no enviado"
 * (undefined) en vez de bloquear el guardado de los demás campos: un
 * signo vital mal tecleado no debería impedir guardar el resto de la nota.
 */
function leerCampoNumerico(formData: FormData, campo: string): number | null | undefined {
  const valor = formData.get(campo);
  if (valor === null) return undefined;
  const texto = String(valor).trim();
  if (texto === "") return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : undefined;
}

export async function guardarConsultaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const consultaId = String(formData.get("consultaId") ?? "");
  if (!consultaId) {
    throw new Error("Falta la consulta.");
  }

  const consultaExistente = await obtenerConsulta({
    organizacionId: session.user.organizacionId,
    consultaId,
  });

  if (!consultaExistente || consultaExistente.medicoId !== medico.id) {
    redirect("/hoy");
  }

  const campos: CamposClinicos = {
    motivoConsulta: leerCampo(formData, "motivoConsulta"),
    anamnesis: leerCampo(formData, "anamnesis"),
    antecedentes: leerCampo(formData, "antecedentes"),
    examenFisico: leerCampo(formData, "examenFisico"),
    evaluacion: leerCampo(formData, "evaluacion"),
    diagnostico: leerCampo(formData, "diagnostico"),
    tratamiento: leerCampo(formData, "tratamiento"),
  };

  const vitales: CamposVitales = {
    presionArterial: leerCampo(formData, "presionArterial"),
    frecuenciaCardiaca: leerCampoNumerico(formData, "frecuenciaCardiaca"),
    temperatura: leerCampoNumerico(formData, "temperatura"),
    saturacionOxigeno: leerCampoNumerico(formData, "saturacionOxigeno"),
    pesoKg: leerCampoNumerico(formData, "pesoKg"),
    tallaCm: leerCampoNumerico(formData, "tallaCm"),
  };

  try {
    await guardarConsulta({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      consultaId,
      campos,
      vitales,
    });
  } catch {
    redirect(`/consultas/${consultaId}?error=1`);
  }

  redirect(`/consultas/${consultaId}?guardado=1`);
}

export async function cerrarConsultaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const consultaId = String(formData.get("consultaId") ?? "");
  if (!consultaId) {
    throw new Error("Falta la consulta.");
  }

  const consultaExistente = await obtenerConsulta({
    organizacionId: session.user.organizacionId,
    consultaId,
  });

  if (!consultaExistente || consultaExistente.medicoId !== medico.id) {
    redirect("/hoy");
  }

  try {
    await cerrarConsulta({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      consultaId,
    });
  } catch {
    redirect(`/consultas/${consultaId}?error=1`);
  }

  redirect("/hoy");
}
