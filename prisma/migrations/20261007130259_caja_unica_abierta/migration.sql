-- Una sola caja ABIERTA por organización, garantizado por la base de datos.
-- Prisma no expresa índices parciales en su DSL, por eso vive aquí en SQL.
-- Reversión: DROP INDEX "cajas_una_abierta_por_organizacion";
CREATE UNIQUE INDEX "cajas_una_abierta_por_organizacion"
  ON "cajas" ("organizacionId")
  WHERE "estado" = 'ABIERTA';
