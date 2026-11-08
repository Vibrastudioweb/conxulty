"use server";

import { z } from "zod";
import { prisma } from "@/db/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import {
  sincronizarFichaDirectorio,
  mapearModalidadDirectorio,
  ModalidadNoMapeableError,
} from "@/modules/directorio/sincronizacion";

const fichaPublicaSchema = z.object({
  fotoUrl: z.string().trim().max(500).optional(),
  descripcion: z.string().trim().max(2000).optional(),
  instagram: z.string().trim().max(160).optional(),
  correo: z.string().trim().max(160).optional(),
  sitioWeb: z.string().trim().max(500).optional(),
  rif: z.string().trim().max(40).optional(),
  domicilioFiscal: z.string().trim().max(300).optional(),
  disponibilidad: z.string().trim().max(500).optional(),
});

export type GuardarFichaPublicaResultado =
  | { ok: true; slug: string }
  | { ok: false; error: string }
  | null;

function vacio(valor: FormDataEntryValue | null): string | undefined {
  const texto = valor?.toString().trim();
  return texto ? texto : undefined;
}

/**
 * Guarda los campos editables de "Mi ficha pública" y sincroniza TODO el
 * estado actual (no solo lo que cambió) con el Directorio — ver changelog
 * punto 75/76. A diferencia del registro (actions.ts de /registro), acá SÍ
 * se bloquea con el resultado real: el médico está mirando esta pantalla
 * para que la ficha quede bien, no tiene sentido fingir que se guardó.
 */
export async function guardarFichaPublicaAction(
  _previo: GuardarFichaPublicaResultado,
  formData: FormData,
): Promise<GuardarFichaPublicaResultado> {
  const { session, medico } = await requireMedicoSesion();

  const parseo = fichaPublicaSchema.safeParse({
    fotoUrl: vacio(formData.get("fotoUrl")),
    descripcion: vacio(formData.get("descripcion")),
    instagram: vacio(formData.get("instagram")),
    correo: vacio(formData.get("correo")),
    sitioWeb: vacio(formData.get("sitioWeb")),
    rif: vacio(formData.get("rif")),
    domicilioFiscal: vacio(formData.get("domicilioFiscal")),
    disponibilidad: vacio(formData.get("disponibilidad")),
  });
  if (!parseo.success) {
    return { ok: false, error: "Revisa los campos marcados — alguno quedó demasiado largo." };
  }

  const [organizacion, medicoCompleto, sedes] = await Promise.all([
    prisma.organizacion.findUniqueOrThrow({
      where: { id: session.user.organizacionId },
      select: { id: true, nombre: true, fichaDirectorioId: true },
    }),
    prisma.medico.findUniqueOrThrow({
      where: { id: medico.id },
      select: { profesion: true, numeroMpps: true, numeroColegiado: true, modalidades: true, zonasCobertura: true },
    }),
    prisma.sede.findMany({
      where: { medicoId: medico.id },
      select: { id: true, direccion: true, referencia: true, telefono: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  let modalidadDirectorio;
  try {
    modalidadDirectorio = mapearModalidadDirectorio(medicoCompleto.modalidades);
  } catch (err) {
    if (err instanceof ModalidadNoMapeableError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  // Cada sede necesita una ciudad REAL del Directorio (catálogo distinto al
  // municipio de Trujillo que ya tiene cada Sede — ver sincronizacion.ts).
  // El formulario manda un campo `ciudadSede_<id>` por cada sede del OS.
  type SedeOs = { id: string; direccion: string; referencia: string | null; telefono: string | null };
  type SedeConCiudad = { ciudadId: string; direccion: string; referencia: string | null; telefono: string | null };

  const sedesConCiudad = sedes
    .map((sede: SedeOs): SedeConCiudad | null => {
      const ciudadId = vacio(formData.get(`ciudadSede_${sede.id}`));
      if (!ciudadId) return null;
      return {
        ciudadId,
        direccion: sede.direccion,
        referencia: sede.referencia,
        telefono: sede.telefono,
      };
    })
    .filter((s: SedeConCiudad | null): s is SedeConCiudad => s !== null);

  if (modalidadDirectorio !== "domicilio" && sedesConCiudad.length === 0 && sedes.length > 0) {
    return {
      ok: false,
      error: "Elige la ciudad del Directorio para al menos una de tus sedes antes de guardar.",
    };
  }

  const resultado = await sincronizarFichaDirectorio({
    fichaDirectorioId: organizacion.fichaDirectorioId,
    nombre: organizacion.nombre,
    profesion: medicoCompleto.profesion,
    numeroMpps: medicoCompleto.numeroMpps,
    numeroColegiado: medicoCompleto.numeroColegiado,
    modalidad: modalidadDirectorio,
    zonasCobertura: medicoCompleto.zonasCobertura,
    sedes: sedesConCiudad,
    fotoUrl: parseo.data.fotoUrl ?? null,
    descripcion: parseo.data.descripcion ?? null,
    instagram: parseo.data.instagram ?? null,
    correo: parseo.data.correo ?? null,
    sitioWeb: parseo.data.sitioWeb ?? null,
    rif: parseo.data.rif ?? null,
    domicilioFiscal: parseo.data.domicilioFiscal ?? null,
    disponibilidad: parseo.data.disponibilidad ?? null,
  });

  if (!resultado.ok) {
    return { ok: false, error: resultado.error };
  }

  await prisma.organizacion.update({
    where: { id: organizacion.id },
    data: {
      fichaDirectorioId: resultado.id,
      fichaDirectorioSlug: resultado.slug,
      fichaDirectorioSincronizada: true,
    },
  });

  return { ok: true, slug: resultado.slug };
}
