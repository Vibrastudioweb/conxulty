/**
 * Corre todas las pruebas, una tras otra, y resume.
 *
 *   npm run pruebas
 *
 * Se corren en serie a propósito: todas escriben en la misma base y cada
 * una siembra sus datos al empezar. En paralelo se pisarían entre ellas.
 */

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const archivos = readdirSync(aqui).filter((f) => f.endsWith(".test.mjs")).sort();

let fallaron = 0;
for (const archivo of archivos) {
  try {
    execFileSync(process.execPath, [join(aqui, archivo)], { stdio: "inherit" });
  } catch {
    fallaron++;
  }
}

console.log(
  fallaron === 0
    ? `\n✓ ${archivos.length} archivos de prueba, todo en verde.`
    : `\n✗ ${fallaron} de ${archivos.length} archivos con fallas.`,
);
process.exit(fallaron ? 1 : 0);
