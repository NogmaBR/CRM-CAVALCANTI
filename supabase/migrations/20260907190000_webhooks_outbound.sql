-- Fase n8n: outbound webhooks pra integração externa.
--
-- Cada endpoint configurado recebe POST HMAC-signed em eventos específicos.
-- Consumers típicos: n8n workflows, Zapier, Make.com, Slack apps.
--
-- Auto-generated no INSERT: secret pseudo-random 64 chars hex.
-- Admin-only via RLS.

CREATE TABLE webhooks_outbound (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  eventos TEXT[] NOT NULL DEFAULT '{}',
    -- Suporta: pagamento_created, confirmacao_pendente_created,
    --          documento_created, obra_created, obra_archived
  secret TEXT NOT NULL,
    -- HMAC key gerada no create; usada pra assinar payloads em X-Nogma-Signature
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_execucao_em TIMESTAMPTZ,
  ultima_execucao_status INTEGER,
    -- HTTP status code do último POST
  ultima_execucao_erro TEXT,
  total_execucoes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  criado_por_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_webhooks_eventos_gin ON webhooks_outbound USING GIN(eventos)
  WHERE ativo = true AND deleted_at IS NULL;

CREATE TRIGGER trg_webhooks_updated BEFORE UPDATE ON webhooks_outbound
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: admin ALL. Nenhum outro papel.
ALTER TABLE webhooks_outbound ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhooks_admin_all ON webhooks_outbound
  FOR ALL
  TO authenticated
  USING (has_role(ARRAY['admin']::papel_usuario[]))
  WITH CHECK (has_role(ARRAY['admin']::papel_usuario[]));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON webhooks_outbound TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON webhooks_outbound TO service_role;

-- Trigger de auditoria (Fase 11 pattern)
CREATE TRIGGER trg_audit_webhooks_outbound
  AFTER INSERT OR UPDATE OR DELETE ON webhooks_outbound
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
