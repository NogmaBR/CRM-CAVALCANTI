-- Planilha compartilhável da obra — o entregável que o cliente final enxerga.
--
-- Hoje o gestor monta uma planilha de Excel à mão e manda pro dono da obra por
-- WhatsApp. O protótipo aprovado pelo Cavalcanti (`ClientSpreadsheet`) troca
-- isso por um link read-only, e é a página que o cliente final de fato abre —
-- ou seja, o produto percebido. Esta migration é a parte de dados dela.
--
-- Modelo de acesso: quem tem o link vê a planilha, sem login. Isso é
-- deliberado (o dono da obra não vai criar conta pra ver quanto gastou), mas
-- exige que o token seja a única credencial e se comporte como tal:
--
--   * gerado com 32 bytes de aleatoriedade real (no app, via crypto), longo o
--     bastante pra não ser enumerável;
--   * revogável a qualquer momento, sem apagar o histórico de quem acessou;
--   * opcionalmente com validade — link de obra entregue não precisa viver
--     pra sempre;
--   * escopo de UMA obra. Nunca dá acesso a outra obra, a fornecedor, a
--     telefone de ninguém nem a qualquer tela do CRM.

CREATE TABLE IF NOT EXISTS obra_compartilhamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,

  -- Hex de 64 chars (32 bytes). UNIQUE porque é a chave de acesso.
  token TEXT UNIQUE NOT NULL,

  -- Rótulo livre pra quem gerou lembrar a quem entregou o link
  -- ("Fernando", "engenheiro da obra", "contador").
  descricao TEXT,

  criado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Revogação é soft: o link para de funcionar mas o registro fica, senão
  -- perde-se a resposta a "quem tinha acesso a essa obra em março?".
  revogado_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ,

  -- Telemetria mínima: dá pro gestor saber se o cliente chegou a abrir.
  acessos INTEGER NOT NULL DEFAULT 0,
  ultimo_acesso_em TIMESTAMPTZ
);

-- A busca é sempre "token → obra", a cada request da página pública.
CREATE INDEX IF NOT EXISTS idx_compartilhamentos_token_ativo
  ON obra_compartilhamentos (token)
  WHERE revogado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_compartilhamentos_obra
  ON obra_compartilhamentos (obra_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- A página pública NÃO passa por aqui: ela roda com service_role, porque não
-- há sessão nenhuma do lado do visitante. Estas policies governam só quem
-- administra os links dentro do CRM.
ALTER TABLE obra_compartilhamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compartilhamentos_select ON obra_compartilhamentos;
CREATE POLICY compartilhamentos_select ON obra_compartilhamentos
  FOR SELECT
  TO authenticated
  USING (has_role(ARRAY['admin','gestor','financeiro','leitura']::papel_usuario[]));

-- Criar e revogar link é decisão de quem responde pela obra. `financeiro` e
-- `leitura` enxergam que o link existe, mas não geram nem revogam.
DROP POLICY IF EXISTS compartilhamentos_insert ON obra_compartilhamentos;
CREATE POLICY compartilhamentos_insert ON obra_compartilhamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(ARRAY['admin','gestor']::papel_usuario[]));

DROP POLICY IF EXISTS compartilhamentos_update ON obra_compartilhamentos;
CREATE POLICY compartilhamentos_update ON obra_compartilhamentos
  FOR UPDATE
  TO authenticated
  USING (has_role(ARRAY['admin','gestor']::papel_usuario[]));

DROP POLICY IF EXISTS compartilhamentos_delete ON obra_compartilhamentos;
CREATE POLICY compartilhamentos_delete ON obra_compartilhamentos
  FOR DELETE
  TO authenticated
  USING (has_role(ARRAY['admin']::papel_usuario[]));

COMMENT ON TABLE obra_compartilhamentos IS
  'Links read-only da planilha de uma obra. O token é a credencial: tratar como secret.';

-- ---------------------------------------------------------------------------
-- Registro de acesso
-- ---------------------------------------------------------------------------
-- Incremento + carimbo numa statement só. Feito como RPC pra que a página
-- pública não precise de UPDATE genérico na tabela, e pra não virar duas
-- viagens ao banco a cada visita.
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
    AND revogado_em IS NULL;
$$;

REVOKE ALL ON FUNCTION registrar_acesso_compartilhamento(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_acesso_compartilhamento(TEXT) TO service_role;
