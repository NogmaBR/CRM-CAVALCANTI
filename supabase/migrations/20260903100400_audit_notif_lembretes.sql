CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('insert','update','delete')),
  diff JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_entidade ON audit_log(entidade, entidade_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);

CREATE TABLE notificacoes_email (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo TEXT NOT NULL,
  enviada_em TIMESTAMPTZ,
  erro TEXT,
  contexto JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lembretes_agendados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  alvo_id UUID,
  cron_expressao TEXT NOT NULL,
  ultima_execucao TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
