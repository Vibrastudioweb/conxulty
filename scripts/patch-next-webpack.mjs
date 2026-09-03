import { writeFileSync, chmodSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const binPath = join(__dirname, "..", "node_modules", ".bin", "next");

const wrapper = `#!/usr/bin/env node
"use strict";
const args = process.argv.slice(2);
if (args[0] === "dev" && !args.includes("--webpack") && !args.includes("--turbo") && !args.includes("--turbopack")) {
  args.push("--webpack");
}
const { spawn } = require("child_process");
const path = require("path");
const realNext = path.join(__dirname, "..", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [realNext, ...args], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
`;

writeFileSync(binPath, wrapper);
chmodSync(binPath, 0o755);
