-- Sedes del médico (13-nov-2026, auditoría previa al lanzamiento).
--
-- La tabla existía en producción y en schema.prisma desde principios de
-- noviembre, pero nunca llegó a un archivo de migración: se creó a mano en
-- Supabase. La cadena de migraciones se rompía en
-- 20261110210000_telefono_unico_por_medico, que lee de "sedes" — por eso
-- esta migración va fechada justo antes de aquella, no al final.
--
-- Idempotente: en producción ya existe, acá tiene que ser un no-op.
CREATE TABLE IF NOT EXISTS "sedes" (
  "id" TEXT NOT NULL,
  "medicoId" TEXT NOT NULL,
  "organizacionId" TEXT NOT NULL,
  "municipio" TEXT NOT NULL,
  "direccion" TEXT NOT NULL,
  "referencia" TEXT,
  -- Se crea con la forma HISTÓRICA de la tabla: un teléfono por sede. La
  -- migración siguiente (20261110210000_telefono_unico_por_medico) migra
  -- ese dato a `medicos.telefonoPublico` y borra esta columna, así que
  -- sobre una base vacía tiene que existir para que esa pueda correr.
  "telefono" TEXT,
  "horario" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sedes_medicoId_idx" ON "sedes"("medicoId");
CREATE INDEX IF NOT EXISTS "sedes_organizacionId_idx" ON "sedes"("organizacionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sedes_medicoId_fkey') THEN
    ALTER TABLE "sedes" ADD CONSTRAINT "sedes_medicoId_fkey"
      FOREIGN KEY ("medicoId") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sedes_organizacionId_fkey') THEN
    ALTER TABLE "sedes" ADD CONSTRAINT "sedes_organizacionId_fkey"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
