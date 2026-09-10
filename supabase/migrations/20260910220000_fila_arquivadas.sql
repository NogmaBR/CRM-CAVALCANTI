-- Leitura da dead-letter.
--
-- O `pgmq.archive` move a mensagem para `pgmq.a_<fila>`. Sem uma forma de ler
-- essas tabelas, arquivar seria só um jeito mais educado de perder — a
-- mensagem sai do caminho e ninguém nunca mais a vê.
--
-- É a metade que faltava do que o painel do BullMQ dá pronto: `fila_metricas`
-- diz quanto tem na fila; esta diz **o que desistiu**, que é a pergunta que
-- alguém faz quando algo não aconteceu.

CREATE OR REPLACE FUNCTION fila_arquivadas(p_limite INTEGER DEFAULT 50)
RETURNS TABLE (
  fila TEXT,
  msg_id BIGINT,
  tentativas INTEGER,
  enfileirado_em TIMESTAMPTZ,
  arquivado_em TIMESTAMPTZ,
  payload JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_fila TEXT;
  v_sql  TEXT := '';
BEGIN
  -- SQL dinâmico sobre a lista de filas em vez de um UNION escrito à mão:
  -- assim, acrescentar fila na whitelist basta, e não há como esquecer de
  -- incluí-la aqui — que seria uma dead-letter invisível, o pior dos casos.
  --
  -- `format` com %I trata o nome como identificador; a lista de origem é
  -- `pgmq.list_queues()` filtrada pela whitelist, então não há entrada de
  -- usuário em lugar nenhum desta construção.
  FOR v_fila IN
    SELECT q.queue_name FROM pgmq.list_queues() q
    WHERE fila_valida(q.queue_name)
    ORDER BY q.queue_name
  LOOP
    IF v_sql <> '' THEN
      v_sql := v_sql || ' UNION ALL ';
    END IF;
    v_sql := v_sql || format(
      'SELECT %L::text, a.msg_id, a.read_ct, a.enqueued_at, a.archived_at, a.message FROM pgmq.%I a',
      v_fila, 'a_' || v_fila
    );
  END LOOP;

  IF v_sql = '' THEN
    RETURN;
  END IF;

  RETURN QUERY EXECUTE
    v_sql || format(' ORDER BY 5 DESC LIMIT %s', p_limite::int);
END;
$$;

REVOKE ALL ON FUNCTION fila_arquivadas(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fila_arquivadas(INTEGER) TO service_role;

COMMENT ON FUNCTION fila_arquivadas(INTEGER) IS
  'Mensagens que desistiram, de todas as filas, mais recentes primeiro.';
