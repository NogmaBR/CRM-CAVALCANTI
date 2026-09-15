import 'server-only';
import { CATEGORIAS, type DocCategoria } from '@/lib/status-labels';
import { createClient } from '@/lib/supabase/server';
import { pareceUuid } from '@/lib/util/uuid';
import type { Database } from '@nogma/db';

/**
 * Leituras do acervo para o painel: as pastas de uma obra, o diário e as
 * notas que a conciliação não conseguiu ligar a um pagamento. Sessão do
 * usuário (RLS), como os outros getters de `lib/data`.
 */

export type RegistroObra = Database['public']['Tables']['registros_obra']['Row'];

export interface PastaDaObra {
  categoria: DocCategoria;
  quantidade: number;
}

/** Contagem por pasta, na ordem de exibição, só pastas com arquivo. */
export async function getPastasDaObra(obraId: string): Promise<PastaDaObra[]> {
  if (!pareceUuid(obraId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documentos')
    .select('categoria')
    .eq('obra_id', obraId)
    .is('deleted_at', null);
  if (error) throw new Error(`Falha ao contar pastas: ${error.message}`);

  const contagem = new Map<DocCategoria, number>();
  for (const d of data ?? []) contagem.set(d.categoria, (contagem.get(d.categoria) ?? 0) + 1);

  return CATEGORIAS.filter((c) => contagem.has(c)).map((c) => ({
    categoria: c,
    quantidade: contagem.get(c) ?? 0,
  }));
}

export interface RegistroComAutor extends RegistroObra {
  autor_nome: string | null;
}

export async function getRegistrosDaObra(obraId: string, limite = 20): Promise<RegistroComAutor[]> {
  if (!pareceUuid(obraId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('registros_obra')
    .select('*, autorizados ( nome )')
    .eq('obra_id', obraId)
    .is('deleted_at', null)
    .order('data_registro', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw new Error(`Falha ao listar o diário: ${error.message}`);

  return (data ?? []).map((r) => {
    const { autorizados, ...resto } = r as RegistroObra & { autorizados: { nome: string } | null };
    return { ...resto, autor_nome: autorizados?.nome ?? null };
  });
}

export interface DocumentoSemPagamento {
  id: string;
  nome_arquivo: string;
  numero_nf: string | null;
  tipo: Database['public']['Enums']['anexo_tipo'];
  origem: Database['public']['Enums']['doc_origem'];
  created_at: string | null;
  obra_id: string | null;
  obra_nome: string | null;
  fornecedor_nome: string | null;
}

/**
 * Notas/comprovantes da pasta NFs/Pagamentos que a conciliação já olhou e
 * não conseguiu ligar a um pagamento (ambíguo ou sem candidato). É o que o
 * gestor liga à mão em /pendentes.
 */
export async function getDocumentosSemPagamento(limite = 100): Promise<DocumentoSemPagamento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documentos')
    .select(
      'id, nome_arquivo, numero_nf, tipo, origem, created_at, obra_id, obras ( nome ), fornecedores ( nome )',
    )
    .eq('categoria', 'nfs_pagamentos')
    .is('pagamento_id', null)
    .not('conciliado_em', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw new Error(`Falha ao listar documentos sem pagamento: ${error.message}`);

  return (data ?? []).map((d) => ({
    id: d.id,
    nome_arquivo: d.nome_arquivo,
    numero_nf: d.numero_nf,
    tipo: d.tipo,
    origem: d.origem,
    created_at: d.created_at,
    obra_id: d.obra_id,
    obra_nome: (d.obras as { nome: string } | null)?.nome ?? null,
    fornecedor_nome: (d.fornecedores as { nome: string } | null)?.nome ?? null,
  }));
}

/** Pagamentos da obra sem documento, para o gestor escolher ao vincular. */
export async function getPagamentosSemDocumentoDaObra(
  obraId: string,
): Promise<Array<{ id: string; valor: number; data_pagamento: string; descricao: string | null }>> {
  if (!pareceUuid(obraId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pagamentos')
    .select('id, valor, data_pagamento, descricao, documentos ( id )')
    .eq('obra_id', obraId)
    .is('deleted_at', null)
    .order('data_pagamento', { ascending: false })
    .limit(200);
  if (error) throw new Error(`Falha ao listar pagamentos: ${error.message}`);
  return (data ?? [])
    .filter((p) => ((p.documentos as Array<{ id: string }> | null) ?? []).length === 0)
    .map((p) => ({
      id: p.id,
      valor: Number(p.valor),
      data_pagamento: p.data_pagamento,
      descricao: p.descricao,
    }));
}
