"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearSolicitud } from "@/modules/acceso/solicitudes";
import { notificarSolicitudAcceso } from "@/modules/acceso/notificacion";

const solicitudSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(160)),
  telefono: z.string().trim().min(6).max(30),
  especialidad: z.string().trim().max(120).optional(),
  nombreConsultorio: z.string().trim().min(2).max(160),
});

function leer(formData: FormData, campo: string) {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

/**
 * Acción pública (sin sesión): solo registra la solicitud y avisa por
 * email. No crea usuario ni organización — eso lo decide el súper-admin.
 */
export async function solicitarAccesoAction(formData: FormData) {
  // Honeypot: el campo está oculto a personas; un bot que rellena todo lo
  // llena. Se responde "éxito" sin guardar nada para no darle señal.
  if (leer(formData, "sitioWeb") !== "") {
    redirect("/solicitar-acceso?enviada=1");
  }

  const parseo = solicitudSchema.safeParse({
    nombre: leer(formData, "nombre"),
    email: leer(formData, "email"),
    telefono: leer(formData, "telefono"),
    especialidad: leer(formData, "especialidad") || undefined,
    nombreConsultorio: leer(formData, "nombreConsultorio"),
  });
  if (!parseo.success) {
    redirect("/solicitar-acceso?error=datos_invalidos");
  }

  const solicitud = await crearSolicitud({
    ...parseo.data,
    especialidad: parseo.data.especialidad ?? null,
  });

  await notificarSolicitudAcceso(solicitud);

  redirect("/solicitar-acceso?enviada=1");
}
