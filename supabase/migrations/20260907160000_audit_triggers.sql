-- Fase 11: Auditoria via Postgres triggers.
--
-- Estratégia: uma única função genérica `audit_log_trigger()` que:
--   1. Lê `auth.uid()` (helper Supabase) — pode ser NULL para operações
--      via service_role (cron, webhook, admin scripts) — audit_log.user_id
--      é nullable.
--   2. Computa diff:
--      INSERT: `{ after: <full_new_row_sem_updated_at> }`
--      UPDATE: `{ before: <changed_keys_old>, after: <changed_keys_new> }`
--             (só campos que mudaram; se só updated_at mudou → skip)
--      DELETE: `{ before: <full_old_row_sem_updated_at> }`
--   3. Insere em audit_log com SECURITY DEFINER (bypassa RLS de escrita).
--
-- Ganchos aplicados nas tabelas de negócio (soft-delete via UPDATE fica
-- capturado). Não incluímos:
--   - profiles (managed via Supabase Auth trigger)
--   - confirmacoes_pendentes (system-generated pelo classifier)
--   - fornecedor_apelidos (child table, auto)
--   - mensagens_whats (system-received, tem próprio status tracking)
--   - notificacoes_email (system-generated)
--   - audit_log (não auditamos a auditoria — evita recursão)
--
-- RLS relaxada: admin+gestor podem ler audit_log (antes só admin).

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
BEGIN
  -- auth.uid() é o helper Supabase — retorna user_id do JWT, NULL se
  -- role for service_role/anon/postgres direto.
  BEGIN
    v_user := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    v_acao := 'insert';
    v_entidade_id := NEW.id;
    v_diff := jsonb_build_object('after', to_jsonb(NEW) - 'updated_at');

  ELSIF (TG_OP = 'UPDATE') THEN
    v_acao := 'update';
    v_entidade_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- Só campos que mudaram (exceto updated_at, que sempre muda via trigger)
    SELECT
      jsonb_object_agg(key, v_old -> key),
      jsonb_object_agg(key, v_new -> key)
    INTO v_changed_before, v_changed_after
    FROM jsonb_object_keys(v_old) AS key
    WHERE key <> 'updated_at'
      AND (v_old -> key) IS DISTINCT FROM (v_new -> key);

    -- Nenhuma mudança real (só updated_at) — pula log
    IF v_changed_before IS NULL OR v_changed_before = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    v_diff := jsonb_build_object('before', v_changed_before, 'after', v_changed_after);

  ELSIF (TG_OP = 'DELETE') THEN
    v_acao := 'delete';
    v_entidade_id := OLD.id;
    v_diff := jsonb_build_object('before', to_jsonb(OLD) - 'updated_at');
  END IF;

  INSERT INTO audit_log (user_id, entidade, entidade_id, acao, diff)
  VALUES (v_user, v_entidade, v_entidade_id, v_acao, v_diff);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach triggers nas 6 tabelas de negócio
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['obras','fornecedores','pagamentos','documentos','categorias','autorizados']::TEXT[])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();',
      t, t
    );
  END LOOP;
END $$;

-- Estende RLS: admin+gestor lêem audit_log (antes só admin).
DROP POLICY IF EXISTS audit_admin_select ON audit_log;
DROP POLICY IF EXISTS audit_admin_gestor_select ON audit_log;
CREATE POLICY audit_admin_gestor_select ON audit_log
  FOR SELECT
  TO authenticated
  USING (has_role(ARRAY['admin','gestor']::papel_usuario[]));

-- Garante SELECT grant pra authenticated (RLS filtra por papel).
-- audit_log usa BIGSERIAL id — sequences também precisam grant.
GRANT SELECT ON audit_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO authenticated;
