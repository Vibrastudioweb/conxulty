"use server";

import { z } from "zod";
import { requireSuperadmin } from "@/modules/core/autorizacion";
import {
  activarSolicitud,
  cambiarEstadoSolicitud,
  EmailEnUsoError,
  OrganizacionNoEncontradaError,
  SolicitudNoEncontradaError,
  SolicitudYaResueltaError,
  type CredencialesGeneradas,
} from "@/modules/superadmin/solicitudes";

/**
 * Server actions del panel de súper-admin. Cada una llama a
 * requireSuperadmin() ANTES de hacer cualquier cosa: las server actions son
 * endpoints POST invocables directamente, la guarda de la página no las
 * protege.
 */

export type ResultadoActivacion =
  | { ok: true; credenciales: CredencialesGeneradas }
  | { ok: false; error: string };

const activarSchema = z
  .object({
    solicitudId: z.string().min(1),
    modoOrganizacion: z.enum(["nueva", "existente"]),
    organizacionId: z.string().optional(),
    nombreOrganizacion: z.string().trim().max(160).optional(),
    adminNombre: z.string().trim().min(2).max(120),
    adminEmail: z.string().trim().toLowerCase().email().max(160),
    rol: z.enum(["ADMIN", "MEDICO"]),
  })
  .superRefine((v, ctx) => {
    if (v.modoOrganizacion === "existente" && !v.organizacionId) {
      ctx.addIssue({ code: "custom", path: ["organizacionId"], message: "Elige una organización." });
    }
    if (v.modoOrganizacion === "nueva" && (!v.nombreOrganizacion || v.nombreOrganizacion.length < 2)) {
      ctx.addIssue({ code: "custom", path: ["nombreOrganizacion"], message: "Indica el nombre de la organización." });
    }
  });

export async function activarSolicitudAction(
  entrada: unknown,
): Promise<ResultadoActivacion> {
  await requireSuperadmin();

  const parseo = activarSchema.safeParse(entrada);
  if (!parseo.success) {
    return {
      ok: false,
      error: parseo.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const d = parseo.data;

  try {
    const credenciales = await activarSolicitud({
      solicitudId: d.solicitudId,
      organizacionId: d.modoOrganizacion === "existente" ? d.organizacionId! : null,
      nombreOrganizacion: d.nombreOrganizacion ?? "",
      adminNombre: d.adminNombre,
      adminEmail: d.adminEmail,
      rol: d.rol,
    });
    return { ok: true, credenciales };
  } catch (error) {
    if (error instanceof EmailEnUsoError) {
      return { ok: false, error: "Ya existe un usuario con ese correo." };
    }
    if (error instanceof SolicitudYaResueltaError) {
      return { ok: false, error: "Esa solicitud ya fue activada o rechazada." };
    }
    if (error instanceof SolicitudNoEncontradaError) {
      return { ok: false, error: "La solicitud ya no existe." };
    }
    if (error instanceof OrganizacionNoEncontradaError) {
      return { ok: false, error: "La organización elegida ya no existe." };
    }
    console.error("[superadmin] Error activando solicitud:", error);
    return { ok: false, error: "No se pudo activar la solicitud. Intenta de nuevo." };
  }
}

export async function cambiarEstadoSolicitudAction(
  solicitudId: string,
  estado: "CONTACTADO" | "RECHAZADO",
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperadmin();

  if (estado !== "CONTACTADO" && estado !== "RECHAZADO") {
    return { ok: false, error: "Estado inválido." };
  }

  try {
    await cambiarEstadoSolicitud(String(solicitudId), estado);
    return { ok: true };
  } catch (error) {
    if (error instanceof SolicitudYaResueltaError) {
      return { ok: false, error: "Esa solicitud ya fue activada o rechazada." };
    }
    if (error instanceof SolicitudNoEncontradaError) {
      return { ok: false, error: "La solicitud ya no existe." };
    }
    console.error("[superadmin] Error cambiando estado:", error);
    return { ok: false, error: "No se pudo actualizar la solicitud." };
  }
}
