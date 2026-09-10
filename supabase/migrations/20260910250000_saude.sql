-- Saúde do lado do banco.
--
-- ## O problema que isto resolve
--
-- O sistema tem quatro relógios que podem parar **sem barulho nenhum**:
--
--   pg_cron        job desativado, ou erro no pg_net — a fila deixa de ser drenada
--   automações     regra falha e vira linha num log que ninguém abre
--   fila pgmq      mensagem arquivada na dead-letter sem ninguém olhar
--   indexação      chave expirada — a busca simplesmente deixa de achar
--
-- Nenhum deles derruba o site. O sintoma é ausência: algo que deveria acontecer
-- não acontece, e a descoberta vem semanas depois, pelo cliente.
--
-- ## Por que aqui, e não só no TypeScript
--
-- As três primeiras checagens são sobre estado que só o banco conhece —
-- `cron.job_run_details` nem é exposto pela API. Deixar isto em SQL também
-- permite que o próprio `pg_cron` chame a verificação, fechando o ciclo: o
-- relógio que verifica os relógios.
--
-- O que o banco NÃO sabe é se as variáveis de ambiente estão configuradas.
-- Essa metade fica na rota.

CREATE OR REPLACE FUNCTION saude_sistema()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, cron, pgmq
AS $$
DECLARE
  v_problemas TEXT[] := '{}';
  v_avisos    TEXT[] := '{}';
  v_r         RECORD;
