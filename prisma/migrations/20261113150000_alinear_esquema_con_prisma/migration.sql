-- Alinea las migraciones con schema.prisma (13-nov-2026, hallazgo de la
-- auditoría previa al lanzamiento).
--
-- EL PROBLEMA: las migraciones de este repo NO reconstruían la base desde
-- cero. Varios cambios se aplicaron a mano en Supabase y nunca llegaron a
-- un archivo de migración, así que `prisma migrate deploy` sobre una base
-- vacía ni siquiera terminaba de correr: faltaba el enum `MetodoPago` y 23
-- columnas repartidas en consultas, cobros, cajas, movimientos_caja y
-- gastos. (La tabla `sedes` y el enum `PlanOrganizacion`, que rompían la
-- cadena a mitad de camino, se arreglaron en sus propias migraciones —
-- 20261110200000_sedes y 20261109120000_suscripcion_plan_pro.) Consecuencia práctica: no se podía levantar
-- un ambiente de pruebas ni reconstruir la base desde el repo tras un
-- incidente — probarlo en local exigía un script aparte que tapara los
-- huecos a mano.
--
-- POR QUÉ ES IDEMPOTENTE: producción ya tiene todo esto. Este archivo
-- tiene que ser un no-op allá y, a la vez, suficiente sobre una base
-- vacía. De ahí el IF NOT EXISTS en todo y los bloques DO para las claves
-- foráneas, que no admiten esa forma. Mismo criterio que las migraciones
-- de enum de esta semana.
--
-- Verificado aplicando TODAS las migraciones sobre una base vacía y
-- comparando el resultado contra schema.prisma (scripts/comparar-esquema.mjs).

