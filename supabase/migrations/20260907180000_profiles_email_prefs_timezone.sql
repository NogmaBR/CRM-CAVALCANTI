-- Fase 14: preferências de usuário
--
-- 1) email_prefs JSONB — opt-in/opt-out por tipo de notificação
--    Default: todos ativos (usuário recebe até desativar explicitamente).
--    Schema esperado:
--    {
--      "pagamentos_aguardando": bool,  // Fase 10 template pagamento
--      "pendencias_novas": bool,        // Fase 10 template pendência WhatsApp
--      "digest_semanal": bool           // Fase 14.x — cron semanal futuro
--    }
--
-- 2) timezone TEXT — IANA timezone name (ex: 'America/Sao_Paulo')
--    Usado em server-side date formatting (emails, PDFs) pra respeitar
--    fuso do usuário. Client-side continua usando browser locale.
--
-- Rollback trivial: DROP COLUMN.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_prefs JSONB NOT NULL DEFAULT '{
    "pagamentos_aguardando": true,
    "pendencias_novas": true,
    "digest_semanal": false
  }'::jsonb;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- Constraint defensivo: timezone precisa ser não-vazio (defensive; UI valida antes)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_timezone_not_empty;
ALTER TABLE profiles ADD CONSTRAINT profiles_timezone_not_empty
  CHECK (char_length(timezone) > 0);
