-- Confirmación del correo al registrarse (13-nov-2026).
--
-- El riesgo que cierra no es el spam: es el caso aburrido y silencioso de
-- quien se registra con el correo mal escrito. Hoy entra igual, usa el
-- producto, y el día que olvida su contraseña descubre que no puede
-- recuperarla — pierde su cuenta y su ficha pública, y nadie se entera
-- hasta que llama.
--
-- Idempotente, como el resto: estas bases se mantienen a mano en Supabase.

ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "emailVerificado" TIMESTAMP(3);

-- A quien ya está adentro se le da por confirmado. Son cuentas que se
-- dieron de alta a mano, una por una, hablando con cada médico — pedirles
-- ahora que confirmen un correo que ya sabemos que funciona solo
-- conseguiría trancar a la única médica real del Directorio.
UPDATE "usuarios" SET "emailVerificado" = now() WHERE "emailVerificado" IS NULL;

CREATE TABLE IF NOT EXISTS "tokens_verificacion" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiraEn" TIMESTAMP(3) NOT NULL,
  "usado" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tokens_verificacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tokens_verificacion_token_key" ON "tokens_verificacion"("token");
CREATE INDEX IF NOT EXISTS "tokens_verificacion_usuarioId_idx" ON "tokens_verificacion"("usuarioId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokens_verificacion_usuarioId_fkey') THEN
    ALTER TABLE "tokens_verificacion" ADD CONSTRAINT "tokens_verificacion_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Todo lo que vive en `public` queda expuesto por la API REST de Supabase
-- salvo que tenga RLS (hallazgo C1 de la auditoría).
ALTER TABLE "tokens_verificacion" ENABLE ROW LEVEL SECURITY;
