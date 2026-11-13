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
  reabrirCita,
  CitaConflictoHorarioError,
  CitaInexistenteError,
  CitaNoEditableError,
  TransicionEstadoInvalidaError,
  CitaConsultaEnCursoError,
  CitaNoCanceladaError,
  CitaDuracionInvalidaError,
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

/**
 * 13-nov-2026 (auditoría Bloque 3): estas vueltas se armaban pegando
 * strings —`?fecha=${fecha}&pacienteId=${pacienteId}&error=1`— con
 * valores que vienen del formulario. Un `&` o un `#` adentro de
 * cualquiera de los dos partía la URL y los parámetros siguientes se
 * perdían o se mezclaban. URLSearchParams escapa.
 */
function destinoNuevaCita(params: Record<string, string>): string {
  return `/agenda/nueva?${new URLSearchParams(params).toString()}`;
}

/** El id va en la RUTA, así que se escapa aparte: un id con `?` o `#`
 *  cortaría la URL en dos. */
function destinoEditarCita(citaId: string, error: string): string {
  return `/agenda/${encodeURIComponent(citaId)}/editar?${new URLSearchParams({ error }).toString()}`;
}

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
  // 13-nov-2026 (auditoría Bloque 2): `volverA` viene del formulario, o
  // sea del cliente, y va directo a `redirect()`. Sin este filtro,
  // "https://otro-sitio.com" o "//otro-sitio.com" sacaban al médico del
  // OS. Solo se aceptan rutas internas; cualquier otra cosa cae a /agenda.
  const crudo = String(formData.get("volverA") ?? "/agenda");
  const volverA = crudo.startsWith("/") && !crudo.startsWith("//") ? crudo : "/agenda";
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
    redirect(destinoNuevaCita({ fecha, pacienteId, error: "1" }));
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
      redirect(destinoNuevaCita({ fecha, pacienteId, error: "conflicto" }));
    }
    if (err instanceof CitaDuracionInvalidaError) {
      redirect(destinoNuevaCita({ fecha, pacienteId, error: "1" }));
    }
    if (err instanceof PacienteArchivadoError) {
      redirect(destinoNuevaCita({ fecha, pacienteId, error: "paciente_archivado" }));
    }
    throw err;
  }

  redirect(`/agenda?${new URLSearchParams({ fecha }).toString()}`);
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
    redirect(destinoEditarCita(citaId, "1"));
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
      redirect(destinoEditarCita(citaId, "conflicto"));
    }
    if (err instanceof CitaDuracionInvalidaError) {
      redirect(destinoEditarCita(citaId, "1"));
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
  /** Query extra para la agenda de destino — la usa cancelar para poder
   *  ofrecer "Deshacer" sobre esa cita en concreto. */
  queryAlTerminar: (citaId: string) => Record<string, string> = () => ({}),
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

  redirect(destinoAgenda(formData, queryAlTerminar(citaId)));
}

export async function confirmarCitaAction(formData: FormData) {
  await ejecutarCambioEstado(formData, confirmarCita);
}

/**
 * 13-nov-2026 (hallazgo de la auditoría): cancelar sigue siendo un clic sin
 * confirmación —es una acción legítima y frecuente, un "¿seguro?" en cada
 * una se termina aceptando sin leer— pero ahora vuelve con el id de la cita
 * en la query, para que la agenda ofrezca deshacerlo. Fricción cero en el
 * caso normal, recuperación completa en el equivocado.
 */
export async function cancelarCitaAction(formData: FormData) {
  await ejecutarCambioEstado(formData, cancelarCita, (citaId) => ({ cancelada: citaId }));
}

/** Deshacer una cancelación. Puede fallar si en el intermedio le dieron el
 *  hueco a otro paciente — ver `reabrirCita`. */
export async function reabrirCitaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const citaId = String(formData.get("citaId") ?? "");
  if (!citaId) {
    throw new Error("Falta la cita.");
  }

  try {
    await reabrirCita({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      medicoId: medico.id,
      citaId,
    });
  } catch (err) {
    if (err instanceof CitaConflictoHorarioError) {
      redirect(destinoAgenda(formData, { error: "reabrir_ocupado" }));
    }
    if (err instanceof CitaInexistenteError || err instanceof CitaNoCanceladaError) {
      redirect(destinoAgenda(formData, { error: "reabrir_estado" }));
    }
    throw err;
  }

  redirect(destinoAgenda(formData, { reabierta: "1" }));
}

export async function marcarAtendidaCitaAction(formData: FormData) {
  await ejecutarCambioEstado(formData, marcarCitaAtendida);
}

export async function marcarNoAsistioCitaAction(formData: FormData) {
  await ejecutarCambioEstado(formData, marcarCitaNoAsistio);
}
