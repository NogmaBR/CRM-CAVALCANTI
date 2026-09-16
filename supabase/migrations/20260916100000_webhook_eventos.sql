-- ============================================================================
-- Diagnóstico do WhatsApp: rastro de cada chamada ao webhook
-- ============================================================================
-- Até aqui, saber o que o UAZAPI mandou exigia ler o log da Vercel — inclusive
-- para descobrir o id do grupo (`…@g.us`) que precisa ser cadastrado. Esta
-- tabela guarda uma linha por evento recebido (autenticado), com o que
-- importa para diagnosticar e nada de conteúdo: nem texto, nem mídia.
--
-- Só admin lê (é a tela /config/whatsapp). Quem escreve é o webhook, com
-- service_role. Sete dias de retenção, purgados pelo cron diário
-- (`/api/cron/sweep-pending-documentos`, que já faz a higiene do rate limit).
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Como a request provou a origem: 'hmac' ou 'token'.
  autenticacao TEXT NOT NULL,
  -- Evento do provider (messages, connection…) ou 'canonico' para as fixtures.
  evento TEXT,
  -- JID do chat (grupo ou privado), remetente, tipo da mensagem.
  chat_id TEXT,
  remetente TEXT,
  is_group BOOLEAN,
  tipo TEXT,
  msg_id TEXT,
  -- O que o CRM fez: evento_ignorado, payload_rejeitado, ignorada_nao_autorizada,
  -- ignorada_grupo_nao_autorizado, pendencia_criada, arquivado, registrado…
  acao TEXT NOT NULL,
  detalhe TEXT
);

CREATE INDEX IF NOT EXISTS webhook_eventos_recebido_em_idx ON webhook_eventos (recebido_em DESC);

ALTER TABLE webhook_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_eventos_select ON webhook_eventos;
CREATE POLICY webhook_eventos_select ON webhook_eventos FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));

-- Escrita só por service_role (o webhook). Sem policy de INSERT/UPDATE/DELETE
-- para authenticated: a sessão de usuário nunca escreve aqui.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON webhook_eventos FROM authenticated;
GRANT SELECT ON webhook_eventos TO authenticated;
GRANT ALL ON webhook_eventos TO service_role;
