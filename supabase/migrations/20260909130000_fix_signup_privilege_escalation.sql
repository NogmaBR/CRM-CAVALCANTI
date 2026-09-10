-- Security fix (audit 2026-09-09, finding C-2 / E — confirmed independently
-- by two separate adversarial audit passes): handle_new_user() trusted
-- `raw_user_meta_data->>'papel'` unconditionally. That field is populated
-- identically by the admin invite flow (auth.admin.inviteUserByEmail with
-- `data: { papel }`) AND by the public self-signup endpoint
-- (POST /auth/v1/signup with `{ data: { papel: 'admin' } }`, callable with
-- only the public anon key). If public signup is ever enabled on the
-- Supabase project (accidentally or by a future change), anyone could
-- self-register as papel='admin'.
--
-- Fix: only honor the client-supplied `papel` when the account was created
-- via the admin invite flow. Supabase Auth sets `invited_at` server-side
-- specifically for accounts created by `admin.inviteUserByEmail` — it is
-- NOT settable by a client calling the public signup endpoint, so it's a
-- reliable signal that this row didn't originate from self-signup.
-- Self-registered accounts (invited_at IS NULL) always get 'leitura',
-- regardless of what they request in the signup payload.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_papel papel_usuario := 'leitura';
BEGIN
  -- Only trust the requested papel for accounts that came through the
  -- admin invite flow (invited_at is set by Supabase Auth server-side,
  -- never by client-supplied signup payloads).
  IF NEW.invited_at IS NOT NULL THEN
    BEGIN
      v_papel := COALESCE((NEW.raw_user_meta_data->>'papel')::papel_usuario, 'leitura');
    EXCEPTION WHEN OTHERS THEN
      v_papel := 'leitura';
    END;
  END IF;

  INSERT INTO profiles (user_id, nome, papel)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    v_papel
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
