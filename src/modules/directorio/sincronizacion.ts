import type { ProfesionId } from "@/modules/onboarding/profesiones";

/**
 * Cliente del endpoint de sincronización del Directorio — ver changelog
 * puntos 74/75/76/87 y `vitalud/site/src/routes/api/sincronizar-profesional/
 * +server.js` (el lado que recibe estas llamadas).
 *
 * Nunca lanza: toda falla (red, configuración faltante, error del
 * Directorio) vuelve como `{ ok: false, error }`, para que el llamador
 * decida — el registro la trata como best-effort (no bloquea la cuenta
 * nueva si el Directorio está caído), "Mi ficha pública" la trata como
 * bloqueante (el médico necesita saber si de verdad se guardó).
 *
 * Hasta el punto 87, esto mandaba un `modalidad: 'sede'|'domicilio'|'ambas'`
 * calculado acá — y no había forma de representar "100% online", así que
 * un médico que solo atiende online no podía sincronizar su ficha. Se
 * investigó antes de aceptar eso como límite del Directorio: resultó ser
 * un endpoint desactualizado, no una limitación real — el Directorio
 * reemplazó ese enum por tres columnas booleanas independientes
 * (`atiende_presencial/domicilio/online`, 02/11, ver vitalud-esquema.sql)
 * ANTES de que se construyera esta integración (08/11), y el endpoint
 * nunca se actualizó para usarlas. Ahora se manda cada una tal cual —
 * ninguna combinación necesita mapeo ni queda sin representar.
 */

/** Catálogo de servicios con precio propio del médico (Task #13) — ver
 *  ServiciosPreciosForm.tsx. `precio` en USD, `null` = "a consultar". */
export interface ServicioPrecioSincronizacion {
  nombre: string;
  precio: number | null;
}

export interface SedeSincronizacion {
  ciudadId: string;
  direccion: string;
  /** 'Piso 3, consultorio 302' — distinto de `referencia` (una seña como
   *  "frente al Hospital Central"). Columna propia desde el 10-nov-2026;
   *  antes el OS no la capturaba y la ficha caía a mostrar solo la
   *  dirección. */
  consultorio?: string | null;
  /** Sector/barrio ('Las Acacias') — igual, nueva desde el 10-nov-2026. */
  sector?: string | null;
  referencia?: string | null;
  telefono?: string | null;
  /** Punto exacto marcado en el mapa (opcional) — ver changelog punto 80. */
  lat?: number | null;
  lng?: number | null;
  /**
   * 11-nov-2026: horario semanal de la sede, para que el Directorio pueda
   * mostrar el widget "Agendar cita" (AgendaCita.svelte, vitalud) — antes
   * esto NUNCA viajaba (el endpoint no tenía campo para esto), así que
   * ningún médico sincronizado desde Conxulty podía activar ese flujo,
   * aunque cargara teléfono y horario acá (descubierto en vivo con la Dra.
   * Yamaruc: cargó horario, pero el botón de agendar nunca apareció).
   * Mismo `dia_semana` 1-7 (1=lunes) que ya usa `horarios_sede` en
   * vitalud-esquema.sql — sin mapeo, calzan directo con `DIAS_SEMANA` de
   * horarioSede.ts. Solo los días que SÍ atiende (filtrado antes de
   * mandar) — un día sin horario simplemente no manda fila.
   */
  horario?: Array<{ diaSemana: number; horaInicio: string; horaFin: string }>;
}

