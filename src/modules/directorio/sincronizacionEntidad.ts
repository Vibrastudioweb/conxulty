import type { TipoEntidadId } from "@/modules/onboarding/tiposEntidad";
import type { HorarioDia } from "@/modules/onboarding/horarioSede";

/**
 * Cliente del endpoint de sincronización de ENTIDADES del Directorio — ver
 * changelog punto 90/92 y el hermano de médico (`sincronizacion.ts`),
 * `vitalud/site/src/routes/api/sincronizar-entidad/+server.js` (el lado
 * que recibe estas llamadas). Mismo criterio: nunca lanza, toda falla
 * vuelve `{ ok: false, error }`, best effort en el registro.
 *
 * Sin `ciudadId` todavía en el registro (mismo motivo que médico: el
 * catálogo de municipios de Trujillo del OS no es el mismo que `ciudades`
 * del Directorio) — se elige después, desde "Mi ficha pública".
 */

export interface DatosFichaEntidad {
  fichaDirectorioId?: string | null;
  nombre: string;
  tipo: TipoEntidadId;
  ciudadId?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  horario: HorarioDia[];
}

export type ResultadoSincronizacionEntidad =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

function configuracion(): { base: string; secreto: string } | null {
  const base = process.env.DIRECTORIO_API_URL;
  const secreto = process.env.CONXULTY_SYNC_SECRET;
  if (!base || !secreto) return null;
  return { base: base.replace(/\/+$/, ""), secreto };
}

export async function sincronizarFichaEntidad(
  datos: DatosFichaEntidad,
): Promise<ResultadoSincronizacionEntidad> {
  const config = configuracion();
  if (!config) {
    return { ok: false, error: "DIRECTORIO_API_URL / CONXULTY_SYNC_SECRET no configurados en este entorno." };
  }

  try {
    const respuesta = await fetch(`${config.base}/api/sincronizar-entidad`, {
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

export interface CiudadDirectorio {
  id: string;
  nombre: string;
}

export interface FichaEntidadDirectorio {
  id: string;
  nombre: string;
  slug: string;
  ciudad_id: string | null;
  direccion: string | null;
  telefono: string | null;
  horarios: HorarioDia[] | null;
  publicada: boolean;
}

export type ResultadoConsultaFichaEntidad =
  | { ok: true; ficha: FichaEntidadDirectorio | null; ciudades: CiudadDirectorio[] }
  | { ok: false; error: string };

/** Trae el estado actual de la ficha de entidad + el catálogo de ciudades —
 *  mismo criterio que `obtenerFichaDirectorio` del lado de médico. */
export async function obtenerFichaEntidadDirectorio(
  fichaDirectorioId: string | null,
): Promise<ResultadoConsultaFichaEntidad> {
  const config = configuracion();
  if (!config) {
    return { ok: false, error: "DIRECTORIO_API_URL / CONXULTY_SYNC_SECRET no configurados en este entorno." };
  }

  try {
    const url = new URL(`${config.base}/api/sincronizar-entidad`);
    if (fichaDirectorioId) url.searchParams.set("id", fichaDirectorioId);
    const respuesta = await fetch(url, {
      headers: { "x-conxulty-secret": config.secreto },
      cache: "no-store",
    });
    const cuerpo = await respuesta.json().catch(() => null);
    if (!cuerpo) return { ok: false, error: `Respuesta inválida del Directorio (HTTP ${respuesta.status}).` };
    if (!cuerpo.ok) return { ok: false, error: cuerpo.error ?? "Error desconocido del Directorio." };
    return { ok: true, ficha: cuerpo.ficha ?? null, ciudades: cuerpo.ciudades ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red al contactar el Directorio." };
  }
}
