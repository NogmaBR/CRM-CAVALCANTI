import 'server-only';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type JobLido, type NomeFila, type PayloadDe, VISIBILITY_TIMEOUT } from './tipos';

/**
 * Acesso às filas.
 *
 * Fina de propósito: tudo que é regra — whitelist, visibility timeout,
 * arquivamento — está no banco, nas funções `fila_*`. Aqui só há tipo e
 * tradução. Se a lógica vivesse dos dois lados, um dia divergiria.
 *
 * ## Sempre service-role
 *
 * As funções `fila_*` só têm GRANT para `service_role`. Não é descuido: fila
 * não é coisa que sessão de usuário mexe. Quem enfileira é o webhook, quem
 * consome é o cron — os dois sem sessão.
 */

type Client = SupabaseClient<Database>;

/** Uma linha como o `fila_ler` devolve, antes de virar `JobLido`. */
interface LinhaFila {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  payload: unknown;
}

interface LinhaArquivada {
  fila: string;
  msg_id: number;
  tentativas: number;
  enfileirado_em: string;
  arquivado_em: string;
  payload: unknown;
}

interface LinhaMetrica {
  fila: string;
  na_fila: number;
  visiveis: number;
  mais_antiga_seg: number | null;
  total_ja_enfileirado: number;
}

/**
 * Põe um job na fila.
 *
 * `delaySegundos` é o backoff: a mensagem só fica visível depois desse tempo.
 * É o que permite retentativa espaçada sem nenhuma infraestrutura de retry —
 * quem falhou reenfileira a si mesmo mais adiante no tempo.
 *
 * **Lança se não conseguir enfileirar.** Aqui é o oposto de `emitir`: um
 * evento perdido significa uma automação que não rodou, mas um job perdido
 * significa uma mídia que nunca foi baixada, e ninguém vai descobrir. Quem
 * chama precisa saber.
 */
export async function enfileirar<F extends NomeFila>(
  supabase: Client,
  fila: F,
  payload: PayloadDe<F>,
  opcoes: { delaySegundos?: number } = {},
): Promise<number> {
  const { data, error } = await supabase.rpc('fila_enfileirar', {
    p_fila: fila,
    p_payload: payload as never,
    p_delay: opcoes.delaySegundos ?? 0,
  });

  if (error) {
    throw new Error(`Não foi possível enfileirar em "${fila}": ${error.message}`);
  }
  return Number(data);
}

/**
 * Lê um lote da fila.
 *
 * As mensagens somem da fila por `VISIBILITY_TIMEOUT[fila]` segundos. Se o
 * processo morrer no meio, elas voltam sozinhas — e é por isso que **todo
 * handler precisa ser idempotente**: a entrega é "pelo menos uma vez", nunca
 * "exatamente uma".
 */
export async function ler<F extends NomeFila>(
  supabase: Client,
  fila: F,
  quantidade = 5,
): Promise<JobLido<F>[]> {
  // `.returns<T>()` e não um cast: função que devolve conjunto vira um
  // filter builder no cliente (dá para encadear `.eq`, `.limit`), e o tipo do
  // `data` só se resolve quando se declara o formato da linha.
  const { data, error } = await supabase
    .rpc('fila_ler', {
      p_fila: fila,
      p_vt: VISIBILITY_TIMEOUT[fila],
      p_qtd: quantidade,
    })
    .returns<LinhaFila[]>();

  if (error) {
    throw new Error(`Não foi possível ler a fila "${fila}": ${error.message}`);
  }

  return (data ?? []).map((linha) => ({
    fila,
    msgId: Number(linha.msg_id),
    tentativa: linha.read_ct,
    enfileiradoEm: linha.enqueued_at,
    payload: linha.payload as PayloadDe<F>,
  }));
}

/** Deu certo: apaga da fila. */
export async function concluir(supabase: Client, fila: NomeFila, msgId: number): Promise<void> {
  const { error } = await supabase.rpc('fila_concluir', { p_fila: fila, p_msg_id: msgId });
  if (error) {
    // Não lança: o trabalho já foi feito. O que se perde aqui é a remoção, e a
    // mensagem vai voltar depois do visibility timeout para ser refeita — o
    // que só é seguro porque os handlers são idempotentes. Registrar alto,
    // porém: isso vira trabalho repetido, e trabalho repetido em silêncio é
    // como uma fila entope sem ninguém entender por quê.
    console.error(`[fila:${fila}] não consegui concluir a msg ${msgId}: ${error.message}`);
  }
}

/**
 * Desistiu: move para o arquivo (`pgmq.a_<fila>`).
 *
 * É a dead-letter. A mensagem sai do caminho mas continua existindo — apagar
 * o que falhou seria destruir a evidência justamente do caso que precisa ser
 * investigado.
 */
export async function arquivar(supabase: Client, fila: NomeFila, msgId: number): Promise<void> {
  const { error } = await supabase.rpc('fila_arquivar', { p_fila: fila, p_msg_id: msgId });
  if (error) {
    console.error(`[fila:${fila}] não consegui arquivar a msg ${msgId}: ${error.message}`);
  }
}

export interface MetricaFila {
  fila: string;
  naFila: number;
  visiveis: number;
  maisAntigaSeg: number | null;
  totalJaEnfileirado: number;
}

export interface Arquivada {
  fila: string;
  msgId: number;
  tentativas: number;
  enfileiradoEm: string;
  arquivadoEm: string;
  payload: unknown;
}

/**
 * As que desistiram.
 *
 * Sem isto, arquivar seria só um jeito mais educado de perder: a mensagem sai
 * do caminho e ninguém nunca mais a vê.
 */
export async function arquivadas(supabase: Client, limite = 50): Promise<Arquivada[]> {
  const { data, error } = await supabase
    .rpc('fila_arquivadas', { p_limite: limite })
    .returns<LinhaArquivada[]>();

  if (error) {
    throw new Error(`Não foi possível ler as mensagens arquivadas: ${error.message}`);
  }

  return (data ?? []).map((a) => ({
    fila: a.fila,
    msgId: Number(a.msg_id),
    tentativas: a.tentativas,
    enfileiradoEm: a.enfileirado_em,
    arquivadoEm: a.arquivado_em,
    payload: a.payload,
  }));
}

/** O que o painel do BullMQ daria pronto. */
export async function metricas(supabase: Client): Promise<MetricaFila[]> {
  const { data, error } = await supabase.rpc('fila_metricas').returns<LinhaMetrica[]>();
  if (error) {
    throw new Error(`Não foi possível ler as métricas das filas: ${error.message}`);
  }
  return (data ?? []).map((m) => ({
    fila: m.fila,
    naFila: Number(m.na_fila),
    visiveis: Number(m.visiveis),
    maisAntigaSeg: m.mais_antiga_seg,
    totalJaEnfileirado: Number(m.total_ja_enfileirado),
  }));
}
