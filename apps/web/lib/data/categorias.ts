import 'server-only';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';

export type Categoria = Database['public']['Tables']['categorias']['Row'];

export interface CategoriaComContagem extends Categoria {
  qtd_pagamentos: number;
  total_valor: number;
}

export async function listCategorias(includeArchived = false): Promise<Categoria[]> {
  const supabase = await createClient();
  let query = supabase.from('categorias').select('*').order('nome', { ascending: true });
  if (!includeArchived) query = query.is('deleted_at', null);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar categorias: ${error.message}`);
  return data ?? [];
}

export async function getCategoria(id: string): Promise<Categoria | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('categorias').select('*').eq('id', id).maybeSingle();
  return data ?? null;
}

/**
 * Retorna categorias enriquecidas com qtd_pagamentos + total_valor (soma).
 * Usado na tela admin `/config/categorias` — permite ao gestor saber qual
 * categoria está sendo usada antes de arquivar.
 *
 * Duas queries batched (não N+1). Filtra pagamentos ativos (deleted_at IS NULL)
 * — pagamentos arquivados não contam.
 */
export async function listCategoriasComContagem(
  includeArchived = false,
): Promise<CategoriaComContagem[]> {
  const supabase = await createClient();

  const [catsRes, pagsRes] = await Promise.all([
    (async () => {
      let q = supabase.from('categorias').select('*').order('nome', { ascending: true });
      if (!includeArchived) q = q.is('deleted_at', null);
      return q;
    })(),
    supabase
      .from('pagamentos')
      .select('categoria_id, valor')
      .not('categoria_id', 'is', null)
      .is('deleted_at', null),
  ]);

  if (catsRes.error) throw new Error(`Falha ao listar categorias: ${catsRes.error.message}`);
  const cats = catsRes.data ?? [];
  const pags = pagsRes.data ?? [];

  const stats = new Map<string, { qtd: number; total: number }>();
  for (const p of pags) {
    if (!p.categoria_id) continue;
    const cur = stats.get(p.categoria_id);
    stats.set(p.categoria_id, {
      qtd: (cur?.qtd ?? 0) + 1,
      total: (cur?.total ?? 0) + Number(p.valor),
    });
  }

  return cats.map((c) => {
    const s = stats.get(c.id);
    return {
      ...c,
      qtd_pagamentos: s?.qtd ?? 0,
      total_valor: s?.total ?? 0,
    };
  });
}
