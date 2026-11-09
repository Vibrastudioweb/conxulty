"use server";

import { prisma } from "@/db/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { agregarFotoGaleria, quitarFotoGaleria, type ResultadoGaleria } from "@/modules/directorio/galeria";

/**
 * Acciones de galería (Task #11, changelog punto 90/92) para médico —
 * resuelven `fichaDirectorioId` desde la SESIÓN, nunca confían en un id
 * que mande el cliente (evita que alguien edite la galería de otra
 * ficha). Requieren que la ficha ya esté sincronizada al menos una vez
 * (mismo precondición que la foto de perfil, `subirFotoDirectorio`).
 */

async function fichaDirectorioIdDeLaSesion(): Promise<string | null> {
  const { session } = await requireMedicoSesion();
  const organizacion = await prisma.organizacion.findUniqueOrThrow({
    where: { id: session.user.organizacionId },
    select: { fichaDirectorioId: true },
  });
  return organizacion.fichaDirectorioId;
}

export async function agregarFotoGaleriaMedicoAction(formData: FormData): Promise<ResultadoGaleria> {
  const fichaDirectorioId = await fichaDirectorioIdDeLaSesion();
  if (!fichaDirectorioId) {
    return { ok: false, error: "Guarda el resto de tu ficha pública primero — la galería necesita que ya esté creada." };
  }
  const foto = formData.get("foto");
  if (!(foto instanceof File)) return { ok: false, error: "No se recibió ninguna foto." };
  return agregarFotoGaleria("profesionales", fichaDirectorioId, foto);
}

export async function quitarFotoGaleriaMedicoAction(formData: FormData): Promise<ResultadoGaleria> {
  const fichaDirectorioId = await fichaDirectorioIdDeLaSesion();
  if (!fichaDirectorioId) return { ok: false, error: "No hay ficha pública todavía." };
  const url = formData.get("url");
  if (typeof url !== "string" || !url) return { ok: false, error: "Falta la foto a quitar." };
  return quitarFotoGaleria("profesionales", fichaDirectorioId, url);
}
