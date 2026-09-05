-- Base grants for Supabase roles (anon, authenticated).
-- RLS policies control per-row visibility; TABLE-level GRANTS control whether
-- the role may attempt the operation at all. Without these, PostgREST returns
-- "permission denied for table X" even when RLS policies would allow the row.
--
-- Supabase Studio applies these automatically for tables created through the
-- dashboard, but bare `CREATE TABLE` migrations do not include them. This
-- migration back-fills the standard Supabase pattern for every table in the
-- public schema created by prior migrations (obras, pagamentos, documentos,
-- profiles, categorias, etc.).

-- Schema-level usage
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Read for both anon (public read via RLS if ever needed) and authenticated
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Mutations restricted to authenticated (RLS then narrows by papel via has_role)
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Sequences (BIGSERIAL columns like audit_log.id)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Default privileges for tables/sequences created in the future by the
-- postgres role — future migrations don't need to remember these grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
