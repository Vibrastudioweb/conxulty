-- CreateEnum
CREATE TYPE "TipoEntidad" AS ENUM ('CLINICA', 'FARMACIA');

-- CreateTable
CREATE TABLE "entidades" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "tipo" "TipoEntidad" NOT NULL,
    "municipio" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "horario" JSONB NOT NULL DEFAULT '[]',
    "horarioTurno" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entidades_usuarioId_key" ON "entidades"("usuarioId");

-- CreateIndex
CREATE INDEX "entidades_organizacionId_idx" ON "entidades"("organizacionId");

-- AddForeignKey
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
