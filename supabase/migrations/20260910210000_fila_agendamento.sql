-- O agendador: quem acorda o consumidor.
--
-- Sem processo vivo, alguém precisa chamar `/api/queue/consume` de tempos em
-- tempos. Esse alguém é o `pg_cron`, e quem faz a chamada é o `pg_net`.
--
-- ## Só chama quando há trabalho
--
-- O jeito óbvio seria agendar a rota de minuto em minuto e pronto. Isso custa
-- 43 mil invocações de função por mês para, na esmagadora maioria das vezes,
-- descobrir que a fila está vazia.
--
-- Então a decisão é tomada **dentro do banco**: o agendador soma as filas e só
-- dispara HTTP se houver algo. Fila vazia custa um `SELECT` sobre quatro
-- tabelas pequenas, e nenhuma invocação.
--
-- ## O segredo não está aqui
--
-- Este arquivo é versionado num repositório **público**. A URL e o
-- `CRON_SECRET` vêm do Vault do Supabase, provisionados fora do Git por
-- `scripts/provisionar-vault.mjs`.
--
-- Enquanto não estiverem lá, o agendador roda e não faz nada — devolve o
-- motivo em texto, em vez de estourar erro de minuto em minuto no log.

CREATE OR REPLACE FUNCTION fila_acordar_consumidor()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  v_total  BIGINT;
  v_url    TEXT;
  v_secret TEXT;
BEGIN
  SELECT coalesce(sum(na_fila), 0) INTO v_total FROM fila_metricas();

  IF v_total = 0 THEN
    RETURN 'fila vazia; nada chamado';
  END IF;

  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'fila_consumidor_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'fila_consumidor_secret';

  -- Falha fechada e silenciosa: sem credencial, não chama. Voltar um texto em
  -- vez de levantar exceção é deliberado — este código roda a cada minuto, e
  -- um erro por minuto no log é ruído que esconde o erro de verdade quando
  -- ele aparecer.
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN 'vault sem fila_consumidor_url/secret; rode scripts/provisionar-vault.mjs';
  END IF;

  PERFORM net.http_get(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 5000
  );

  RETURN format('%s job(s) na fila; consumidor chamado', v_total);
END;
$$;

REVOKE ALL ON FUNCTION fila_acordar_consumidor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fila_acordar_consumidor() TO service_role;

COMMENT ON FUNCTION fila_acordar_consumidor() IS
  'Chamado pelo pg_cron. Só dispara HTTP se houver job na fila.';

-- ---------------------------------------------------------------------------
-- O agendamento
-- ---------------------------------------------------------------------------
-- De minuto em minuto. Enquanto nada enfileirar — e nada enfileira até
-- `FILA_WHATSAPP=true` — isto é um SELECT que devolve "fila vazia".
--
-- `cron.unschedule` antes: reaplicar a migration não pode criar um segundo job
-- com o mesmo propósito, e `cron.schedule` com nome repetido atualiza, mas o
-- unschedule explícito deixa o efeito óbvio para quem lê.
SELECT cron.unschedule('fila-consumidor')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fila-consumidor');

SELECT cron.schedule(
  'fila-consumidor',
  '* * * * *',
  $cron$ SELECT fila_acordar_consumidor(); $cron$
);
