-- CreateEnum
CREATE TYPE "EstadoSolicitudAcceso" AS ENUM ('PENDIENTE', 'CONTACTADO', 'ACTIVADO', 'RECHAZADO');

-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'SUPERADMIN';

-- CreateTable
CREATE TABLE "solicitudes_acceso" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "especialidad" TEXT,
    "nombreConsultorio" TEXT NOT NULL,
    "estado" "EstadoSolicitudAcceso" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_acceso_estado_createdAt_idx" ON "solicitudes_acceso"("estado", "createdAt");

