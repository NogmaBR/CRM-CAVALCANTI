-- ============================================================================
-- Rastro das respostas do agente + estado da conversa
-- ============================================================================
-- Até aqui o CRM guardava o que a pessoa mandou (`mensagens_whats`) mas não o
-- que o próprio agente respondeu. Sem isso, três coisas da conversa real de
-- 17/09 não têm como funcionar:
--
--   - responder "sim" EM CIMA de uma pergunta (citação): o provider manda o id
--     da mensagem citada, e ele só aponta para algo se a pergunta ficou gravada;
--   - reagir com 👍 à pergunta: mesma coisa, o id reagido é o da resposta do bot;
--   - "desfaz isso" citando o "📁 Guardei…": é a linha aqui que diz que
--     documento é "isso".
--
-- Uma linha por envio, com a entidade a que a resposta se refere. Quem escreve
-- é o webhook (service_role). A tela /whatsapp lê para mostrar a conversa
-- inteira, dos dois lados.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mensagens_enviadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- JID do chat (grupo ou privado) para onde a resposta foi.
  chat_id TEXT NOT NULL,
  -- Id da mensagem no provider. NULL quando o envio falhou ou o provider não
  -- devolveu id (a linha ainda vale como histórico da conversa).
  msg_id_uazapi TEXT,
  texto TEXT NOT NULL,
  -- O que a resposta é: pergunta_pendencia, lancado, arquivado, anotado,
  -- acao_executada, resposta (assistente), aviso.
  tipo TEXT NOT NULL,
  -- A mensagem da pessoa que motivou a resposta, quando há.
  em_resposta_a UUID REFERENCES mensagens_whats(id) ON DELETE SET NULL,
  -- A entidade a que a resposta se refere (no máximo uma preenchida).
  confirmacao_id UUID REFERENCES confirmacoes_pendentes(id) ON DELETE SET NULL,
  pagamento_id UUID REFERENCES pagamentos(id) ON DELETE SET NULL,
  documento_id UUID REFERENCES documentos(id) ON DELETE SET NULL,
  registro_id UUID REFERENCES registros_obra(id) ON DELETE SET NULL,
  -- Lote de mensagens (janela de silêncio) que gerou a resposta; nulo fora dele.
  lote_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Citação e reação chegam pelo id do provider: é por ele que se busca.
CREATE UNIQUE INDEX IF NOT EXISTS mensagens_enviadas_msg_id_uazapi_uidx
  ON mensagens_enviadas (msg_id_uazapi) WHERE msg_id_uazapi IS NOT NULL;
-- A conversa de um chat, do mais recente para o mais antigo.
CREATE INDEX IF NOT EXISTS mensagens_enviadas_chat_created_idx
  ON mensagens_enviadas (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mensagens_enviadas_em_resposta_a_idx
  ON mensagens_enviadas (em_resposta_a) WHERE em_resposta_a IS NOT NULL;

ALTER TABLE mensagens_enviadas ENABLE ROW LEVEL SECURITY;

-- Mesma régua de `mensagens_whats`: qualquer usuário logado lê (é a conversa
-- que a tela /whatsapp mostra). Escrita só pelo service_role.
DROP POLICY IF EXISTS mensagens_enviadas_select ON mensagens_enviadas;
CREATE POLICY mensagens_enviadas_select ON mensagens_enviadas FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON mensagens_enviadas FROM authenticated;
GRANT SELECT ON mensagens_enviadas TO authenticated;
GRANT ALL ON mensagens_enviadas TO service_role;

-- ----------------------------------------------------------------------------
-- Estado da conversa por chat
-- ----------------------------------------------------------------------------
-- "A obra de que se estava falando" era deduzida das últimas mensagens e
-- grudava por 2 h: depois de "paguei 1200 na Garibaldi", toda foto do grupo
-- ia para a Garibaldi. Aqui fica o que zera essa memória: uma correção ("não
-- é na Garibaldi") ou um desfazer grava `obra_conversa_reset_em`, e o
-- classificador só considera obra citada DEPOIS desse instante.
CREATE TABLE IF NOT EXISTS conversa_estado (
  chat_id TEXT PRIMARY KEY,
  obra_conversa_reset_em TIMESTAMPTZ,
  -- A obra que a pessoa disse por correção ("não, é na INOX"): vence a
  -- dedução pelas mensagens enquanto estiver dentro da janela.
  obra_conversa_id UUID REFERENCES obras(id) ON DELETE SET NULL,
  obra_conversa_em TIMESTAMPTZ,
  -- "Qual pendência?" em aberto: [{ n, confirmacao_id }] e a resposta que a
  -- pessoa deu ('sim'/'nao'), esperando o número. Vale 10 minutos.
  escolha_pendencias JSONB,
  escolha_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conversa_estado ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON conversa_estado FROM authenticated;
GRANT ALL ON conversa_estado TO service_role;
