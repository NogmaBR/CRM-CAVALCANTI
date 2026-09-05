-- Habilitar RLS em todas as tabelas de negócio
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedor_apelidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_whats ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmacoes_pendentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE lembretes_agendados ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se user tem papel
CREATE OR REPLACE FUNCTION has_role(roles papel_usuario[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND papel = ANY(roles)
  );
$$;

-- Profiles: cada um lê o seu; admin lê todos
CREATE POLICY profiles_self_select ON profiles FOR SELECT
  USING (user_id = auth.uid() OR has_role(ARRAY['admin']::papel_usuario[]));
CREATE POLICY profiles_self_update ON profiles FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY profiles_admin_all ON profiles FOR ALL
  USING (has_role(ARRAY['admin']::papel_usuario[]));

-- Padrão para tabelas de negócio (autorizados, categorias, obras, fornecedores, fornecedor_apelidos, pagamentos, documentos, mensagens_whats, confirmacoes_pendentes)
-- SELECT: qualquer autenticado
-- INSERT/UPDATE: admin, gestor, financeiro
-- DELETE: admin

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['autorizados','categorias','obras','fornecedores','fornecedor_apelidos','pagamentos','documentos','mensagens_whats','confirmacoes_pendentes']::TEXT[])
  LOOP
    EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (auth.uid() IS NOT NULL);', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON %I FOR INSERT WITH CHECK (has_role(ARRAY[''admin'',''gestor'',''financeiro'']::papel_usuario[]));', t, t);
    EXECUTE format('CREATE POLICY %I_update ON %I FOR UPDATE USING (has_role(ARRAY[''admin'',''gestor'',''financeiro'']::papel_usuario[]));', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON %I FOR DELETE USING (has_role(ARRAY[''admin'']::papel_usuario[]));', t, t);
  END LOOP;
END $$;

-- audit_log: só admin lê; sistema (service_role) escreve
CREATE POLICY audit_admin_select ON audit_log FOR SELECT
  USING (has_role(ARRAY['admin']::papel_usuario[]));

-- notificacoes_email e lembretes: só admin
CREATE POLICY notif_admin ON notificacoes_email FOR ALL
  USING (has_role(ARRAY['admin']::papel_usuario[]));
CREATE POLICY lembretes_admin ON lembretes_agendados FOR ALL
  USING (has_role(ARRAY['admin']::papel_usuario[]));
