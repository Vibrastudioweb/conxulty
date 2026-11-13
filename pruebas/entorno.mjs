/**
 * Piezas compartidas de las pruebas: conexión a la base, sesiones falsas,
 * aserciones y el informe final.
 *
 * No hay framework de pruebas a propósito. Cada archivo .test.mjs es un
 * programa de Node que se puede correr solo:
 *
 *   node pruebas/reserva.test.mjs
 *
 * Es una dependencia menos que mantener y una capa menos entre una falla y
 * entender por qué falló. Si algún día son cientos de pruebas, ahí sí vale
 * meter un corredor de verdad.
 */

import { createRequire } from "node:module";
import { PrismaPg } from "@prisma/adapter-pg";

const requerir = createRequire(import.meta.url);

// ── Guarda: esto NUNCA debe correr contra producción ────────────────
//
// Estas pruebas crean, modifican y BORRAN filas (pagos, citas, pacientes).
// Contra la base real serían un desastre silencioso. Por eso se exige que
// la base sea local: no hay bandera para saltárselo, si algún día hace
// falta correrlas contra otra base habrá que editar esta función y pensarlo
// dos veces, que es justo el punto.
const HOSTS_PERMITIDOS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function exigirBaseLocal() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL. Mira pruebas/README.md.");
    process.exit(2);
  }
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    console.error("DATABASE_URL no es una URL válida.");
    process.exit(2);
  }
  if (!HOSTS_PERMITIDOS.has(host)) {
    console.error(
      `\n✗ NEGADO: DATABASE_URL apunta a "${host}", que no es una base local.\n` +
        "  Estas pruebas escriben y borran datos. No se corren contra producción.\n",
    );
    process.exit(2);
  }
  return url;
}

// ── Base de datos ───────────────────────────────────────────────────

let conexion = null;

async function conectar() {
  if (!conexion) {
    const adapter = new PrismaPg({ connectionString: exigirBaseLocal(), ssl: false });
    conexion = await adapter.connect();
  }
  return conexion;
}

/** Devuelve las filas de una consulta, como objetos. */
export async function consultar(sql) {
  const c = await conectar();
  const r = await c.queryRaw({ sql, args: [], argTypes: [] });
  return r.rows.map((fila) =>
    Object.fromEntries(r.columnNames.map((col, i) => [col, fila[i]])),
  );
}

/** El primer valor de la primera fila — para `select count(*)` y amigos. */
export async function valor(sql) {
  const filas = await consultar(sql);
  if (filas.length === 0) return null;
  return Object.values(filas[0])[0];
}

/** Para INSERT/UPDATE/DELETE. */
export async function ejecutar(sql) {
  const c = await conectar();
  await c.executeRaw({ sql, args: [], argTypes: [] });
}

export async function cerrarBase() {
  if (conexion) {
    await conexion.dispose?.();
    conexion = null;
  }
}

// ── La aplicación bajo prueba ───────────────────────────────────────

export const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3111").replace(/\/+$/, "");

export function secretoSync() {
  const s = process.env.CONXULTY_SYNC_SECRET;
  if (!s) {
    console.error("Falta CONXULTY_SYNC_SECRET (el mismo con el que arrancaste la app).");
    process.exit(2);
  }
  return s;
}

/** Comprueba que la app esté levantada antes de perder tiempo. */
export async function exigirAppViva() {
  try {
    const r = await fetch(`${BASE_URL}/api/health-db`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) return;
    console.error(`La app respondió ${r.status} en ${BASE_URL}. ¿Arrancó bien?`);
  } catch {
    console.error(`No hay nada escuchando en ${BASE_URL}. Mira pruebas/README.md.`);
  }
  process.exit(2);
}

/**
 * Una cookie de sesión válida, firmada con el mismo AUTH_SECRET con el que
 * corre la app. Evita tener que crear contraseñas reales y pasar por el
 * formulario de login en cada prueba — lo que se quiere probar está
 * después del login, no el login.
 */