BEGIN
  -- -------------------------------------------------------------------------
  -- 1. Os agendamentos estão vivos?
  -- -------------------------------------------------------------------------
  -- "Ativo" não basta: um job pode estar marcado ativo e não rodar há dias
  -- porque o pg_cron parou. Só a última execução prova que o relógio anda.
  --
  -- A tolerância é 3x o intervalo esperado: um atraso de um ciclo é normal,
  -- três seguidos não são.
  FOR v_r IN
    SELECT j.jobname,
           j.active,
           j.schedule,
           (SELECT max(d.start_time) FROM cron.job_run_details d WHERE d.jobid = j.jobid) AS ultima
    FROM cron.job j
  LOOP
    IF NOT v_r.active THEN
      v_problemas := v_problemas || format('cron "%s" está DESATIVADO', v_r.jobname);
    ELSIF v_r.ultima IS NULL THEN
      v_avisos := v_avisos || format('cron "%s" nunca rodou', v_r.jobname);
    ELSIF v_r.schedule = '* * * * *' AND v_r.ultima < now() - interval '5 minutes' THEN
      v_problemas := v_problemas || format(
        'cron "%s" (a cada minuto) não roda há %s',
        v_r.jobname, age(now(), v_r.ultima)
      );
    ELSIF v_r.schedule <> '* * * * *' AND v_r.ultima < now() - interval '3 hours' THEN
      v_problemas := v_problemas || format(
        'cron "%s" não roda há %s', v_r.jobname, age(now(), v_r.ultima)
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM cron.job) THEN
    v_problemas := v_problemas || 'nenhum cron agendado';
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. Alguma fila entupida?
  -- -------------------------------------------------------------------------
  -- Fila cheia é volume; fila com mensagem PARADA é consumidor que não roda.
  -- São coisas diferentes e só a segunda é problema.
  FOR v_r IN SELECT * FROM fila_metricas() WHERE mais_antiga_seg > 900
  LOOP
    v_problemas := v_problemas || format(
      'fila "%s" com mensagem parada há %s min', v_r.fila, (v_r.mais_antiga_seg / 60)
    );
  END LOOP;

  -- -------------------------------------------------------------------------
  -- 3. Alguma mensagem desistiu?
  -- -------------------------------------------------------------------------
  -- Dead-letter é sempre digna de nota: significa que algo falhou três vezes.
  SELECT count(*) INTO v_r FROM fila_arquivadas(100);
  IF v_r.count > 0 THEN
    v_avisos := v_avisos || format('%s mensagem(ns) na dead-letter', v_r.count);
  END IF;

  -- -------------------------------------------------------------------------
  -- 4. Automação falhando?
  -- -------------------------------------------------------------------------
  SELECT count(*) INTO v_r
  FROM automation_executions
  WHERE status = 'falha' AND created_at > now() - interval '24 hours';

  IF v_r.count > 0 THEN
    v_problemas := v_problemas || format('%s falha(s) de automação nas últimas 24h', v_r.count);
  END IF;

  -- -------------------------------------------------------------------------
  -- 5. Base de conhecimento indexada?
  -- -------------------------------------------------------------------------
  -- Aviso e não problema: sem chave de embedding isto é o estado esperado, e
  -- transformar o esperado em alarme treina todo mundo a ignorar alarme.
  SELECT count(*) FILTER (WHERE indexado_em IS NULL) AS pendentes
    INTO v_r
  FROM knowledge_documents WHERE deleted_at IS NULL;

  IF v_r.pendentes > 0 THEN
    v_avisos := v_avisos || format('%s documento(s) sem embedding', v_r.pendentes);
  END IF;

  RETURN jsonb_build_object(
    'ok', cardinality(v_problemas) = 0,
    'problemas', to_jsonb(v_problemas),
    'avisos', to_jsonb(v_avisos),
    'verificado_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION saude_sistema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION saude_sistema() TO service_role;

COMMENT ON FUNCTION saude_sistema() IS
  'Checagem funda do lado do banco: crons vivos, filas fluindo, automações sem falha.';

-- ---------------------------------------------------------------------------
-- O relógio que vigia os relógios
-- ---------------------------------------------------------------------------
-- Roda uma vez por dia e, se houver problema, **enfileira um WhatsApp para o
-- gestor** — usando a fila `whatsapp_outbound` que já existe.
--
-- Por que WhatsApp e não e-mail: o cliente vive no WhatsApp, é a premissa do
-- produto inteiro. Um alerta por e-mail chegaria na mesma caixa que ninguém
-- abre — seria alarme com a aparência de diligência.
--
-- Enfileira em vez de enviar direto: o envio precisa de credencial e de
-- retentativa, e as duas coisas a fila já resolve. Se o WhatsApp estiver fora,
-- o alerta espera em vez de sumir.
CREATE OR REPLACE FUNCTION alertar_se_doente()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saude     JSONB;
  v_problemas TEXT;
  v_telefone  TEXT;
  v_texto     TEXT;
BEGIN
  v_saude := saude_sistema();

  IF (v_saude->>'ok')::boolean THEN
    RETURN 'saudável; nada enviado';
  END IF;

  -- Para quem avisar: o primeiro autorizado ativo. Sem ninguém cadastrado não
  -- há a quem avisar — e isso, por si, já é o problema mais urgente.
  SELECT telefone_whats INTO v_telefone
  FROM autorizados
  WHERE ativo AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1;

  IF v_telefone IS NULL THEN
    RETURN 'doente, mas não há autorizado ativo para avisar';
  END IF;

  SELECT string_agg('- ' || valor, E'\n')
    INTO v_problemas
  FROM jsonb_array_elements_text(v_saude->'problemas') AS t(valor);

  v_texto := 'Aviso do CRM: algo parou de funcionar.' || E'\n\n' || v_problemas ||
             E'\n\n' || 'Confira em /config/filas e /config/automacoes.';

  PERFORM fila_enfileirar(
    'whatsapp_outbound',
    jsonb_build_object('telefone', v_telefone, 'texto', v_texto, 'origem', 'erro')
  );

  RETURN 'alerta enfileirado';
END;
$$;

REVOKE ALL ON FUNCTION alertar_se_doente() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alertar_se_doente() TO service_role;

-- 9h da manhã em São Paulo (12h UTC): o gestor está acordado e ainda dá tempo
-- de agir no mesmo dia. Alerta que chega de madrugada é alerta que se perde.
SELECT cron.unschedule('saude-alerta')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'saude-alerta');

SELECT cron.schedule(
  'saude-alerta',
  '0 12 * * *',
  $cron$ SELECT alertar_se_doente(); $cron$
);
