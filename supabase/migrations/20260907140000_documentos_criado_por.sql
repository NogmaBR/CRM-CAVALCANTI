-- Fase 7.5 hardening: audit trail em documentos.
-- Adiciona `criado_por_user_id` matching pattern de pagamentos (Fase 6).
-- Nullable pra rows legadas + pra fluxo WhatsApp/webhook (Fase 8) onde
-- não há user autenticado.

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS criado_por_user_id UUID REFERENCES profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_documentos_criado_por ON documentos(criado_por_user_id)
  WHERE criado_por_user_id IS NOT NULL;
