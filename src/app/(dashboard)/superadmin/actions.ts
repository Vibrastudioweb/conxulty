"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperadmin } from "@/modules/core/autorizacion";
import {
  activarSolicitud,
  cambiarEstadoSolicitud,
  EmailYaRegistradoError,
  OrganizacionNoEncontradaError,
  SolicitudNoActivableError,
} from "@/modules/acceso/solicitudes";

const activarSchema = z.object({
  solicitudId: z.string().min(1),
  organizacionId: z.string().trim().optional(),
  nombreOrganizacion: z.string().trim().min(2).max(160),
  nombreUsuario: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(160)),
  rol: z.enum(["ADMIN", "MEDICO"]),
});

export type ActivarResultado =
  | { ok: true; email: string; password: string; organizacion: string }
  | { ok: false; error: string }
  | null;

/**
 * Devuelve la contraseña temporal en la respuesta de la acción (no por
 * redirect/query string, que la dejaría en URLs e historial). Solo existe
 * en esa respuesta: no se guarda en claro en ningún lado.
 */
export async function activarSolicitudAction(
  _previo: ActivarResultado,
  formData: FormData,
): Promise<ActivarResultado> {
  await requireSuperadmin();

  const parseo = activarSchema.safeParse(Object.fromEntries(formData));
  if (!parseo.success) {
    return { ok: false, error: "Revisa los datos: hay campos vacíos o inválidos." };
  }

  try {
    const resultado = await activarSolicitud({
      solicitudId: parseo.data.solicitudId,
      organizacionId: parseo.data.organizacionId || null,
      nombreOrganizacion: parseo.data.nombreOrganizacion,
      nombreUsuario: parseo.data.nombreUsuario,
      email: parseo.data.email,
      rol: parseo.data.rol,
    });
    revalidatePath("/superadmin");
    return {
      ok: true,
      email: resultado.email,
      password: resultado.password,
      organizacion: resultado.organizacion.nombre,
    };
  } catch (err) {
    if (err instanceof SolicitudNoActivableError) {
      return { ok: false, error: "La solicitud ya fue procesada." };
    }
    if (err instanceof EmailYaRegistradoError) {
      return { ok: false, error: "Ya existe un usuario con ese correo." };
    }
    if (err instanceof OrganizacionNoEncontradaError) {
      return { ok: false, error: "La organización seleccionada no existe." };
    }
    throw err;
  }
}

async function cambiarEstado(
  formData: FormData,
  estado: "CONTACTADO" | "RECHAZADO",
) {
  await requireSuperadmin();
  const id = String(formData.get("solicitudId") ?? "");
  if (id) {
    try {
      await cambiarEstadoSolicitud(id, estado);
    } catch (err) {
      if (!(err instanceof SolicitudNoActivableError)) throw err;
    }
  }
  revalidatePath("/superadmin");
  redirect("/superadmin");
}

export async function rechazarSolicitudAction(formData: FormData) {
  await cambiarEstado(formData, "RECHAZADO");
}

export async function marcarContactadoAction(formData: FormData) {
  await cambiarEstado(formData, "CONTACTADO");
}
