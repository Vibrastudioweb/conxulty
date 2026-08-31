"use server";

import { redirect } from "next/navigation";
import { requireMedico } from "@/modules/core/autorizacion";
import { crearPaciente } from "@/modules/core/pacientes";

export async function crearPacienteAction(formData: FormData) {
  const session = await requireMedico();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellido = String(formData.get("apellido") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();

  if (!nombre || !apellido) {
    redirect("/pacientes?error=1");
  }

  const paciente = await crearPaciente({
    organizacionId: session.user.organizacionId,
    actorId: session.user.id,
    datos: {
      nombre,
      apellido,
      telefono: telefono || null,
    },
  });

  redirect(`/pacientes/${paciente.id}`);
}
