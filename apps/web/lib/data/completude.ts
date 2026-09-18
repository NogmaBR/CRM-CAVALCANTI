import 'server-only';
import {
  type Completude,
  type ContextoDaObra,
  type ResumoDeNiveis,
  avaliarDocumento,
  avaliarFornecedor,
  avaliarObra,
  avaliarPagamento,
  resumirNiveis,
} from '@/lib/completude/regras';
import { etapasEstouradasPorObra } from '@/lib/data/cronograma';
import type { Documento } from '@/lib/data/documentos';
import type { Fornecedor } from '@/lib/data/fornecedores';
import type { Obra } from '@/lib/data/obras';
import type { Pagamento } from '@/lib/data/pagamentos';
import { STATUS_QUE_CONTAM } from '@/lib/status-labels';
import { createClient } from '@/lib/supabase/server';
import { hojeBR } from '@/lib/util/datas';

/**
 * O contexto que as regras de completude precisam e que não está na linha
 * da entidade: quem tem documento, quantos pagamentos da obra estão sem
 * nota, o que há em cada pasta. Tudo com a sessão do usuário (RLS).
 *
 * As contas ficam em `lib/completude/regras.ts`; aqui só se busca e monta.
 */

/** Ids de pagamento que têm pelo menos um documento vivo ligado. */
export async function pagamentosComDocumento(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documentos')
    .select('pagamento_id')
    .not('pagamento_id', 'is', null)
    .is('deleted_at', null)
    .limit(10000);
  if (error) throw new Error(`Falha ao carregar documentos por pagamento: ${error.message}`);
  return new Set((data ?? []).map((d) => d.pagamento_id).filter((id): id is string => !!id));
}

export function completudeDoPagamento(p: Pagamento, comDocumento: Set<string>): Completude {
  return avaliarPagamento(p, { temDocumento: comDocumento.has(p.id) });
}

/** Avalia uma lista inteira de pagamentos com uma ida só ao banco. */
export async function completudeDosPagamentos(
  pagamentos: readonly Pagamento[],
): Promise<Map<string, Completude>> {
  const comDocumento = await pagamentosComDocumento();
  return new Map(pagamentos.map((p) => [p.id, completudeDoPagamento(p, comDocumento)]));
}

/**
 * Contexto por obra: gasto (só o que conta), pagamentos, quantos sem
 * documento, e documentos por pasta. Uma consulta em pagamentos e uma em
 * documentos, para todas as obras de uma vez.
 */
export async function contextoDasObras(): Promise<Map<string, ContextoDaObra>> {
  const supabase = await createClient();
  const [pagsR, docsR] = await Promise.all([
    supabase
      .from('pagamentos')
      .select('id, obra_id, valor')
      .in('status_pagto', [...STATUS_QUE_CONTAM])
      .is('deleted_at', null)
      .limit(5000),
    supabase
      .from('documentos')
      .select('obra_id, categoria, pagamento_id')
      .is('deleted_at', null)
      .limit(10000),
  ]);
  if (pagsR.error) throw new Error(`Falha ao carregar pagamentos: ${pagsR.error.message}`);
  if (docsR.error) throw new Error(`Falha ao carregar documentos: ${docsR.error.message}`);

  const docs = docsR.data ?? [];
  const comDocumento = new Set(docs.map((d) => d.pagamento_id).filter(Boolean));
  const estouradas = await etapasEstouradasPorObra(supabase);
  const hoje = hojeBR();
  const mapa = new Map<string, ContextoDaObra>();
  const contexto = (obraId: string): ContextoDaObra => {
    let c = mapa.get(obraId);
    if (!c) {
      c = { hoje, gasto: 0, pagamentos: 0, pagamentosSemDocumento: 0, docsPorPasta: {} };
      mapa.set(obraId, c);
    }
    return c;
  };
  for (const p of pagsR.data ?? []) {
    const c = contexto(p.obra_id);
    c.gasto = Math.round((c.gasto + Number(p.valor)) * 100) / 100;
    c.pagamentos += 1;
    if (!comDocumento.has(p.id)) c.pagamentosSemDocumento += 1;
  }
  for (const d of docs) {
    if (!d.obra_id) continue;
    const c = contexto(d.obra_id);
    c.docsPorPasta[d.categoria] = (c.docsPorPasta[d.categoria] ?? 0) + 1;
  }
  for (const [obraId, n] of estouradas) contexto(obraId).etapasEstouradas = n;
  return mapa;
}

