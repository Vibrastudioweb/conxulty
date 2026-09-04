"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { TipoAntecedente } from "@prisma/client";
import { requireMedico, requireMedicoSesion } from "@/modules/core/autorizacion";
import {
  abrirOCrearConsulta,
  CitaNoDisponibleError,
} from "@/modules/core/consultas";
import {
  actualizarPaciente,
  archivarPaciente,
  reactivarPaciente,
  DocumentoIdentidadDuplicadoError,
  PacienteNoEncontradoError,
  PacienteArchivadoError,
} from "@/modules/core/pacientes";
import {
  crearAntecedente,
  editarAntecedente,
  desactivarAntecedente,
  AntecedenteNoEncontradoError,
  AntecedenteNoEditableError,
} from "@/modules/core/antecedentes";
import { parsearFechaOpcional } from "@/components/pacientes/fecha";

function leerTexto(formData: FormData, campo: string): string | null {
  const valor = formData.get(campo);
  if (valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

const datosPacienteSchema = z.object({
  nombre: z.string().trim().min(1),
  apellido: z.string().trim().min(1),
  sexo: z.string().trim().nullable(),
  telefono: z.string().trim().nullable(),
  email: z.string().trim().email().nullable(),
  documentoIdentidad: z.string().trim().nullable(),
  direccion: z.string().trim().nullable(),
  contactoEmergenciaNombre: z.string().trim().nullable(),
  contactoEmergenciaTelefono: z.string().trim().nullable(),
});

export async function iniciarConsultaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const pacienteId = String(formData.get("pacienteId") ?? "");
  const citaIdCampo = formData.get("citaId");
  const citaId = citaIdCampo ? String(citaIdCampo) : null;

  if (!pacienteId) {
    throw new Error("Falta el paciente para iniciar la consulta.");
  }

  let consultaId: string;
  try {
    ({ consultaId } = await abrirOCrearConsulta({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      medicoId: medico.id,
      pacienteId,
      citaId,
    }));
  } catch (err) {
    if (err instanceof CitaNoDisponibleError) {
      redirect(`/pacientes/${pacienteId}?error=cita_no_disponible`);
    }
    if (err instanceof PacienteArchivadoError) {
      redirect(`/pacientes/${pacienteId}?error=paciente_archivado`);
    }
    throw err;
  }

  redirect(`/consultas/${consultaId}`);
}

export async function actualizarPacienteAction(formData: FormData) {
  const session = await requireMedico();

  const pacienteId = String(formData.get("pacienteId") ?? "");
  if (!pacienteId) {
    throw new Error("Falta el paciente.");
  }

  const parseo = datosPacienteSchema.safeParse({
    nombre: String(formData.get("nombre") ?? ""),
    apellido: String(formData.get("apellido") ?? ""),
    sexo: leerTexto(formData, "sexo"),
    telefono: leerTexto(formData, "telefono"),
    email: leerTexto(formData, "email"),
    documentoIdentidad: leerTexto(formData, "documentoIdentidad"),
    direccion: leerTexto(formData, "direccion"),
    contactoEmergenciaNombre: leerTexto(formData, "contactoEmergenciaNombre"),
    contactoEmergenciaTelefono: leerTexto(formData, "contactoEmergenciaTelefono"),
  });

  if (!parseo.success) {
    redirect(`/pacientes/${pacienteId}/editar?error=1`);
  }

  const resultadoFecha = parsearFechaOpcional(leerTexto(formData, "fechaNacimiento"));
  if (!resultadoFecha.valida) {
    redirect(`/pacientes/${pacienteId}/editar?error=fecha_invalida`);
  }

  try {
    await actualizarPaciente({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      pacienteId,
      datos: { ...parseo.data, fechaNacimiento: resultadoFecha.fecha },
    });
  } catch (err) {
    if (err instanceof DocumentoIdentidadDuplicadoError) {
      redirect(`/pacientes/${pacienteId}/editar?error=documento_duplicado`);
    }
    if (err instanceof PacienteNoEncontradoError) {
      redirect("/pacientes");
    }
    throw err;
  }

  redirect(`/pacientes/${pacienteId}?actualizado=1`);
}

export async function archivarPacienteAction(formData: FormData) {
  const session = await requireMedico();
  const pacienteId = String(formData.get("pacienteId") ?? "");
  if (!pacienteId) {
    throw new Error("Falta el paciente.");
  }

  await archivarPaciente({
    organizacionId: session.user.organizacionId,
    actorId: session.user.id,
    pacienteId,
  });

  redirect(`/pacientes/${pacienteId}?archivado=1`);
}

export async function reactivarPacienteAction(formData: FormData) {
  const session = await requireMedico();
  const pacienteId = String(formData.get("pacienteId") ?? "");
  if (!pacienteId) {
    throw new Error("Falta el paciente.");
  }

  await reactivarPaciente({
    organizacionId: session.user.organizacionId,
    actorId: session.user.id,
    pacienteId,
  });

  redirect(`/pacientes/${pacienteId}?reactivado=1`);
}

const TIPOS_ANTECEDENTE = [
  "ALERGIA",
  "ENFERMEDAD_CRONICA",
  "CIRUGIA",
  "MEDICAMENTO_HABITUAL",
  "HABITO",
  "ANTECEDENTE_FAMILIAR",
  "ANTECEDENTE_PERSONAL",
  "OBSERVACION",
] as const;

const antecedenteSchema = z.object({
  tipo: z.enum(TIPOS_ANTECEDENTE),
  descripcion: z.string().trim().min(1),
});

export async function crearAntecedenteAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const pacienteId = String(formData.get("pacienteId") ?? "");
  if (!pacienteId) {
    throw new Error("Falta el paciente.");
  }

  const parseo = antecedenteSchema.safeParse({
    tipo: formData.get("tipo"),
    descripcion: String(formData.get("descripcion") ?? ""),
  });

  if (!parseo.success) {
    redirect(`/pacientes/${pacienteId}?error=antecedente_invalido`);
  }

  await crearAntecedente({
    organizacionId: session.user.organizacionId,
    actorId: session.user.id,
    medicoId: medico.id,
    pacienteId,
    tipo: parseo.data.tipo as TipoAntecedente,
    descripcion: parseo.data.descripcion,
  });

  redirect(`/pacientes/${pacienteId}?antecedente_creado=1`);
}

