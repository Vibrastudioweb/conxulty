"use server";

import { redirect } from "next/navigation";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { abrirOCrearConsulta, CitaNoDisponibleError } from "@/modules/core/consultas";

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
    throw err;
  }

  redirect(`/consultas/${consultaId}`);
}
