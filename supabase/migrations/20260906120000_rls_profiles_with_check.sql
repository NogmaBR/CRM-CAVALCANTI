-- Endurecimento: adiciona WITH CHECK a profiles_self_update.
-- USING controla LINHAS visíveis; WITH CHECK controla LINHAS resultantes.
-- Sem WITH CHECK, um usuário poderia UPDATE profile SET papel='admin', user_id=<outro> WHERE user_id=auth.uid()
-- e escapar. Com WITH CHECK, a linha resultante ainda precisa passar user_id=auth.uid().
-- Adicionalmente, restringimos os campos mutáveis: papel só pode ser mudado pela policy profiles_admin_all.

DROP POLICY IF EXISTS profiles_self_update ON profiles;

CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND papel = (SELECT papel FROM profiles WHERE user_id = auth.uid()));
