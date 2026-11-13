-- Cortesía: cuenta que no vence y no se le cobra (decisión del founder,
-- 13-nov-2026). Idempotente, igual que la migración de 'PRUEBA' — estas
-- bases se crearon antes de que las migraciones pudieran reconstruirlas
-- desde cero, así que se corren a mano en Supabase.
ALTER TYPE "EstadoSuscripcion" ADD VALUE IF NOT EXISTS 'CORTESIA';
