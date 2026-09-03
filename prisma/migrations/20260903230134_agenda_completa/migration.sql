-- CreateEnum
CREATE TYPE "ModalidadCita" AS ENUM ('PRESENCIAL', 'VIDEOCONSULTA', 'DOMICILIO');

-- AlterTable
ALTER TABLE "citas"
  ADD COLUMN "duracionMinutos" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "modalidad" "ModalidadCita" NOT NULL DEFAULT 'PRESENCIAL',
  ADD COLUMN "notas" TEXT;
