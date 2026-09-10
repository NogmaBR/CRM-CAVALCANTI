-- Auditoria 2026-09-09 — finding M-3 (ausência total de rate limiting).
--
-- Login, /definir-senha, /api/exports/* e /api/webhooks/uazapi não tinham
-- nenhum limite de taxa: brute force de senha e scraping de export eram
-- limitados só pelo tempo de resposta do Vercel.
--
-- Optamos por contador no Postgres em vez de Upstash/Redis porque o projeto
-- não tem essa credencial e não faz sentido travar um fix de segurança em
-- contratação de fornecedor. O trade-off é honesto: fica um round-trip ao
-- banco por request limitada (~5ms no pooler) em troca de um contador
-- realmente global — memória de processo não serve, porque cada invocação
-- serverless do Vercel tem a sua e o atacante simplesmente cai em outra.

CREATE TABLE IF NOT EXISTS rate_limits (
  chave TEXT PRIMARY KEY,
  janela_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_janela ON rate_limits (janela_inicio);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- Sem policy: nenhuma sessão `authenticated`/`anon` lê ou escreve. Só o
-- service_role (que bypassa RLS) através da RPC abaixo.

/*
 * Incrementa e avalia o contador de uma chave numa única statement.
 *
 * O CASE duplicado existe porque a janela precisa ser avaliada e reescrita
 * no mesmo comando: se a janela anterior expirou, `janela_inicio` volta pra
 * now() e `hits` reinicia em 1; senão soma 1 na janela corrente. Fazer isso
 * em SELECT-depois-UPDATE abriria exatamente a race que o rate limit deveria
 * fechar (N requests simultâneas leem hits=4 e todas passam).
 *
 * `ON CONFLICT DO UPDATE` pega row lock, então requests concorrentes na mesma
 * chave serializam no banco.
 */
CREATE OR REPLACE FUNCTION rate_limit_hit(
  p_chave TEXT,
  p_janela_segundos INTEGER,
  p_max INTEGER
)
RETURNS TABLE (permitido BOOLEAN, hits INTEGER, reset_em TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_janela TIMESTAMPTZ;
  v_hits INTEGER;
BEGIN
  INSERT INTO rate_limits AS rl (chave, janela_inicio, hits)
  VALUES (p_chave, now(), 1)
  ON CONFLICT (chave) DO UPDATE
    SET janela_inicio = CASE
          WHEN rl.janela_inicio < now() - make_interval(secs => p_janela_segundos)
            THEN now()
          ELSE rl.janela_inicio
        END,
        hits = CASE
          WHEN rl.janela_inicio < now() - make_interval(secs => p_janela_segundos)
            THEN 1
          ELSE rl.hits + 1
        END
  RETURNING rl.janela_inicio, rl.hits INTO v_janela, v_hits;

  RETURN QUERY SELECT
    v_hits <= p_max,
    v_hits,
    v_janela + make_interval(secs => p_janela_segundos);
END;
$$;

/*
 * Zera o contador de uma chave — chamado após login bem-sucedido, pra que
 * um usuário legítimo que errou a senha 3x não continue penalizado depois
 * de acertar.
 */
CREATE OR REPLACE FUNCTION rate_limit_reset(p_chave TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limits WHERE chave = p_chave;
$$;

/* Housekeeping: chamado pelo cron de sweep pra tabela não crescer sem fim. */
CREATE OR REPLACE FUNCTION rate_limit_purge(p_idade_horas INTEGER DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removidos INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE janela_inicio < now() - make_interval(hours => p_idade_horas);
  GET DIAGNOSTICS v_removidos = ROW_COUNT;
  RETURN v_removidos;
END;
$$;

REVOKE ALL ON FUNCTION rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION rate_limit_reset(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rate_limit_purge(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION rate_limit_reset(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION rate_limit_purge(INTEGER) TO service_role;
