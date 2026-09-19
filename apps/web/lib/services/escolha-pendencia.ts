import 'server-only';
import { logger } from '@/lib/log';
import type { Database } from '@nogma/db';
import type { Json } from '@nogma/db/types';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient<Database>;

const log = logger('escolha-pendencia');

/** Quanto tempo "qual delas?" fica esperando o número. */
export const JANELA_ESCOLHA_MIN = 10;

export interface EscolhaDePendencia {
  /**
   * `sim`/`nao`: o agente perguntou "qual delas?" e espera o número.
   * `lote`: o agente mandou a lista de um lote ("Li 3 comprovantes: 1) … 2) …")
   * e espera SIM/NÃO para todos, ou "2 não" / "2 é na INOX" para um.
   */
  interpretacao: 'sim' | 'nao' | 'lote';
  itens: Array<{ n: number; confirmacaoId: string }>;
}

/** A lista de um lote vale o dia inteiro, como qualquer pendência. */
export const JANELA_LOTE_H = 24;

/**
 * Duas ou mais perguntas abertas e um "sim" solto: o agente perguntou qual,
 * e guarda aqui (por chat) a lista numerada e o que a pessoa quis dizer
 * (sim ou não). A próxima mensagem com número, ou TODOS, fecha.
 */
export async function guardarEscolha(
  supabase: Client,
  chatId: string,
  escolha: EscolhaDePendencia,
): Promise<void> {
  const agora = new Date().toISOString();
  const { error } = await supabase.from('conversa_estado').upsert(
    {
      chat_id: chatId,
      escolha_pendencias: escolha as unknown as Json,
      escolha_em: agora,
      updated_at: agora,
    },
    { onConflict: 'chat_id' },
  );
  if (error) log.aviso('escolha_nao_guardada', { erro: error.message });
}

export async function lerEscolha(
  supabase: Client,
  chatId: string,
  agora = new Date(),
): Promise<EscolhaDePendencia | null> {
  const { data } = await supabase
    .from('conversa_estado')
    .select('escolha_pendencias, escolha_em')
    .eq('chat_id', chatId)
    .maybeSingle();
  if (!data?.escolha_pendencias || !data.escolha_em) return null;
  const e = data.escolha_pendencias as unknown as Partial<EscolhaDePendencia>;
  if (
    (e.interpretacao !== 'sim' && e.interpretacao !== 'nao' && e.interpretacao !== 'lote') ||
    !Array.isArray(e.itens)
  ) {
    return null;
  }
  const validadeMs =
    e.interpretacao === 'lote' ? JANELA_LOTE_H * 3600_000 : JANELA_ESCOLHA_MIN * 60_000;
  if (new Date(data.escolha_em).getTime() < agora.getTime() - validadeMs) return null;
  return { interpretacao: e.interpretacao, itens: e.itens };
}

export async function limparEscolha(supabase: Client, chatId: string): Promise<void> {
  await supabase
    .from('conversa_estado')
    .update({ escolha_pendencias: null, escolha_em: null, updated_at: new Date().toISOString() })
    .eq('chat_id', chatId);
}

/** Correção ou desfazer: a obra da conversa deixa de valer a partir de agora. */
export async function zerarObraDaConversa(
  supabase: Client,
  chatId: string,
  obraNova: { id: string } | null = null,
): Promise<void> {
  const agora = new Date().toISOString();
  const { error } = await supabase.from('conversa_estado').upsert(
    {
      chat_id: chatId,
      obra_conversa_reset_em: agora,
      obra_conversa_id: obraNova?.id ?? null,
      obra_conversa_em: obraNova ? agora : null,
      updated_at: agora,
    },
    { onConflict: 'chat_id' },
  );
  if (error) log.aviso('conversa_estado_nao_gravado', { erro: error.message });
}
