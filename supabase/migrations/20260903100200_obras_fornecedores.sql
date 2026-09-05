CREATE TABLE obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cliente TEXT,
  tipo obra_tipo,
  orcamento NUMERIC(12,2),
  status obra_status DEFAULT 'ativa',
  data_inicio DATE,
  data_prevista_fim DATE,
  endereco JSONB,
  apelidos TEXT[] DEFAULT '{}',
  onedrive_folder_id TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_obras_status ON obras(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_obras_apelidos_gin ON obras USING GIN(apelidos);
CREATE TRIGGER trg_obras_updated BEFORE UPDATE ON obras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  razao_social TEXT,
  documento TEXT,
  documento_tipo documento_tipo,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  telefone TEXT,
  email TEXT,
  origem origem_fornecedor DEFAULT 'manual',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_fornecedores_doc_unique ON fornecedores(documento)
  WHERE documento IS NOT NULL AND deleted_at IS NULL;
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE fornecedor_apelidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  apelido TEXT NOT NULL,
  criado_por_ia BOOLEAN DEFAULT false,
  vezes_visto INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_apelidos_fornecedor ON fornecedor_apelidos(fornecedor_id);
CREATE INDEX idx_apelidos_texto ON fornecedor_apelidos(lower(apelido));
