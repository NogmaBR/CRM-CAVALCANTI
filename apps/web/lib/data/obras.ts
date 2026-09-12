import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSearchQuery } from '@/lib/util/search';
import { pareceUuid } from '@/lib/util/uuid';
import type { Database } from '@nogma/db';

export type Obra = Database['public']['Tables']['obras']['Row'];

export interface ListObrasFilters {
  q?: string;
  status?: 'ativa' | 'pausada' | 'concluida' | 'arquivada';
  includeArchived?: boolean;
}

export async function listObras(filters: ListObrasFilters = {}): Promise<Obra[]> {
  const supabase = await createClient();
  let query = supabase.from('obras').select('*').order('created_at', { ascending: false });

  if (!filters.includeArchived && filters.status !== 'arquivada') {
    query = query.is('deleted_at', null);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.q && filters.q.trim().length > 0) {
    const q = sanitizeSearchQuery(filters.q);
    if (q.length > 0) {
      query = query.or(`nome.ilike.%${q}%,cliente.ilike.%${q}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar obras: ${error.message}`);
  return data ?? [];
}

export async function getObra(id: string): Promise<Obra | null> {
  // Id que não é uuid vira 404, não erro 500 (o Postgres recusaria o cast).
  if (!pareceUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('obras').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Falha ao carregar obra: ${error.message}`);
  return data;
}
