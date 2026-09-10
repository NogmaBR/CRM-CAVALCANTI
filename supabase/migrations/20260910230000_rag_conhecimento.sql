-- Fase 4: base de conhecimento e memória das conversas com IA.
--
-- ## O que é indexado, e por quê não é PDF
--
-- O plano falava em "documento → parser → chunking → embedding". Ao chegar
-- aqui, o banco tem **zero documentos**: os PDFs de nota e comprovante estão
-- no OneDrive do cliente, não no sistema. Um parser de PDF indexaria nada.
--
-- O que existe são 80 pagamentos, 10 obras e 8 fornecedores — dados
-- estruturados, com valor, data, fornecedor e descrição. É esse o corpus que
-- responde "quanto gastei com material na Garibaldi em fevereiro?", que é a
-- pergunta que o gestor faz de verdade.
--
-- Por isso a tabela tem `origem`: o pipeline é o mesmo para qualquer fonte, e
-- quando os PDFs entrarem no sistema basta um indexador novo. A estrutura já
-- comporta; o que falta é o arquivo existir.
--
-- ## Separação deliberada
--
-- `knowledge_*` e `ai_*` **não referenciam** as tabelas de negócio por FK, e
-- isso é de propósito: apagar um pagamento não pode falhar porque existe um
-- embedding apontando para ele. O vínculo é por id solto, e o reindexador
-- limpa o que ficou órfão.

