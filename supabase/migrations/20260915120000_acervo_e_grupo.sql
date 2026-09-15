-- Acervo do OneDrive e agente no grupo do WhatsApp
-- (docs/superpowers/specs/2026-09-15-acervo-onedrive-e-agente-grupo-design.md).
--
-- O que muda, e por quê:
--
-- 1. `documentos` ganha `categoria` (a PASTA onde o arquivo mora: NFs/Pagamentos,
--    Projeto, Fotos…) separada de `tipo` (o que o arquivo É: nota, comprovante,
--    contrato). A estrutura de pastas é a do cliente — só `documentacao` e
--    `nfs_pagamentos` existem em toda obra; o resto varia por projeto.
--    `origem` diz de onde veio (painel, WhatsApp, OneDrive) e `caminho_origem`
--    guarda o caminho relativo no Drive, que é a chave de sincronia do
--    importador (`scripts/importar-onedrive.mjs`).
-- 2. `texto_extraido` é o que o assistente pesquisa e o que a conciliação usa
--    para casar uma NF importada com um pagamento sem documento.
-- 3. `registros_obra` é o diário de obra: áudio ou texto do dia a dia que não
--    é pagamento ("hoje a laje ficou pronta") passa a ter onde morar.
-- 4. `whatsapp_grupos`: a lista fechada de grupos em que o agente age. Sem o
--    grupo aqui, mensagem de grupo é ignorada — mesma postura de `autorizados`.
-- 5. `confirmacoes_pendentes.tipo`: a mecânica de pergunta/resposta com janela
--    de 24 h passa a servir também para "de qual obra é isso?", respondida por
--    número (`opcoes`). O caminho de pagamento continua o mesmo.

-- ---------------------------------------------------------------------------
-- 1. Enums novos (tipo novo pode ser usado na mesma transação; ADD VALUE não)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE doc_categoria AS ENUM (
    'documentacao', 'nfs_pagamentos', 'proposta', 'projeto', 'projeto_aprovado',
    'cronograma', 'fotos', 'orcamentos', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doc_origem AS ENUM ('painel', 'whatsapp', 'onedrive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. documentos
-- ---------------------------------------------------------------------------
ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS categoria doc_categoria NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS origem doc_origem NOT NULL DEFAULT 'painel',
  ADD COLUMN IF NOT EXISTS caminho_origem TEXT,
  ADD COLUMN IF NOT EXISTS origem_modificado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS texto_extraido TEXT,
  ADD COLUMN IF NOT EXISTS texto_extraido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conciliado_em TIMESTAMPTZ;

COMMENT ON COLUMN documentos.categoria IS
  'A pasta em que o arquivo mora (estrutura do cliente). Diferente de `tipo`, que diz o que o arquivo é.';
COMMENT ON COLUMN documentos.caminho_origem IS
  'Caminho relativo dentro de _OBRAS ATIVAS_ quando origem = onedrive. Chave de sincronia do importador.';
COMMENT ON COLUMN documentos.texto_extraido_em IS
  'Quando a extração olhou este documento — mesmo sem conseguir texto. NULL = ainda na fila.';
COMMENT ON COLUMN documentos.conciliado_em IS
  'Quando a conciliação tentou casar este documento com um pagamento. NULL = ainda na fila.';

-- Documento que já nasceu de mensagem do WhatsApp (anexado numa confirmação)
-- é nota/comprovante: pasta NFs/Pagamentos, origem whatsapp.
UPDATE documentos d
   SET origem = 'whatsapp', categoria = 'nfs_pagamentos'
 WHERE d.deleted_at IS NULL
   AND d.origem = 'painel'
   AND EXISTS (SELECT 1 FROM mensagens_whats m WHERE m.documento_id = d.id);

CREATE INDEX IF NOT EXISTS idx_documentos_obra_categoria
  ON documentos (obra_id, categoria) WHERE deleted_at IS NULL;

-- Um caminho do Drive aponta para um documento vivo. Substituição no Drive =
-- o antigo recebe deleted_at, o novo entra.
CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_caminho_origem
  ON documentos (caminho_origem) WHERE origem = 'onedrive' AND deleted_at IS NULL;

-- Filas da extração e da conciliação: só quem ainda não foi olhado.
CREATE INDEX IF NOT EXISTS idx_documentos_extracao_pendente
  ON documentos (created_at) WHERE texto_extraido_em IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_conciliacao_pendente
  ON documentos (created_at)
  WHERE categoria = 'nfs_pagamentos' AND pagamento_id IS NULL
    AND conciliado_em IS NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. whatsapp_grupos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- JID do grupo no provider, ex.: '120363012345678901@g.us'.
  chat_id TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  -- Grupo dedicado a uma obra: documento e registro sem obra explícita vão
  -- para ela sem perguntar.
  obra_id UUID REFERENCES obras(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS trg_whatsapp_grupos_updated ON whatsapp_grupos;
CREATE TRIGGER trg_whatsapp_grupos_updated BEFORE UPDATE ON whatsapp_grupos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_whatsapp_grupos ON whatsapp_grupos;
CREATE TRIGGER trg_audit_whatsapp_grupos AFTER INSERT OR UPDATE OR DELETE ON whatsapp_grupos
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

ALTER TABLE whatsapp_grupos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_grupos_select ON whatsapp_grupos;
CREATE POLICY whatsapp_grupos_select ON whatsapp_grupos FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS whatsapp_grupos_insert ON whatsapp_grupos;
CREATE POLICY whatsapp_grupos_insert ON whatsapp_grupos FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS whatsapp_grupos_update ON whatsapp_grupos;
CREATE POLICY whatsapp_grupos_update ON whatsapp_grupos FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])))
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS whatsapp_grupos_delete ON whatsapp_grupos;
CREATE POLICY whatsapp_grupos_delete ON whatsapp_grupos FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));

