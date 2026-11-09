"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { prisma } from "@/db/client";
import {
  registrarMedico,
  ProfesionOtraTextoRequeridoError,
  ModalidadRequeridaError,
  SedeRequeridaError,
  ZonaCoberturaRequeridaError,
} from "@/modules/onboarding/registro";
import { EmailYaRegistradoError } from "@/modules/acceso/solicitudes";
import { PROFESIONES } from "@/modules/onboarding/profesiones";
import { MODALIDADES_ATENCION } from "@/modules/onboarding/modalidades";
import { MUNICIPIOS_TRUJILLO } from "@/modules/onboarding/municipiosTrujillo";
import { leerHorarioSedeDeFormData, type HorarioDia } from "@/modules/onboarding/horarioSede";
import { sincronizarFichaDirectorio } from "@/modules/directorio/sincronizacion";

const registroSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(160)),
  password: z.string().min(8).max(100),
  profesion: z.enum(PROFESIONES),
  planElegido: z.enum(["FICHA", "PRO"]),
});

const SEDES_MAX = 3;

function leerTexto(formData: FormData, campo: string): string | null {
  const valor = formData.get(campo);
  if (valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

function leerSedes(formData: FormData): Array<{
  municipio: string;
  direccion: string;
  referencia: string | null;
  telefono: string | null;
  horario: HorarioDia[];
}> {
  const sedes: Array<{
    municipio: string;
    direccion: string;
    referencia: string | null;
    telefono: string | null;
    horario: HorarioDia[];
  }> = [];

  for (let i = 1; i <= SEDES_MAX; i++) {
    const prefijo = `sede${i}`;
    const municipio = leerTexto(formData, `${prefijo}_municipio`);
    const direccion = leerTexto(formData, `${prefijo}_direccion`);
    if (!municipio || !direccion) continue; // slot sin usar

    sedes.push({
      municipio,
      direccion,
      referencia: leerTexto(formData, `${prefijo}_referencia`),
      telefono: leerTexto(formData, `${prefijo}_telefono`),
      horario: leerHorarioSedeDeFormData(formData, prefijo),
    });
  }

  return sedes;
}

export async function registrarMedicoAction(formData: FormData) {
  const parseo = registroSchema.safeParse(Object.fromEntries(formData));
  if (!parseo.success) {
    redirect("/registro?error=datos_invalidos");
  }

  const modalidades = MODALIDADES_ATENCION.filter(
    (m) => formData.get(`modalidad_${m}`) === "on",
  );

  const zonasCobertura = formData
    .getAll("zonasCobertura")
    .map(String)
    .filter((z) => (MUNICIPIOS_TRUJILLO as readonly string[]).includes(z));

  const especialidadesSecundarias = [
    leerTexto(formData, "especialidadSecundaria1"),
    leerTexto(formData, "especialidadSecundaria2"),
  ].filter((v): v is string => !!v);

  // Catálogo cerrado solo para MEDICO (punto 37); las demás profesiones
  // siguen en texto libre (punto 38) — nunca se mezclan los dos campos.
  const especialidad =
    parseo.data.profesion === "MEDICO"
      ? leerTexto(formData, "especialidadMedico")
      : leerTexto(formData, "especialidadOtra");

  let organizacionId: string;
  try {
    const resultado = await registrarMedico({
      nombre: parseo.data.nombre,
      email: parseo.data.email,
      password: parseo.data.password,
      profesion: parseo.data.profesion,
      profesionOtraTexto: leerTexto(formData, "profesionOtraTexto"),
      cedula: leerTexto(formData, "cedula"),
      numeroColegiado: leerTexto(formData, "numeroColegiado"),
      numeroMpps: leerTexto(formData, "numeroMpps"),
      especialidad,
      especialidadesSecundarias,
      modalidades,
      zonasCobertura,
      sedes: leerSedes(formData),
      planElegido: parseo.data.planElegido,
    });
    organizacionId = resultado.organizacionId;
  } catch (err) {
    if (err instanceof EmailYaRegistradoError) {
      redirect("/registro?error=email_registrado");
    }
    if (err instanceof ProfesionOtraTextoRequeridoError) {
      redirect("/registro?error=profesion_otra_requerida");
    }
    if (err instanceof ModalidadRequeridaError) {
      redirect("/registro?error=modalidad_requerida");
    }
    if (err instanceof SedeRequeridaError) {
      redirect("/registro?error=sede_requerida");
    }
    if (err instanceof ZonaCoberturaRequeridaError) {
      redirect("/registro?error=zona_requerida");
    }
    throw err;
  }

  // NOT NOW: mostrar el detalle de choques de horario (`resultado.choques`)
  // en una pantalla propia tras el registro — requeriría que /hoy acepte
  // searchParams, que hoy no toca. El choque queda guardado en `Sede.horario`
  // igual, solo no se avisa todavía justo después de crear la cuenta.

  // Sincronización con el Directorio (changelog punto 75/76) — BEST EFFORT:
  // si el Directorio está caído o no configurado, el registro NO se
  // bloquea ni se revierte (la cuenta y la Organizacion ya existen). Queda
  // `fichaDirectorioSincronizada = false` y "Mi ficha pública" ofrece
  // reintentar manualmente. Sin sedes todavía (el registro no pide ciudad
  // del Directorio, ver sincronizacion.ts) — se completan ahí mismo.
  // changelog punto 87: ya no hace falta mapear/validar la modalidad acá —
  // las tres booleanas viajan tal cual, cualquier combinación (incluida
  // solo ONLINE) es representable del lado del Directorio.
  const resultadoSync = await sincronizarFichaDirectorio({
    nombre: parseo.data.nombre,
    profesion: parseo.data.profesion,
    numeroMpps: leerTexto(formData, "numeroMpps"),
    numeroColegiado: leerTexto(formData, "numeroColegiado"),
    atiendePresencial: modalidades.includes("PRESENCIAL"),
    atiendeDomicilio: modalidades.includes("DOMICILIO"),
    atiendeOnline: modalidades.includes("ONLINE"),
    zonasCobertura,
    sedes: [],
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
  // Si falló (incluida profesión "OTRA", que el Directorio rechaza a
  // propósito): no se registra el error en ningún lado todavía — queda
  // simplemente sincronizada=false. NOT NOW: loguear esto en
  // RegistroTrazabilidad para poder auditar fallos silenciosos.

  try {
    await signIn("credentials", {
      email: parseo.data.email,
      password: parseo.data.password,
      redirectTo: "/hoy",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // La cuenta se creó bien — esto no debería pasar, pero si pasa, que
      // inicie sesión manualmente en vez de perder la cuenta ya creada.
      redirect("/login?creada=1");
    }
    throw error;
  }
}