export async function cookieDeSesion({ email, usuarioId, organizacionId, rol, nombre }) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error("Falta AUTH_SECRET (el mismo con el que arrancaste la app).");
    process.exit(2);
  }
  const { encode } = await import("@auth/core/jwt");
  return encode({
    secret,
    salt: "authjs.session-token",
    token: { sub: usuarioId, email, organizacionId, rol, name: nombre },
  });
}

/**
 * Playwright NO está en package.json a propósito: instalarlo arrastra la
 * descarga de un navegador entero, y eso no tiene por qué pasar en cada
 * despliegue de producción. Solo hace falta para las pruebas que manejan
 * la pantalla; las de API corren sin él.
 */
function playwright() {
  try {
    return requerir("playwright");
  } catch {
    console.error(
      "\nEsta prueba maneja el navegador y Playwright no está instalado.\n" +
        "  npm install --no-save playwright && npx playwright install chromium\n" +
        "Las pruebas de API (reserva.test.mjs) corren sin esto.\n",
    );
    process.exit(2);
  }
}

/** Un navegador con sesión iniciada, en hora de Venezuela. */
export async function navegadorConSesion(usuario) {
  const { chromium } = playwright();
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({
    timezoneId: "America/Caracas",
    locale: "es-VE",
  });
  await contexto.addCookies([
    {
      name: "authjs.session-token",
      value: await cookieDeSesion(usuario),
      domain: new URL(BASE_URL).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return { navegador, pagina: await contexto.newPage() };
}

/**
 * Una Server Action de Next navega del lado del cliente, así que
 * `networkidle` puede resolver ANTES de que React reemplace el DOM y la
 * prueba lee la página vieja. Se espera el texto que se está buscando.
 */
export async function esperarTexto(pagina, texto, ms = 10000) {
  try {
    await pagina.getByText(texto, { exact: false }).first().waitFor({ timeout: ms });
  } catch {
    // Que no aparezca es un resultado válido: lo decide la aserción.
  }
  return (await pagina.locator("main").innerText()).replace(/\s+/g, " ").trim();
}

/**
 * Espera a que la BASE llegue a un estado, no a que la pantalla diga algo.
 *
 * Más fiable que esperar un texto: un formulario puede escribir en la base
 * y recién después re-renderizar, y hay palabras ("pago") que ya estaban en
 * la pantalla antes de apretar el botón, así que esperarlas no espera nada.
 */
export async function esperarEnBase(sql, esperado, ms = 10000) {
  const hasta = Date.now() + ms;
  let ultimo;
  do {
    ultimo = await valor(sql);
    if (String(ultimo) === String(esperado)) return ultimo;
    await new Promise((r) => setTimeout(r, 250));
  } while (Date.now() < hasta);
  return ultimo;
}

// ── Aserciones e informe ────────────────────────────────────────────

const resultados = [];

/**
 * @param nombre  qué se está comprobando, en una línea
 * @param pasa    la condición
 * @param detalle qué se vio en realidad — solo se imprime si falla
 */
export function comprobar(nombre, pasa, detalle = "") {
  resultados.push({ nombre, pasa, detalle: String(detalle).slice(0, 300) });
}

export function informar(titulo) {
  const fallas = resultados.filter((r) => !r.pasa);
  console.log(`\n${titulo}`);
  for (const r of resultados) {
    console.log(`  ${r.pasa ? "✓" : "✗"} ${r.nombre}${r.pasa ? "" : `\n      visto: ${r.detalle}`}`);
  }
  console.log(`  ${resultados.length - fallas.length}/${resultados.length} OK`);
  return fallas.length;
}

/** Envuelve una prueba: cierra la base pase lo que pase y sale con el código correcto. */
export async function correr(titulo, cuerpo) {
  let fallas = 1;
  try {
    await cuerpo();
    fallas = informar(titulo);
  } catch (err) {
    console.error(`\n${titulo}\n  ✗ La prueba se rompió: ${err.message}`);
  } finally {
    await cerrarBase();
  }
  process.exit(fallas ? 1 : 0);
}

