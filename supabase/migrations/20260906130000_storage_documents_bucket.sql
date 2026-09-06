-- Bucket privado para documentos (NF, comprovantes, contratos)
-- Path convention: {obra_id}/{documento_id}/{filename}
-- Acesso via signed URLs geradas por server actions (RLS server-side ownership check)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- privado, requer signed URL
  10485760, -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated pode fazer CRUD em objects. Ownership fine-grained é feito
-- server-side via server actions (que chamam getDocumento antes de gerar signed URL).
-- Bucket privado + RLS aberto pra authenticated = defense-in-depth; anon nem passa.

CREATE POLICY documents_authenticated_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY documents_authenticated_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY documents_authenticated_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY documents_authenticated_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents');
