-- ============================================================================
-- Saúde: tolerância de cada cron derivada da própria agenda dele
-- ============================================================================
--
-- O bug, visto em produção em 2026-09-11 às 23:48 UTC:
--
--   /api/health → 503: cron "saude-alerta" não roda há 11:47:48
--
-- O `saude-alerta` é DIÁRIO (`0 12 * * *`) e tinha rodado às 12:00, como devia.
-- A versão anterior de `saude_sistema()` só distinguia "a cada minuto" de
-- "qualquer outro", e para o "qualquer outro" usava 3 horas de tolerância. Um
-- job diário passa 21 horas por dia "doente" por essa régua.
--
-- Pior que o 503: no dia seguinte ao meio-dia o próprio `saude-alerta` leria
-- esse falso problema e enfileiraria um WhatsApp de alarme para o gestor. Um
-- alarme falso por dia treina todo mundo a ignorar alarme — que é exatamente
-- o que a Fase 5.1 existia para evitar.
--
-- A correção: a tolerância vem da agenda. Cada padrão de cron tem um período
-- esperado, e a tolerância é ~3x ele, com folga para atraso de um ciclo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Quanto tempo sem rodar é "parou", por agenda
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cron_tolerancia(p_schedule TEXT)
RETURNS INTERVAL
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_campos TEXT[];
BEGIN
  v_campos := regexp_split_to_array(btrim(p_schedule), '\s+');
  IF array_length(v_campos, 1) <> 5 THEN
    -- Sintaxe que não é cron de 5 campos (ex.: "30 seconds" do pg_cron).
    -- Sem como estimar, fica a régua antiga de 3 horas.
    RETURN interval '3 hours';
  END IF;

  -- a cada minuto: `* * * * *`
  IF v_campos[1] = '*' AND v_campos[2] = '*' THEN
    RETURN interval '5 minutes';
  END IF;

  -- a cada N minutos: `*/N * * * *`
  IF v_campos[1] LIKE '*/%' AND v_campos[2] = '*' THEN
    RETURN interval '30 minutes';
  END IF;

  -- de hora em hora: `M * * * *`
  IF v_campos[2] = '*' THEN
    RETURN interval '3 hours';
  END IF;

  -- diário: `M H * * *`
  IF v_campos[3] = '*' AND v_campos[4] = '*' AND v_campos[5] = '*' THEN
    RETURN interval '26 hours';
  END IF;

  -- semanal: `M H * * D`
  IF v_campos[3] = '*' AND v_campos[4] = '*' THEN
    RETURN interval '8 days';
  END IF;

  -- mensal ou mais raro
  RETURN interval '32 days';
END;
$$;

COMMENT ON FUNCTION cron_tolerancia(TEXT) IS
  'Quanto tempo um cron pode ficar sem rodar antes de saude_sistema() considerar que parou. Derivado da agenda.';

-- ---------------------------------------------------------------------------
-- saude_sistema(), com a régua certa
-- ---------------------------------------------------------------------------
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
  -- A tolerância vem da agenda de cada job (`cron_tolerancia`): 5 min para o
  -- de cada minuto, 3 h para o de hora em hora, 26 h para o diário.
  FOR v_r IN
    SELECT j.jobname,
           j.active,
           j.schedule,
           cron_tolerancia(j.schedule) AS tolerancia,
           (SELECT max(d.start_time) FROM cron.job_run_details d WHERE d.jobid = j.jobid) AS ultima
    FROM cron.job j
  LOOP
    IF NOT v_r.active THEN
      v_problemas := v_problemas || format('cron "%s" está DESATIVADO', v_r.jobname);
    ELSIF v_r.ultima IS NULL THEN
      v_avisos := v_avisos || format('cron "%s" nunca rodou', v_r.jobname);
    ELSIF v_r.ultima < now() - v_r.tolerancia THEN
      v_problemas := v_problemas || format(
        'cron "%s" (%s) não roda há %s; tolerância %s',
        v_r.jobname, v_r.schedule, age(now(), v_r.ultima), v_r.tolerancia
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
REVOKE ALL ON FUNCTION cron_tolerancia(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cron_tolerancia(TEXT) TO service_role;
