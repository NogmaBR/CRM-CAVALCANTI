-- Security fix (audit 2026-09-09, finding B): audit_log_trigger() records
-- to_jsonb(NEW)/to_jsonb(OLD) verbatim for every audited table, including
-- webhooks_outbound.secret (the HMAC signing key for outbound webhooks).
-- audit_log is readable by papel 'gestor' as well as 'admin'
-- (audit_admin_gestor_select, migration 20260907160000), but
-- webhooks_outbound itself is admin-only (webhooks_admin_all, migration
-- 20260907190000) — so a 'gestor' user, who has no direct access to the
-- table, could read any webhook's HMAC secret out of its audit trail and
-- forge signed payloads to whatever downstream automation trusts it.
--
-- Fix: strip the `secret` key from the diff unconditionally in the shared
-- trigger function. No other audited table (obras, fornecedores,
-- pagamentos, documentos, categorias, autorizados, webhooks_outbound) has
-- a column literally named `secret`, so this is safe for all of them.

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
    v_diff := jsonb_build_object('after', to_jsonb(NEW) - 'updated_at' - 'secret');

  ELSIF (TG_OP = 'UPDATE') THEN
    v_acao := 'update';
    v_entidade_id := NEW.id;
    v_old := to_jsonb(OLD) - 'secret';
    v_new := to_jsonb(NEW) - 'secret';
    -- Só campos que mudaram (exceto updated_at, que sempre muda via trigger)
    SELECT
      jsonb_object_agg(key, v_old -> key),
      jsonb_object_agg(key, v_new -> key)
    INTO v_changed_before, v_changed_after
    FROM jsonb_object_keys(v_old) AS key
    WHERE key <> 'updated_at'
      AND (v_old -> key) IS DISTINCT FROM (v_new -> key);

    -- Nenhuma mudança real (só updated_at, ou só o secret que acabamos
    -- de excluir) — pula log
    IF v_changed_before IS NULL OR v_changed_before = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    v_diff := jsonb_build_object('before', v_changed_before, 'after', v_changed_after);

  ELSIF (TG_OP = 'DELETE') THEN
    v_acao := 'delete';
    v_entidade_id := OLD.id;
    v_diff := jsonb_build_object('before', to_jsonb(OLD) - 'updated_at' - 'secret');
  END IF;

  INSERT INTO audit_log (user_id, entidade, entidade_id, acao, diff)
  VALUES (v_user, v_entidade, v_entidade_id, v_acao, v_diff);

  RETURN COALESCE(NEW, OLD);
END;
$$;
