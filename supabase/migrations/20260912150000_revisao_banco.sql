-- ============================================================================
-- Revisão do banco — 2026-09-12
--
-- Feita com o inventário real de produção (pg_policies, pg_proc, advisors da
-- Supabase, pg_stat_statements, cron.job_run_details). Cada bloco diz o que
-- o inventário mostrou e o que muda. Nada aqui apaga dado de negócio.
--
-- 1. has_role(): STABLE (era VOLATILE) e sem EXECUTE para PUBLIC/anon.
-- 2. 58 policies reescritas com `(select auth.uid())` / `(select has_role())`:
--    o planner avalia uma vez por consulta em vez de uma vez por linha
--    (advisor auth_rls_initplan em 11 tabelas). `TO authenticated` no lugar
--    de `TO public`. profiles e automation_rules deixam de ter policies
--    permissivas sobrepostas (advisor multiple_permissive_policies).
-- 3. Privilégios de `authenticated` reduzidos ao que as policies permitem:
--    TRUNCATE/REFERENCES/TRIGGER saem de todas as tabelas (TRUNCATE não passa
--    pela RLS); tabelas só de leitura perdem INSERT/UPDATE/DELETE; rate_limits
--    e whatsapp_respostas ficam só com service_role.
-- 4. audit_log_trigger() aceita tabela cuja chave é `user_id` (profiles),
--    esconde `token` além de `secret`, e passa a auditar profiles,
--    automation_rules e obra_compartilhamentos — mudança de papel, regra
--    ligada/desligada e link público criado eram invisíveis.
-- 5. Manutenção agendada no pg_cron: cron.job_run_details (2.719 linhas em
--    2 dias, sem purga) e automation_executions (a função de purga existia e
--    nunca era chamada).
-- 6. supabase_migrations.schema_migrations: 21 migrations aplicadas pela
--    Management API não estavam registradas. Registradas agora, para um
--    `supabase db push` futuro não tentar reaplicá-las.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. has_role
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_role(roles papel_usuario[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND papel = ANY(roles)
      AND deleted_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION has_role(papel_usuario[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION has_role(papel_usuario[]) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Policies — initplan + TO authenticated
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select" ON public.ai_conversations FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));
DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_messages;
CREATE POLICY "ai_messages_select" ON public.ai_messages FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));
DROP POLICY IF EXISTS "ai_tool_calls_select" ON public.ai_tool_calls;
CREATE POLICY "ai_tool_calls_select" ON public.ai_tool_calls FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));
DROP POLICY IF EXISTS "audit_admin_gestor_select" ON public.audit_log;
CREATE POLICY "audit_admin_gestor_select" ON public.audit_log FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));
DROP POLICY IF EXISTS "automation_executions_select" ON public.automation_executions;
CREATE POLICY "automation_executions_select" ON public.automation_executions FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "autorizados_delete" ON public.autorizados;
CREATE POLICY "autorizados_delete" ON public.autorizados FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "autorizados_insert" ON public.autorizados;
CREATE POLICY "autorizados_insert" ON public.autorizados FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "autorizados_select" ON public.autorizados;
CREATE POLICY "autorizados_select" ON public.autorizados FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "autorizados_update" ON public.autorizados;
CREATE POLICY "autorizados_update" ON public.autorizados FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "categorias_delete" ON public.categorias;
CREATE POLICY "categorias_delete" ON public.categorias FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "categorias_insert" ON public.categorias;
CREATE POLICY "categorias_insert" ON public.categorias FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "categorias_select" ON public.categorias;
CREATE POLICY "categorias_select" ON public.categorias FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "categorias_update" ON public.categorias;
CREATE POLICY "categorias_update" ON public.categorias FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "confirmacoes_pendentes_delete" ON public.confirmacoes_pendentes;
CREATE POLICY "confirmacoes_pendentes_delete" ON public.confirmacoes_pendentes FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "confirmacoes_pendentes_insert" ON public.confirmacoes_pendentes;
CREATE POLICY "confirmacoes_pendentes_insert" ON public.confirmacoes_pendentes FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "confirmacoes_pendentes_select" ON public.confirmacoes_pendentes;
CREATE POLICY "confirmacoes_pendentes_select" ON public.confirmacoes_pendentes FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "confirmacoes_pendentes_update" ON public.confirmacoes_pendentes;
CREATE POLICY "confirmacoes_pendentes_update" ON public.confirmacoes_pendentes FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "documentos_delete" ON public.documentos;
CREATE POLICY "documentos_delete" ON public.documentos FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "documentos_insert" ON public.documentos;
CREATE POLICY "documentos_insert" ON public.documentos FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "documentos_select" ON public.documentos;
CREATE POLICY "documentos_select" ON public.documentos FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "documentos_update" ON public.documentos;
CREATE POLICY "documentos_update" ON public.documentos FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "fornecedor_apelidos_delete" ON public.fornecedor_apelidos;
CREATE POLICY "fornecedor_apelidos_delete" ON public.fornecedor_apelidos FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "fornecedor_apelidos_insert" ON public.fornecedor_apelidos;
CREATE POLICY "fornecedor_apelidos_insert" ON public.fornecedor_apelidos FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "fornecedor_apelidos_select" ON public.fornecedor_apelidos;
CREATE POLICY "fornecedor_apelidos_select" ON public.fornecedor_apelidos FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "fornecedor_apelidos_update" ON public.fornecedor_apelidos;
CREATE POLICY "fornecedor_apelidos_update" ON public.fornecedor_apelidos FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "fornecedores_delete" ON public.fornecedores;
CREATE POLICY "fornecedores_delete" ON public.fornecedores FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "fornecedores_insert" ON public.fornecedores;
CREATE POLICY "fornecedores_insert" ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "fornecedores_select" ON public.fornecedores;
CREATE POLICY "fornecedores_select" ON public.fornecedores FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "fornecedores_update" ON public.fornecedores;
CREATE POLICY "fornecedores_update" ON public.fornecedores FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "knowledge_chunks_select" ON public.knowledge_chunks;
CREATE POLICY "knowledge_chunks_select" ON public.knowledge_chunks FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));
DROP POLICY IF EXISTS "knowledge_documents_select" ON public.knowledge_documents;
CREATE POLICY "knowledge_documents_select" ON public.knowledge_documents FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "lembretes_admin" ON public.lembretes_agendados;
CREATE POLICY "lembretes_admin" ON public.lembretes_agendados FOR ALL TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])))
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "mensagens_whats_delete" ON public.mensagens_whats;
CREATE POLICY "mensagens_whats_delete" ON public.mensagens_whats FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "mensagens_whats_insert" ON public.mensagens_whats;
CREATE POLICY "mensagens_whats_insert" ON public.mensagens_whats FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "mensagens_whats_select" ON public.mensagens_whats;
CREATE POLICY "mensagens_whats_select" ON public.mensagens_whats FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "mensagens_whats_update" ON public.mensagens_whats;
CREATE POLICY "mensagens_whats_update" ON public.mensagens_whats FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "notif_admin" ON public.notificacoes_email;
CREATE POLICY "notif_admin" ON public.notificacoes_email FOR ALL TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])))
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "compartilhamentos_delete" ON public.obra_compartilhamentos;
CREATE POLICY "compartilhamentos_delete" ON public.obra_compartilhamentos FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "compartilhamentos_insert" ON public.obra_compartilhamentos;
CREATE POLICY "compartilhamentos_insert" ON public.obra_compartilhamentos FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));
DROP POLICY IF EXISTS "compartilhamentos_select" ON public.obra_compartilhamentos;
CREATE POLICY "compartilhamentos_select" ON public.obra_compartilhamentos FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario, 'leitura'::papel_usuario])));
DROP POLICY IF EXISTS "compartilhamentos_update" ON public.obra_compartilhamentos;
CREATE POLICY "compartilhamentos_update" ON public.obra_compartilhamentos FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));
DROP POLICY IF EXISTS "obras_delete" ON public.obras;
CREATE POLICY "obras_delete" ON public.obras FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "obras_insert" ON public.obras;
CREATE POLICY "obras_insert" ON public.obras FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "obras_select" ON public.obras;
CREATE POLICY "obras_select" ON public.obras FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "obras_update" ON public.obras;
CREATE POLICY "obras_update" ON public.obras FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "pagamentos_delete" ON public.pagamentos;
CREATE POLICY "pagamentos_delete" ON public.pagamentos FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
DROP POLICY IF EXISTS "pagamentos_insert" ON public.pagamentos;
CREATE POLICY "pagamentos_insert" ON public.pagamentos FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "pagamentos_select" ON public.pagamentos;
CREATE POLICY "pagamentos_select" ON public.pagamentos FOR SELECT TO authenticated
  USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS "pagamentos_update" ON public.pagamentos;
