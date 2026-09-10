import 'server-only';
import { executarAutomacoes } from '@/lib/automations/engine';
import { logger } from '@/lib/log';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Evento, NomeEvento, PayloadDe } from './tipos';

const log = logger('eventos');

/**
 * Barramento de eventos de domínio.
 *
 * ## Como funciona hoje, e por quê
 *
 * O despacho é **síncrono e dentro da request**. Isso não é um atalho: no
 * Vercel serverless não existe processo vivo entre requests, então um bus
 * em memória com listeners registrados no boot simplesmente não sobrevive —
 * cada invocação tem o próprio heap. Assinar no boot funcionaria em dev e
 * falharia em produção de forma silenciosa, que é o pior tipo de falha.
 *
 * Então: quem emite chama `emitir`, o engine avalia as regras e age, tudo na
 * mesma invocação.
 *
 * ## O que a Fase 3 muda (e o que não muda)
 *
 * Quando entrarem fila e worker, `emitir` passa a **enfileirar** em vez de
 * executar, e o worker chama o mesmo `executarAutomacoes`. Nenhum chamador
 * muda — é por isso que a emissão está atrás desta função e não espalhada.
 *
 * Até lá vale a limitação: **ação lenta atrasa a request do usuário.** Regra
 * que faz I/O demorado (enviar WhatsApp, chamar LLM) deve ser marcada como
 * `apenasAgendada` na definition e rodar pelo cron, não no evento.
 *
 * ## Emitir nunca pode quebrar quem emitiu
 *
 * Se uma automação falhar, o pagamento tem que ser criado do mesmo jeito.
 * Automação é efeito colateral, não parte da transação. Por isso tudo aqui é
 * best-effort e a falha vai para o log, não para cima.
 */

type Client = SupabaseClient<Database>;

interface OpcoesEmissao {
  /** Quem causou. `null` em cron e webhook. */
  userId?: string | null;
  /** Quando o fato aconteceu, se diferente de agora. */
  em?: string;
  /**
   * Não executa nada; só registra o que teria acontecido. Usado nos testes e
   * no botão "simular" do painel.
   */
  simular?: boolean;
}

export async function emitir<E extends NomeEvento>(
  supabase: Client,
  nome: E,
  payload: PayloadDe<E>,
  opcoes: OpcoesEmissao = {},
): Promise<void> {
  const evento: Evento<E> = {
    nome,
    payload,
    em: opcoes.em ?? new Date().toISOString(),
    userId: opcoes.userId ?? null,
  };

  try {
    await executarAutomacoes(supabase, evento as Evento, { simular: opcoes.simular ?? false });
  } catch (err) {
    // Chegou aqui significa que o próprio engine quebrou, não uma regra — as
    // falhas de regra são capturadas lá dentro e viram linha de log. Ainda
    // assim não propagamos: quem emitiu estava criando um pagamento.
    log.erro('engine_falhou', { evento: nome, err });
  }
}
