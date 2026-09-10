import 'server-only';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { arquivar, concluir, ler } from './fila';
import { type JobLido, MAX_TENTATIVAS, type NomeFila } from './tipos';

/**
 * O consumidor.
 *
 * Substitui o worker que consumiria BullMQ para sempre. Como não há processo
 * vivo, ele é chamado de tempos em tempos, drena um lote e devolve o controle.
 *
 * ## O que decide, e por quê
 *
 * Três desfechos por mensagem, e nenhum é "tentar para sempre":
 *
 *   **concluída** — o handler passou. Apaga da fila.
 *   **arquivada** — já falhou `MAX_TENTATIVAS` vezes. Vai para a dead-letter,
 *                   onde continua existindo para alguém investigar.
 *   **devolvida**  — falhou agora, ainda tem tentativa. Não faz nada: o
 *                   visibility timeout expira e ela reaparece sozinha.
 *
 * O terceiro é o que costuma surpreender. Não existe "reenfileirar em caso de
 * erro" no código porque **não é preciso**: quem não conclui, devolve por
 * omissão. Isso vale inclusive para o caso em que a função inteira morre no
 * meio — que é justamente o caso que um retry explícito não cobriria.
 */

type Client = SupabaseClient<Database>;

export type Handler<F extends NomeFila> = (supabase: Client, job: JobLido<F>) => Promise<void>;

export interface ResultadoLote {
  fila: NomeFila;
  lidas: number;
  concluidas: number;
  arquivadas: number;
  devolvidas: number;
}

/**
 * Drena um lote de uma fila.
 *
 * Nunca lança por causa de uma mensagem: uma que quebra não pode impedir as
 * outras do lote. Só propaga se a própria leitura falhar — aí não há lote.
 */
export async function consumirFila<F extends NomeFila>(
  supabase: Client,
  fila: F,
  handler: Handler<F>,
  quantidade = 5,
): Promise<ResultadoLote> {
  const jobs = await ler(supabase, fila, quantidade);

  const resultado: ResultadoLote = {
    fila,
    lidas: jobs.length,
    concluidas: 0,
    arquivadas: 0,
    devolvidas: 0,
  };

  for (const job of jobs) {
    // A checagem vem ANTES de executar, não depois de falhar.
    //
    // `tentativa` conta esta entrega. Se já chegou ao teto, executar de novo
    // seria fazer a quarta tentativa de algo que falhou três vezes — e, pior,
    // com efeito colateral: no caso do envio de WhatsApp, uma quarta mensagem
    // para alguém que já recebeu três.
    if (job.tentativa > MAX_TENTATIVAS) {
      console.error(`[fila:${fila}] msg ${job.msgId} arquivada após ${job.tentativa - 1} falhas.`);
      await arquivar(supabase, fila, job.msgId);
      resultado.arquivadas += 1;
      continue;
    }

    try {
      await handler(supabase, job);
      await concluir(supabase, fila, job.msgId);
      resultado.concluidas += 1;
    } catch (err) {
      // Devolvida por omissão: o visibility timeout expira e ela volta.
      console.error(
        `[fila:${fila}] msg ${job.msgId} falhou (tentativa ${job.tentativa}/${MAX_TENTATIVAS}):`,
        err instanceof Error ? err.message : err,
      );
      resultado.devolvidas += 1;
    }
  }

  return resultado;
}