CREATE POLICY "pagamentos_update" ON public.pagamentos FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
DROP POLICY IF EXISTS "webhooks_admin_all" ON public.webhooks_outbound;
CREATE POLICY "webhooks_admin_all" ON public.webhooks_outbound FOR ALL TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])))
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario])));

-- profiles: uma policy por comando, sem sobreposição.
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (select has_role(ARRAY['admin'::papel_usuario])));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario])));
CREATE POLICY profiles_delete ON public.profiles FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario])));
-- Admin edita qualquer perfil; o próprio usuário edita o seu sem tocar em
-- papel nem em deleted_at (regra da revisão de 2026-09-11, mantida).
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) OR (select has_role(ARRAY['admin'::papel_usuario])))
  WITH CHECK (
    (select has_role(ARRAY['admin'::papel_usuario]))
    OR (
      user_id = (select auth.uid())
      AND papel = (SELECT p.papel FROM profiles p WHERE p.user_id = (select auth.uid()))
      AND NOT (deleted_at IS DISTINCT FROM (SELECT p.deleted_at FROM profiles p WHERE p.user_id = (select auth.uid())))
    )
  );

-- automation_rules: escrita separada por comando (antes FOR ALL sobrepunha o SELECT).
DROP POLICY IF EXISTS automation_rules_select ON public.automation_rules;
DROP POLICY IF EXISTS automation_rules_write ON public.automation_rules;
CREATE POLICY automation_rules_select ON public.automation_rules FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario, 'financeiro'::papel_usuario])));
CREATE POLICY automation_rules_insert ON public.automation_rules FOR INSERT TO authenticated
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));
CREATE POLICY automation_rules_update ON public.automation_rules FOR UPDATE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])))
  WITH CHECK ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));
