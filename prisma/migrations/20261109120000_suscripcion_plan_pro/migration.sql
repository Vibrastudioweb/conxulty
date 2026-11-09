-- CreateEnum
CREATE TYPE "ProveedorPago" AS ENUM ('SPIDI');

-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('ACTIVA', 'PENDIENTE_PAGO', 'BAJANDO_A_FICHA', 'SIN_METODO_DE_PAGO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PAGADO', 'FALLIDO', 'PENDIENTE');

-- CreateTable
CREATE TABLE "suscripciones" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "proveedor" "ProveedorPago" NOT NULL DEFAULT 'SPIDI',
    "estado" "EstadoSuscripcion" NOT NULL DEFAULT 'SIN_METODO_DE_PAGO',
    "planAlRenovar" "PlanOrganizacion",
    "inicioPeriodoActual" TIMESTAMP(3),
    "finPeriodoActual" TIMESTAMP(3),
    "spidiClienteId" TEXT,
    "spidiSuscripcionId" TEXT,
    "metodoPagoResumen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "suscripcionId" TEXT NOT NULL,
    "plan" "PlanOrganizacion" NOT NULL,
    "montoCentavos" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "estado" "EstadoPago" NOT NULL,
    "spidiPagoId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_organizacionId_key" ON "suscripciones"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_spidiPagoId_key" ON "pagos"("spidiPagoId");

-- CreateIndex
CREATE INDEX "pagos_organizacionId_fecha_idx" ON "pagos"("organizacionId", "fecha");

-- AddForeignKey
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "suscripciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
