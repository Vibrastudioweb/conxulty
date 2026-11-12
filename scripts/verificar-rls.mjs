// Candado de build (12-nov-2026, auditoría pre-lanzamiento, hallazgo C1).
//
// Supabase expone todo el esquema `public` por su API REST: una tabla sin
// Row Level Security se puede leer con la clave pública del proyecto.
// `tokens_recuperacion` estuvo dos días así en producción porque el RLS se
// aplicaba con un script manual y la tabla se creó después.
//
// Este script hace fallar el build si alguna tabla de schema.prisma no
// tiene su `ENABLE ROW LEVEL SECURITY` en alguna migración. No habla con
// la base: solo lee archivos del repo.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(join(raiz, "prisma", "schema.prisma"), "utf8");
const tablas = [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]);

const dirMigraciones = join(raiz, "prisma", "migrations");
const conRls = new Set();
for (const carpeta of readdirSync(dirMigraciones)) {
  const archivo = join(dirMigraciones, carpeta, "migration.sql");
  if (!existsSync(archivo)) continue;
  const sql = readFileSync(archivo, "utf8");
  const patron = /ALTER\s+TABLE\s+(?:"?public"?\.)?"?([a-z_0-9]+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  for (const m of sql.matchAll(patron)) conRls.add(m[1]);
}

const faltantes = tablas.filter((t) => !conRls.has(t));
if (tablas.length === 0) {
  console.error("[verificar-rls] No se encontró ninguna tabla en schema.prisma — revisar el script.");
  process.exit(1);
}
if (faltantes.length > 0) {
  console.error(
    `[verificar-rls] Tablas sin ENABLE ROW LEVEL SECURITY en ninguna migración: ${faltantes.join(", ")}.\n` +
      `Agrega a la migración que crea cada una:\n` +
      faltantes.map((t) => `  ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`).join("\n"),
  );
  process.exit(1);
}
console.log(`[verificar-rls] OK — ${tablas.length} tablas, todas con RLS en migraciones.`);
