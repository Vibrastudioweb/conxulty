-- AlterEnum
-- Cuentas de clínica/farmacia (changelog punto 90/92) — en migración propia
-- porque un valor de enum no se puede agregar y usarse en la misma
-- transacción (mismo criterio que PENDIENTE_CONFIRMACION, migración
-- 20261109123000).
ALTER TYPE "RolUsuario" ADD VALUE 'ENTIDAD';