-- ---------------------------------------------------------------------------
-- Documentos de conhecimento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- De onde este texto veio. Novo indexador = novo valor aqui.
  origem TEXT NOT NULL CHECK (origem IN ('pagamento', 'obra', 'fornecedor', 'documento')),

  -- Id na tabela de negócio. Sem FK, de propósito (ver cabeçalho).
  origem_id UUID NOT NULL,

  -- Denormalizado para filtrar a busca por obra sem join. A pergunta quase
  -- sempre é sobre UMA obra, e filtrar antes da comparação vetorial é o que
  -- mantém a busca barata conforme a base cresce.
  obra_id UUID,

  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,

  -- Hash do conteúdo: se não mudou, não vale gastar embedding de novo.
  -- Embedding custa dinheiro e tempo; reindexar 80 pagamentos que não mudaram
  -- é desperdício que se paga toda vez que o cron roda.
  hash_conteudo TEXT NOT NULL,

  indexado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Um documento de conhecimento por entidade de origem.
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_origem
  ON knowledge_documents (origem, origem_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_obra
  ON knowledge_documents (obra_id) WHERE deleted_at IS NULL;

-- Fila de reindexação: quem ainda não tem embedding, ou mudou depois dele.
CREATE INDEX IF NOT EXISTS idx_knowledge_pendente
  ON knowledge_documents (updated_at)
  WHERE deleted_at IS NULL AND indexado_em IS NULL;

DROP TRIGGER IF EXISTS trg_knowledge_documents_updated ON knowledge_documents;
CREATE TRIGGER trg_knowledge_documents_updated
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Trechos e embeddings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Esta FK existe (diferente das de negócio): o trecho não faz sentido sem o
  -- documento, e apagar em cascata é o comportamento certo.
  documento_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,

  ordem INTEGER NOT NULL,
  conteudo TEXT NOT NULL,

  -- 1536 = text-embedding-3-small da OpenAI. Trocar de modelo com dimensão
  -- diferente exige migration e reindexação completa — por isso a dimensão
  -- está fixa aqui e não configurável: um vetor de 1536 e um de 3072 não se
  -- comparam, e descobrir isso em runtime seria um erro difícil de entender.
  embedding extensions.vector(1536),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_documento
  ON knowledge_chunks (documento_id, ordem);

-- HNSW com distância de cosseno.
--
-- HNSW e não IVFFlat: o IVFFlat precisa de dados representativos no momento
-- de criar o índice para calcular as listas, e aqui o índice nasce antes dos
-- dados. HNSW não tem esse problema e é melhor em recall.
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON knowledge_chunks USING hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Busca
-- ---------------------------------------------------------------------------
-- O embedding chega como TEXT e não como `vector`: o PostgREST serializa em
-- JSON, e um array de 1536 floats atravessa como string sem perda. Receber
-- `vector` direto funcionaria em SQL puro e falharia pela API — o tipo de
-- diferença que só aparece em produção.
CREATE OR REPLACE FUNCTION buscar_conhecimento(
  p_embedding TEXT,
  p_limite INTEGER DEFAULT 6,
  p_obra_id UUID DEFAULT NULL,
  p_similaridade_minima REAL DEFAULT 0.25
)
RETURNS TABLE (
  chunk_id UUID,
  documento_id UUID,
  origem TEXT,
  origem_id UUID,
  obra_id UUID,
  titulo TEXT,
  conteudo TEXT,
  similaridade REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_vec extensions.vector(1536);
BEGIN
  v_vec := p_embedding::extensions.vector(1536);

  RETURN QUERY
  SELECT
    c.id,
    d.id,
    d.origem,
    d.origem_id,
    d.obra_id,
    d.titulo,
    c.conteudo,
    -- `<=>` é distância de cosseno (0 = idêntico). Similaridade é 1 menos
    -- isso, que é o número que faz sentido para quem lê.
    (1 - (c.embedding <=> v_vec))::real
  FROM knowledge_chunks c
  JOIN knowledge_documents d ON d.id = c.documento_id
  WHERE d.deleted_at IS NULL
    AND c.embedding IS NOT NULL
    AND (p_obra_id IS NULL OR d.obra_id = p_obra_id)
    AND (1 - (c.embedding <=> v_vec)) >= p_similaridade_minima
  ORDER BY c.embedding <=> v_vec
  LIMIT p_limite;
END;
$$;

COMMENT ON FUNCTION buscar_conhecimento(TEXT, INTEGER, UUID, REAL) IS
  'Busca vetorial com corte de similaridade. Sem resultado é resposta válida: melhor dizer "não sei" que responder com trecho irrelevante.';

-- ---------------------------------------------------------------------------
-- Memória das conversas
-- ---------------------------------------------------------------------------
-- Separadas das tabelas de negócio de propósito. Uma pergunta ao assistente
-- não é um lançamento financeiro, e misturar as duas faria a auditoria do
-- financeiro encher de conversa.
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'painel')),

  -- Quem perguntou. Um dos dois, conforme o canal.
  autorizado_id UUID,
  user_id UUID,

  obra_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_autorizado
  ON ai_conversations (autorizado_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_ai_conversations_updated ON ai_conversations;
CREATE TRIGGER trg_ai_conversations_updated
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('usuario', 'assistente', 'sistema')),
  conteudo TEXT NOT NULL,

  -- As fontes que sustentaram a resposta. É o que permite responder "de onde
  -- você tirou isso?" depois — e sem isso o RAG vira um chute com sotaque de
  -- certeza.
  fontes JSONB,

  tokens_entrada INTEGER,
  tokens_saida INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversa
  ON ai_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
  ferramenta TEXT NOT NULL,
  argumentos JSONB,
  resultado JSONB,
  ok BOOLEAN NOT NULL DEFAULT true,
  erro TEXT,
  duracao_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_message
  ON ai_tool_calls (message_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Quem indexa e quem responde é o service_role, sem sessão. Estas policies
-- governam só a leitura pelo painel.
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_calls       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_documents_select ON knowledge_documents;
CREATE POLICY knowledge_documents_select ON knowledge_documents
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','gestor','financeiro']::papel_usuario[]));

DROP POLICY IF EXISTS knowledge_chunks_select ON knowledge_chunks;
CREATE POLICY knowledge_chunks_select ON knowledge_chunks
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','gestor']::papel_usuario[]));

DROP POLICY IF EXISTS ai_conversations_select ON ai_conversations;
CREATE POLICY ai_conversations_select ON ai_conversations
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','gestor']::papel_usuario[]));

DROP POLICY IF EXISTS ai_messages_select ON ai_messages;
CREATE POLICY ai_messages_select ON ai_messages
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','gestor']::papel_usuario[]));

DROP POLICY IF EXISTS ai_tool_calls_select ON ai_tool_calls;
CREATE POLICY ai_tool_calls_select ON ai_tool_calls
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','gestor']::papel_usuario[]));

REVOKE ALL ON FUNCTION buscar_conhecimento(TEXT, INTEGER, UUID, REAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buscar_conhecimento(TEXT, INTEGER, UUID, REAL) TO service_role;
