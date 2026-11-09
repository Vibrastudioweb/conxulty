-- Task #15/#16 (changelog punto 91/97/98): reserva de citas real desde la
-- ficha pública y token de reseña gated por cita.

-- CreateEnum
CREATE TYPE "CitaOrigen" AS ENUM ('OS', 'DIRECTORIO');

-- AlterTable
ALTER TABLE "citas"
  ADD COLUMN "origen" "CitaOrigen" NOT NULL DEFAULT 'OS',
  ADD COLUMN "tokenResena" TEXT,
  ADD COLUMN "tokenResenaUsado" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "citas_tokenResena_key" ON "citas"("tokenResena");
