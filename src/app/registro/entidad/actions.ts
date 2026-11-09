"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { prisma } from "@/db/client";
import { registrarEntidad } from "@/modules/onboarding/registrarEntidad";
import { EmailYaRegistradoError } from "@/modules/acceso/solicitudes";
import { TIPOS_ENTIDAD } from "@/modules/onboarding/tiposEntidad";
import { MUNICIPIOS_TRUJILLO } from "@/modules/onboarding/municipiosTrujillo";
import { leerHorarioSedeDeFormData } from "@/modules/onboarding/horarioSede";
import { sincronizarFichaEntidad } from "@/modules/directorio/sincronizacionEntidad";

const registroEntidadSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(160)),
  password: z.string().min(8).max(100),
  tipo: z.enum(TIPOS_ENTIDAD),
  municipio: z.string().trim().optional(),
  direccion: z.string().trim().max(300).optional(),
  telefono: z.string().trim().max(40).optional(),
});

/**
 * Mismo patrón que `registrarMedicoAction` (/registro): valida, crea la
 * cuenta, sincroniza con el Directorio BEST EFFORT (no bloquea si falla —
 * ver changelog punto 75/76 para el criterio original, acá aplicado igual
 * a entidades) y abre sesión. Sin Plan/modalidades/sedes — eso es
 * justamente lo que una entidad no tiene.
 */
export async function registrarEntidadAction(formData: FormData) {
  const parseo = registroEntidadSchema.safeParse(Object.fromEntries(formData));
  if (!parseo.success) {
    redirect(`/registro/entidad?tipo=${formData.get("tipo") ?? ""}&error=datos_invalidos`);
  }

  const municipio =
    parseo.data.municipio && (MUNICIPIOS_TRUJILLO as readonly string[]).includes(parseo.data.municipio)
      ? parseo.data.municipio
      : null;

  const horario = leerHorarioSedeDeFormData(formData, "horario");

  let organizacionId: string;
  try {
    const resultado = await registrarEntidad({
      nombre: parseo.data.nombre,
      email: parseo.data.email,
      password: parseo.data.password,
      tipo: parseo.data.tipo,
      municipio,
      direccion: parseo.data.direccion,
      telefono: parseo.data.telefono,
      horario,
    });
    organizacionId = resultado.organizacionId;
  } catch (err) {
    if (err instanceof EmailYaRegistradoError) {
      redirect(`/registro/entidad?tipo=${parseo.data.tipo}&error=email_registrado`);
    }
    throw err;
  }

  // Sincronización con el Directorio (igual criterio que el registro de
  // médico): best effort, no bloquea la cuenta ya creada si falla. Sin
  // ciudadId todavía — mismo motivo que médico, el municipio de Trujillo
  // (arriba) no es el catálogo de `ciudades` del Directorio. Se elige
  // después, desde "Mi ficha pública" (ver sincronizacionEntidad.ts).
  const resultadoSync = await sincronizarFichaEntidad({
    nombre: parseo.data.nombre,
    tipo: parseo.data.tipo,
    direccion: parseo.data.direccion ?? null,
    telefono: parseo.data.telefono ?? null,
    horario,
  });
  if (resultadoSync.ok) {
    await prisma.organizacion.update({
      where: { id: organizacionId },
      data: {
        fichaDirectorioId: resultadoSync.id,
        fichaDirectorioSlug: resultadoSync.slug,
        fichaDirectorioSincronizada: true,
      },
    });
  }

  try {
    await signIn("credentials", {
      email: parseo.data.email,
      password: parseo.data.password,
      redirectTo: "/ficha-entidad",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?creada=1");
    }
    throw error;
  }
}
