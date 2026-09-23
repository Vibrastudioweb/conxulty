/*
# CONXULTY - Initial Schema (Fase 0)

## Descripción
Crea el esquema completo de la plataforma de gestión médica CONXULTY:
- Organizaciones (tenant raíz: consultorio o clínica)
- Usuarios (cuentas con roles: MEDICO, ADMIN, STAFF)
- Médicos (perfil profesional)
- Pacientes
- Citas (agenda)
- Consultas (núcleo operativo)
- Cobros
- Cajas y Movimientos de Caja
- Trazabilidad

## Tablas nuevas
- organizaciones: tenant raíz del sistema
- usuarios: cuentas de acceso con rol
- medicos: perfil profesional del médico
- pacientes: datos del paciente
- citas: citas de agenda
- consultas: consulta médica vinculada a cita
- cobros: obligaciones/pagos asociados a consulta
- cajas: control de caja
- movimientos_caja: movimientos de dinero en caja
- registros_trazabilidad: trazabilidad funcional

## Enumeraciones
- RolUsuario: MEDICO, ADMIN, STAFF
- EstadoCita: PENDIENTE, CONFIRMADA, ATENDIDA, CANCELADA, NO_ASISTIO
- EstadoConsulta: EN_CURSO, CERRADA, ANULADA
- EstadoCobro: PENDIENTE, PAGADO, PARCIAL, ANULADO
- EstadoCaja: ABIERTA, CERRADA
- TipoMovimientoCaja: INGRESO, EGRESO
- OrigenMovimientoCaja: COBRO, INGRESO_MANUAL, EGRESO, DEVOLUCION, RETIRO, AJUSTE

## Seguridad
- Este esquema usa Prisma ORM para acceso a datos desde el servidor Next.js.
- La autenticación se maneja con NextAuth (JWT), no con Supabase Auth.
- RLS no se aplica aquí porque el acceso a la base de datos se realiza
  exclusivamente desde el servidor Next.js usando Prisma con conexión directa,
  no desde el navegador del cliente.

## Notas
- Esquema generado por Prisma migrate desde prisma/schema.prisma.
- Los nombres de tablas usan snake_case mediante @@map.
- Las columnas usan camelCase (convención de Prisma).
- Se incluyen índices para optimizar consultas frecuentes.
*/

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('MEDICO', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'ATENDIDA', 'CANCELADA', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "EstadoConsulta" AS ENUM ('EN_CURSO', 'CERRADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoCobro" AS ENUM ('PENDIENTE', 'PAGADO', 'PARCIAL', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "OrigenMovimientoCaja" AS ENUM ('COBRO', 'INGRESO_MANUAL', 'EGRESO', 'DEVOLUCION', 'RETIRO', 'AJUSTE');

-- CreateTable
CREATE TABLE IF NOT EXISTS "organizaciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "usuarios" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'MEDICO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "medicos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "especialidad" TEXT,
    "numeroColegiado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pacientes" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "sexo" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "citas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "consultas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "citaId" TEXT,
    "motivoConsulta" TEXT,
    "anamnesis" TEXT,
    "antecedentes" TEXT,
    "examenFisico" TEXT,
    "evaluacion" TEXT,
    "diagnostico" TEXT,
    "tratamiento" TEXT,
    "estado" "EstadoConsulta" NOT NULL DEFAULT 'EN_CURSO',
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cobros" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "consultaId" TEXT,
    "pacienteId" TEXT NOT NULL,
    "medicoId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "metodoPago" TEXT,
    "estado" "EstadoCobro" NOT NULL DEFAULT 'PENDIENTE',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cajas" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "abiertaPorId" TEXT NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "montoInicial" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montoFinal" DECIMAL(10,2),
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cajas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "movimientos_caja" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "cobroId" TEXT,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "origen" "OrigenMovimientoCaja" NOT NULL DEFAULT 'INGRESO_MANUAL',
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "descripcion" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "registros_trazabilidad" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "pacienteId" TEXT,
    "cambios" JSONB,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_trazabilidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "usuarios_organizacionId_idx" ON "usuarios"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "medicos_usuarioId_key" ON "medicos"("usuarioId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "medicos_organizacionId_idx" ON "medicos"("organizacionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pacientes_organizacionId_idx" ON "pacientes"("organizacionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "citas_organizacionId_fechaHora_idx" ON "citas"("organizacionId", "fechaHora");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "consultas_citaId_key" ON "consultas"("citaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "consultas_organizacionId_pacienteId_idx" ON "consultas"("organizacionId", "pacienteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cobros_organizacionId_consultaId_idx" ON "cobros"("organizacionId", "consultaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cajas_organizacionId_estado_idx" ON "cajas"("organizacionId", "estado");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "movimientos_caja_organizacionId_idx" ON "movimientos_caja"("organizacionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "movimientos_caja_cajaId_idx" ON "movimientos_caja"("cajaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "registros_trazabilidad_organizacionId_entidadTipo_entidadId_idx" ON "registros_trazabilidad"("organizacionId", "entidadTipo", "entidadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "registros_trazabilidad_organizacionId_pacienteId_idx" ON "registros_trazabilidad"("organizacionId", "pacienteId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicos" ADD CONSTRAINT "medicos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicos" ADD CONSTRAINT "medicos_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citas" ADD CONSTRAINT "citas_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "citas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_consultaId_fkey" FOREIGN KEY ("consultaId") REFERENCES "consultas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_medicoId_fkey" FOREIGN KEY ("medicoId") REFERENCES "medicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cajas" ADD CONSTRAINT "cajas_abiertaPorId_fkey" FOREIGN KEY ("abiertaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_cobroId_fkey" FOREIGN KEY ("cobroId") REFERENCES "cobros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_trazabilidad" ADD CONSTRAINT "registros_trazabilidad_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_trazabilidad" ADD CONSTRAINT "registros_trazabilidad_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;