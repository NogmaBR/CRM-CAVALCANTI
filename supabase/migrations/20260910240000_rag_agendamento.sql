-- Agendamento da indexação.
--
-- ## Por que aqui e não no `vercel.json`
--
-- O projeto já tem dois crons registrados na Vercel, e o plano Hobby permite
-- dois. Um terceiro faria o deploy recusar — um erro que só apareceria na hora
-- de subir, depois de tudo pronto.
--
-- Como o `pg_cron` e o `pg_net` já estão instalados e já acordam o consumidor
-- de filas, agendar daqui não custa infraestrutura nenhuma e não consome a
-- cota da Vercel. É o mesmo mecanismo, com um alvo diferente.
--
-- ## De hora em hora, e não de minuto em minuto
--
-- Indexar só importa quando um pagamento muda. De hora em hora é folgado o
-- bastante para o gestor não notar atraso e econômico o bastante para não
-- gastar chamada de embedding à toa — o hash já garante que nada é reindexado
-- sem ter mudado, mas a própria varredura custa uma requisição.
--
-- Minuto 7 de propósito: no minuto 0 concorre com todo cron do mundo.

CREATE OR REPLACE FUNCTION indexar_conhecimento_agendado()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  v_base   TEXT;
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_base
    FROM vault.decrypted_secrets WHERE name = 'app_base_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'fila_consumidor_secret';

  -- Mesma decisão do agendador de filas: falha fechada e silenciosa. Um erro
  -- por hora no log é ruído que esconde o erro de verdade.
  IF v_base IS NULL OR v_secret IS NULL THEN
    RETURN 'vault sem app_base_url/fila_consumidor_secret; rode scripts/provisionar-vault.mjs';
  END IF;

  PERFORM net.http_get(
    url := v_base || '/api/cron/indexar',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    -- Mais folgado que o do consumidor: uma leva de embeddings pode levar
    -- alguns segundos, e o pg_net não espera a resposta para liberar a
    -- conexão — mas o timeout curto abortaria a requisição no meio.
    timeout_milliseconds := 20000
  );

  RETURN 'indexação chamada';
END;
$$;

REVOKE ALL ON FUNCTION indexar_conhecimento_agendado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION indexar_conhecimento_agendado() TO service_role;

COMMENT ON FUNCTION indexar_conhecimento_agendado() IS
  'Chamado pelo pg_cron de hora em hora. Sincroniza textos e gera embeddings pendentes.';

SELECT cron.unschedule('rag-indexar')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rag-indexar');

SELECT cron.schedule(
  'rag-indexar',
  '7 * * * *',
  $cron$ SELECT indexar_conhecimento_agendado(); $cron$
);
