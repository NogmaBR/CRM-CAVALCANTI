-- Fase 7.5 hardening: garante que service_role tenha SELECT/INSERT/UPDATE/DELETE
-- em todas as tabelas do schema public. Supabase normalmente concede via papel
-- postgres, mas o comportamento pode divergir entre projetos (owner de tabela
-- criada via CREATE TABLE numa migration bare). Fase 4 back-fillou grants pra
-- `authenticated`; esta migration faz o mesmo pra `service_role`.
--
-- Trigger: cron sweeper (/api/cron/sweep-pending-documentos) usa service_role
-- pra DELETE em documentos e retornava 42501 "permission denied".

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
