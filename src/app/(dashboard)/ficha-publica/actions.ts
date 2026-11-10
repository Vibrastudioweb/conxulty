"use server";

import { z } from "zod";
import { prisma } from "@/db/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import {
  sincronizarFichaDirectorio,
  subirFotoDirectorio,
  obtenerFichaDirectorio,
} from "@/modules/directorio/sincronizacion";
import { MUNICIPIOS_TRUJILLO } from "@/modules/onboarding/municipiosTrujillo";

const fichaPublicaSchema = z.object({
  descripcion: z.string().trim().max(2000).optional(),
  instagram: z.string().trim().max(160).optional(),
  correo: z.string().trim().max(160).optional(),
  sitioWeb: z.string().trim().max(500).optional(),
  rif: z.string().trim().max(40).optional(),
  domicilioFiscal: z.string().trim().max(300).optional(),
  // 10-nov-2026: "disponibilidad" se saca de acá y del formulario — nunca
  // se imprimía en la ficha pública (confirmado en el código de vitalud),
  // era un campo que se guardaba sin ningún destino.
  // 10-nov-2026: se sacaron del registro ("menos pasos") — ahora se
  // editan acá y se persisten en `Medico`, no solo se sincronizan.
  cedula: z.string().trim().max(40).optional(),
  numeroColegiado: z.string().trim().max(40).optional(),
  numeroMpps: z.string().trim().max(40).optional(),
  especialidadSecundaria1: z.string().trim().max(160).optional(),
  // 10-nov-2026: el médico elige del catálogo real del Directorio (un
  // uuid), nunca se manda texto libre — ver nota en sincronizacion.ts.
  especialidadId: z.string().trim().max(60).optional(),
});

// Task #13: el médico edita la lista con ServiciosPreciosForm.tsx, que
// mantiene el estado completo en UN input oculto (`servicios`, JSON) —
// más simple que repuntar índice por índice del lado del servidor. Se
// valida acá, no se confía en el JSON tal cual llega del cliente.
const servicioPrecioSchema = z.object({
  nombre: z.string().trim().min(1).max(160),
  precio: z.number().finite().min(0).nullable(),
});
const serviciosSchema = z.array(servicioPrecioSchema).max(20);

function leerServiciosDeFormData(formData: FormData): { nombre: string; precio: number | null }[] {
  const crudo = formData.get("servicios")?.toString();
  if (!crudo) return [];
  try {
    const parseo = serviciosSchema.safeParse(JSON.parse(crudo));
    return parseo.success ? parseo.data : [];
  } catch {
    // JSON inválido (no debería pasar viniendo del propio formulario) —
    // se descarta en vez de bloquear el resto del guardado.
    return [];
  }
}

// Task #14: mismo patrón que servicios — texto libre, sin catálogo
// cerrado (no se investigó ninguno compartido con el Directorio).
const aseguradorasSchema = z.array(z.string().trim().min(1).max(160)).max(15);

function leerAseguradorasDeFormData(formData: FormData): string[] {
  const crudo = formData.get("aseguradoras")?.toString();
  if (!crudo) return [];
  try {
    const parseo = aseguradorasSchema.safeParse(JSON.parse(crudo));
    return parseo.success ? parseo.data : [];
  } catch {
    return [];
  }
}

