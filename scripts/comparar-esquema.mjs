#!/usr/bin/env node
/**
 * Compara una base de datos real contra schema.prisma y lista lo que falta.
 *
 * Por qué existe (13-nov-2026, hallazgo de la auditoría previa al
 * lanzamiento): varios cambios de esquema se aplicaron a mano en Supabase y
 * nunca llegaron a un archivo de migración, así que `prisma migrate deploy`
 * sobre una base vacía producía un esquema distinto al que describe
 * schema.prisma — faltaban tres tablas, un enum y 23 columnas. Eso se
 * descubrió de casualidad, al intentar levantar una base de prueba. Este
 * script lo vuelve una comprobación de un comando.
 *
 * Uso:
 *   DATABASE_URL=postgres://... node scripts/comparar-esquema.mjs
 *
 * Lo normal es correrlo sobre una base VACÍA a la que se le aplicaron todas
 * las migraciones: así prueba que el repo, solo, reconstruye el esquema.
 * Sale con código 1 si falta algo, para poder encadenarlo en CI.
 *
 * Qué compara: existencia de enums, de sus valores, de tablas y de
 * columnas. No compara tipos ni restricciones — eso lo cubre Prisma al
 * generar una migración; acá interesa la clase de deriva que ya ocurrió.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(join(RAIZ, "prisma", "schema.prisma"), "utf8");

const TIPOS_ESCALARES = new Set([
  "String", "Int", "Boolean", "DateTime", "Decimal", "Float", "Json", "Bytes", "BigInt",
]);

function bloques(palabra) {
  const encontrados = new Map();
  const re = new RegExp(`^${palabra}\\s+(\\w+)\\s*\\{([\\s\\S]*?)^\\}`, "gm");
  let m;
  while ((m = re.exec(schema)) !== null) encontrados.set(m[1], m[2]);
  return encontrados;
}

const enums = new Map(
  [...bloques("enum")].map(([nombre, cuerpo]) => [
    nombre,
    cuerpo
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@") && !l.startsWith("///"))
      .map((l) => l.split(/\s+/)[0]),
  ]),
);

/** Modelos → { tabla, columnas[] }. Solo campos escalares o enum: las
 *  relaciones de Prisma no son columnas (la columna es su `fields:`, que ya
 *  está declarada aparte como escalar). */
const modelos = [...bloques("model")].map(([nombre, cuerpo]) => {
  const mapa = cuerpo.match(/@@map\("([^"]+)"\)/);
  const columnas = [];
  for (const linea of cuerpo.split("\n")) {
    const t = linea.trim();
    if (!t || t.startsWith("//") || t.startsWith("@@") || t.startsWith("///")) continue;
    const campo = t.match(/^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/);
    if (!campo) continue;
    const [, nombreCampo, tipo, , , resto] = campo;
    if (!TIPOS_ESCALARES.has(tipo) && !enums.has(tipo)) continue;
    const alias = resto.match(/@map\("([^"]+)"\)/);
    columnas.push(alias ? alias[1] : nombreCampo);
  }
  return { modelo: nombre, tabla: mapa ? mapa[1] : nombre, columnas };
});

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL.");
  process.exit(2);
}

const adapter = new PrismaPg({ connectionString: url, ssl: false });
const conexion = await adapter.connect();

async function filas(sql) {
  const r = await conexion.queryRaw({ sql, args: [], argTypes: [] });
  const idx = Object.fromEntries(r.columnNames.map((c, i) => [c, i]));
  return r.rows.map((fila) => Object.fromEntries(Object.entries(idx).map(([c, i]) => [c, fila[i]])));
}

const faltantes = [];

// ── Enums ──
const enumsEnBase = new Map();
for (const f of await filas(
  `select t.typname as nombre, e.enumlabel as valor
     from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typtype = 'e'`,
)) {
  if (!enumsEnBase.has(f.nombre)) enumsEnBase.set(f.nombre, new Set());
  enumsEnBase.get(f.nombre).add(f.valor);
}

for (const [nombre, valores] of enums) {
  const enBase = enumsEnBase.get(nombre);
  if (!enBase) {
    faltantes.push(`enum ${nombre} (completo)`);
    continue;
  }
  for (const v of valores) {
    if (!enBase.has(v)) faltantes.push(`enum ${nombre} → valor ${v}`);
  }
}

// ── Tablas y columnas ──
const tablasEnBase = new Set(
  (await filas(`select tablename as nombre from pg_tables where schemaname = 'public'`)).map(
    (f) => f.nombre,
  ),
);
const columnasEnBase = new Map();
for (const f of await filas(
  `select table_name as tabla, column_name as columna
     from information_schema.columns where table_schema = 'public'`,
)) {
  if (!columnasEnBase.has(f.tabla)) columnasEnBase.set(f.tabla, new Set());
  columnasEnBase.get(f.tabla).add(f.columna);
}

for (const { modelo, tabla, columnas } of modelos) {
  if (!tablasEnBase.has(tabla)) {
    faltantes.push(`tabla ${tabla} (modelo ${modelo}, completa)`);
    continue;
  }
  const enBase = columnasEnBase.get(tabla) ?? new Set();
  for (const c of columnas) {
    if (!enBase.has(c)) faltantes.push(`${tabla}.${c} (modelo ${modelo})`);
  }
}

await conexion.dispose?.();

if (faltantes.length === 0) {
  console.log(
    `✓ La base tiene todo lo que describe schema.prisma (${modelos.length} tablas, ${enums.size} enums).`,
  );
  process.exit(0);
}

console.error(`✗ Faltan ${faltantes.length} cosas en la base:\n`);
for (const f of faltantes) console.error(`  - ${f}`);
console.error(
  "\nSi esto corre sobre una base vacía con todas las migraciones aplicadas,\n" +
    "significa que el repo NO reconstruye el esquema: falta escribir la migración.",
);
process.exit(1);
