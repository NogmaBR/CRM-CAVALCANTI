-- ============================================================================
-- Lote de mensagens: a janela de silêncio do WhatsApp
-- ============================================================================
-- No canteiro se manda a foto e, dois segundos depois, "inox". Ou cinco fotos
-- seguidas. Ou três comprovantes. Cada webhook chegava sozinho e cada um
-- virava uma resposta: a foto foi para a obra errada antes do "inox" chegar,
-- e três comprovantes viraram três perguntas (17/09).
--
-- Não há Redis nem processo vivo: a janela vive aqui. O webhook grava a
-- mensagem, responde 200, espera alguns segundos e pergunta se é a mais
-- recente do (chat, remetente). Se for, reivindica todas as que ainda não têm
-- lote (`lote_id`, atômico) e processa como UMA entrada. Se não for, sai: a
-- invocação da mensagem mais nova fecha o lote.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mensagens_em_espera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Id no provider: o retry do UAZAPI bate aqui (23505) e sai como duplicada.
  msg_id_uazapi TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL,
  telefone TEXT NOT NULL,
  -- O payload canônico (já validado pelo Zod), para reprocessar sem o provider.
  payload JSONB NOT NULL,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  lote_id UUID,
  processado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS mensagens_em_espera_chat_tel_idx
  ON mensagens_em_espera (chat_id, telefone, recebido_em DESC);
CREATE INDEX IF NOT EXISTS mensagens_em_espera_lote_idx
  ON mensagens_em_espera (lote_id) WHERE lote_id IS NOT NULL;

ALTER TABLE mensagens_em_espera ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mensagens_em_espera FROM authenticated;
GRANT ALL ON mensagens_em_espera TO service_role;

-- Reivindicação atômica: todas as mensagens ainda sem lote deste (chat,
-- remetente) recebem o mesmo lote_id, numa statement só. Quem perde a corrida
-- recebe zero linhas.
CREATE OR REPLACE FUNCTION public.reivindicar_lote(p_chat_id TEXT, p_telefone TEXT, p_lote_id UUID)
RETURNS SETOF mensagens_em_espera
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE mensagens_em_espera
     SET lote_id = p_lote_id
   WHERE chat_id = p_chat_id
     AND telefone = p_telefone
     AND lote_id IS NULL
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.reivindicar_lote(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reivindicar_lote(TEXT, TEXT, UUID) TO service_role;

-- A pendência sabe de que lote veio e em que posição: "2 não" e "2 é na INOX"
-- apontam para o item 2 da lista que o agente mandou.
ALTER TABLE confirmacoes_pendentes ADD COLUMN IF NOT EXISTS lote_id UUID;
ALTER TABLE confirmacoes_pendentes ADD COLUMN IF NOT EXISTS indice_no_lote INT;
CREATE INDEX IF NOT EXISTS confirmacoes_pendentes_lote_idx
  ON confirmacoes_pendentes (lote_id) WHERE lote_id IS NOT NULL;

-- A mensagem gravada também lembra o lote: é por ela que a resposta única do
-- lote sabe quantos arquivos foram guardados e onde.
ALTER TABLE mensagens_whats ADD COLUMN IF NOT EXISTS lote_id UUID;
CREATE INDEX IF NOT EXISTS mensagens_whats_lote_idx ON mensagens_whats (lote_id) WHERE lote_id IS NOT NULL;