-- ---------------------------------------------------------------------------
-- 4. registros_obra (diário de obra)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registros_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  -- Como veio: transcrição do áudio ou o texto da mensagem.
  texto TEXT NOT NULL,
  -- Uma linha, do modelo. NULL no mock.
  resumo TEXT,
  -- Data civil de Brasília no momento do registro (hojeBR()).
  data_registro DATE NOT NULL,
  origem doc_origem NOT NULL DEFAULT 'whatsapp',
  mensagem_id UUID REFERENCES mensagens_whats(id) ON DELETE SET NULL,
  autor_autorizado_id UUID REFERENCES autorizados(id) ON DELETE SET NULL,
  autor_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  midia_storage_path TEXT,
  midia_mime TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_registros_obra_obra_data
  ON registros_obra (obra_id, data_registro DESC) WHERE deleted_at IS NULL;

-- Uma mensagem gera no máximo um registro (retry do provider, corrida do "2").
CREATE UNIQUE INDEX IF NOT EXISTS idx_registros_obra_mensagem
  ON registros_obra (mensagem_id) WHERE mensagem_id IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_registros_obra_updated ON registros_obra;
CREATE TRIGGER trg_registros_obra_updated BEFORE UPDATE ON registros_obra
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_registros_obra ON registros_obra;
CREATE TRIGGER trg_audit_registros_obra AFTER INSERT OR UPDATE OR DELETE ON registros_obra
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

ALTER TABLE registros_obra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS registros_obra_select ON registros_obra;
CREATE POLICY registros_obra_select ON registros_obra FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS registros_obra_insert ON registros_obra;
CREATE POLICY registros_obra_insert ON registros_obra FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS registros_obra_update ON registros_obra;
CREATE POLICY registros_obra_update ON registros_obra FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])))
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS registros_obra_delete ON registros_obra;
CREATE POLICY registros_obra_delete ON registros_obra FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));

-- Os DEFAULT PRIVILEGES de 20260911140000/20260912150000 já tiram anon e
-- TRUNCATE/REFERENCES/TRIGGER de tabela nova; repetido aqui por clareza.
REVOKE ALL ON whatsapp_grupos, registros_obra FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON whatsapp_grupos, registros_obra FROM authenticated;

-- ---------------------------------------------------------------------------
-- 5. mensagens_whats: de onde veio e para onde responder
-- ---------------------------------------------------------------------------
ALTER TABLE mensagens_whats
  ADD COLUMN IF NOT EXISTS chat_id TEXT,
  ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES whatsapp_grupos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registro_id UUID REFERENCES registros_obra(id) ON DELETE SET NULL;

COMMENT ON COLUMN mensagens_whats.chat_id IS
  'JID do chat de origem (grupo ou privado). É para onde a resposta vai; telefone_from é quem falou.';

-- ---------------------------------------------------------------------------
-- 6. confirmacoes_pendentes: pergunta de obra, respondida por número
-- ---------------------------------------------------------------------------
ALTER TABLE confirmacoes_pendentes
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'pagamento',
  ADD COLUMN IF NOT EXISTS opcoes JSONB,
  ADD COLUMN IF NOT EXISTS chat_id TEXT;