export interface DatosFichaDirectorio {
  fichaDirectorioId?: string | null;
  nombre: string;
  profesion: ProfesionId;
  numeroMpps?: string | null;
  numeroColegiado?: string | null;
  atiendePresencial: boolean;
  atiendeDomicilio: boolean;
  atiendeOnline: boolean;
  zonasCobertura?: string[];
  sedes: SedeSincronizacion[];
  fotoUrl?: string | null;
  descripcion?: string | null;
  instagram?: string | null;
  correo?: string | null;
  sitioWeb?: string | null;
  rif?: string | null;
  domicilioFiscal?: string | null;
  // 10-nov-2026: `disponibilidad` se saca de acá — nunca se imprimía en
  // la ficha pública (medico/[slug]/+page.svelte, vitalud, nunca la lee),
  // así que era un campo que se mandaba sin ningún destino. La columna
  // sigue existiendo del lado del Directorio (datos viejos intactos), ya
  // no la escribe nadie.
  /** Task #13 — ver ServicioPrecioSincronizacion. */
  servicios?: ServicioPrecioSincronizacion[];
  /** Task #14 — texto libre, sin catálogo cerrado (ver AseguradorasForm.tsx). */
  aseguradoras?: string[];
  /**
   * Id real del catálogo cerrado de especialidades del Directorio
   * (`especialidades.id`), o null si no hay. Nunca lo elige el médico a
   * mano — se resuelve con `resolverEspecialidadId` a partir del texto
   * que ya escogió en /registro, tanto ahí mismo como al guardar "Mi
   * ficha pública" (10-nov-2026, ver esa función para el porqué).
   */
  especialidadId?: string | null;
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
  consultorio: string | null;
  sector: string | null;
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
  atiende_presencial: boolean;
  atiende_domicilio: boolean;
  atiende_online: boolean;
  cobertura_zonas: string[];
  registro_numero: string | null;
  foto_url: string | null;
  /** Hasta 6 fotos (Task #11, changelog punto 90/92) — gestionada aparte
   *  por GaleriaFotosForm, nunca se manda en el POST principal. */
  galeria: string[];
  descripcion: string | null;
  instagram: string | null;
  correo: string | null;
  sitio_web: string | null;
  rif: string | null;
  domicilio_fiscal: string | null;
  disponibilidad: string | null;
  /** Task #13, changelog punto 91/93. */
  servicios: ServicioPrecioSincronizacion[];
  /** Task #14, changelog punto 91/95. */
  aseguradoras: string[];
  publicada: boolean;
  /** Especialidad principal ya elegida del catálogo (ver `especialidadId`
   *  en `DatosFichaDirectorio`) — null si todavía no se eligió ninguna. */
  especialidad_id: string | null;
}

export interface EspecialidadDirectorio {
  id: string;
  nombre: string;
  grupo: string | null;
}

export type ResultadoConsultaFicha =
  | {
      ok: true;
      ficha: FichaDirectorio | null;
      sedes: SedeDirectorio[];
      ciudades: CiudadDirectorio[];
      especialidades: EspecialidadDirectorio[];
    }
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
    return {
      ok: true,
      ficha: cuerpo.ficha ?? null,
      sedes: cuerpo.sedes ?? [],
      ciudades: cuerpo.ciudades ?? [],
      especialidades: cuerpo.especialidades ?? [],
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red al contactar el Directorio." };
  }
}

function normalizarTextoEspecialidad(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * 10-nov-2026 (pedido del usuario: "debería sincronizarse con la
 * especialidad que el médico escoja en el onboarding" — antes esto era un
 * <select> manual en "Mi ficha pública"): resuelve el id real del catálogo
 * del Directorio a partir del texto de especialidad que el médico YA
 * eligió en /registro. Para "Médico" ese texto sale de una lista cerrada
 * (`ESPECIALIDADES_MEDICAS`, ver plantillasEspecialidad.ts) — no es texto
 * libre salvo que haya elegido "Otra" (Odontólogo, Psicólogo, etc.), caso
 * en el que lo normal es que no haya match y listo.
 *
 * Compara normalizado (sin mayúsculas/acentos). Si no hay coincidencia
 * exacta no inventa nada — vuelve null y la ficha queda sin especialidad
 * en el Directorio hasta que su catálogo tenga ese nombre (nunca se
 * fuerza una coincidencia parcial que podría ser otra especialidad).
 */
export function resolverEspecialidadId(
  especialidad: string | null | undefined,
  catalogo: EspecialidadDirectorio[],
): string | null {
  if (!especialidad) return null;
  const buscado = normalizarTextoEspecialidad(especialidad);
  return catalogo.find((e) => normalizarTextoEspecialidad(e.nombre) === buscado)?.id ?? null;
}
