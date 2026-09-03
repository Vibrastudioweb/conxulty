import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const realNext = join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");

if (!existsSync(realNext)) {
  process.exit(0);
}

const original = readFileSync(realNext, "utf8");

if (original.includes("patch-next-webpack")) {
  process.exit(0);
}

const marker = "program.parse(process.argv);";
const patch = `if (process.argv[2] === 'dev' && !process.argv.includes('--webpack') && !process.argv.includes('--turbo') && !process.argv.includes('--turbopack')) {\n    process.argv.push('--webpack');\n}\nprogram.parse(process.argv);`;

if (original.includes(marker)) {
  const patched = original.replace(marker, patch);
  writeFileSync(realNext, patched);
}
