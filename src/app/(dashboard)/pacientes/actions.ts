"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMedico } from "@/modules/core/autorizacion";
import { crearPaciente, DocumentoIdentidadDuplicadoError } from "@/modules/core/pacientes";
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

export async function crearPacienteAction(formData: FormData) {
  const session = await requireMedico();

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
    redirect("/pacientes/nuevo?error=1");
  }

  const resultadoFecha = parsearFechaOpcional(leerTexto(formData, "fechaNacimiento"));
  if (!resultadoFecha.valida) {
    redirect("/pacientes/nuevo?error=fecha_invalida");
  }

  let pacienteId: string;
  try {
    const paciente = await crearPaciente({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      datos: { ...parseo.data, fechaNacimiento: resultadoFecha.fecha },
    });
    pacienteId = paciente.id;
  } catch (err) {
    if (err instanceof DocumentoIdentidadDuplicadoError) {
      redirect("/pacientes/nuevo?error=documento_duplicado");
    }
    throw err;
  }

  redirect(`/pacientes/${pacienteId}`);
}
