-- Filas da Fase 3, sobre pgmq.
--
-- ## Por que existem wrappers em vez de chamar pgmq direto
--
-- O PostgREST só expõe o schema `public` (e os que forem configurados). As
-- funções do pgmq moram em `pgmq`, então o cliente Supabase não as alcança —
-- não é uma restrição que dá para contornar do lado do app.
--
-- Isso vira vantagem: em vez de expor o schema inteiro, expomos **cinco
-- funções com uma whitelist de filas**. Um bug no app não cria fila nova, não
-- lê fila que não devia e não apaga a fila errada. O que não está na lista não
-- existe para quem chama.
--
-- ## Nada disso age sozinho
--
-- As filas nascem vazias e ninguém enfileira ainda. O `pg_cron` que vai
-- consumir **não é agendado aqui** de propósito: agendar antes de existir
-- consumidor testado significaria uma rota sendo chamada de minuto em minuto
-- sem ninguém olhando. O agendamento é o último passo da Fase 3, não o
-- primeiro.

-- ---------------------------------------------------------------------------
-- As filas
-- ---------------------------------------------------------------------------
-- Nomes com underline, não hífen: o pgmq cria uma tabela `q_<nome>` por fila,
-- e hífen exigiria aspas em toda consulta manual ao histórico.
--
-- A divisão segue as etapas caras do fluxo do WhatsApp, que hoje rodam todas
-- dentro do request do webhook:
--
--   whatsapp_inbound   recebeu mensagem; decidir o que fazer com ela
--   midia              baixar anexo antes da URL do provider expirar
--   ia_classificacao   transcrever e classificar (a etapa mais lenta)
--   whatsapp_outbound  responder ao remetente
--
-- Separadas porque falham por motivos diferentes e merecem retentativa
-- diferente: mídia expira, IA dá rate limit, envio depende do provider estar
-- de pé.
SELECT pgmq.create('whatsapp_inbound');
SELECT pgmq.create('midia');
SELECT pgmq.create('ia_classificacao');
SELECT pgmq.create('whatsapp_outbound');

-- ---------------------------------------------------------------------------
-- Whitelist
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fila_valida(p_fila TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_fila IN ('whatsapp_inbound', 'midia', 'ia_classificacao', 'whatsapp_outbound');
$$;

COMMENT ON FUNCTION fila_valida(TEXT) IS
  'Filas que o app pode tocar. Acrescentar aqui E criar a fila na mesma migration.';

-- ---------------------------------------------------------------------------
-- Enfileirar
-- ---------------------------------------------------------------------------
-- `p_delay` em segundos é o que dá retentativa com backoff sem infraestrutura
-- de retry: quem falha reenfileira a si mesmo mais adiante no tempo.
CREATE OR REPLACE FUNCTION fila_enfileirar(
  p_fila TEXT,
  p_payload JSONB,
  p_delay INTEGER DEFAULT 0
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF NOT fila_valida(p_fila) THEN
    RAISE EXCEPTION 'Fila desconhecida: %', p_fila;
  END IF;

  -- `pgmq.send` devolve SETOF bigint com um elemento.
  SELECT * INTO v_id FROM pgmq.send(p_fila, p_payload, p_delay);
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ler
-- ---------------------------------------------------------------------------
-- `p_vt` é o visibility timeout: por quantos segundos a mensagem some da fila
-- depois de lida. Se o consumidor morrer no meio, ela volta sozinha — é isso
-- que substitui o "retry" do BullMQ, e é por isso que **todo consumidor
-- precisa ser idempotente**: a entrega é "pelo menos uma vez", nunca
-- "exatamente uma".
--
-- O `vt` deve ser maior que o pior tempo de processamento esperado. Curto
-- demais e a mesma mensagem é processada duas vezes em paralelo.
CREATE OR REPLACE FUNCTION fila_ler(
  p_fila TEXT,
  p_vt INTEGER DEFAULT 60,
  p_qtd INTEGER DEFAULT 5
)
RETURNS TABLE (msg_id BIGINT, read_ct INTEGER, enqueued_at TIMESTAMPTZ, payload JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF NOT fila_valida(p_fila) THEN
    RAISE EXCEPTION 'Fila desconhecida: %', p_fila;
  END IF;

  RETURN QUERY
  SELECT m.msg_id, m.read_ct, m.enqueued_at, m.message
  FROM pgmq.read(p_fila, p_vt, p_qtd) AS m;
END;
$$;

-- ---------------------------------------------------------------------------
-- Concluir e arquivar
-- ---------------------------------------------------------------------------
-- `fila_concluir` apaga: deu certo, acabou.
-- `fila_arquivar` move para `pgmq.a_<fila>`: é a dead-letter. A mensagem sai
-- do caminho mas continua existindo para alguém olhar e entender o que houve.
-- Apagar o que falhou seria destruir a evidência justamente do caso que
-- precisa ser investigado.
CREATE OR REPLACE FUNCTION fila_concluir(p_fila TEXT, p_msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF NOT fila_valida(p_fila) THEN
    RAISE EXCEPTION 'Fila desconhecida: %', p_fila;
  END IF;
  RETURN pgmq.delete(p_fila, p_msg_id);
END;
$$;

CREATE OR REPLACE FUNCTION fila_arquivar(p_fila TEXT, p_msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  IF NOT fila_valida(p_fila) THEN
    RAISE EXCEPTION 'Fila desconhecida: %', p_fila;
  END IF;
  RETURN pgmq.archive(p_fila, p_msg_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Métricas
-- ---------------------------------------------------------------------------
-- O painel de observação que o BullMQ dá pronto. Aqui é uma função e uma tela.
CREATE OR REPLACE FUNCTION fila_metricas()
RETURNS TABLE (
  fila TEXT,
  na_fila BIGINT,
  visiveis BIGINT,
  mais_antiga_seg INTEGER,
  total_ja_enfileirado BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY
  SELECT m.queue_name, m.queue_length, m.queue_visible_length,
         m.oldest_msg_age_sec, m.total_messages
  FROM pgmq.metrics_all() AS m
  WHERE fila_valida(m.queue_name);
END;
$$;

-- ---------------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------------
-- Só `service_role`. Fila não é coisa que sessão de usuário mexe: quem
-- enfileira é o webhook, quem consome é o cron — os dois sem sessão.
REVOKE ALL ON FUNCTION fila_enfileirar(TEXT, JSONB, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION fila_ler(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION fila_concluir(TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION fila_arquivar(TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION fila_metricas() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION fila_enfileirar(TEXT, JSONB, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION fila_ler(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION fila_concluir(TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION fila_arquivar(TEXT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION fila_metricas() TO service_role;
