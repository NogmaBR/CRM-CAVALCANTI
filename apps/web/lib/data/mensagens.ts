import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { pareceUuid } from '@/lib/util/uuid';
import type { Database } from '@nogma/db';

export type MensagemWhats = Database['public']['Tables']['mensagens_whats']['Row'];
export type MsgStatus = Database['public']['Enums']['msg_status'];
export type MsgTipo = Database['public']['Enums']['msg_tipo'];

export interface MensagemFeedItem extends MensagemWhats {
  pagamento_valor: number | null;
  pagamento_obra_nome: string | null;
}

/**
 * Retorna as últimas N mensagens de WhatsApp (default 100), mais recentes
 * primeiro. Enriquece com valor + nome de obra do pagamento vinculado
 * quando existir (evita N+1 via batched lookup).
 */
export async function listMensagens(limit = 100): Promise<MensagemFeedItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('mensagens_whats')
    .select('*')
    .order('recebida_em', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Falha ao listar mensagens: ${error.message}`);
  const rows = data ?? [];

  const pagamentoIds = [
    ...new Set(rows.map((r) => r.pagamento_id).filter((v): v is string => !!v)),
  ];

  const pagamentosMap = new Map<string, { valor: number; obra_id: string }>();
  const obrasMap = new Map<string, string>();

  if (pagamentoIds.length > 0) {
    const { data: pagtos } = await supabase
      .from('pagamentos')
      .select('id, valor, obra_id')
      .in('id', pagamentoIds);

    for (const p of pagtos ?? []) {
      pagamentosMap.set(p.id, { valor: Number(p.valor), obra_id: p.obra_id });
    }

    const obraIds = [...new Set([...pagamentosMap.values()].map((p) => p.obra_id))];
    if (obraIds.length > 0) {
      const { data: obras } = await supabase.from('obras').select('id, nome').in('id', obraIds);
      for (const o of obras ?? []) obrasMap.set(o.id, o.nome);
    }
  }

  return rows.map((r) => {
    const pagto = r.pagamento_id ? pagamentosMap.get(r.pagamento_id) : undefined;
    return {
      ...r,
      pagamento_valor: pagto?.valor ?? null,
      pagamento_obra_nome: pagto ? (obrasMap.get(pagto.obra_id) ?? null) : null,
    };
  });
}

/**
 * Uma mensagem pelo id — para a página do pagamento mostrar a foto/áudio que
 * deu origem ao lançamento. `null` se não existe ou a RLS não deixa ver.
 */
export async function getMensagem(id: string): Promise<MensagemWhats | null> {
  if (!pareceUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('mensagens_whats')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar mensagem: ${error.message}`);
  return data;
}
