-- Extensões decididas na FASE 0 do plano de arquitetura.
--
-- Nenhuma delas muda comportamento sozinha: instalar uma extensão só torna as
-- funções disponíveis. O que age é o que se escreve depois em cima delas — e
-- isso é migration futura, não esta.
--
-- O `WITH SCHEMA extensions` segue a convenção do projeto (é onde pgcrypto,
-- uuid-ossp e pg_stat_statements já vivem), mas **o resultado real não é esse
-- para todas**, e vale registrar porque o comando não reclama:
--
--   pg_net  → extensão em `extensions`, funções em `net` (net.http_post, …)
--   vector  → extensão e tipos em `extensions`
--   pg_cron → a Supabase força `pg_catalog`, ignorando o WITH SCHEMA em
--             silêncio. As funções ficam em `cron` (cron.schedule, …)
--
-- Conferido no catálogo depois de aplicar, não deduzido do comando.

-- ---------------------------------------------------------------------------
-- pg_cron — agendamento dentro do banco
-- ---------------------------------------------------------------------------
-- Hoje o agendamento é o Vercel Cron chamando /api/cron/*. Isso continua.
--
-- O que o pg_cron acrescenta é agendar o que não precisa passar pela aplicação
-- — purga de log, agregação, retentativa — sem gastar invocação de função nem
-- depender de a aplicação estar no ar. O primeiro candidato óbvio é a
-- `purgar_automation_executions`, que hoje não tem quem a chame.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- pg_net — HTTP assíncrono a partir do banco
-- ---------------------------------------------------------------------------
-- Assíncrono é a palavra que importa. A extensão `http` (1.6) também está
-- disponível e faz requisição HTTP, mas de forma SÍNCRONA: ela segura a
-- conexão do Postgres até o outro lado responder. Num webhook lento isso
-- prende um slot do pool, e o pool é compartilhado com o app inteiro.
--
-- Por isso instalo pg_net e NÃO instalo http. Ter as duas seria oferecer dois
-- jeitos de fazer a mesma coisa, com o mais perigoso parecendo mais simples.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- vector (pgvector) — embeddings para a Fase 4
-- ---------------------------------------------------------------------------
-- Instalada agora porque era um dos motivos alegados para introduzir Python no
-- projeto. Com pgvector aqui, RAG é uma tabela com coluna `vector` e uma
-- chamada de embeddings — em TypeScript, sem um terceiro runtime.
--
-- Nenhuma tabela usa ainda. É a diferença entre "possível" e "feito", e por
-- ora fica em possível.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Acesso ao agendador
-- ---------------------------------------------------------------------------
-- O pg_cron cria o schema `cron` com as próprias tabelas. Sem GRANT, só o
-- superusuário enxerga — o que na prática significa que ninguém agenda nada
-- pelas nossas credenciais.
--
-- O DO existe porque o schema é criado pela extensão: se algum dia a
-- instalação acima virar no-op num banco que já a tinha em outro lugar, o
-- GRANT solto quebraria a migration inteira por um detalhe sem importância.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    GRANT USAGE ON SCHEMA cron TO postgres, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA cron TO postgres, service_role;
  END IF;
END
$$;
