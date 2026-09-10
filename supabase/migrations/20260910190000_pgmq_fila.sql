-- pgmq — fila de mensagens dentro do Postgres.
--
-- Instalada porque a decisão de hospedagem mudou: **sem VPS**. Web na Vercel,
-- DNS na Cloudflare, e nada de processo vivo em lugar nenhum.
--
-- Isso elimina Redis + BullMQ, que precisam de um processo consumindo a fila
-- para sempre. O que sobra não é "ficar sem fila": é uma fila que mora no
-- banco, com as mesmas garantias que interessam aqui.
--
-- ## O trio, e o papel de cada um
--
--   pgmq    guarda a mensagem, entrega uma vez, esconde por N segundos
--           (visibility timeout) e devolve à fila se ninguém confirmar
--   pg_cron acorda de minuto em minuto e pergunta se há o que fazer
--   pg_net  chama uma rota da Vercel de forma assíncrona, sem segurar conexão
--
-- Junto, isso é "enfileira e processa depois" sem infraestrutura nova. O que
-- se perde em relação ao BullMQ é o painel pronto e a prioridade por job; o
-- que se ganha é não ter servidor para administrar, atualizar e vigiar.
--
-- ## O que isto NÃO faz sozinho
--
-- Nenhuma fila é criada aqui, nenhum job é agendado, nada muda de
-- comportamento. Instalar a extensão só torna `pgmq.create`, `pgmq.send` e
-- `pgmq.read` disponíveis. Quem cria fila e agenda consumo é a Fase 3, com o
-- caso concreto na mão — que é o webhook do WhatsApp, hoje fazendo download de
-- mídia, transcrição e chamada de IA dentro da request.
--
-- Verificado antes de instalar, num ensaio revertido: criar fila, enviar e ler
-- com visibility timeout funcionam neste banco.
CREATE EXTENSION IF NOT EXISTS pgmq;

-- O pgmq cria o schema `pgmq` com as tabelas de fila. Sem GRANT, quem se
-- conecta como service_role não enxerga — e é o service_role que a aplicação
-- usa nos caminhos sem sessão (webhook, cron).
--
-- O DO existe pelo mesmo motivo do GRANT do pg_cron: o schema é criado pela
-- extensão, e um GRANT solto quebraria a migration inteira num banco onde ela
-- já estivesse instalada de outro jeito.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgmq') THEN
    GRANT USAGE ON SCHEMA pgmq TO postgres, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA pgmq TO postgres, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgmq TO postgres, service_role;
  END IF;
END
$$;
