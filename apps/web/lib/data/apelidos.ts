import 'server-only';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';

export type FornecedorApelido = Database['public']['Tables']['fornecedor_apelidos']['Row'];

/**
 * Data helpers pra fornecedor_apelidos (Fase 3 schema).
 * RLS: profiles.papel admin/gestor/financeiro pode CRUD; leitura só SELECT.
 */

export async function listApelidosByFornecedor(fornecedorId: string): Promise<FornecedorApelido[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fornecedor_apelidos')
    .select('*')
    .eq('fornecedor_id', fornecedorId)
    .order('vezes_visto', { ascending: false });
  if (error) throw new Error(`Falha ao listar apelidos: ${error.message}`);
  return data ?? [];
}

/** Verifica se apelido já existe (case-insensitive) pra qualquer fornecedor. */
export async function findApelidoConflict(
  apelido: string,
): Promise<{ fornecedor_id: string; apelido: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('fornecedor_apelidos')
    .select('fornecedor_id, apelido')
    .ilike('apelido', apelido.trim())
    .limit(1)
    .maybeSingle();
  return data;
}
