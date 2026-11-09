import type { ProfesionId } from "@/modules/onboarding/profesiones";
import type { ModalidadAtencionId } from "@/modules/onboarding/modalidades";

/**
 * Cliente del endpoint de sincronización del Directorio — ver changelog
 * puntos 74/75/76 y `vitalud/site/src/routes/api/sincronizar-profesional/
 * +server.js` (el lado que recibe estas llamadas).
 *
 * Nunca lanza: toda falla (red, configuración faltante, error del
 * Directorio) vuelve como `{ ok: false, error }`, para que el llamador
 * decida — el registro la trata como best-effort (no bloquea la cuenta
 * nueva si el Directorio está caído), "Mi ficha pública" la trata como
 * bloqueante (el médico necesita saber si de verdad se guardó).
 */

export type ModalidadDirectorio = "sede" | "domicilio" | "ambas";

export class ModalidadNoMapeableError extends Error {
  constructor() {
    super(
      "El Directorio todavía no admite una ficha 100% online — agrega al menos una sede presencial o cobertura a domicilio para publicarla.",
    );
    this.name = "ModalidadNoMapeableError";
  }
}

/**
 * El OS admite PRESENCIAL / DOMICILIO / ONLINE (multi-select, changelog
 * punto 30). El Directorio solo modela 'sede' / 'domicilio' / 'ambas' — no
 * tiene ningún concepto de "online". Mapeo deliberado, sin inventar un
 * valor que no existe en el esquema real:
 *  - PRESENCIAL + DOMICILIO → 'ambas'
 *  - solo PRESENCIAL        → 'sede'
 *  - solo DOMICILIO         → 'domicilio'
 *  - ONLINE se ignora para esta decisión (no participa del cálculo); si
 *    es la ÚNICA modalidad elegida, no hay nada que mapear → lanza
 *    ModalidadNoMapeableError en vez de adivinar.
 */
export function mapearModalidadDirectorio(modalidades: ModalidadAtencionId[]): ModalidadDirectorio {
  const presencial = modalidades.includes("PRESENCIAL");
  const domicilio = modalidades.includes("DOMICILIO");
  if (presencial && domicilio) return "ambas";
  if (presencial) return "sede";
  if (domicilio) return "domicilio";
  throw new ModalidadNoMapeableError();
}

export interface SedeSincronizacion {
  ciudadId: string;
  direccion: string;
  referencia?: string | null;
  telefono?: string | null;
  /** Punto exacto marcado en el mapa (opcional) — ver changelog punto 80. */
  lat?: number | null;
  lng?: number | null;
}

export interface DatosFichaDirectorio {
  fichaDirectorioId?: string | null;
  nombre: string;
  profesion: ProfesionId;
  numeroMpps?: string | null;
  numeroColegiado?: string | null;
  modalidad: ModalidadDirectorio;
  zonasCobertura?: string[];
  sedes: SedeSincronizacion[];
  fotoUrl?: string | null;
  descripcion?: string | null;
  instagram?: string | null;
  correo?: string | null;
  sitioWeb?: string | null;
  rif?: string | null;
  domicilioFiscal?: string | null;
  disponibilidad?: string | null;
}

export type ResultadoSincronizacion =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

function configuracion(): { base: string; secreto: string } | null {
  const base = process.env.DIRECTORIO_API_URL;
  const secreto = process.env.CONXULTY_SYNC_SECRET;
  if (!base || !secreto) return null;
  return { base: base.replace(/\/+$/, ""), secreto };
}