CREATE POLICY automation_rules_delete ON public.automation_rules FOR DELETE TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));

-- ----------------------------------------------------------------------------
-- 3. Privilégios de authenticated
-- ----------------------------------------------------------------------------
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;

-- Tabelas em que a sessão só lê (as escritas são do servidor, service_role).
REVOKE INSERT, UPDATE, DELETE ON
  public.audit_log, public.ai_conversations, public.ai_messages, public.ai_tool_calls,
  public.knowledge_chunks, public.knowledge_documents, public.automation_executions
FROM authenticated;

-- Tabelas internas: só service_role.
REVOKE ALL ON public.rate_limits, public.whatsapp_respostas FROM authenticated;

-- ----------------------------------------------------------------------------
-- 4. Auditoria
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entidade TEXT := TG_TABLE_NAME;
  v_acao TEXT;
  v_entidade_id UUID;
  v_diff JSONB;
  v_user UUID;
  v_old JSONB;
  v_new JSONB;
  v_changed_before JSONB;
  v_changed_after JSONB;
  -- Nunca entram no log: o carimbo automático e os segredos.
  v_ocultas TEXT[] := ARRAY['updated_at', 'secret', 'token'];
BEGIN
  BEGIN
    v_user := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    v_acao := 'insert';
    v_new := to_jsonb(NEW) - v_ocultas;
    v_entidade_id := COALESCE(v_new ->> 'id', v_new ->> 'user_id')::uuid;
    v_diff := jsonb_build_object('after', v_new);

  ELSIF (TG_OP = 'UPDATE') THEN
    v_acao := 'update';
    v_old := to_jsonb(OLD) - v_ocultas;
    v_new := to_jsonb(NEW) - v_ocultas;
    v_entidade_id := COALESCE(v_new ->> 'id', v_new ->> 'user_id')::uuid;
    SELECT
      jsonb_object_agg(key, v_old -> key),
      jsonb_object_agg(key, v_new -> key)
    INTO v_changed_before, v_changed_after
    FROM jsonb_object_keys(v_old) AS key
    WHERE (v_old -> key) IS DISTINCT FROM (v_new -> key);
    -- Nenhuma mudança real (só updated_at, ou só um campo oculto): pula.
    IF v_changed_before IS NULL OR v_changed_before = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
    v_diff := jsonb_build_object('before', v_changed_before, 'after', v_changed_after);

  ELSIF (TG_OP = 'DELETE') THEN
    v_acao := 'delete';
    v_old := to_jsonb(OLD) - v_ocultas;
    v_entidade_id := COALESCE(v_old ->> 'id', v_old ->> 'user_id')::uuid;
    v_diff := jsonb_build_object('before', v_old);
  END IF;

  INSERT INTO audit_log (user_id, entidade, entidade_id, acao, diff)
  VALUES (v_user, v_entidade, v_entidade_id, v_acao, v_diff);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'automation_rules', 'obra_compartilhamentos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();',
      t, t
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Manutenção agendada (pg_cron; `cron.schedule` com o mesmo nome atualiza)
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'manutencao-cron-historico',
  '20 3 * * *',
  $$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'; $$
);
SELECT cron.schedule(
  'manutencao-automacoes',
  '25 3 * * *',
  $$ SELECT purgar_automation_executions(90); $$
);

