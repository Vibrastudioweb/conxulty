"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { registrarMedico, ProfesionOtraTextoRequeridoError } from "@/modules/onboarding/registro";
import { EmailYaRegistradoError } from "@/modules/acceso/solicitudes";
import { PROFESIONES } from "@/modules/onboarding/profesiones";

const registroSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(160)),
  password: z.string().min(8).max(100),
  profesion: z.enum(PROFESIONES),
  planElegido: z.enum(["FICHA", "PRO"]),
});

function leerTexto(formData: FormData, campo: string): string | null {
  const valor = formData.get(campo);
  if (valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

export async function registrarMedicoAction(formData: FormData) {
  const parseo = registroSchema.safeParse(Object.fromEntries(formData));
  if (!parseo.success) {
    redirect("/registro?error=datos_invalidos");
  }

  // 10-nov-2026, pedido del usuario ("quiero hacer súper sencillo el
  // registro inicial y poner todo lo demás en mi ficha"): especialidad,
  // modalidad, sedes/horario, zonas de cobertura, cédula, MPPS y
  // colegiado ya no se piden acá — el registro solo crea la cuenta
  // (nombre, correo, contraseña, profesión, plan). Todo eso se completa
  // después en "Mi ficha pública" (ver FichaPublicaForm.tsx y su action),
  // que ya exige al menos una modalidad antes de guardar/publicar — ese
  // candado ya no hace falta acá.
  let quierePro = false;
  try {
    ({ quierePro } = await registrarMedico({
      nombre: parseo.data.nombre,
      email: parseo.data.email,
      password: parseo.data.password,
      profesion: parseo.data.profesion,
      profesionOtraTexto: leerTexto(formData, "profesionOtraTexto"),
      cedula: null,
      numeroColegiado: null,
      numeroMpps: null,
      especialidad: null,
      especialidadesSecundarias: [],
      modalidades: [],
      zonasCobertura: [],
      sedes: [],
      planElegido: parseo.data.planElegido,
    }));
  } catch (err) {
    if (err instanceof EmailYaRegistradoError) {
      redirect("/registro?error=email_registrado");
    }
    if (err instanceof ProfesionOtraTextoRequeridoError) {
      redirect("/registro?error=profesion_otra_requerida");
    }
    throw err;
  }

  // 10-nov-2026: la sincronización con el Directorio YA NO se intenta acá
  // — sin modalidad ni especialidad elegidas en este formulario, esa
  // llamada iba a fallar el 100% de las veces ("marca al menos una
  // modalidad"), puro ruido. Queda para cuando el médico entra a "Mi
  // ficha pública" por primera vez y guarda: ese mismo action crea la
  // ficha en el Directorio si todavía no existe (ver
  // `sincronizarFichaDirectorio` — funciona igual con `fichaDirectorioId`
  // en null que actualizando una ya creada).

  try {
    await signIn("credentials", {
      email: parseo.data.email,
      password: parseo.data.password,
      // Quien eligió Pro entra a pagarlo: Pro no tiene mes gratis
      // (decisión del founder, 13-nov-2026). Su cuenta ya quedó en Ficha
      // con el mes de regalo corriendo, así que si no paga igual puede
      // trabajar con agenda, pacientes y su ficha pública.
      redirectTo: quierePro ? "/ajustes?pro=consultas" : "/hoy",
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
