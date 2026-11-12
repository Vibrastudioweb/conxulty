-- 12-nov-2026 — auditoría pre-lanzamiento, hallazgos C1 y A3.
--
-- 1) C1: `tokens_recuperacion` nació sin RLS (prisma/seguridad-rls.sql se
--    corrió a mano ANTES de que existiera esta tabla). Ya se cerró a mano
--    en producción el 12-nov; queda acá para que cualquier base nueva
--    también nazca cerrada. Idempotente.
ALTER TABLE "tokens_recuperacion" ENABLE ROW LEVEL SECURITY;

-- 2) A3: freno contra fuerza bruta en el login.
CREATE TABLE IF NOT EXISTS "intentos_acceso" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentos_acceso_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "intentos_acceso_clave_createdAt_idx" ON "intentos_acceso"("clave", "createdAt");

-- Regla del proyecto desde hoy: toda tabla nueva se cierra en la MISMA
-- migración que la crea (sin políticas: la app entra como dueño de la
-- tabla; esto solo cierra la API REST pública de Supabase).
ALTER TABLE "intentos_acceso" ENABLE ROW LEVEL SECURITY;

-- 3) El resto de las tablas ya estaba cerrado en producción, pero solo por
--    haber corrido prisma/seguridad-rls.sql a mano. Se repite acá
--    (idempotente: en producción no cambia nada) para que una base nueva
--    — pruebas, staging, restauración de respaldo — nazca cerrada sin
--    depender de acordarse de ese script. scripts/verificar-rls.mjs hace
--    fallar el build si una tabla del schema no aparece en ninguna
--    migración con ENABLE ROW LEVEL SECURITY.
ALTER TABLE "antecedentes_medicos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cajas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "citas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cobros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consultas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gastos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medicos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movimientos_caja" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pacientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pagos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registros_trazabilidad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sedes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "solicitudes_acceso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suscripciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
