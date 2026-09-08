-- Fase QA hardening (audit BUG-04): RMW race em webhooks_outbound.total_execucoes
--
-- O padrão atual em dispatch-webhook.ts:logWebhookExecution faz:
--   1) SELECT total_execucoes
--   2) UPDATE ... total_execucoes = current + 1
--
-- Sob N webhooks disparados em paralelo (Promise.allSettled), 2+ leituras
-- concorrentes podem ler o mesmo valor e escrever a mesma soma → contador
-- fica sub-contado.
--
-- Esta RPC faz UPDATE atômico em uma expressão:
--   UPDATE ... SET total_execucoes = COALESCE(total_execucoes, 0) + 1, ...
-- eliminando a janela RMW inteira.

CREATE OR REPLACE FUNCTION increment_webhook_execution(
  p_webhook_id UUID,
  p_status INTEGER,
  p_erro TEXT
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE webhooks_outbound
  SET
    ultima_execucao_em = now(),
    ultima_execucao_status = p_status,
    ultima_execucao_erro = p_erro,
    total_execucoes = COALESCE(total_execucoes, 0) + 1
  WHERE id = p_webhook_id;
$$;

COMMENT ON FUNCTION increment_webhook_execution(UUID, INTEGER, TEXT) IS
  'Audit BUG-04: contador atômico pra evitar RMW race em Promise.allSettled paralelo.';

-- Grants — chamada só via service_role (dispatch-webhook.ts import server-only)
REVOKE ALL ON FUNCTION increment_webhook_execution(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_webhook_execution(UUID, INTEGER, TEXT) TO service_role;
