-- Segunda revisión del núcleo clínico (13-nov-2026).
--
-- 1) Corregir un antecedente ya no pisa el texto: crea una versión nueva y
--    la anterior queda inactiva apuntando a ella.
-- 2) Notas aclaratorias: la única forma de corregir una consulta cerrada,
--    agregando sin tocar lo escrito.
-- 3) Cédulas en una sola forma (mayúsculas, sin puntos, espacios ni
--    guiones), para que "V-12.345.678" y "V12345678" no sean dos pacientes.
--
-- Idempotente, como el resto.

ALTER TABLE "antecedentes_medicos" ADD COLUMN IF NOT EXISTS "reemplazadoPorId" TEXT;

CREATE TABLE IF NOT EXISTS "notas_aclaratorias" (
  "id" TEXT NOT NULL,
  "organizacionId" TEXT NOT NULL,
  "consultaId" TEXT NOT NULL,
  "medicoId" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notas_aclaratorias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notas_aclaratorias_organizacionId_consultaId_createdAt_idx"
  ON "notas_aclaratorias"("organizacionId", "consultaId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notas_aclaratorias_organizacionId_fkey') THEN
    ALTER TABLE "notas_aclaratorias" ADD CONSTRAINT "notas_aclaratorias_organizacionId_fkey"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notas_aclaratorias_consultaId_fkey') THEN
    ALTER TABLE "notas_aclaratorias" ADD CONSTRAINT "notas_aclaratorias_consultaId_fkey"
      FOREIGN KEY ("consultaId") REFERENCES "consultas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "notas_aclaratorias" ENABLE ROW LEVEL SECURITY;

-- Cédulas que ya existen: se pasan a la forma única SOLO donde eso no
-- choca con otro paciente del mismo consultorio. Si dos pacientes ya son
-- la misma cédula escrita distinto, no se toca ninguno: fusionarlos es una
-- decisión clínica, no de una migración.
UPDATE "pacientes" p
SET "documentoIdentidad" = upper(regexp_replace(p."documentoIdentidad", '[\s.\-]', '', 'g'))
WHERE p."documentoIdentidad" IS NOT NULL
  AND p."documentoIdentidad" <> upper(regexp_replace(p."documentoIdentidad", '[\s.\-]', '', 'g'))
  AND upper(regexp_replace(p."documentoIdentidad", '[\s.\-]', '', 'g')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "pacientes" q
    WHERE q."organizacionId" = p."organizacionId"
      AND q."id" <> p."id"
      AND q."documentoIdentidad" IS NOT NULL
      AND upper(regexp_replace(q."documentoIdentidad", '[\s.\-]', '', 'g'))
        = upper(regexp_replace(p."documentoIdentidad", '[\s.\-]', '', 'g'))
  );
