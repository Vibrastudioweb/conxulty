"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/db/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { moderarResena } from "@/modules/directorio/resenas";

const DECISIONES_VALIDAS = new Set(["publicar", "rechazar"]);

/**
 * Aprueba o rechaza una reseña negativa (1-3★) pendiente — ver changelog
 * punto 91/98. Las positivas (4-5★) ya se publicaron solas del lado del
 * Directorio y nunca aparecen acá.
 */
export async function moderarResenaAction(formData: FormData): Promise<void> {
  const { session } = await requireMedicoSesion();

  const resenaId = formData.get("resenaId")?.toString();
  const decision = formData.get("decision")?.toString();
  if (!resenaId || !decision || !DECISIONES_VALIDAS.has(decision)) return;

  const organizacion = await prisma.organizacion.findUniqueOrThrow({
    where: { id: session.user.organizacionId },
    select: { fichaDirectorioId: true },
  });
  if (!organizacion.fichaDirectorioId) return;

  const resultado = await moderarResena(
    organizacion.fichaDirectorioId,
    resenaId,
    decision as "publicar" | "rechazar",
  );
  if (!resultado.ok) {
    // Sin UI de error dedicada en esta primera versión (ver page.tsx) — se
    // propaga como error de Next.js antes que fallar en silencio, para que
    // el médico sepa que la decisión NO se aplicó en vez de ver la página
    // igual tras recargar.
    throw new Error(resultado.error);
  }
  revalidatePath("/resenas");
}
