-- Fase QA hardening (audit BUG-02): race condition em confirmarPendencia
--
-- Sem este índice, dois cliques rápidos no botão "Confirmar" da tela
-- /pendentes podem criar 2 pagamentos linkados à mesma mensagem_whats.
--
-- Estratégia: unique parcial em (criado_via_msg_id) onde não-nulo. Isso
-- não afeta pagamentos manuais (todos com criado_via_msg_id = NULL) e
-- garante que cada mensagem_whats vira no máximo 1 pagamento.
--
-- Combinado com pre-check em actions.ts e catch de código '23505' →
-- garante idempotência mesmo em duplo-submit.
--
-- Idempotente: IF NOT EXISTS.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagamentos_criado_via_msg_unique
  ON pagamentos (criado_via_msg_id)
  WHERE criado_via_msg_id IS NOT NULL;

COMMENT ON INDEX idx_pagamentos_criado_via_msg_unique IS
  'Audit BUG-02: garante 1 pagamento por mensagem_whats (evita duplo-submit em /pendentes).';
