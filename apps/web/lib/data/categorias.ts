import 'server-only';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';

export type Categoria = Database['public']['Tables']['categorias']['Row'];

export async function listCategorias(): Promise<Categoria[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .is('deleted_at', null)
    .order('nome', { ascending: true });
  if (error) throw new Error(`Falha ao listar categorias: ${error.message}`);
  return data ?? [];
}
