-- 13-nov-2026 (auditoría previa al lanzamiento): esta migración usaba
-- "PlanOrganizacion" sin haberlo creado nunca —el enum y la columna
-- `organizaciones.plan` se habían aplicado a mano en Supabase, sin archivo
-- de migración— así que la cadena de migraciones se ROMPÍA acá sobre una
-- base vacía: `type "PlanOrganizacion" does not exist`. Es decir, el repo
-- no podía reconstruir su propia base, ni para pruebas ni tras un
-- incidente. Se agrega lo que faltaba, en forma idempotente para que no
-- choque donde ya existe (producción).
--
-- Se edita esta migración en vez de agregar una al final porque la falla
-- ocurre a mitad de la cadena: nada que venga después llega a correr. No
-- rompe nada en producción: el despliegue no corre `prisma migrate deploy`
-- (ver package.json — las migraciones se aplican a mano en Supabase).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanOrganizacion') THEN
    CREATE TYPE "PlanOrganizacion" AS ENUM ('FICHA', 'PRO');
  END IF;
END $$;

ALTER TABLE "organizaciones"
  ADD COLUMN IF NOT EXISTS "plan" "PlanOrganizacion" NOT NULL DEFAULT 'FICHA';

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProveedorPago') THEN
    CREATE TYPE "ProveedorPago" AS ENUM ('SPIDI');
  END IF;
END $$;

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
