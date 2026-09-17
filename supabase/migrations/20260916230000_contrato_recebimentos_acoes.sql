-- ============================================================================
-- Agente do WhatsApp sobre o CRM inteiro: contrato, recebimentos e ações
-- ============================================================================
-- Três peças que o agente precisa e não existiam:
--
--   1. `obras.valor_contrato` — sem ele "quanto estou lucrando" não tem
--      resposta. `orcamento` é o que se planeja gastar; contrato é o que o
--      cliente da obra vai pagar. São números diferentes.
--   2. `recebimentos` — as parcelas que o cliente da obra pagou. Resultado da
--      obra = recebido − gasto. Mesmo formato de `pagamentos` (RLS por papel,
--      auditoria, soft delete).
--   3. `confirmacoes_pendentes.tipo = 'acao'` + coluna `acao` — a proposta de
--      ação ("criar obra X") que o bot pergunta e o "SIM" executa. Nunca se
--      grava direto a partir do modelo; a proposta fica aqui até a confirmação.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Valor do contrato
-- ----------------------------------------------------------------------------
ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS valor_contrato NUMERIC(14,2)
  CHECK (valor_contrato IS NULL OR valor_contrato > 0);

COMMENT ON COLUMN obras.valor_contrato IS
  'Quanto o cliente da obra paga pelo todo. Diferente de orcamento (o que se planeja gastar). Nulo até alguém informar — o agente diz que falta.';

-- ----------------------------------------------------------------------------
-- 2. Recebimentos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE RESTRICT,
  valor NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  data_recebimento DATE NOT NULL,
  descricao TEXT,
  -- De onde veio o registro: painel ou confirmação pelo WhatsApp.
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'whatsapp')),
  criado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autorizado_id UUID REFERENCES autorizados(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE recebimentos IS
  'Parcelas que o cliente da obra pagou. Resultado da obra = soma daqui − gasto (pagamentos que contam).';

CREATE INDEX IF NOT EXISTS idx_recebimentos_obra_vivos
  ON recebimentos (obra_id, data_recebimento DESC) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_recebimentos_updated ON recebimentos;
CREATE TRIGGER trg_recebimentos_updated BEFORE UPDATE ON recebimentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_recebimentos ON recebimentos;
CREATE TRIGGER trg_audit_recebimentos AFTER INSERT OR UPDATE OR DELETE ON recebimentos
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

ALTER TABLE recebimentos ENABLE ROW LEVEL SECURITY;

-- Mesmo desenho de `pagamentos`: qualquer autenticado lê; gestor/financeiro/admin
-- escreve; só admin apaga de verdade. service_role (webhook) não passa por RLS.
DROP POLICY IF EXISTS "recebimentos_select" ON public.recebimentos;
CREATE POLICY "recebimentos_select" ON public.recebimentos FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "recebimentos_insert" ON public.recebimentos;
CREATE POLICY "recebimentos_insert" ON public.recebimentos FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "recebimentos_update" ON public.recebimentos;
CREATE POLICY "recebimentos_update" ON public.recebimentos FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "recebimentos_delete" ON public.recebimentos;
CREATE POLICY "recebimentos_delete" ON public.recebimentos FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));

-- Grants no padrão da revisão do banco: nada de TRUNCATE/REFERENCES/TRIGGER
-- para authenticated; anon não tem privilégio nenhum em public.
REVOKE ALL ON recebimentos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON recebimentos TO authenticated;
GRANT ALL ON recebimentos TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Pendência de ação
-- ----------------------------------------------------------------------------
ALTER TABLE confirmacoes_pendentes
  ADD COLUMN IF NOT EXISTS acao JSONB;

ALTER TABLE confirmacoes_pendentes DROP CONSTRAINT IF EXISTS confirmacoes_pendentes_tipo_check;
ALTER TABLE confirmacoes_pendentes ADD CONSTRAINT confirmacoes_pendentes_tipo_check
  CHECK (tipo IN ('pagamento', 'obra_documento', 'obra_registro', 'acao'));

COMMENT ON COLUMN confirmacoes_pendentes.acao IS
  'Para tipo acao: {"tipo":"criar_obra"|"cadastrar_fornecedor"|"definir_contrato"|"registrar_recebimento"|"arquivar_obra","dados":{…},"resumo":"…"}. Gravado pelo agente, executado no SIM.';
