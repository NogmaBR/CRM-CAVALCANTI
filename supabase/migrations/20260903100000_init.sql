-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigger genérico updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Papel dos usuários
CREATE TYPE papel_usuario AS ENUM ('admin','gestor','financeiro','leitura');

-- Preferência de tema
CREATE TYPE tema_preferido AS ENUM ('light','black','dark');

-- Origem de fornecedor
CREATE TYPE origem_fornecedor AS ENUM ('manual','auto_detectado');

-- Documento tipo
CREATE TYPE documento_tipo AS ENUM ('cnpj','cpf');

-- Obra tipo/status
CREATE TYPE obra_tipo AS ENUM ('nova','reforma');
CREATE TYPE obra_status AS ENUM ('ativa','pausada','concluida','arquivada');

-- Pagamento origem/status
CREATE TYPE pagamento_origem AS ENUM ('whatsapp','manual','importado');
CREATE TYPE pagamento_status AS ENUM ('confirmado','aguardando','erro');

-- Documento tipo (anexo)
CREATE TYPE anexo_tipo AS ENUM ('nota_fiscal','comprovante','contrato','outro');

-- Mensagem WhatsApp
CREATE TYPE msg_tipo AS ENUM ('texto','imagem','pdf','audio');
CREATE TYPE msg_status AS ENUM ('recebida','processando','classificada','confirmada','erro');
