import 'server-only';
import { STATUS_QUE_CONTAM } from '@/lib/status-labels';
import { createClient } from '@/lib/supabase/server';
import { pareceUuid } from '@/lib/util/uuid';
import type { Database } from '@nogma/db';
import { type ResumoFinanceiroDaObra, montarResumo } from '@/lib/financeiro/resumo-obra';

export type Recebimento = Database['public']['Tables']['recebimentos']['Row'];

/** Parcelas vivas de uma obra, mais recente primeiro. Sessão do usuário (RLS). */
export async function listRecebimentosDaObra(obraId: string): Promise<Recebimento[]> {
  if (!pareceUuid(obraId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('recebimentos')
    .select('*')
    .eq('obra_id', obraId)
    .is('deleted_at', null)
    .order('data_recebimento', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Falha ao listar recebimentos: ${error.message}`);
  return data ?? [];
}

/**
 * Os quatro números que respondem "como está a obra": contrato, gasto,
 * recebido e resultado. A mesma conta é feita pela ferramenta do agente
 * (`lib/ia/ferramentas/crm.ts`) com o cliente de serviço — se mudar a regra
 * aqui, mude lá.
 */
export async function resumoFinanceiroDaObra(obraId: string): Promise<ResumoFinanceiroDaObra> {
  const supabase = await createClient();
  const [{ data: obra }, { data: pagamentos }, { data: recebimentos }] = await Promise.all([
    supabase.from('obras').select('valor_contrato').eq('id', obraId).maybeSingle(),
    supabase
      .from('pagamentos')
      .select('valor')
      .eq('obra_id', obraId)
      .is('deleted_at', null)
      .in('status_pagto', [...STATUS_QUE_CONTAM]),
    supabase.from('recebimentos').select('valor').eq('obra_id', obraId).is('deleted_at', null),
  ]);

  const contrato = obra?.valor_contrato == null ? null : Number(obra.valor_contrato);
  const gasto = (pagamentos ?? []).reduce((acc, p) => acc + Number(p.valor), 0);
  const recebido = (recebimentos ?? []).reduce((acc, r) => acc + Number(r.valor), 0);
  return montarResumo({ contrato, gasto, recebido });
}
