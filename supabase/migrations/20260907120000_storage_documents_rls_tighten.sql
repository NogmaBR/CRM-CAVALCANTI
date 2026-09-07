-- Fase 7.5 hardening: tighten storage.objects RLS pra bucket 'documents'
-- Antes: qualquer authenticated CRUD.
-- Agora: SELECT authenticated (RLS row-level de public.documentos filtra visibilidade real);
--        INSERT/UPDATE/DELETE só admin/gestor/financeiro (matching table-level RLS).
-- has_role() helper já existe (Fase 3).

DROP POLICY IF EXISTS documents_authenticated_select ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_delete ON storage.objects;

-- SELECT: qualquer authenticated pode listar/baixar (a signed URL server-action controla ownership)
CREATE POLICY documents_authenticated_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

-- INSERT/UPDATE/DELETE: só roles com permissão de mutation em documentos
CREATE POLICY documents_role_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND has_role(ARRAY['admin','gestor','financeiro']::papel_usuario[])
  );

CREATE POLICY documents_role_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND has_role(ARRAY['admin','gestor','financeiro']::papel_usuario[])
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND has_role(ARRAY['admin','gestor','financeiro']::papel_usuario[])
  );

CREATE POLICY documents_role_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND has_role(ARRAY['admin','gestor','financeiro']::papel_usuario[])
  );
