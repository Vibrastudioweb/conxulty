"use server";

import { prisma } from "@/db/client";
import { requireEntidadSesion } from "@/modules/core/autorizacion";
import { agregarFotoGaleria, quitarFotoGaleria, type ResultadoGaleria } from "@/modules/directorio/galeria";

/**
 * Acciones de galería (Task #11, changelog punto 90/92) para entidad
 * (clínica/farmacia) — mismo criterio que el hermano de médico
 * (ficha-publica/galeriaActions.ts): `fichaDirectorioId` sale de la
 * SESIÓN, nunca de un id que mande el cliente.
 */

async function fichaDirectorioIdDeLaSesion(): Promise<string | null> {
  const { session } = await requireEntidadSesion();
  const organizacion = await prisma.organizacion.findUniqueOrThrow({
    where: { id: session.user.organizacionId },
    select: { fichaDirectorioId: true },
  });
  return organizacion.fichaDirectorioId;
}

export async function agregarFotoGaleriaEntidadAction(formData: FormData): Promise<ResultadoGaleria> {
  const fichaDirectorioId = await fichaDirectorioIdDeLaSesion();
  if (!fichaDirectorioId) {
    return { ok: false, error: "Guarda el resto de tu ficha pública primero — la galería necesita que ya esté creada." };
  }
  const foto = formData.get("foto");
  if (!(foto instanceof File)) return { ok: false, error: "No se recibió ninguna foto." };
  return agregarFotoGaleria("entidades", fichaDirectorioId, foto);
}

export async function quitarFotoGaleriaEntidadAction(formData: FormData): Promise<ResultadoGaleria> {
  const fichaDirectorioId = await fichaDirectorioIdDeLaSesion();
  if (!fichaDirectorioId) return { ok: false, error: "No hay ficha pública todavía." };
  const url = formData.get("url");
  if (typeof url !== "string" || !url) return { ok: false, error: "Falta la foto a quitar." };
  return quitarFotoGaleria("entidades", fichaDirectorioId, url);
}
