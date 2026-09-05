-- mensagens_whats primeiro (pagamentos referencia)
CREATE TABLE mensagens_whats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_id_uazapi TEXT UNIQUE NOT NULL,
  telefone_from TEXT NOT NULL,
  autorizado_id UUID REFERENCES autorizados(id) ON DELETE SET NULL,
  tipo msg_tipo NOT NULL,
  texto_bruto TEXT,
  midia_storage_path TEXT,
  midia_mime TEXT,
  recebida_em TIMESTAMPTZ NOT NULL,
  status msg_status NOT NULL DEFAULT 'recebida',
  dados_extraidos JSONB,
  confianca_ia NUMERIC(4,3),
  erro_msg TEXT,
  pagamento_id UUID,  -- FK adicionada depois (circular)
  documento_id UUID,  -- FK adicionada depois
  tentativas_reprocessamento INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_msgs_status ON mensagens_whats(status);
CREATE INDEX idx_msgs_recebida_em ON mensagens_whats(recebida_em DESC);
CREATE TRIGGER trg_msgs_updated BEFORE UPDATE ON mensagens_whats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE RESTRICT,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  data_pagamento DATE NOT NULL DEFAULT current_date,
  origem pagamento_origem NOT NULL,
  status_pagto pagamento_status DEFAULT 'confirmado',
  criado_por_user_id UUID REFERENCES profiles(user_id),
  criado_via_msg_id UUID REFERENCES mensagens_whats(id) DEFERRABLE INITIALLY DEFERRED,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_pagamentos_obra_data ON pagamentos(obra_id, data_pagamento DESC);
CREATE INDEX idx_pagamentos_fornecedor ON pagamentos(fornecedor_id);
CREATE INDEX idx_pagamentos_status ON pagamentos(status_pagto);
CREATE TRIGGER trg_pagamentos_updated BEFORE UPDATE ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id UUID REFERENCES pagamentos(id) ON DELETE SET NULL,
  obra_id UUID REFERENCES obras(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  tipo anexo_tipo NOT NULL,
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho_bytes BIGINT,
  storage_path TEXT NOT NULL,
  onedrive_file_id TEXT,
  numero_nf TEXT,
  chave_acesso_nf TEXT,
  hash_sha256 TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_documentos_chave_nf ON documentos(chave_acesso_nf)
  WHERE chave_acesso_nf IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_documentos_hash ON documentos(hash_sha256)
  WHERE hash_sha256 IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_documentos_pagamento ON documentos(pagamento_id);
CREATE INDEX idx_documentos_obra ON documentos(obra_id);
CREATE INDEX idx_documentos_fornecedor ON documentos(fornecedor_id);
CREATE TRIGGER trg_documentos_updated BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Agora adicionamos FKs em mensagens_whats
ALTER TABLE mensagens_whats
  ADD CONSTRAINT fk_msgs_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE mensagens_whats
  ADD CONSTRAINT fk_msgs_documento FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE confirmacoes_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id UUID NOT NULL REFERENCES mensagens_whats(id) ON DELETE CASCADE,
  pergunta_enviada TEXT NOT NULL,
  msg_id_pergunta_uazapi TEXT,
  respondida_em TIMESTAMPTZ,
  resposta_bruta TEXT,
  resolvida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
