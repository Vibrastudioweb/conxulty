import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "node:fs";
import path from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// El Transaction Pooler de Supabase (Supavisor) presenta una cadena de
// certificados firmada por la CA propia de Supabase, que no está en el
// almacén de CA por defecto de Node (causaba SELF_SIGNED_CERT_IN_CHAIN).
// Se valida explícitamente contra esa CA en vez de desactivar TLS.
const supabaseCa = fs.readFileSync(
  path.join(process.cwd(), "prisma", "certs", "supabase-ca.crt"),
  "utf8",
);

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: supabaseCa, rejectUnauthorized: true },
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