/** O contexto de UMA obra (a tela de detalhe): duas consultas filtradas. */
export async function contextoDaObra(obraId: string): Promise<ContextoDaObra> {
  const supabase = await createClient();
  const [pagsR, docsR] = await Promise.all([
    supabase
      .from('pagamentos')
      .select('id, valor')
      .eq('obra_id', obraId)
      .in('status_pagto', [...STATUS_QUE_CONTAM])
      .is('deleted_at', null)
      .limit(5000),
    supabase
      .from('documentos')
      .select('categoria, pagamento_id')
      .eq('obra_id', obraId)
      .is('deleted_at', null)
      .limit(10000),
  ]);
  if (pagsR.error) throw new Error(`Falha ao carregar pagamentos: ${pagsR.error.message}`);
  if (docsR.error) throw new Error(`Falha ao carregar documentos: ${docsR.error.message}`);
  const docs = docsR.data ?? [];
  const comDocumento = new Set(docs.map((d) => d.pagamento_id).filter(Boolean));
  const c = CONTEXTO_VAZIO(hojeBR());
  for (const p of pagsR.data ?? []) {
    c.gasto = Math.round((c.gasto + Number(p.valor)) * 100) / 100;
    c.pagamentos += 1;
    if (!comDocumento.has(p.id)) c.pagamentosSemDocumento += 1;
  }
  for (const d of docs) c.docsPorPasta[d.categoria] = (c.docsPorPasta[d.categoria] ?? 0) + 1;
  return c;
}

const CONTEXTO_VAZIO = (hoje: string): ContextoDaObra => ({
  hoje,
  gasto: 0,
  pagamentos: 0,
  pagamentosSemDocumento: 0,
  docsPorPasta: {},
});

export function completudeDaObra(o: Obra, contextos: Map<string, ContextoDaObra>): Completude {
  return avaliarObra(o, contextos.get(o.id) ?? CONTEXTO_VAZIO(hojeBR()));
}

export async function completudeDasObras(obras: readonly Obra[]): Promise<Map<string, Completude>> {
  const contextos = await contextoDasObras();
  return new Map(obras.map((o) => [o.id, completudeDaObra(o, contextos)]));
}

export function completudeDoFornecedor(f: Fornecedor): Completude {
  return avaliarFornecedor(f);
}

export function completudeDoDocumento(d: Documento): Completude {
  return avaliarDocumento(d);
}

// ---------------------------------------------------------------------------
// Painel: a saúde do cadastro inteiro
// ---------------------------------------------------------------------------

export interface SaudeDoCadastro {
  obras: ResumoDeNiveis;
  pagamentos: ResumoDeNiveis;
  fornecedores: ResumoDeNiveis;
  documentos: ResumoDeNiveis;
}

/**
 * Conta, para cada tipo de cadastro, quantos estão completos, com pendência
 * leve e com pendência grave. Obras: só as vivas. Pagamentos: só os que
 * contam (aprovado/pendente) e não arquivados. Fornecedores ativos.
 * Documentos vivos.
 */
export async function saudeDoCadastro(): Promise<SaudeDoCadastro> {
  const supabase = await createClient();
  const [obrasR, pagsR, fornsR, docsR, contextos] = await Promise.all([
    supabase.from('obras').select('*').is('deleted_at', null).limit(1000),
    supabase
      .from('pagamentos')
      .select('*')
      .in('status_pagto', [...STATUS_QUE_CONTAM])
      .is('deleted_at', null)
      .limit(5000),
    supabase.from('fornecedores').select('*').is('deleted_at', null).eq('ativo', true).limit(2000),
    supabase.from('documentos').select('*').is('deleted_at', null).limit(10000),
    contextoDasObras(),
  ]);
  for (const r of [obrasR, pagsR, fornsR, docsR]) {
    if (r.error) throw new Error(`Falha ao medir a saúde do cadastro: ${r.error.message}`);
  }
  const docs = docsR.data ?? [];
  const comDocumento = new Set(docs.map((d) => d.pagamento_id).filter((id): id is string => !!id));
  return {
    obras: resumirNiveis((obrasR.data ?? []).map((o) => completudeDaObra(o, contextos))),
    pagamentos: resumirNiveis(
      (pagsR.data ?? []).map((p) => completudeDoPagamento(p, comDocumento)),
    ),
    fornecedores: resumirNiveis((fornsR.data ?? []).map(completudeDoFornecedor)),
    documentos: resumirNiveis(docs.map(completudeDoDocumento)),
  };
}
