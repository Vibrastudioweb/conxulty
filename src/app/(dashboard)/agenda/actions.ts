"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ModalidadCita } from "@prisma/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import {
  crearCita,
  actualizarCita,
  confirmarCita,
  cancelarCita,
  marcarCitaAtendida,
  marcarCitaNoAsistio,
  CitaConflictoHorarioError,
  CitaInexistenteError,
  CitaNoEditableError,
  TransicionEstadoInvalidaError,
  CitaConsultaEnCursoError,
  DURACION_MINUTOS_DEFECTO,
} from "@/modules/core/citas";
import { PacienteArchivadoError } from "@/modules/core/pacientes";
import { combinarFechaHora } from "@/components/citas/fecha";

const MODALIDADES = ["PRESENCIAL", "VIDEOCONSULTA", "DOMICILIO"] as const;

const datosCitaSchema = z.object({
  duracionMinutos: z.coerce.number().int().min(5).max(480),
  modalidad: z.enum(MODALIDADES),
  motivo: z.string().trim().nullable(),
  notas: z.string().trim().nullable(),
});

function leerTexto(formData: FormData, campo: string): string | null {
  const valor = formData.get(campo);
  if (valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

/** Vuelve a la pantalla de agenda de la que vino la acción (fecha/vista/
 *  filtros incluidos), preservando el contexto en el que estaba el médico
 *  en vez de siempre resetear a la agenda del día actual. */
function destinoAgenda(formData: FormData, query: Record<string, string> = {}) {
  const volverA = String(formData.get("volverA") ?? "/agenda");
  const params = new URLSearchParams(query);
  const queryString = params.toString();
  const separador = volverA.includes("?") ? "&" : "?";
  return queryString ? `${volverA}${separador}${queryString}` : volverA;
}

export async function crearCitaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const pacienteId = String(formData.get("pacienteId") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "");

  const fechaHora = combinarFechaHora(fecha, hora);

  const parseo = datosCitaSchema.safeParse({
    duracionMinutos: formData.get("duracionMinutos") || DURACION_MINUTOS_DEFECTO,
    modalidad: formData.get("modalidad") || "PRESENCIAL",
    motivo: leerTexto(formData, "motivo"),
    notas: leerTexto(formData, "notas"),
  });

  if (!pacienteId || !fechaHora || !parseo.success) {
    redirect(`/agenda/nueva?fecha=${fecha}&pacienteId=${pacienteId}&error=1`);
  }

  try {
    await crearCita({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      medicoId: medico.id,
      pacienteId,
      fechaHora,
      duracionMinutos: parseo.data.duracionMinutos,
      modalidad: parseo.data.modalidad as ModalidadCita,
      motivo: parseo.data.motivo,
      notas: parseo.data.notas,
    });
  } catch (err) {
    if (err instanceof CitaConflictoHorarioError) {
      redirect(`/agenda/nueva?fecha=${fecha}&pacienteId=${pacienteId}&error=conflicto`);
    }
    if (err instanceof PacienteArchivadoError) {
      redirect(`/agenda/nueva?fecha=${fecha}&pacienteId=${pacienteId}&error=paciente_archivado`);
    }
    throw err;
  }

  redirect(`/agenda?fecha=${fecha}`);
}

export async function actualizarCitaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const citaId = String(formData.get("citaId") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "");

  if (!citaId) {
    throw new Error("Falta la cita.");
  }

  const fechaHora = combinarFechaHora(fecha, hora);

  const parseo = datosCitaSchema.safeParse({
    duracionMinutos: formData.get("duracionMinutos") || DURACION_MINUTOS_DEFECTO,
    modalidad: formData.get("modalidad") || "PRESENCIAL",
    motivo: leerTexto(formData, "motivo"),
    notas: leerTexto(formData, "notas"),
  });

  if (!fechaHora || !parseo.success) {
    redirect(`/agenda/${citaId}/editar?error=1`);
  }

  try {
    await actualizarCita({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      medicoId: medico.id,
      citaId,
      fechaHora,
      duracionMinutos: parseo.data.duracionMinutos,
      modalidad: parseo.data.modalidad as ModalidadCita,
      motivo: parseo.data.motivo,
      notas: parseo.data.notas,
    });
  } catch (err) {
    if (err instanceof CitaConflictoHorarioError) {
      redirect(`/agenda/${citaId}/editar?error=conflicto`);
    }
    if (err instanceof CitaInexistenteError || err instanceof CitaNoEditableError) {
      redirect(`/agenda?error=no_editable`);
    }
    throw err;
  }

  redirect(destinoAgenda(formData, { actualizada: "1" }));
}

async function ejecutarCambioEstado(
  formData: FormData,
  accion: (input: {
    organizacionId: string;
    actorId: string;
    medicoId: string;
    citaId: string;
  }) => Promise<void>,
) {
  const { session, medico } = await requireMedicoSesion();

  const citaId = String(formData.get("citaId") ?? "");
  if (!citaId) {
    throw new Error("Falta la cita.");
  }

  try {
    await accion({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      medicoId: medico.id,
      citaId,
    });
  } catch (err) {
    if (
      err instanceof CitaInexistenteError ||
      err instanceof TransicionEstadoInvalidaError ||
      err instanceof CitaConsultaEnCursoError
    ) {
      redirect(destinoAgenda(formData, { error: "estado" }));
    }
    throw err;
  }

  redirect(destinoAgenda(formData));
}

export async function confirmarCitaAction(formData: FormData) {
  await ejecutarCambioEstado(formData, confirmarCita);
}

export async function cancelarCitaAction(formData: FormData) {
  await ejecutarCambioEstado(formData, cancelarCita);
}

export async function marcarAtendidaCitaAction(formData: FormData) {
  await ejecutarCambioEstado(formData, marcarCitaAtendida);
}

export async function marcarNoAsistioCitaAction(formData: FormData) {
  await ejecutarCambioEstado(formData, marcarCitaNoAsistio);
}
