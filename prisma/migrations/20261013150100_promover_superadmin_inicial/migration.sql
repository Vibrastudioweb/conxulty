-- Promueve al dueño de la plataforma a SUPERADMIN.
--
-- Va en una migración aparte a propósito: en PostgreSQL un valor nuevo de enum
-- (ALTER TYPE ... ADD VALUE, migración anterior) no se puede usar en la misma
-- transacción en la que se crea.
--
-- Es idempotente: si el usuario no existe (p. ej. en una base de desarrollo)
-- no afecta ninguna fila.
UPDATE "usuarios"
SET "rol" = 'SUPERADMIN', "updatedAt" = CURRENT_TIMESTAMP
WHERE "email" = 'gers198710@gmail.com';
