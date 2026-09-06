import 'server-only';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';

export type Fornecedor = Database['public']['Tables']['fornecedores']['Row'];
export type FornecedorApelido = Database['public']['Tables']['fornecedor_apelidos']['Row'];

export interface ListFornecedoresFilters {
  q?: string;
  categoria_id?: string;
  includeArchived?: boolean;
  onlyArchived?: boolean;
}

/**
 * Remove caracteres que quebram o filter string do PostgREST (`.or(...)`).
 * PostgREST interpreta `,` `(` `)` como separadores/agrupadores; `\` como escape.
 * Sanitiza sem tentar escapar — para search UI, aceitável dropá-los.
 */
function sanitizeSearchQuery(raw: string): string {
  return raw.replace(/[,()\\]/gu, ' ').trim();
}

export async function listFornecedores(filters: ListFornecedoresFilters = {}): Promise<Fornecedor[]> {
  const supabase = await createClient();
  let query = supabase.from('fornecedores').select('*').order('created_at', { ascending: false });

  if (filters.onlyArchived) {
    query = query.not('deleted_at', 'is', null);
  } else if (!filters.includeArchived) {
    query = query.is('deleted_at', null);
  }

  if (filters.categoria_id) {
    query = query.eq('categoria_id', filters.categoria_id);
  }

  if (filters.q && filters.q.trim().length > 0) {
    const q = sanitizeSearchQuery(filters.q);
    if (q.length > 0) {
      // busca em nome OR razao_social OR documento (case-insensitive)
      const digits = q.replace(/\D/gu, '');
      const docClause = digits.length >= 3 ? `,documento.ilike.%${digits}%` : '';
      query = query.or(`nome.ilike.%${q}%,razao_social.ilike.%${q}%${docClause}`);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar fornecedores: ${error.message}`);
  return data ?? [];
}

export async function getFornecedor(id: string): Promise<Fornecedor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('fornecedores').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Falha ao carregar fornecedor: ${error.message}`);
  return data;
}

export async function listFornecedorApelidos(fornecedor_id: string): Promise<FornecedorApelido[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fornecedor_apelidos')
    .select('*')
    .eq('fornecedor_id', fornecedor_id)
    .order('vezes_visto', { ascending: false });
  if (error) throw new Error(`Falha ao listar apelidos: ${error.message}`);
  return data ?? [];
}