export async function editarAntecedenteAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const pacienteId = String(formData.get("pacienteId") ?? "");
  const antecedenteId = String(formData.get("antecedenteId") ?? "");
  if (!pacienteId || !antecedenteId) {
    throw new Error("Falta el antecedente.");
  }

  const parseo = antecedenteSchema.safeParse({
    tipo: formData.get("tipo"),
    descripcion: String(formData.get("descripcion") ?? ""),
  });

  if (!parseo.success) {
    redirect(`/pacientes/${pacienteId}?error=antecedente_invalido`);
  }

  try {
    await editarAntecedente({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      medicoId: medico.id,
      antecedenteId,
      tipo: parseo.data.tipo as TipoAntecedente,
      descripcion: parseo.data.descripcion,
    });
  } catch (err) {
    if (err instanceof AntecedenteNoEncontradoError) {
      redirect(`/pacientes/${pacienteId}`);
    }
    if (err instanceof AntecedenteNoEditableError) {
      redirect(`/pacientes/${pacienteId}?error=antecedente_no_editable`);
    }
    throw err;
  }

  redirect(`/pacientes/${pacienteId}?antecedente_editado=1`);
}

export async function desactivarAntecedenteAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const pacienteId = String(formData.get("pacienteId") ?? "");
  const antecedenteId = String(formData.get("antecedenteId") ?? "");
  if (!pacienteId || !antecedenteId) {
    throw new Error("Falta el antecedente.");
  }

  try {
    await desactivarAntecedente({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      medicoId: medico.id,
      antecedenteId,
    });
  } catch (err) {
    if (err instanceof AntecedenteNoEncontradoError) {
      redirect(`/pacientes/${pacienteId}`);
    }
    throw err;
  }

  redirect(`/pacientes/${pacienteId}?antecedente_desactivado=1`);
}
