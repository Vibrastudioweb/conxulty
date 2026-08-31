"use server";

import { redirect } from "next/navigation";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { crearCita, CitaConflictoHorarioError } from "@/modules/core/citas";

export async function crearCitaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const pacienteId = String(formData.get("pacienteId") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "");
  const motivoCampo = formData.get("motivo");
  const motivo = motivoCampo ? String(motivoCampo).trim() : "";

  if (!pacienteId || !fecha || !hora) {
    redirect(`/agenda/nueva?fecha=${fecha}&pacienteId=${pacienteId}&error=1`);
  }

  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [horaNum, minutoNum] = hora.split(":").map(Number);
  const fechaHora = new Date(anio, mes - 1, dia, horaNum, minutoNum, 0, 0);

  if (Number.isNaN(fechaHora.getTime())) {
    redirect(`/agenda/nueva?fecha=${fecha}&pacienteId=${pacienteId}&error=1`);
  }

  try {
    await crearCita({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      medicoId: medico.id,
      pacienteId,
      fechaHora,
      motivo: motivo || null,
    });
  } catch (err) {
    if (err instanceof CitaConflictoHorarioError) {
      redirect(`/agenda/nueva?fecha=${fecha}&pacienteId=${pacienteId}&error=conflicto`);
    }
    throw err;
  }

  redirect(`/agenda?fecha=${fecha}`);
}
