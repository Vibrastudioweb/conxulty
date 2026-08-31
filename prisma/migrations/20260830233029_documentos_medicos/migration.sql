-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('RECETA');

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "consultaId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "contenido" JSONB NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_organizacionId_consultaId_idx" ON "documentos"("organizacionId", "consultaId");

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_consultaId_fkey" FOREIGN KEY ("consultaId") REFERENCES "consultas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
