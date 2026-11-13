-- Anular en vez de borrar, e historia del odontograma (13-nov-2026,
-- auditoría del núcleo clínico).
--
-- 1) ANULAR UNA RECETA. `documentos` era inmutable —solo emitir, listar y
--    obtener— lo cual está bien, pero no había forma de invalidar una
--    receta equivocada: seguía imprimible y con cara de válida, y la
--    historia quedaba con dos recetas contradictorias sin señal de cuál
--    vale. No se borra nunca: se marca. Una receta que desaparece deja la
--    historia clínica mintiendo; una marcada como anulada la deja
--    diciendo la verdad.
--
-- 2) HISTORIA DEL ODONTOGRAMA. Para un odontólogo el valor clínico está en
--    la evolución del diente —cómo estaba antes del tratamiento y cómo
--    quedó—, y cada guardado pisaba al anterior. `pacientes.odontograma`
--    sigue siendo la foto actual; acá queda el historial, una fila por
--    guardado.
--
-- (La anulación de una CONSULTA no necesita migración: el estado ANULADA
--  ya existía en el enum `EstadoConsulta` y la interfaz ya sabía pintarlo
--  — lo que faltaba era que algo lo produjera.)
--
-- Idempotente, como el resto: estas bases se mantienen a mano en Supabase.

ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "anuladoEn" TIMESTAMP(3);
ALTER TABLE "documentos" ADD COLUMN IF NOT EXISTS "motivoAnulacion" TEXT;

CREATE TABLE IF NOT EXISTS "odontogramas" (
  "id" TEXT NOT NULL,
  "organizacionId" TEXT NOT NULL,
  "pacienteId" TEXT NOT NULL,
  "medicoId" TEXT,
  "estado" JSONB NOT NULL,
  "notas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "odontogramas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "odontogramas_organizacionId_pacienteId_createdAt_idx"
  ON "odontogramas"("organizacionId", "pacienteId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'odontogramas_organizacionId_fkey') THEN
    ALTER TABLE "odontogramas" ADD CONSTRAINT "odontogramas_organizacionId_fkey"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'odontogramas_pacienteId_fkey') THEN
    ALTER TABLE "odontogramas" ADD CONSTRAINT "odontogramas_pacienteId_fkey"
      FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Lo que vive en `public` queda expuesto por la API REST de Supabase salvo
-- que tenga RLS (hallazgo C1 de la auditoría).
ALTER TABLE "odontogramas" ENABLE ROW LEVEL SECURITY;

-- El odontograma que ya tiene cada paciente pasa a ser su primera versión,
-- para que el historial no empiece vacío y parezca que nunca hubo nada.
INSERT INTO "odontogramas" ("id", "organizacionId", "pacienteId", "estado", "notas", "createdAt")
SELECT
  'odo_' || replace(gen_random_uuid()::text, '-', ''),
  p."organizacionId", p."id", p."odontograma", p."notasOdontograma", p."updatedAt"
FROM "pacientes" p
WHERE p."odontograma" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "odontogramas" o WHERE o."pacienteId" = p."id");
