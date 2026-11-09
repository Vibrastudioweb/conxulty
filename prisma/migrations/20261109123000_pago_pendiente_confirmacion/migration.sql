-- AlterEnum
-- Flujo de pago real del Plan Pro (changelog punto 89): sin cuenta
-- comercial en SPIDI no hay API ni webhook, así que la confirmación de
-- un pago es manual — este estado representa "el médico dijo que ya
-- pagó, falta que el equipo lo confirme en /superadmin/pagos".
ALTER TYPE "EstadoSuscripcion" ADD VALUE 'PENDIENTE_CONFIRMACION';
