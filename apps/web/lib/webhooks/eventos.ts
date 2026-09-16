import { logger } from '@/lib/log';
import type { UazapiInbound } from '@/lib/schemas/uazapi';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Autenticacao } from './autenticar-uazapi';

/**
 * Rastro de cada evento autenticado que chega ao webhook, para a tela
 * `/config/whatsapp`. Guarda forma e decisão — chat, remetente, tipo, ação —
 * nunca o texto nem a mídia. É best-effort: falhar aqui não pode derrubar o
 * webhook (um 5xx faria o provider reenviar a mensagem).
 *
 * `bruto` é o payload como veio (para ler `EventType`/`event` e o chat de um
 * evento que o adaptador descartou); `payload` é o canônico quando existe.
 */

const log = logger('webhook_eventos');

type Client = SupabaseClient<Database>;

export interface CamposDoEvento {
  bruto: unknown;
  payload?: UazapiInbound;
  acao: string;
  detalhe?: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Puro: o que vai para a linha, a partir do bruto e do canônico. */
export function linhaDoEvento(
  autenticacao: Exclude<Autenticacao, null>,
  campos: CamposDoEvento,
): Database['public']['Tables']['webhook_eventos']['Insert'] {
  const r = (campos.bruto && typeof campos.bruto === 'object' ? campos.bruto : {}) as Record<
    string,
    unknown
  >;
  const m = (r.message && typeof r.message === 'object' ? r.message : {}) as Record<
    string,
    unknown
  >;
  const p = campos.payload;
  const evento = str(r.EventType) ?? str(r.event) ?? (str(r.id) && str(r.from) ? 'canonico' : null);
  return {
    autenticacao,
    evento,
    chat_id: p?.chatId ?? str(m.chatid) ?? str(m.chatId) ?? null,
    remetente: p?.from ?? str(m.sender_pn) ?? str(m.sender) ?? null,
    is_group: p?.isGroup ?? (typeof m.isGroup === 'boolean' ? m.isGroup : null),
    tipo: p?.type ?? str(m.messageType) ?? null,
    msg_id: p?.id ?? str(m.messageid) ?? null,
    acao: campos.acao,
    detalhe: campos.detalhe ? String(campos.detalhe).slice(0, 300) : null,
  };
}

export async function registrarEventoWebhook(
  supabase: Client,
  autenticacao: Exclude<Autenticacao, null>,
  campos: CamposDoEvento,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('webhook_eventos')
      .insert(linhaDoEvento(autenticacao, campos));
    if (error) log.aviso('evento_nao_registrado', { erro: error.message });
  } catch (err) {
    log.aviso('evento_nao_registrado', { err });
  }
}
