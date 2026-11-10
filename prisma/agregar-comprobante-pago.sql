-- Agrega las columnas para guardar el comprobante de pago adjunto en
-- /ajustes ("Ya pagué") — ver schema.prisma, modelo Pago, 10-nov-2026.
-- Antes el médico mandaba la captura por WhatsApp aparte; ahora se sube
-- en el mismo formulario y se guarda directo en la fila del Pago.
--
-- IF NOT EXISTS: seguro de correr aunque ya existan (no rompe nada si se
-- ejecuta dos veces por error).

ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS comprobante BYTEA;
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS "comprobanteTipo" TEXT;

-- Después de correr esto: probar en /ajustes que "Ya pagué" con una
-- captura adjunta no tire error, y que /superadmin/pagos la muestre.
