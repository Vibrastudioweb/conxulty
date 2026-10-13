-- Promueve al dueño de la plataforma a SUPERADMIN. Va en una migración
-- aparte de la que agrega el valor al enum porque Postgres no permite usar
-- un valor de enum recién agregado dentro de la misma transacción.
-- Idempotente; si el usuario no existe (p.ej. base nueva), no hace nada.
-- Reversión: UPDATE "usuarios" SET "rol" = 'ADMIN' WHERE "email" = 'gers198710@gmail.com';
UPDATE "usuarios"
SET "rol" = 'SUPERADMIN', "updatedAt" = CURRENT_TIMESTAMP
WHERE "email" = 'gers198710@gmail.com';
