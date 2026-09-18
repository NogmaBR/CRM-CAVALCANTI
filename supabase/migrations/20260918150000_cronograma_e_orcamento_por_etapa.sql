-- ============================================================================
-- Plano master PM1 + PM2 + PM4: cronograma físico, orçamento por etapa e o
-- resumo diário do semáforo
-- ============================================================================
-- Duas tabelas novas e um seed:
--
--   1. `etapas_obra` — o cronograma FÍSICO: cada etapa da obra com o %
--      concluído (a medição). É o que responde "a obra está em que pé?" ao
--      lado do % financeiro (gasto/contrato) e do % do prazo. Uma etapa pode
--      apontar para uma categoria do plano de contas (a mesma ETAPA da
--      planilha do cliente) — é o elo com o orçado × realizado.
--   2. `orcamentos_etapa` — quanto se planejou gastar em cada categoria da
--      obra. `obras.orcamento` continua sendo o número total; aqui é a
--      abertura por etapa, que permite "estrutura está 20% acima do orçado".
--   3. A regra `resumo-diario-semaforo` em `automation_rules`, DESLIGADA,
--      como toda regra nova (a §7 do CLAUDE.md explica o porquê).
--
-- Mesmo desenho de `recebimentos`: RLS por papel, auditoria, soft delete,
-- grants sem TRUNCATE/REFERENCES/TRIGGER para authenticated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cronograma físico
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etapas_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 2 AND 120),
  -- Ordem de exibição (1 = primeira etapa). Empate desempata pelo nome.
  ordem INTEGER NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  -- Peso da etapa no avanço total (padrão 1). Uma laje vale mais que a
  -- pintura; quem sabe disso é o gestor.
  peso NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (peso > 0),
  percentual_concluido NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (percentual_concluido >= 0 AND percentual_concluido <= 100),
  -- Elo opcional com o plano de contas (a ETAPA da planilha do cliente).
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  data_prevista DATE,
  -- Quando a medição foi feita (não quando a linha mudou).
  medido_em DATE,
  observacoes TEXT,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'whatsapp')),
  criado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autorizado_id UUID REFERENCES autorizados(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE etapas_obra IS
  'Cronograma físico: etapas da obra com % concluído (medição). Avanço da obra = média ponderada pelo peso.';
COMMENT ON COLUMN etapas_obra.percentual_concluido IS
  '0–100. Atualizado pelo painel ou pelo WhatsApp ("laje 100%") depois do SIM.';

-- Nome único por obra entre etapas vivas, sem diferenciar maiúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_etapas_obra_nome_viva
  ON etapas_obra (obra_id, lower(btrim(nome))) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_etapas_obra_vivas
  ON etapas_obra (obra_id, ordem, nome) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_etapas_obra_updated ON etapas_obra;
CREATE TRIGGER trg_etapas_obra_updated BEFORE UPDATE ON etapas_obra
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_etapas_obra ON etapas_obra;
CREATE TRIGGER trg_audit_etapas_obra AFTER INSERT OR UPDATE OR DELETE ON etapas_obra
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

ALTER TABLE etapas_obra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "etapas_obra_select" ON public.etapas_obra;
CREATE POLICY "etapas_obra_select" ON public.etapas_obra FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "etapas_obra_insert" ON public.etapas_obra;
CREATE POLICY "etapas_obra_insert" ON public.etapas_obra FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "etapas_obra_update" ON public.etapas_obra;
CREATE POLICY "etapas_obra_update" ON public.etapas_obra FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "etapas_obra_delete" ON public.etapas_obra;
CREATE POLICY "etapas_obra_delete" ON public.etapas_obra FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));

REVOKE ALL ON etapas_obra FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON etapas_obra TO authenticated;
GRANT ALL ON etapas_obra TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Orçamento por etapa (categoria)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orcamentos_etapa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE RESTRICT,
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  valor NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  observacoes TEXT,
  criado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE orcamentos_etapa IS
  'Quanto se planejou gastar em cada categoria (etapa) de uma obra. Realizado = pagamentos que contam da mesma categoria.';

-- Uma linha viva por (obra, categoria): o "salvar" é upsert.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_etapa_viva
  ON orcamentos_etapa (obra_id, categoria_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_orcamentos_etapa_updated ON orcamentos_etapa;
CREATE TRIGGER trg_orcamentos_etapa_updated BEFORE UPDATE ON orcamentos_etapa
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_orcamentos_etapa ON orcamentos_etapa;
CREATE TRIGGER trg_audit_orcamentos_etapa AFTER INSERT OR UPDATE OR DELETE ON orcamentos_etapa
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

ALTER TABLE orcamentos_etapa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orcamentos_etapa_select" ON public.orcamentos_etapa;
CREATE POLICY "orcamentos_etapa_select" ON public.orcamentos_etapa FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "orcamentos_etapa_insert" ON public.orcamentos_etapa;
CREATE POLICY "orcamentos_etapa_insert" ON public.orcamentos_etapa FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "orcamentos_etapa_update" ON public.orcamentos_etapa;
CREATE POLICY "orcamentos_etapa_update" ON public.orcamentos_etapa FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "orcamentos_etapa_delete" ON public.orcamentos_etapa;
CREATE POLICY "orcamentos_etapa_delete" ON public.orcamentos_etapa FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));

REVOKE ALL ON orcamentos_etapa FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON orcamentos_etapa TO authenticated;
GRANT ALL ON orcamentos_etapa TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Pendência de ação: o tipo novo `registrar_medicao`
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN confirmacoes_pendentes.acao IS
  'Para tipo acao: {"tipo":"criar_obra"|"cadastrar_fornecedor"|"definir_contrato"|"registrar_recebimento"|"arquivar_obra"|"registrar_medicao","dados":{…}}. Gravado pelo agente, executado no SIM.';

-- ----------------------------------------------------------------------------
-- 4. Regra do resumo diário, desligada
-- ----------------------------------------------------------------------------
INSERT INTO automation_rules (chave, ativo, config) VALUES
  ('resumo-diario-semaforo', false, '{"telefones": "", "enviar_quando_tudo_ok": false}'::jsonb)
ON CONFLICT (chave) DO NOTHING;
