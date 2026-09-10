-- Briefing Cavalcanti 16/09 — itens 5, 7 e 9 do "falta construir".
--
-- Contexto: hoje o único jeito de resolver uma pendência é o gestor clicar em
-- /pendentes. O briefing pede que a resposta "SIM" do próprio cliente no
-- WhatsApp já grave o lançamento. Esta migration prepara o schema pra isso.
--
-- 1. `recusado` como estado de verdade.
--    Rejeitar no painel gravava `status_pagto='erro'` + erro_msg='Rejeitada
--    pelo gestor'. Isso mistura duas coisas diferentes: "o processamento
--    quebrou" e "o gestor não aprovou". Quem lê o relatório não distingue
--    falha técnica de decisão de negócio, e o filtro de status do briefing
--    (pendente/recusado/aprovado) não tinha como existir.
--
-- 2. Rastro de COMO a confirmação foi resolvida (painel vs. WhatsApp), que é
--    o dado que prova pro cliente que a automação funcionou.
--
-- 3. Transcrição de áudio em coluna própria, preservando `texto_bruto` como
--    "o que o provider mandou" (null pra áudio).

-- ---------------------------------------------------------------------------
-- 1. Novos valores de enum
-- ---------------------------------------------------------------------------
-- ADD VALUE não pode ser usado na mesma transação em que é criado, por isso
-- nenhuma statement abaixo referencia 'recusado'/'recusada' literalmente.
ALTER TYPE pagamento_status ADD VALUE IF NOT EXISTS 'recusado';
ALTER TYPE msg_status ADD VALUE IF NOT EXISTS 'recusada';

-- ---------------------------------------------------------------------------
-- 2. Rastro da resolução
-- ---------------------------------------------------------------------------
ALTER TABLE confirmacoes_pendentes
  ADD COLUMN IF NOT EXISTS resolvida_via TEXT
    CHECK (resolvida_via IN ('painel', 'whatsapp', 'expiracao')),
  ADD COLUMN IF NOT EXISTS resultado TEXT
    CHECK (resultado IN ('confirmada', 'recusada', 'expirada')),
  ADD COLUMN IF NOT EXISTS pagamento_id UUID
    REFERENCES pagamentos(id) ON DELETE SET NULL;

-- A busca "existe confirmação aberta pra este telefone?" roda a cada mensagem
-- inbound. Sem estes dois índices ela vira seq scan nas duas tabelas.
CREATE INDEX IF NOT EXISTS idx_confirmacoes_abertas
  ON confirmacoes_pendentes (mensagem_id, created_at DESC)
  WHERE resolvida = false;

CREATE INDEX IF NOT EXISTS idx_msgs_telefone
  ON mensagens_whats (telefone_from, recebida_em DESC);

-- ---------------------------------------------------------------------------
-- 3. Transcrição de áudio
-- ---------------------------------------------------------------------------
ALTER TABLE mensagens_whats
  ADD COLUMN IF NOT EXISTS texto_transcrito TEXT;

COMMENT ON COLUMN mensagens_whats.texto_transcrito IS
  'Transcrição de áudio (provider em IA_TRANSCRICAO_PROVIDER). texto_bruto continua sendo apenas o que o UAZAPI enviou.';

-- ---------------------------------------------------------------------------
-- 4. Índice pra visão de "pagamentos sem documento há X dias"
-- ---------------------------------------------------------------------------
-- A tela de pendências passa a listar pagamentos que não têm NF nem
-- comprovante anexado, ordenados pelos mais antigos.
CREATE INDEX IF NOT EXISTS idx_pagamentos_sem_doc
  ON pagamentos (data_pagamento)
  WHERE deleted_at IS NULL;
