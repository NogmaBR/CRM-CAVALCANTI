import 'server-only';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSearchQuery } from '@/lib/util/search';

export type Documento = Database['public']['Tables']['documentos']['Row'];

export interface ListDocumentosFilters {
  q?: string;
  obra_id?: string;
  pagamento_id?: string;
  fornecedor_id?: string;
  tipo?: 'nota_fiscal' | 'comprovante' | 'contrato' | 'outro';
  includeArchived?: boolean;
  onlyArchived?: boolean;
}

export async function listDocumentos(filters: ListDocumentosFilters = {}): Promise<Documento[]> {
  const supabase = await createClient();
  let query = supabase.from('documentos').select('*').order('created_at', { ascending: false });

  if (filters.onlyArchived) {
    query = query.not('deleted_at', 'is', null);
  } else if (!filters.includeArchived) {
    query = query.is('deleted_at', null);
  }

  if (filters.obra_id) query = query.eq('obra_id', filters.obra_id);
  if (filters.pagamento_id) query = query.eq('pagamento_id', filters.pagamento_id);
  if (filters.fornecedor_id) query = query.eq('fornecedor_id', filters.fornecedor_id);
  if (filters.tipo) query = query.eq('tipo', filters.tipo);

  if (filters.q && filters.q.trim().length > 0) {
    const q = sanitizeSearchQuery(filters.q);
    if (q.length > 0) {
      query = query.or(`nome_arquivo.ilike.%${q}%,numero_nf.ilike.%${q}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar documentos: ${error.message}`);
  return data ?? [];
}

export async function getDocumento(id: string): Promise<Documento | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('documentos').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Falha ao carregar documento: ${error.message}`);
  return data;
}
