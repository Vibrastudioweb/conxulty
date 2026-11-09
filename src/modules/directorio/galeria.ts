/**
 * Cliente del endpoint unificado de galería del Directorio (Task #11,
 * changelog punto 90/92) — `vitalud/site/src/routes/api/galeria/+server.js`.
 * Compartido por médico y entidad (clínica/farmacia): un solo módulo en
 * vez de duplicar en sincronizacion.ts y sincronizacionEntidad.ts, porque
 * la lógica es idéntica — solo cambia `tabla`. Mismo criterio que el
 * resto de los clientes de sincronización: nunca lanza, toda falla vuelve
 * `{ ok: false, error }`.
 *
 * Subida/borrado son INMEDIATOS (no van dentro del guardado general de la
 * ficha) — evita tener que rastrear en el formulario cuáles de hasta 6
 * fotos son nuevas.
 */

export type TablaGaleria = "profesionales" | "entidades";

export type ResultadoGaleria = { ok: true; galeria: string[] } | { ok: false; error: string };

function configuracion(): { base: string; secreto: string } | null {
  const base = process.env.DIRECTORIO_API_URL;
  const secreto = process.env.CONXULTY_SYNC_SECRET;
  if (!base || !secreto) return null;
  return { base: base.replace(/\/+$/, ""), secreto };
}

export async function agregarFotoGaleria(
  tabla: TablaGaleria,
  fichaDirectorioId: string,
  foto: File,
): Promise<ResultadoGaleria> {
  const config = configuracion();
  if (!config) {
    return { ok: false, error: "DIRECTORIO_API_URL / CONXULTY_SYNC_SECRET no configurados en este entorno." };
  }

  try {
    const form = new FormData();
    form.set("tabla", tabla);
    form.set("id", fichaDirectorioId);
    form.set("foto", foto, "foto.webp");
    const respuesta = await fetch(`${config.base}/api/galeria`, {
      method: "POST",
      headers: { "x-conxulty-secret": config.secreto },
      body: form,
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as ResultadoGaleria | null;
    if (!cuerpo) return { ok: false, error: `Respuesta inválida del Directorio (HTTP ${respuesta.status}).` };
    return cuerpo;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red al contactar el Directorio." };
  }
}

export async function quitarFotoGaleria(
  tabla: TablaGaleria,
  fichaDirectorioId: string,
  url: string,
): Promise<ResultadoGaleria> {
  const config = configuracion();
  if (!config) {
    return { ok: false, error: "DIRECTORIO_API_URL / CONXULTY_SYNC_SECRET no configurados en este entorno." };
  }

  try {
    const respuesta = await fetch(`${config.base}/api/galeria`, {
      method: "DELETE",
      headers: { "content-type": "application/json", "x-conxulty-secret": config.secreto },
      body: JSON.stringify({ tabla, id: fichaDirectorioId, url }),
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as ResultadoGaleria | null;
    if (!cuerpo) return { ok: false, error: `Respuesta inválida del Directorio (HTTP ${respuesta.status}).` };
    return cuerpo;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red al contactar el Directorio." };
  }
}
