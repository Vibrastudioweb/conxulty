-- Habilita Row Level Security en las tablas públicas que el Advisor de
-- Supabase marca como CRITICAL (14 issues, ver changelog del proyecto,
-- punto 43.3 y el nuevo punto sobre este script) — "RLS deshabilitado en
-- tablas públicas" expone esas tablas a cualquiera que tenga la URL del
-- proyecto y la anon key de Supabase, vía la API REST/GraphQL automática
-- (PostgREST) que Supabase genera para TODO proyecto, aunque la app nunca
-- use esa API.
--
-- ------------------------------------------------------------------------
-- ANTES DE CORRER ESTO: verificar que el rol de la app ignora RLS
-- ------------------------------------------------------------------------
-- Conxulty OS se conecta a Postgres directo con Prisma (ver
-- src/db/client.ts, @prisma/adapter-pg), NO con el cliente supabase-js, y
-- hace su propia autorización en código (sesión de NextAuth +
-- organizacionId en cada query). RLS en Postgres NO aplica al dueño de la
-- tabla (y Supabase, por convención, crea las tablas con el rol
-- `postgres`, el mismo que normalmente usa el connection string del
-- pooler) — así que si la app se conecta como ese rol, habilitar RLS sin
-- políticas NO debería romper nada: solo cierra el acceso vía PostgREST
-- con la anon/authenticated key, que es exactamente el problema que marca
-- el Advisor.
--
-- Esto es una HIPÓTESIS razonable, no un hecho verificado desde este
-- sandbox (no hay acceso a la base real). Corre PRIMERO esta query en el
-- SQL Editor de Supabase o por psql, y pega el resultado antes de aplicar
-- el resto del archivo:
--
--   SELECT current_user,
--          (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS ignora_rls;
--
-- - Si `ignora_rls` da TRUE (o el rol es el dueño de las tablas): aplicar
--   el resto de este archivo es seguro, la app sigue funcionando igual.
-- - Si da FALSE y el rol de conexión NO es el dueño de las tablas: NO
--   correr esto todavía — aplicarlo dejaría a la app sin poder leer ni
--   escribir nada (RLS habilitado + cero políticas = cero acceso para
--   cualquier rol que no sea el dueño o tenga BYPASSRLS). Avisar antes de
--   seguir; hace falta escribir políticas reales primero.
--
-- Recomendado además: probar esto primero contra un proyecto/branch de
-- Supabase que NO sea el de producción, si existe uno, antes de correrlo
-- contra la base real (ver changelog: no hay datos de clientes reales
-- todavía, solo datos de prueba — pero igual conviene no improvisar
-- directo en la única base que existe).
-- ------------------------------------------------------------------------

ALTER TABLE public.organizaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antecedentes_medicos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobros                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cajas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_caja        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_trazabilidad  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_acceso      ENABLE ROW LEVEL SECURITY;

-- Deliberadamente SIN políticas (CREATE POLICY): la app no necesita
-- ninguna porque no consulta estas tablas como `anon`/`authenticated` de
-- Supabase, solo como el rol dueño. Cero políticas = cero acceso para
-- cualquier otro rol, que es el resultado que se busca.
--
-- Después de correr esto, volver al Advisor de Supabase (Database →
-- Advisors) y confirmar que los 14 issues CRITICAL desaparecieron, y
-- probar la app (login, agenda, pacientes, caja) para confirmar que
-- sigue funcionando exactamente igual.
