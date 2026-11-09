"use server";

import { z } from "zod";
import { prisma } from "@/db/client";
import { Prisma } from "@prisma/client";
import { requireEntidadSesion } from "@/modules/core/autorizacion";
import { leerHorarioSedeDeFormData } from "@/modules/onboarding/horarioSede";
import { MUNICIPIOS_TRUJILLO } from "@/modules/onboarding/municipiosTrujillo";
import { tieneHorarioTurno } from "@/modules/onboarding/tiposEntidad";
import { sincronizarFichaEntidad } from "@/modules/directorio/sincronizacionEntidad";

const fichaEntidadSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  municipio: z.string().trim().optional(),
  direccion: z.string().trim().max(300).optional(),
  telefono: z.string().trim().max(40).optional(),
  ciudadDirectorioId: z.string().trim().optional(),
});

export type GuardarFichaEntidadResultado = { ok: true; slug: string } | { ok: false; error: string } | null;

/**
 * Guarda "Mi ficha pública" de clínica/farmacia — ver changelog punto
 * 90/92. Mismo criterio que `guardarFichaPublicaAction` (médico): se
 * bloquea con el resultado real del Directorio, la persona está mirando
 * esta pantalla para que quede bien. Actualiza Entidad (fuente de verdad
 * en el OS) y sincroniza TODO el estado actual con el Directorio.
 */
export async function guardarFichaEntidadAction(
  _previo: GuardarFichaEntidadResultado,
  formData: FormData,
): Promise<GuardarFichaEntidadResultado> {
  const { session, entidad } = await requireEntidadSesion();

  const parseo = fichaEntidadSchema.safeParse(Object.fromEntries(formData));
  if (!parseo.success) {
    return { ok: false, error: "Revisa los campos marcados." };
  }

  const municipio =
    parseo.data.municipio && (MUNICIPIOS_TRUJILLO as readonly string[]).includes(parseo.data.municipio)
      ? parseo.data.municipio
      : null;

  const horario = leerHorarioSedeDeFormData(formData, "horario");

  // Horario de turno (Task #10, solo FARMACIA) — se lee siempre que venga
  // en el formData, pero solo se persiste/sincroniza si el tipo de esta
  // entidad lo tiene; para CLINICA queda vacío aunque el campo no exista
  // en su formulario (leerHorarioSedeDeFormData devuelve los 7 días con
  // atiende:false cuando no encuentra los checkboxes).
  const horarioTurno = tieneHorarioTurno(entidad.tipo)
    ? leerHorarioSedeDeFormData(formData, "horarioTurno")
    : [];

  const organizacion = await prisma.organizacion.findUniqueOrThrow({
    where: { id: session.user.organizacionId },
    select: { id: true, fichaDirectorioId: true },
  });

  const resultadoSync = await sincronizarFichaEntidad({
    fichaDirectorioId: organizacion.fichaDirectorioId,
    nombre: parseo.data.nombre,
    tipo: entidad.tipo,
    ciudadId: parseo.data.ciudadDirectorioId || null,
    direccion: parseo.data.direccion ?? null,
    telefono: parseo.data.telefono ?? null,
    horario,
    horarioTurno,
  });
  if (!resultadoSync.ok) {
    return { ok: false, error: resultadoSync.error };
  }

  await prisma.$transaction([
    prisma.organizacion.update({
      where: { id: organizacion.id },
      data: {
        nombre: parseo.data.nombre,
        fichaDirectorioId: resultadoSync.id,
        fichaDirectorioSlug: resultadoSync.slug,
        fichaDirectorioSincronizada: true,
      },
    }),
    prisma.entidad.update({
      where: { id: entidad.id },
      data: {
        municipio,
        direccion: parseo.data.direccion?.trim() || null,
        telefono: parseo.data.telefono?.trim() || null,
        horario: horario as unknown as Prisma.InputJsonValue,
        horarioTurno: horarioTurno as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  return { ok: true, slug: resultadoSync.slug };
}
