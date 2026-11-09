/**
 * Cliente de moderación de reseñas (Task #16, changelog punto 91/98) — el
 * médico administra desde acá sus reseñas negativas (1-3★) pendientes;
 * las positivas (4-5★) ya se publicaron solas del lado del Directorio y
 * nunca pasan por este módulo. Mismo sentido (OS → Directorio) y mismo
 * secreto compartido que `sincronizacion.ts` — nunca lanza, toda falla
 * vuelve como `{ ok: false, error }`.
 */

export interface ResenaPendiente {
  id: string;
  nombre: string;
  telefono: string;
  estrellas: number;
  comentario: string | null;
  created_at: string;
}

export type ResultadoResenasPendientes =
  | { ok: true; pendientes: ResenaPendiente[] }
  | { ok: false; error: string };

export type ResultadoModerarResena = { ok: true } | { ok: false; error: string };

function configuracion(): { base: string; secreto: string } | null {
  const base = process.env.DIRECTORIO_API_URL;
  const secreto = process.env.CONXULTY_SYNC_SECRET;
  if (!base || !secreto) return null;
  return { base: base.replace(/\/+$/, ""), secreto };
}

export async function listarResenasPendientes(
  fichaDirectorioId: string,
): Promise<ResultadoResenasPendientes> {
  const config = configuracion();
  if (!config) {
    return { ok: false, error: "DIRECTORIO_API_URL / CONXULTY_SYNC_SECRET no configurados en este entorno." };
  }

  try {
    const url = new URL(`${config.base}/api/resenas-pendientes`);
    url.searchParams.set("id", fichaDirectorioId);
    const respuesta = await fetch(url, {
      headers: { "x-conxulty-secret": config.secreto },
      cache: "no-store",
    });
    const cuerpo = await respuesta.json().catch(() => null);
    if (!cuerpo) return { ok: false, error: `Respuesta inválida del Directorio (HTTP ${respuesta.status}).` };
    if (!cuerpo.ok) return { ok: false, error: cuerpo.error ?? "Error desconocido del Directorio." };
    return { ok: true, pendientes: cuerpo.pendientes ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red al contactar el Directorio." };
  }
}

export async function moderarResena(
  fichaDirectorioId: string,
  resenaId: string,
  decision: "publicar" | "rechazar",
): Promise<ResultadoModerarResena> {
  const config = configuracion();
  if (!config) {
    return { ok: false, error: "DIRECTORIO_API_URL / CONXULTY_SYNC_SECRET no configurados en este entorno." };
  }

  try {
    const respuesta = await fetch(`${config.base}/api/resenas-moderar`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-conxulty-secret": config.secreto },
      body: JSON.stringify({ fichaDirectorioId, resenaId, decision }),
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as
      | { ok: true }
      | { ok: false; error: string }
      | null;
    if (!cuerpo) return { ok: false, error: `Respuesta inválida del Directorio (HTTP ${respuesta.status}).` };
    return cuerpo;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red al contactar el Directorio." };
  }
}
