/*
  Warnings:

  - You are about to drop the column `montoFinal` on the `cajas` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CategoriaGasto" AS ENUM ('ALQUILER', 'INSUMOS', 'PERSONAL', 'SERVICIOS', 'OTRO');

-- AlterEnum
ALTER TYPE "OrigenMovimientoCaja" ADD VALUE 'GASTO';

-- AlterTable
ALTER TABLE "cajas" DROP COLUMN "montoFinal",
ADD COLUMN     "diferencia" DECIMAL(10,2),
ADD COLUMN     "montoContado" DECIMAL(10,2),
ADD COLUMN     "montoEsperado" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "movimientos_caja" ADD COLUMN     "gastoId" TEXT;

-- CreateTable
CREATE TABLE "gastos" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "categoria" "CategoriaGasto" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "nota" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gastos_organizacionId_cajaId_idx" ON "gastos"("organizacionId", "cajaId");

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_gastoId_fkey" FOREIGN KEY ("gastoId") REFERENCES "gastos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
