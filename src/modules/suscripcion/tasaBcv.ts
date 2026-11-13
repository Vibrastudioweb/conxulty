/**
 * Tasa del BCV para mostrar el monto en bolívares antes de mandar al
 * médico a pagar (13-nov-2026, decisión del founder: "5$ BCV").
 *
 * Por qué hace falta: la cuenta de SPIDI es personal, no comercial, así
 * que el monto NO viaja en el link — quien paga lo escribe a mano (ver
 * pagoManual.ts). Si solo le mostramos "$5", cada médico convierte por su
 * cuenta con la tasa que tenga a mano y paga un monto distinto, que
 * después alguien tiene que cuadrar a ojo contra el comprobante.
 *
 * Es informativo, nunca bloqueante: si ninguna fuente responde se
 * devuelve null y la pantalla muestra solo los dólares, diciendo que no
 * se pudo traer la tasa. Un cobro no se cae porque una API pública esté
 * lenta.
 *
 * Ojo: las dos fuentes son APIs públicas de terceros que publican la tasa
 * oficial del BCV; no son el BCV. Si alguna cambia su formato, el
 * extractor tolerante de abajo devuelve null y se cae al dólar.
 */

export interface TasaBcv {
  bolivaresPorDolar: number;
  /** Cuándo la trajimos nosotros, no cuándo la publicó el BCV. */
  consultadaEn: Date;
  fuente: string;
}

const FUENTES = [
  "https://ve.dolarapi.com/v1/dolares/oficial",
  "https://pydolarve.org/api/v1/dollar?page=bcv",
] as const;

const TIEMPO_ESPERA_MS = 4000;
/** La tasa oficial cambia como mucho una vez al día; 3 horas es de sobra
 *  y evita pegarle a una API pública en cada carga de /ajustes. */
const VIGENCIA_CACHE_MS = 3 * 60 * 60 * 1000;

let cache: { tasa: TasaBcv | null; expiraEn: number } | null = null;

/**
 * Busca un número de tasa plausible en la respuesta, sin casarse con el
 * formato exacto de ninguna de las dos APIs: ambas han cambiado de forma
 * antes y una tasa no vale romper la pantalla de pago. Se recorren los
 * nombres de campo conocidos y se acepta el primero que parezca una tasa
 * (positivo y finito).
 */
function extraerTasa(datos: unknown): number | null {
  const candidatos: unknown[] = [];
  const visitar = (valor: unknown, profundidad: number) => {
    if (profundidad > 4 || valor === null || typeof valor !== "object") return;
    const obj = valor as Record<string, unknown>;
    for (const clave of ["promedio", "price", "venta", "valor", "rate"]) {
      if (clave in obj) candidatos.push(obj[clave]);
    }
    for (const anidado of Object.values(obj)) visitar(anidado, profundidad + 1);
  };
  visitar(datos, 0);

  for (const candidato of candidatos) {
    const numero = typeof candidato === "string" ? Number(candidato) : candidato;
    if (typeof numero === "number" && Number.isFinite(numero) && numero > 0) {
      return numero;
    }
  }
  return null;
}

export async function obtenerTasaBcv(): Promise<TasaBcv | null> {
  if (cache && cache.expiraEn > Date.now()) return cache.tasa;

  for (const url of FUENTES) {
    try {
      const respuesta = await fetch(url, {
        signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!respuesta.ok) continue;
      const tasa = extraerTasa(await respuesta.json());
      if (tasa === null) continue;

      const resultado: TasaBcv = {
        bolivaresPorDolar: tasa,
        consultadaEn: new Date(),
        fuente: new URL(url).hostname,
      };
      cache = { tasa: resultado, expiraEn: Date.now() + VIGENCIA_CACHE_MS };
      return resultado;
    } catch (err) {
      console.error(`[tasa BCV] no se pudo leer ${url}:`, err);
    }
  }

  // Se cachea también el fallo, pero por poco tiempo: si las dos fuentes
  // están caídas, no tiene sentido reintentar en cada carga de página.
  cache = { tasa: null, expiraEn: Date.now() + 10 * 60 * 1000 };
  return null;
}

/** "Bs. 1.234,56" — lo que el médico tiene que escribir en SPIDI. */
export function montoEnBolivares(centavosUsd: number, tasa: TasaBcv): string {
  const bolivares = (centavosUsd / 100) * tasa.bolivaresPorDolar;
  return `Bs. ${bolivares.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