-- ── Enums que faltaban ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MetodoPago') THEN
    CREATE TYPE "MetodoPago" AS ENUM (
      'EFECTIVO_USD', 'EFECTIVO_BS', 'PAGO_MOVIL', 'TRANSFERENCIA', 'TARJETA', 'ZELLE'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Profesion') THEN
    CREATE TYPE "Profesion" AS ENUM (
      'MEDICO', 'ODONTOLOGO', 'PSICOLOGO', 'NUTRICIONISTA', 'FISIOTERAPEUTA', 'ENFERMERO',
      'TERAPEUTA_LENGUAJE', 'TERAPEUTA_OCUPACIONAL', 'PSICOPEDAGOGO', 'PODOLOGO',
      'OPTOMETRISTA', 'OTRA'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ModalidadAtencion') THEN
    CREATE TYPE "ModalidadAtencion" AS ENUM ('PRESENCIAL', 'DOMICILIO', 'ONLINE');
  END IF;
END $$;

-- ── Enlace de la organización con su ficha del Directorio ───────────
ALTER TABLE "organizaciones" ADD COLUMN IF NOT EXISTS "fichaDirectorioId" TEXT;
ALTER TABLE "organizaciones" ADD COLUMN IF NOT EXISTS "fichaDirectorioSlug" TEXT;
ALTER TABLE "organizaciones" ADD COLUMN IF NOT EXISTS "fichaDirectorioSincronizada" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "organizaciones_fichaDirectorioId_key" ON "organizaciones"("fichaDirectorioId");

-- ── Profesión, credenciales y modalidades del profesional ───────────
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "profesion" "Profesion" NOT NULL DEFAULT 'MEDICO';
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "profesionOtraTexto" TEXT;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "cedula" TEXT;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "numeroMpps" TEXT;
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "especialidadesSecundarias" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "modalidades" "ModalidadAtencion"[] DEFAULT ARRAY[]::"ModalidadAtencion"[];
ALTER TABLE "medicos" ADD COLUMN IF NOT EXISTS "zonasCobertura" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ── Odontograma del paciente ────────────────────────────────────────
ALTER TABLE "pacientes" ADD COLUMN IF NOT EXISTS "odontograma" JSONB;
ALTER TABLE "pacientes" ADD COLUMN IF NOT EXISTS "notasOdontograma" TEXT;

-- ── Comprobante del pago (antes iba por WhatsApp, aparte) ───────────
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "comprobante" BYTEA;
ALTER TABLE "pagos" ADD COLUMN IF NOT EXISTS "comprobanteTipo" TEXT;

-- ── Signos vitales y campos por especialidad de la consulta ─────────
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "presionArterial" TEXT;
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "frecuenciaCardiaca" INTEGER;
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "temperatura" DECIMAL(4,1);
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "saturacionOxigeno" INTEGER;
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "pesoKg" DECIMAL(5,2);
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "tallaCm" DECIMAL(5,1);
ALTER TABLE "consultas" ADD COLUMN IF NOT EXISTS "camposEspecialidad" JSONB;

-- ── Cobros: folio, descuento y si entra en efectivo ─────────────────
ALTER TABLE "cobros" ADD COLUMN IF NOT EXISTS "numero" SERIAL;
ALTER TABLE "cobros" ADD COLUMN IF NOT EXISTS "descuentoMonto" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "cobros" ADD COLUMN IF NOT EXISTS "descuentoMotivo" TEXT;
ALTER TABLE "cobros" ADD COLUMN IF NOT EXISTS "esEfectivo" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS "cobros_numero_key" ON "cobros"("numero");

-- ── Caja: apertura, conteo de cierre y diferencia, en las dos monedas ─
ALTER TABLE "cajas" ADD COLUMN IF NOT EXISTS "montoInicialUsd" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "cajas" ADD COLUMN IF NOT EXISTS "montoInicialBs" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "cajas" ADD COLUMN IF NOT EXISTS "montoContadoUsd" DECIMAL(10,2);
ALTER TABLE "cajas" ADD COLUMN IF NOT EXISTS "montoContadoBs" DECIMAL(10,2);
ALTER TABLE "cajas" ADD COLUMN IF NOT EXISTS "montoEsperadoUsd" DECIMAL(10,2);
ALTER TABLE "cajas" ADD COLUMN IF NOT EXISTS "montoEsperadoBs" DECIMAL(10,2);
ALTER TABLE "cajas" ADD COLUMN IF NOT EXISTS "diferenciaUsd" DECIMAL(10,2);
ALTER TABLE "cajas" ADD COLUMN IF NOT EXISTS "diferenciaBs" DECIMAL(10,2);

-- ── Método de pago en movimientos y gastos ──────────────────────────
ALTER TABLE "movimientos_caja" ADD COLUMN IF NOT EXISTS "esEfectivo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "movimientos_caja" ADD COLUMN IF NOT EXISTS "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO_USD';
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "esEfectivo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "gastos" ADD COLUMN IF NOT EXISTS "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO_USD';

-- ── Suscripción (una por organización) ──────────────────────────────
CREATE TABLE IF NOT EXISTS "suscripciones" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "suscripciones_organizacionId_key" ON "suscripciones"("organizacionId");

-- ── Pagos reportados y confirmados a mano ───────────────────────────
CREATE TABLE IF NOT EXISTS "pagos" (
  "id" TEXT NOT NULL,
  "organizacionId" TEXT NOT NULL,
  "suscripcionId" TEXT NOT NULL,
  "plan" "PlanOrganizacion" NOT NULL,
  "montoCentavos" INTEGER NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'USD',
  "estado" "EstadoPago" NOT NULL,
  "spidiPagoId" TEXT,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comprobante" BYTEA,
  "comprobanteTipo" TEXT,
  CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pagos_spidiPagoId_key" ON "pagos"("spidiPagoId");
CREATE INDEX IF NOT EXISTS "pagos_organizacionId_fecha_idx" ON "pagos"("organizacionId", "fecha");

-- ── Claves foráneas ─────────────────────────────────────────────────
-- ADD CONSTRAINT no admite IF NOT EXISTS, así que se pregunta primero.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suscripciones_organizacionId_fkey') THEN
    ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_organizacionId_fkey"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_organizacionId_fkey') THEN
    ALTER TABLE "pagos" ADD CONSTRAINT "pagos_organizacionId_fkey"
      FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_suscripcionId_fkey') THEN
    ALTER TABLE "pagos" ADD CONSTRAINT "pagos_suscripcionId_fkey"
      FOREIGN KEY ("suscripcionId") REFERENCES "suscripciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── RLS para las tablas nuevas ──────────────────────────────────────
-- Todo lo que vive en `public` queda expuesto por la API REST de Supabase
-- salvo que tenga RLS (hallazgo C1 de la auditoría). Sin políticas: al OS
-- le llega por conexión directa, no por PostgREST.
ALTER TABLE "sedes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suscripciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pagos" ENABLE ROW LEVEL SECURITY;