-- ----------------------------------------------------------------------------
-- 7. Achados do revisor de SQL (cada um conferido contra o catálogo)
-- ----------------------------------------------------------------------------

-- 7.1 O bucket recusava áudio: a mídia de voz do WhatsApp subia, o Storage
--     rejeitava, o catch engolia e `midia_storage_path` ficava NULL. A
--     transcrição sobrevivia; o áudio original (a evidência) se perdia.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/opus'
]
WHERE id = 'documents';

-- 7.2 Link público da planilha é uma credencial: o token não deve ser
--     legível por `financeiro`/`leitura`. Só quem pode gerar (admin/gestor).
DROP POLICY IF EXISTS "compartilhamentos_select" ON public.obra_compartilhamentos;
CREATE POLICY "compartilhamentos_select" ON public.obra_compartilhamentos FOR SELECT TO authenticated
  USING ((select has_role(ARRAY['admin'::papel_usuario, 'gestor'::papel_usuario])));

-- 7.3 Acesso a link vencido não conta (a validade era checada só no app).
CREATE OR REPLACE FUNCTION registrar_acesso_compartilhamento(p_token TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE obra_compartilhamentos
  SET acessos = acessos + 1,
      ultimo_acesso_em = now()
  WHERE token = p_token
    AND revogado_em IS NULL
    AND (expira_em IS NULL OR expira_em > now());
$$;

-- 7.4 Telefone autorizado: UNIQUE sobre o texto cru deixava "(51) 9…" e
--     "5551…" coexistirem, e arquivar + recadastrar dava 23505. Coluna
--     gerada só com dígitos, única entre os vivos.
ALTER TABLE autorizados
  ADD COLUMN IF NOT EXISTS telefone_norm TEXT
  GENERATED ALWAYS AS (regexp_replace(telefone_whats, '\D', '', 'g')) STORED;
ALTER TABLE autorizados DROP CONSTRAINT IF EXISTS autorizados_telefone_whats_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_autorizados_telefone_norm
  ON autorizados (telefone_norm) WHERE deleted_at IS NULL;

-- 7.5 Categoria: arquivar e recriar com o mesmo nome dava 23505.
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nome_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_nome_viva
  ON categorias (nome) WHERE deleted_at IS NULL;

-- 7.6 NULL escapa de todo filtro: `resolvida`, `status_pagto`, `ativo`,
--     `status`, `created_at` não podem ser nulos (conferido: zero linhas
--     nulas em produção em 2026-09-12).
ALTER TABLE confirmacoes_pendentes ALTER COLUMN resolvida SET NOT NULL;
ALTER TABLE pagamentos ALTER COLUMN status_pagto SET NOT NULL;
ALTER TABLE autorizados ALTER COLUMN ativo SET NOT NULL;
ALTER TABLE fornecedores ALTER COLUMN ativo SET NOT NULL;
ALTER TABLE obras ALTER COLUMN status SET NOT NULL;
ALTER TABLE automation_executions ALTER COLUMN created_at SET NOT NULL;

-- 7.7 Data civil do pagamento é Brasília também no default do banco.
ALTER TABLE pagamentos
  ALTER COLUMN data_pagamento SET DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date;

-- 7.8 FKs para profiles sem ON DELETE: apagar um usuário no painel da
--     Supabase falhava se ele tivesse criado um pagamento. SET NULL, como
--     já fazem audit_log, obra_compartilhamentos e webhooks_outbound.
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_criado_por_user_id_fkey;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_criado_por_user_id_fkey
  FOREIGN KEY (criado_por_user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_criado_por_user_id_fkey;
ALTER TABLE documentos ADD CONSTRAINT documentos_criado_por_user_id_fkey
  FOREIGN KEY (criado_por_user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;

-- 7.9 Obra arquivada não recebe pagamento novo. Só INSERT e troca de obra;
--     editar/arquivar um pagamento antigo de obra arquivada continua ok.
CREATE OR REPLACE FUNCTION pagamentos_bloquear_obra_arquivada()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.obra_id IS NOT DISTINCT FROM OLD.obra_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM obras o WHERE o.id = NEW.obra_id AND o.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'obra arquivada não recebe pagamento novo'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'pagamentos_obra_arquivada';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_pagamentos_obra_arquivada ON pagamentos;
CREATE TRIGGER trg_pagamentos_obra_arquivada
  BEFORE INSERT OR UPDATE OF obra_id ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION pagamentos_bloquear_obra_arquivada();

-- 7.10 Índices que seguem o filtro real (`deleted_at IS NULL`) e as
--      ordenações por `created_at` das telas; fora os redundantes.
CREATE INDEX IF NOT EXISTS idx_pagamentos_obra_data_vivos
  ON pagamentos (obra_id, data_pagamento DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_created_vivos
  ON pagamentos (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_aguardando
  ON pagamentos (created_at DESC) WHERE deleted_at IS NULL AND status_pagto = 'aguardando';
CREATE INDEX IF NOT EXISTS idx_documentos_created_vivos
  ON documentos (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);
DROP INDEX IF EXISTS idx_pagamentos_status;              -- enum de 4 valores, nunca usado
DROP INDEX IF EXISTS idx_confirmacoes_abertas;            -- coberto pelo único parcial por mensagem
DROP INDEX IF EXISTS idx_compartilhamentos_token_ativo;   -- subconjunto do UNIQUE (token)

-- 7.11 A tela de pendentes e a ferramenta da IA repetiam a heurística
--      "sem documento" em JS com limite; a RPC já existe e é STABLE.
GRANT EXECUTE ON FUNCTION pagamentos_sem_documento(DATE, INTEGER) TO authenticated;

-- 7.12 Arquivo das filas (dead-letter) crescia para sempre.
CREATE OR REPLACE FUNCTION purgar_filas_arquivadas(p_dias INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_fila TEXT;
  v_total INTEGER := 0;
  v_n INTEGER;
BEGIN
  FOREACH v_fila IN ARRAY ARRAY['whatsapp_inbound', 'midia', 'ia_classificacao', 'whatsapp_outbound'] LOOP
    EXECUTE format('DELETE FROM pgmq.a_%I WHERE archived_at < now() - make_interval(days => $1)', v_fila)
      USING p_dias;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
  END LOOP;
  RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION purgar_filas_arquivadas(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purgar_filas_arquivadas(INTEGER) TO service_role;
SELECT cron.schedule(
  'manutencao-filas',
  '30 3 * * *',
  $$ SELECT purgar_filas_arquivadas(30); $$
);

-- 7.13 Função interna sem motivo para ser chamável via /rpc/.
REVOKE ALL ON FUNCTION fila_valida(TEXT) FROM PUBLIC, anon, authenticated;

-- 7.14 A resolução de uma pendência ("SIM" virou pagamento) passa a ficar
--      na auditoria — só UPDATE, a criação é do sistema.
DROP TRIGGER IF EXISTS trg_audit_confirmacoes_pendentes ON confirmacoes_pendentes;
CREATE TRIGGER trg_audit_confirmacoes_pendentes
  AFTER UPDATE ON confirmacoes_pendentes
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ----------------------------------------------------------------------------
-- 6. Registro das migrations aplicadas fora do CLI
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20260908100000', 'pagamentos_criado_via_msg_unique'),
  ('20260908110000', 'webhook_counter_rpc'),
  ('20260908120000', 'merge_fornecedores_rpc'),
  ('20260909130000', 'fix_signup_privilege_escalation'),
  ('20260909130100', 'audit_log_exclude_webhook_secret'),
  ('20260909140000', 'storage_documents_rls_ownership'),
  ('20260909140100', 'rate_limit'),
  ('20260909140200', 'fluxo_confirmacao_whatsapp'),
  ('20260909150000', 'planilha_compartilhada'),
  ('20260910120000', 'motor_automacoes'),
  ('20260910180000', 'extensoes_fase0'),
  ('20260910190000', 'pgmq_fila'),
  ('20260910200000', 'filas_pgmq'),
  ('20260910210000', 'fila_agendamento'),
  ('20260910220000', 'fila_arquivadas'),
  ('20260910230000', 'rag_conhecimento'),
  ('20260910240000', 'rag_agendamento'),
  ('20260910250000', 'saude'),
  ('20260910260000', 'higiene_advisors'),
  ('20260911120000', 'saude_tolerancia_por_agenda'),
  ('20260911140000', 'revisao_seguranca_corretude'),
  ('20260912150000', 'revisao_banco')
ON CONFLICT (version) DO NOTHING;
