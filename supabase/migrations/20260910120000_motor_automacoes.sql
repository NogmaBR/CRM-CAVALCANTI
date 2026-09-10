-- Motor de automações — o "n8n de código" (Fase 2 do plano de arquitetura).
--
-- Substitui o workflow visual por regras versionadas em Git, testáveis e
-- revisáveis. A divisão entre o que é código e o que é dado é deliberada:
--
--   * A LÓGICA da regra (gatilho, condição, ação) mora em
--     `lib/automations/definitions/` — em código, com tipo e teste. Mudar
--     comportamento é um commit, com revisão e CI.
--
--   * O ESTADO da regra (ligada/desligada, parâmetros) mora aqui. Assim o
--     gestor liga, desliga e ajusta um prazo sem precisar de deploy — que é
--     a única coisa que o n8n dava e que perderíamos indo 100% pra código.
--
-- O log de execução é a peça que não pode faltar. Uma automação que roda
-- sozinha e não deixa rastro é impossível de depurar quando o cliente diz
-- "não recebi a cobrança" — e essa pergunta vai acontecer.

-- ---------------------------------------------------------------------------
-- Regras: só o que é configurável em runtime
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Casa com a chave da definition em código. Sem FK possível (o outro lado
  -- é um arquivo .ts), então o engine ignora chave órfã e registra aviso —
  -- é o caso de uma regra removida do código com a linha ainda no banco.
  chave TEXT UNIQUE NOT NULL,

  ativo BOOLEAN NOT NULL DEFAULT false,

  -- Parâmetros que o gestor pode ajustar sem deploy. O shape é validado por
  -- Zod na definition; aqui fica solto de propósito, porque cada regra tem o
  -- seu. Ex.: {"dias_sem_documento": 7}
  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_automation_rules_updated ON automation_rules;
CREATE TRIGGER trg_automation_rules_updated
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE automation_rules IS
  'Liga/desliga e parametriza automações. A lógica vive em lib/automations/definitions.';

-- ---------------------------------------------------------------------------
-- Execuções: o rastro
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  regra_chave TEXT NOT NULL,
  evento TEXT NOT NULL,

  -- 'sucesso'  — a ação rodou
  -- 'pulada'   — a condição disse não (o caso mais comum, e precisa aparecer:
  --              "por que não cobrou?" quase sempre se responde aqui)
  -- 'falha'    — a ação levantou erro
  -- 'simulada' — dry-run, não tocou em nada de verdade
  status TEXT NOT NULL CHECK (status IN ('sucesso', 'pulada', 'falha', 'simulada')),

  -- Motivo legível. Em 'pulada', qual condição barrou. Em 'falha', o erro.
  motivo TEXT,

  -- Entidade afetada (pagamento, obra, mensagem...). Sem FK porque aponta
  -- para tabelas diferentes conforme a regra.
  entidade_id UUID,

  -- Payload do evento, para reproduzir a decisão depois. Nunca guarde
  -- credencial aqui: o payload de evento é montado no código e não deve
  -- conter secret.
  payload JSONB,

  duracao_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- A consulta real é "o que essa regra fez ultimamente" e "o que aconteceu
-- com essa entidade" — os dois índices cobrem as duas.
CREATE INDEX IF NOT EXISTS idx_execucoes_regra
  ON automation_executions (regra_chave, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_execucoes_entidade
  ON automation_executions (entidade_id, created_at DESC)
  WHERE entidade_id IS NOT NULL;

-- Só as falhas, para o painel de saúde não varrer a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_execucoes_falhas
  ON automation_executions (created_at DESC)
  WHERE status = 'falha';

COMMENT ON TABLE automation_executions IS
  'Log de toda execução de automação, inclusive as puladas. Rastro para depuração.';

-- ---------------------------------------------------------------------------
-- Idempotência
-- ---------------------------------------------------------------------------
-- Impede a mesma regra de agir duas vezes sobre a mesma entidade no mesmo dia.
-- O caso concreto: a cobrança de nota fiscal roda no cron diário; sem esta
-- trava, um cron que rode duas vezes (retry, deploy no meio) manda duas
-- mensagens para o mesmo fornecedor — e quem recebe não perdoa.
--
-- Só vale para execuções que de fato agiram: 'pulada' e 'falha' podem repetir.
CREATE UNIQUE INDEX IF NOT EXISTS idx_execucoes_idempotencia
  ON automation_executions (regra_chave, entidade_id, (created_at::date))
  WHERE status = 'sucesso' AND entidade_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- O engine roda com service_role (sem sessão), então estas policies governam
-- apenas quem lê e configura pelo painel.
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_rules_select ON automation_rules;
CREATE POLICY automation_rules_select ON automation_rules
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','gestor','financeiro','leitura']::papel_usuario[]));

-- Ligar e desligar automação mexe no que o cliente recebe. Restrito.
DROP POLICY IF EXISTS automation_rules_write ON automation_rules;
CREATE POLICY automation_rules_write ON automation_rules
  FOR ALL TO authenticated
  USING (has_role(ARRAY['admin','gestor']::papel_usuario[]))
  WITH CHECK (has_role(ARRAY['admin','gestor']::papel_usuario[]));

DROP POLICY IF EXISTS automation_executions_select ON automation_executions;
CREATE POLICY automation_executions_select ON automation_executions
  FOR SELECT TO authenticated
  USING (has_role(ARRAY['admin','gestor','financeiro']::papel_usuario[]));

-- Ninguém escreve o log pela sessão: quem escreve é o engine, via service_role.

-- ---------------------------------------------------------------------------
-- Retenção
-- ---------------------------------------------------------------------------
-- O log cresce a cada evento. Sem poda vira a maior tabela do banco em poucos
-- meses, sem que ninguém consulte execução de 90 dias atrás.
CREATE OR REPLACE FUNCTION purgar_automation_executions(p_dias INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removidos INTEGER;
BEGIN
  DELETE FROM automation_executions
  WHERE created_at < now() - make_interval(days => p_dias);
  GET DIAGNOSTICS v_removidos = ROW_COUNT;
  RETURN v_removidos;
END;
$$;

REVOKE ALL ON FUNCTION purgar_automation_executions(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purgar_automation_executions(INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- Seed: as regras que existem em codigo, todas DESLIGADAS
-- ---------------------------------------------------------------------------
-- A linha precisa existir para o gestor poder ligar; o `ativo = false` e o
-- que garante que um deploy nunca comeca a mandar mensagem sozinho.
--
-- ON CONFLICT DO NOTHING de proposito: reaplicar a migration nao pode
-- desligar uma regra que o gestor ja ligou.
INSERT INTO automation_rules (chave, ativo, config) VALUES
  ('cobrar-documento-fornecedor', false, '{"dias_sem_documento": 7, "limite_por_rodada": 25}'::jsonb),
  ('orcamento-em-risco',          false, '{"limiar_percentual": 80}'::jsonb)
ON CONFLICT (chave) DO NOTHING;