export type GuardarFichaPublicaResultado =
  | { ok: true; slug: string; advertenciaFoto?: string }
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
    descripcion: vacio(formData.get("descripcion")),
    instagram: vacio(formData.get("instagram")),
    correo: vacio(formData.get("correo")),
    sitioWeb: vacio(formData.get("sitioWeb")),
    rif: vacio(formData.get("rif")),
    domicilioFiscal: vacio(formData.get("domicilioFiscal")),
    cedula: vacio(formData.get("cedula")),
    numeroColegiado: vacio(formData.get("numeroColegiado")),
    numeroMpps: vacio(formData.get("numeroMpps")),
    especialidadSecundaria1: vacio(formData.get("especialidadSecundaria1")),
    especialidadId: vacio(formData.get("especialidadId")),
  });
  if (!parseo.success) {
    return { ok: false, error: "Revisa los campos marcados — alguno quedó demasiado largo." };
  }

  const servicios = leerServiciosDeFormData(formData);
  const aseguradoras = leerAseguradorasDeFormData(formData);
  const zonasCoberturaForm = formData
    .getAll("zonasCobertura")
    .map(String)
    .filter((z) => (MUNICIPIOS_TRUJILLO as readonly string[]).includes(z));

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

  // changelog punto 87: ya no hace falta mapear/validar la modalidad acá —
  // las tres booleanas viajan tal cual, cualquier combinación (incluida
  // solo ONLINE) es representable del lado del Directorio.
  const atiendePresencial = medicoCompleto.modalidades.includes("PRESENCIAL");
  const atiendeDomicilio = medicoCompleto.modalidades.includes("DOMICILIO");
  const atiendeOnline = medicoCompleto.modalidades.includes("ONLINE");

  // 10-nov-2026: cédula, MPPS, colegiado, especialidad secundaria y zonas
  // de cobertura ya no se piden en el registro — este formulario es ahora
  // la única pantalla donde se persisten en `Medico` (antes acá solo se
  // LEÍAN de `medicoCompleto` para sincronizar, nunca se escribían).
  const numeroMppsNuevo =
    medicoCompleto.profesion === "MEDICO" ? parseo.data.numeroMpps ?? null : null;
  const zonasCoberturaNuevas = atiendeDomicilio ? zonasCoberturaForm : [];
  const especialidadesSecundariasNuevas = parseo.data.especialidadSecundaria1
    ? [parseo.data.especialidadSecundaria1]
    : [];

  await prisma.medico.update({
    where: { id: medico.id },
    data: {
      cedula: parseo.data.cedula ?? null,
      numeroColegiado: parseo.data.numeroColegiado ?? null,
      numeroMpps: numeroMppsNuevo,
      especialidadesSecundarias: especialidadesSecundariasNuevas,
      zonasCobertura: zonasCoberturaNuevas,
    },
  });

  // Cada sede necesita una ciudad REAL del Directorio (catálogo distinto al
  // municipio de Trujillo que ya tiene cada Sede — ver sincronizacion.ts).
  // El formulario manda un campo `ciudadSede_<id>` por cada sede del OS.
  type SedeOs = { id: string; direccion: string; referencia: string | null; telefono: string | null };
  type SedeConCiudad = {
    ciudadId: string;
    direccion: string;
    // 10-nov-2026: antes el Directorio no tenía estas dos columnas — la
    // ficha caía a mostrar solo la dirección. `consultorioSede_<id>` y
    // `sectorSede_<id>` son nuevos en FichaPublicaForm.tsx.
    consultorio: string | null;
    sector: string | null;
    referencia: string | null;
    telefono: string | null;
    lat: number | null;
    lng: number | null;
  };

  // El picker de mapa manda `lat_<id>`/`lng_<id>` como string numérico solo
  // cuando el médico marcó un punto — ausentes o vacíos quedan en null (el
  // punto exacto es opcional, la ciudad ya alcanza para listar la sede).
  function coordenada(valor: FormDataEntryValue | null): number | null {
    const texto = valor?.toString().trim();
    if (!texto) return null;
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
  }

  const sedesConCiudad = sedes
    .map((sede: SedeOs): SedeConCiudad | null => {
      const ciudadId = vacio(formData.get(`ciudadSede_${sede.id}`));
      if (!ciudadId) return null;
      return {
        ciudadId,
        direccion: sede.direccion,
        consultorio: vacio(formData.get(`consultorioSede_${sede.id}`)) ?? null,
        sector: vacio(formData.get(`sectorSede_${sede.id}`)) ?? null,
        referencia: sede.referencia,
        telefono: sede.telefono,
        lat: coordenada(formData.get(`lat_${sede.id}`)),
        lng: coordenada(formData.get(`lng_${sede.id}`)),
      };
    })
    .filter((s: SedeConCiudad | null): s is SedeConCiudad => s !== null);

  if (atiendePresencial && sedesConCiudad.length === 0 && sedes.length > 0) {
    return {
      ok: false,
      error: "Elige la ciudad del Directorio para al menos una de tus sedes antes de guardar.",
    };
  }

  // La foto ya no se edita como texto (ver changelog punto 86) — este POST
  // sigue necesitando MANDAR el valor actual de foto_url, o el Directorio
  // la pondría en null en cada guardado de los demás campos. La subida de
  // una foto nueva (si llegó un archivo) pasa aparte, DESPUÉS de este sync,
  // porque necesita un fichaDirectorioId real (lo crea este mismo llamado
  // si todavía no existía).
  const directorioActual = await obtenerFichaDirectorio(organizacion.fichaDirectorioId);
  const fotoUrlActual = directorioActual.ok ? directorioActual.ficha?.foto_url ?? null : null;

  const resultado = await sincronizarFichaDirectorio({
    fichaDirectorioId: organizacion.fichaDirectorioId,
    nombre: organizacion.nombre,
    profesion: medicoCompleto.profesion,
    numeroMpps: numeroMppsNuevo,
    numeroColegiado: parseo.data.numeroColegiado ?? null,
    atiendePresencial,
    atiendeDomicilio,
    atiendeOnline,
    zonasCobertura: zonasCoberturaNuevas,
    sedes: sedesConCiudad,
    fotoUrl: fotoUrlActual,
    descripcion: parseo.data.descripcion ?? null,
    instagram: parseo.data.instagram ?? null,
    correo: parseo.data.correo ?? null,
    sitioWeb: parseo.data.sitioWeb ?? null,
    rif: parseo.data.rif ?? null,
    domicilioFiscal: parseo.data.domicilioFiscal ?? null,
    servicios,
    aseguradoras,
    especialidadId: parseo.data.especialidadId ?? null,
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

  // Foto nueva: el input oculto solo trae un archivo si RecortadorFoto
  // confirmó un recorte en esta misma carga del form (ver
  // FichaPublicaForm.tsx) — subirFotoDirectorio aplica foto_url directo en
  // el Directorio, no hace falta un segundo sync completo para eso.
  const archivoFoto = formData.get("foto");
  let advertenciaFoto: string | undefined;
  if (archivoFoto instanceof File && archivoFoto.size > 0) {
    const subida = await subirFotoDirectorio(resultado.id, archivoFoto);
    if (!subida.ok) advertenciaFoto = subida.error;
  }

  return { ok: true, slug: resultado.slug, advertenciaFoto };
}