export async function sincronizarFichaDirectorio(
  datos: DatosFichaDirectorio,
): Promise<ResultadoSincronizacion> {
  const config = configuracion();
  if (!config) {
    return { ok: false, error: "DIRECTORIO_API_URL / CONXULTY_SYNC_SECRET no configurados en este entorno." };
  }

  try {
    const respuesta = await fetch(`${config.base}/api/sincronizar-profesional`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-conxulty-secret": config.secreto },
      body: JSON.stringify(datos),
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as
      | { ok: true; id: string; slug: string }
      | { ok: false; error: string }
      | null;
    if (!cuerpo) return { ok: false, error: `Respuesta inválida del Directorio (HTTP ${respuesta.status}).` };
    return cuerpo;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red al contactar el Directorio." };
  }
}

export type ResultadoSubidaFoto = { ok: true; fotoUrl: string } | { ok: false; error: string };

/**
 * Sube la foto (ya convertida a webp en el navegador, ver RecortadorFoto)
 * al Directorio — ver changelog punto 86 y el endpoint hermano del lado de
 * vitalud, api/sincronizar-profesional/foto/+server.js. Requiere un
 * `fichaDirectorioId` real: no crea la ficha, solo le aplica la foto.
 */
export async function subirFotoDirectorio(
  fichaDirectorioId: string,
  foto: File,
): Promise<ResultadoSubidaFoto> {
  const config = configuracion();
  if (!config) {
    return { ok: false, error: "DIRECTORIO_API_URL / CONXULTY_SYNC_SECRET no configurados en este entorno." };
  }

  try {
    const form = new FormData();
    form.set("id", fichaDirectorioId);
    form.set("foto", foto, "foto.webp");
    const respuesta = await fetch(`${config.base}/api/sincronizar-profesional/foto`, {
      method: "POST",
      headers: { "x-conxulty-secret": config.secreto },
      body: form,
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as
      | { ok: true; fotoUrl: string }
      | { ok: false; error: string }
      | null;
    if (!cuerpo) return { ok: false, error: `Respuesta inválida del Directorio (HTTP ${respuesta.status}).` };
    return cuerpo;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red al contactar el Directorio." };
  }
}

export interface CiudadDirectorio {
  id: string;
  nombre: string;
}

export interface SedeDirectorio {
  id: string;
  ciudad_id: string | null;
  direccion: string;
  referencia_escrita: string | null;
  telefono: string | null;
  principal: boolean;
  orden: number;
  lat: number | null;
  lng: number | null;
}

export interface FichaDirectorio {
  id: string;
  nombre: string;
  slug: string;
  modalidad: ModalidadDirectorio;
  cobertura_zonas: string[];
  registro_numero: string | null;
  foto_url: string | null;
  descripcion: string | null;
  instagram: string | null;
  correo: string | null;
  sitio_web: string | null;
  rif: string | null;
  domicilio_fiscal: string | null;
  disponibilidad: string | null;
  publicada: boolean;
}

export type ResultadoConsultaFicha =
  | { ok: true; ficha: FichaDirectorio | null; sedes: SedeDirectorio[]; ciudades: CiudadDirectorio[] }
  | { ok: false; error: string };

/**
 * Trae el estado actual de la ficha (para precargar "Mi ficha pública") y
 * el catálogo real de ciudades del Directorio — el médico elige la suya
 * ahí mismo, no se intenta adivinar a partir del municipio de Trujillo
 * que ya captura el registro (son catálogos geográficos distintos, ver
 * comentario del endpoint del lado del Directorio).
 */
export async function obtenerFichaDirectorio(
  fichaDirectorioId: string | null,
): Promise<ResultadoConsultaFicha> {
  const config = configuracion();
  if (!config) {
    return { ok: false, error: "DIRECTORIO_API_URL / CONXULTY_SYNC_SECRET no configurados en este entorno." };
  }

  try {
    const url = new URL(`${config.base}/api/sincronizar-profesional`);
    if (fichaDirectorioId) url.searchParams.set("id", fichaDirectorioId);
    const respuesta = await fetch(url, {
      headers: { "x-conxulty-secret": config.secreto },
      cache: "no-store",
    });
    const cuerpo = await respuesta.json().catch(() => null);
    if (!cuerpo) return { ok: false, error: `Respuesta inválida del Directorio (HTTP ${respuesta.status}).` };
    if (!cuerpo.ok) return { ok: false, error: cuerpo.error ?? "Error desconocido del Directorio." };
    return { ok: true, ficha: cuerpo.ficha ?? null, sedes: cuerpo.sedes ?? [], ciudades: cuerpo.ciudades ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red al contactar el Directorio." };
  }
}
