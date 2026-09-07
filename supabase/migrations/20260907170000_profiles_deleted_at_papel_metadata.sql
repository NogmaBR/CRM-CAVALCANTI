-- Fase 13: gestão de usuários
--
-- 1) ADD deleted_at pra soft-delete (padrão obras/pagamentos/documentos)
--    RLS já existente (profiles_admin_all) cobre; queries de list filtram
--    `deleted_at IS NULL` pra esconder arquivados por default.
--
-- 2) Atualiza handle_new_user pra ler `papel` de raw_user_meta_data
--    quando o admin envia o invite. Fallback continua sendo 'leitura'
--    se metadata ausente (auto-signup public — não permitido no MVP,
--    mas defensive).
--
-- 3) Constraint: papel string do metadata precisa castar pra enum
--    papel_usuario; se falhar (papel inválido), cai no fallback.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_papel_active ON profiles(papel)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_papel papel_usuario;
BEGIN
  -- Cast defensivo: se metadata tem papel inválido, cai pro fallback
  BEGIN
    v_papel := COALESCE((NEW.raw_user_meta_data->>'papel')::papel_usuario, 'leitura');
  EXCEPTION WHEN OTHERS THEN
    v_papel := 'leitura';
  END;

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