ALTER TABLE confirmacoes_pendentes DROP CONSTRAINT IF EXISTS confirmacoes_pendentes_tipo_check;
ALTER TABLE confirmacoes_pendentes ADD CONSTRAINT confirmacoes_pendentes_tipo_check
  CHECK (tipo IN ('pagamento', 'obra_documento', 'obra_registro'));

COMMENT ON COLUMN confirmacoes_pendentes.opcoes IS
  'Para tipo obra_*: [{"n":1,"id":"<obra_id>","nome":"Aguirre","apelidos":[]}, …]. A resposta é o número ou o nome.';

-- ---------------------------------------------------------------------------
-- 7. knowledge_documents: o diário também é conhecimento
-- ---------------------------------------------------------------------------
ALTER TABLE knowledge_documents DROP CONSTRAINT IF EXISTS knowledge_documents_origem_check;
ALTER TABLE knowledge_documents ADD CONSTRAINT knowledge_documents_origem_check
  CHECK (origem IN ('pagamento', 'obra', 'fornecedor', 'documento', 'registro'));

-- ---------------------------------------------------------------------------
-- 8. busca_global: documentos entram na paleta ⌘K
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.busca_global(p_termo text, p_limite integer DEFAULT 5)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH termo AS (
    SELECT '%' || replace(replace(replace(left(coalesce(p_termo, ''), 60), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS padrao,
           greatest(1, least(coalesce(p_limite, 5), 20)) AS limite
  ),
  obras_q AS (
    SELECT jsonb_build_object('id', o.id, 'nome', o.nome, 'cliente', o.cliente) AS j
    FROM obras o, termo t
    WHERE o.deleted_at IS NULL
      AND (o.nome ILIKE t.padrao ESCAPE '\' OR o.cliente ILIKE t.padrao ESCAPE '\')
    ORDER BY o.nome
    LIMIT (SELECT limite FROM termo)
  ),
  forn_q AS (
    SELECT jsonb_build_object('id', f.id, 'nome', f.nome, 'categoria', c.nome) AS j
    FROM fornecedores f
    LEFT JOIN categorias c ON c.id = f.categoria_id
    , termo t
    WHERE f.deleted_at IS NULL
      AND (f.nome ILIKE t.padrao ESCAPE '\' OR f.razao_social ILIKE t.padrao ESCAPE '\')
    ORDER BY f.nome
    LIMIT (SELECT limite FROM termo)
  ),
  pag_q AS (
    SELECT jsonb_build_object(
             'id', p.id, 'descricao', p.descricao, 'valor', p.valor,
             'data', p.data_pagamento, 'obra', o.nome) AS j
    FROM pagamentos p
    LEFT JOIN obras o ON o.id = p.obra_id
    , termo t
    WHERE p.deleted_at IS NULL
      AND (p.descricao ILIKE t.padrao ESCAPE '\' OR p.observacoes ILIKE t.padrao ESCAPE '\')
    ORDER BY p.data_pagamento DESC
    LIMIT (SELECT limite FROM termo)
  ),
  doc_q AS (
    SELECT jsonb_build_object(
             'id', d.id, 'nome', d.nome_arquivo, 'categoria', d.categoria::text,
             'obra', o.nome) AS j
    FROM documentos d
    LEFT JOIN obras o ON o.id = d.obra_id
    , termo t
    WHERE d.deleted_at IS NULL
      AND (d.nome_arquivo ILIKE t.padrao ESCAPE '\'
           OR d.numero_nf ILIKE t.padrao ESCAPE '\'
           OR d.caminho_origem ILIKE t.padrao ESCAPE '\')
    ORDER BY d.created_at DESC
    LIMIT (SELECT limite FROM termo)
  )
  SELECT jsonb_build_object(
    'obras',        coalesce((SELECT jsonb_agg(j) FROM obras_q), '[]'::jsonb),
    'fornecedores', coalesce((SELECT jsonb_agg(j) FROM forn_q), '[]'::jsonb),
    'pagamentos',   coalesce((SELECT jsonb_agg(j) FROM pag_q), '[]'::jsonb),
    'documentos',   coalesce((SELECT jsonb_agg(j) FROM doc_q), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.busca_global(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.busca_global(text, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.busca_global(text, integer) IS
  'Paleta ⌘K: obras, fornecedores, pagamentos e documentos que casam com o termo, numa viagem. SECURITY INVOKER: respeita a RLS de quem chama.';
