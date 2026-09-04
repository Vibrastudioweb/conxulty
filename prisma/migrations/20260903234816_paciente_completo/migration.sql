-- CreateEnum
CREATE TYPE "TipoAntecedente" AS ENUM ('ALERGIA', 'ENFERMEDAD_CRONICA', 'CIRUGIA', 'MEDICAMENTO_HABITUAL', 'HABITO', 'ANTECEDENTE_FAMILIAR', 'ANTECEDENTE_PERSONAL', 'OBSERVACION');

-- AlterTable
ALTER TABLE "pacientes"
  ADD COLUMN "documentoIdentidad" TEXT,
  ADD COLUMN "direccion" TEXT,
  ADD COLUMN "contactoEmergenciaNombre" TEXT,
  ADD COLUMN "contactoEmergenciaTelefono" TEXT,
  ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "antecedentes_medicos" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "tipo" "TipoAntecedente" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "antecedentes_medicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_organizacionId_documentoIdentidad_key" ON "pacientes"("organizacionId", "documentoIdentidad");

-- CreateIndex
CREATE INDEX "pacientes_organizacionId_activo_idx" ON "pacientes"("organizacionId", "activo");

-- CreateIndex
CREATE INDEX "antecedentes_medicos_organizacionId_pacienteId_idx" ON "antecedentes_medicos"("organizacionId", "pacienteId");

-- AddForeignKey
ALTER TABLE "antecedentes_medicos" ADD CONSTRAINT "antecedentes_medicos_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "antecedentes_medicos" ADD CONSTRAINT "antecedentes_medicos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "antecedentes_medicos" ADD CONSTRAINT "antecedentes_medicos_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
