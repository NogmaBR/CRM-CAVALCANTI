-- Auditoria 2026-09-09 — findings A-2 e M-2.
--
-- A-2: a policy de SELECT no bucket `documents` era `USING (bucket_id = 'documents')`.
--      Qualquer sessão autenticada (inclusive papel `leitura`) podia listar
--      `documentos.storage_path` pela tabela e chamar
--      `supabase.storage.from('documents').createSignedUrl(path)` direto do
--      browser, baixando NF/comprovante/contrato de qualquer obra — inclusive
--      documentos ARQUIVADOS (deleted_at != null), que a server action
--      `downloadDocumento` bloqueia mas o Storage não.
--
--      Agora o SELECT exige que exista uma linha viva em public.documentos
--      apontando pro objeto. O Storage passa a herdar o ciclo de vida da
--      tabela: arquivou o documento, o arquivo físico deixa de ser baixável.
--
-- M-2: `documents_role_delete` permitia admin/gestor/financeiro, enquanto a
--      tabela `documentos` só permite DELETE para admin. Um gestor não
--      conseguia apagar a linha, mas conseguia apagar o arquivo físico via
--      `storage.remove()`, deixando a linha órfã apontando pro nada.
--      Alinhado para admin-only, espelhando a tabela.
--
-- Prefixo `whatsapp/` fica de fora do join porque mídia recebida do WhatsApp
-- é gravada antes de virar `documentos` (o classificador ainda vai decidir se
-- aquilo é NF, comprovante ou nada). Esses objetos ficam legíveis só para os
-- papéis de mutação, nunca para `leitura`.

DROP POLICY IF EXISTS documents_authenticated_select ON storage.objects;
DROP POLICY IF EXISTS documents_role_delete ON storage.objects;

CREATE POLICY documents_authenticated_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      EXISTS (
        SELECT 1
        FROM public.documentos d
        WHERE d.storage_path = storage.objects.name
          AND d.deleted_at IS NULL
      )
      OR (
        storage.objects.name LIKE 'whatsapp/%'
        AND has_role(ARRAY['admin','gestor','financeiro']::papel_usuario[])
      )
    )
  );

CREATE POLICY documents_role_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND has_role(ARRAY['admin']::papel_usuario[])
  );

-- O join da policy roda a cada SELECT/signed URL; sem índice em storage_path
-- isso vira seq scan em `documentos` a cada download.
CREATE INDEX IF NOT EXISTS idx_documentos_storage_path
  ON public.documentos (storage_path)
  WHERE deleted_at IS NULL;
