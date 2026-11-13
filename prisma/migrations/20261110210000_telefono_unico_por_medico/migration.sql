-- 10-nov-2026, pedido del usuario: "el unico telefono que se debe pedir y
-- existir el el whatsapp de el medico no uno para cada sede" — antes
-- `sedes.telefono` se pedía por sede en "Mi ficha pública"; ahora es un
-- único WhatsApp por médico (`medicos.telefonoPublico`), que se manda
-- igual (repetido en cada sede) al Directorio para no tocar su esquema.

-- AlterTable
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "telefonoPublico" TEXT;

-- Migra el dato existente antes de borrar la columna: toma el primer
-- teléfono no nulo que tenga alguna sede del médico (createdAt más
-- antigua primero, mismo criterio que ya usa el resto del código para
-- "la sede principal").
UPDATE "medicos" AS m
SET "telefonoPublico" = sub.telefono
FROM (
  SELECT DISTINCT ON ("medicoId") "medicoId", "telefono"
  FROM "sedes"
  WHERE "telefono" IS NOT NULL
  ORDER BY "medicoId", "createdAt" ASC
) AS sub
WHERE sub."medicoId" = m."id";

-- AlterTable
-- IF EXISTS: en producción esta columna ya se borró a mano.
ALTER TABLE "sedes" DROP COLUMN IF EXISTS "telefono";
