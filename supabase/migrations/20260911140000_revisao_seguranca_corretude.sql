-- ============================================================================
-- Revisão geral de 2026-09-11: o que é banco
-- ============================================================================
--
-- Três revisores independentes (segurança, corretude, qualidade) leram o
-- repositório inteiro depois do merge das Fases 1–5. Isto é a parte dos
-- achados que se corrige em SQL. A parte em TypeScript vai no mesmo PR.
--
-- Cada bloco diz o achado, o cenário e a correção. Tudo idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ALTO — usuário arquivado continuava com o papel inteiro
-- ---------------------------------------------------------------------------
-- `archiveUsuarioAdmin` só marcava `profiles.deleted_at`. `has_role()`, que é a
-- base de TODA policy de RLS, ignorava a coluna: um admin arquivado seguia
-- admin. E a policy de auto-edição do perfil pinava `papel` mas não
-- `deleted_at` — o próprio usuário podia se desarquivar pela API.
--
-- Aqui: has_role exige deleted_at IS NULL; a WITH CHECK pina deleted_at.
-- O banimento no Auth fica no TypeScript (usuarios.ts).
CREATE OR REPLACE FUNCTION has_role(roles papel_usuario[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND papel = ANY(roles)
      AND deleted_at IS NULL
  );
$$;

DROP POLICY IF EXISTS profiles_self_update ON profiles;
CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND papel = (SELECT p.papel FROM profiles p WHERE p.user_id = auth.uid())
    AND deleted_at IS NOT DISTINCT FROM (SELECT p.deleted_at FROM profiles p WHERE p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. MÉDIO — qualquer sessão admin/gestor/financeiro podia sobrescrever
--    qualquer arquivo do bucket `documents` direto pelo Storage
-- ---------------------------------------------------------------------------
-- O app nunca grava no Storage com sessão de usuário: `lib/storage/documents.ts`
-- usa service_role, que ignora RLS. As policies de escrita por papel não
-- serviam a nenhum caminho do produto — só permitiam trocar a nota fiscal de
-- um pagamento por outro arquivo, pulando magic bytes e hash. Fora.
DROP POLICY IF EXISTS documents_role_insert ON storage.objects;
DROP POLICY IF EXISTS documents_role_update ON storage.objects;
DROP POLICY IF EXISTS documents_role_delete ON storage.objects;

-- ---------------------------------------------------------------------------
-- 3. BAIXO — `anon` tinha SELECT em toda tabela atual e futura do public
-- ---------------------------------------------------------------------------
-- Seguro hoje só porque todas as 24 tabelas têm RLS. Uma CREATE TABLE sem RLS
-- no futuro ficaria legível para o mundo com a chave anon. O app nunca lê
-- dado como anon (a planilha pública usa service_role no servidor).
-- ALL, e não só SELECT: o ensaio mostrou que o `anon` também herdava TRUNCATE,
-- REFERENCES e TRIGGER como privilégio padrão em tabelas futuras — e TRUNCATE
-- não passa pela RLS.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- ---------------------------------------------------------------------------
-- 4. ALTO — retry do provider durante o processamento abria DUAS pendências
-- ---------------------------------------------------------------------------
-- A checagem de duplicidade é um SELECT antes de uma janela que inclui
-- download, transcrição e IA. Dois retries na janela passam; o perdedor cai
-- no 23505 de `mensagens_whats`, mas seguia classificando de novo e abria
-- uma segunda `confirmacoes_pendentes` para a mesma mensagem. O "SIM"
-- resolvia a segunda e a primeira ficava aberta para sempre.
--
-- Trava no banco: no máximo UMA pendência aberta por mensagem. O TypeScript
-- trata o 23505 como "já existe" e não manda a pergunta duas vezes.
--
-- Antes do índice, as duplicatas que o bug JÁ produziu (em produção havia uma,
-- da mensagem de teste de 07/09): fica aberta a mais recente — é a que o
-- fluxo do "SIM" resolveria — e as anteriores são encerradas como expiradas.
UPDATE confirmacoes_pendentes c
SET resolvida = true,
    resolvida_via = 'expiracao',
    resultado = 'expirada',
    respondida_em = now(),
    resposta_bruta = coalesce(resposta_bruta, '[duplicada encerrada pela migration 20260911140000]')
WHERE c.resolvida = false
  AND EXISTS (
    SELECT 1 FROM confirmacoes_pendentes m
    WHERE m.mensagem_id = c.mensagem_id
      AND m.resolvida = false
      AND m.created_at > c.created_at
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_confirmacoes_uma_aberta_por_mensagem
  ON confirmacoes_pendentes (mensagem_id)
  WHERE resolvida = false;

-- ---------------------------------------------------------------------------
-- 5. MÉDIO — comandos e perguntas ao assistente respondiam duas vezes
-- ---------------------------------------------------------------------------
-- Nenhum dos dois persiste nada, então a dedupe por `msg_id_uazapi` nunca os
-- via. Um retry do provider durante os 4 turnos do assistente mandava uma
-- segunda resposta (possivelmente diferente). Esta tabela registra o id do
-- provider ANTES de executar; o segundo INSERT dá 23505 e a mensagem é
-- tratada como duplicada. Só service_role toca nela.
CREATE TABLE IF NOT EXISTS whatsapp_respostas (
  msg_id_uazapi TEXT PRIMARY KEY,
  acao          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE whatsapp_respostas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON whatsapp_respostas FROM anon, authenticated;
COMMENT ON TABLE whatsapp_respostas IS
  'Dedupe de comandos e perguntas do WhatsApp (que não viram mensagens_whats). Purgada pelo sweep após 7 dias.';

-- ---------------------------------------------------------------------------
-- 6. BAIXO — trechos duplicados se a marcação falhasse depois do insert
-- ---------------------------------------------------------------------------
-- O indexador passa a apagar os trechos do documento antes de reinserir; o
-- índice único é a rede de segurança.
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_chunks_documento_ordem
  ON knowledge_chunks (documento_id, ordem);

-- ---------------------------------------------------------------------------
-- 7. MÉDIO — cobrança varria 100 pagamentos mais antigos e filtrava em JS
-- ---------------------------------------------------------------------------
-- Quando os 100 mais antigos já tinham documento, o filtro devolvia vazio e
-- os mais novos nunca eram alcançados. O filtro "sem documento vivo" passa
-- para o banco, com limite depois do filtro.
CREATE OR REPLACE FUNCTION pagamentos_sem_documento(p_corte DATE, p_limite INTEGER)
RETURNS TABLE (id UUID, valor NUMERIC, data_pagamento DATE, fornecedor_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.valor, p.data_pagamento, p.fornecedor_id
  FROM pagamentos p
  WHERE p.deleted_at IS NULL
    AND p.status_pagto IN ('confirmado', 'aguardando')
    AND p.fornecedor_id IS NOT NULL
    AND p.data_pagamento <= p_corte
    AND NOT EXISTS (
      SELECT 1 FROM documentos d
      WHERE d.pagamento_id = p.id AND d.deleted_at IS NULL
    )
  ORDER BY p.data_pagamento ASC
  LIMIT greatest(1, least(p_limite, 500));
$$;
REVOKE ALL ON FUNCTION pagamentos_sem_documento(DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pagamentos_sem_documento(DATE, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 8. MÉDIO — saúde: cron que roda e FALHA parecia saudável
-- ---------------------------------------------------------------------------
-- `max(start_time)` não filtrava por status. Um job falhando a cada minuto tem
-- start_time sempre fresco. Agora a última execução considerada é a última
-- que SUCEDEU, e a última linha em `failed` vira problema por si.
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
  FOR v_r IN
    SELECT j.jobname,
           j.active,
           j.schedule,
           cron_tolerancia(j.schedule) AS tolerancia,
           (SELECT max(d.start_time) FROM cron.job_run_details d
             WHERE d.jobid = j.jobid AND d.status = 'succeeded') AS ultima_ok,
           (SELECT d.status FROM cron.job_run_details d
             WHERE d.jobid = j.jobid ORDER BY d.start_time DESC LIMIT 1) AS ultimo_status,
           (SELECT left(d.return_message, 120) FROM cron.job_run_details d
             WHERE d.jobid = j.jobid ORDER BY d.start_time DESC LIMIT 1) AS ultima_msg
    FROM cron.job j
  LOOP
    IF NOT v_r.active THEN
      v_problemas := v_problemas || format('cron "%s" está DESATIVADO', v_r.jobname);
    ELSIF v_r.ultimo_status = 'failed' THEN
      v_problemas := v_problemas || format(
        'cron "%s" falhou na última execução: %s', v_r.jobname, coalesce(v_r.ultima_msg, '?')
      );
    ELSIF v_r.ultima_ok IS NULL THEN
      v_avisos := v_avisos || format('cron "%s" nunca rodou com sucesso', v_r.jobname);
    ELSIF v_r.ultima_ok < now() - v_r.tolerancia THEN
      v_problemas := v_problemas || format(
        'cron "%s" (%s) sem sucesso há %s; tolerância %s',
        v_r.jobname, v_r.schedule, age(now(), v_r.ultima_ok), v_r.tolerancia
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM cron.job) THEN
    v_problemas := v_problemas || 'nenhum cron agendado';
  END IF;

  FOR v_r IN SELECT * FROM fila_metricas() WHERE mais_antiga_seg > 900
  LOOP
    v_problemas := v_problemas || format(
      'fila "%s" com mensagem parada há %s min', v_r.fila, (v_r.mais_antiga_seg / 60)
    );
  END LOOP;

  SELECT count(*) INTO v_r FROM fila_arquivadas(100);
  IF v_r.count > 0 THEN
    v_avisos := v_avisos || format('%s mensagem(ns) na dead-letter', v_r.count);
  END IF;

  SELECT count(*) INTO v_r
  FROM automation_executions
  WHERE status = 'falha' AND created_at > now() - interval '24 hours';
  IF v_r.count > 0 THEN
    v_problemas := v_problemas || format('%s falha(s) de automação nas últimas 24h', v_r.count);
  END IF;

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

-- ---------------------------------------------------------------------------
-- 9. MÉDIO — alerta enfileirava o telefone sem normalizar
-- ---------------------------------------------------------------------------
-- "(51) 99999-8888" ia inteiro para o provider, que espera só dígitos. Agora
-- normaliza e recusa número curto (< 10 dígitos), que é o cheiro dos
-- telefones-placeholder do protótipo.
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

  SELECT regexp_replace(telefone_whats, '\D', '', 'g') INTO v_telefone
  FROM autorizados
  WHERE ativo AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1;

  IF v_telefone IS NULL OR length(v_telefone) < 10 THEN
    RETURN 'doente, mas não há autorizado ativo com telefone válido para avisar';
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

-- ---------------------------------------------------------------------------
-- 10. BAIXO — pg_net desistia da chamada ao consumidor em 5 s
-- ---------------------------------------------------------------------------
-- Um lote com transcrição de áudio leva mais que isso. A função da Vercel
-- continua rodando depois que o cliente desconecta (não verificado até o
-- fim), mas não há motivo para o pg_net cortar cedo: 60 s cobre o pior lote.
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

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN 'vault sem fila_consumidor_url/secret; rode scripts/provisionar-vault.mjs';
  END IF;

  PERFORM net.http_get(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  );

  RETURN format('%s job(s) na fila; consumidor chamado', v_total);
END;
$$;
