import 'server-only';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSearchQuery } from '@/lib/util/search';

export type Pagamento = Database['public']['Tables']['pagamentos']['Row'];

export interface ListPagamentosFilters {
  q?: string;
  obra_id?: string;
  fornecedor_id?: string;
  categoria_id?: string;
  status_pagto?: 'confirmado' | 'aguardando' | 'erro';
  origem?: 'whatsapp' | 'manual' | 'importado';
  from?: string; // AAAA-MM-DD inclusive
  to?: string;   // AAAA-MM-DD inclusive
  includeArchived?: boolean;
  onlyArchived?: boolean;
}

export async function listPagamentos(filters: ListPagamentosFilters = {}): Promise<Pagamento[]> {
  const supabase = await createClient();
  let query = supabase
    .from('pagamentos')
    .select('*')
    .order('data_pagamento', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.onlyArchived) {
    query = query.not('deleted_at', 'is', null);
  } else if (!filters.includeArchived) {
    query = query.is('deleted_at', null);
  }

  if (filters.obra_id) query = query.eq('obra_id', filters.obra_id);
  if (filters.fornecedor_id) query = query.eq('fornecedor_id', filters.fornecedor_id);
  if (filters.categoria_id) query = query.eq('categoria_id', filters.categoria_id);
  if (filters.status_pagto) query = query.eq('status_pagto', filters.status_pagto);
  if (filters.origem) query = query.eq('origem', filters.origem);
  if (filters.from) query = query.gte('data_pagamento', filters.from);
  if (filters.to) query = query.lte('data_pagamento', filters.to);

  if (filters.q && filters.q.trim().length > 0) {
    const q = sanitizeSearchQuery(filters.q);
    if (q.length > 0) {
      query = query.or(`descricao.ilike.%${q}%,observacoes.ilike.%${q}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar pagamentos: ${error.message}`);
  return data ?? [];
}

export async function getPagamento(id: string): Promise<Pagamento | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('pagamentos').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Falha ao carregar pagamento: ${error.message}`);
  return data;
}

export interface SumPagamentosFilters {
  obra_id?: string;
  status_pagto?: 'confirmado' | 'aguardando' | 'erro';
  /** AAAA-MM (ex: '2026-09') — agrega o mês inteiro */
  month?: string;
  from?: string;
  to?: string;
}

/**
 * Retorna { total, count } de pagamentos não-arquivados que passam nos filtros.
 * Usa fetch de valor + reduce client-side (Supabase JS não tem SUM native).
 * Dataset esperado é <10k rows — aceitável.
 */
export async function sumPagamentosBy(
  filters: SumPagamentosFilters = {},
): Promise<{ total: number; count: number }> {
  const supabase = await createClient();
  let query = supabase.from('pagamentos').select('valor', { count: 'exact' }).is('deleted_at', null);

  if (filters.obra_id) query = query.eq('obra_id', filters.obra_id);
  if (filters.status_pagto) query = query.eq('status_pagto', filters.status_pagto);
  if (filters.month) {
    const [year, mo] = filters.month.split('-');
    if (year && mo) {
      const first = `${year}-${mo}-01`;
      // Último dia do mês: adiciona 1 ao mês, dia 0 = último do anterior
      const nextMo = Number(mo) === 12 ? '01' : String(Number(mo) + 1).padStart(2, '0');
      const nextYear = Number(mo) === 12 ? String(Number(year) + 1) : year;
      const nextFirst = `${nextYear}-${nextMo}-01`;
      query = query.gte('data_pagamento', first).lt('data_pagamento', nextFirst);
    }
  }
  if (filters.from) query = query.gte('data_pagamento', filters.from);
  if (filters.to) query = query.lte('data_pagamento', filters.to);

  const { data, error, count } = await query;
  if (error) throw new Error(`Falha ao somar pagamentos: ${error.message}`);
  const total = (data ?? []).reduce((s, row) => s + Number(row.valor ?? 0), 0);
  return { total, count: count ?? 0 };
}
