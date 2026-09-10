import 'server-only';
import { MAX_LOTE, embeddingsAtivo, gerarEmbeddings, paraLiteralVetor } from '@/lib/ia/embeddings';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type DocumentoIndexavel,
  dividirEmTrechos,
  fornecedorParaDocumento,
  obraParaDocumento,
  pagamentoParaDocumento,
} from './documentos';

/**
 * Indexação: do dado do CRM até o vetor.
 *
 * Duas etapas separadas de propósito:
 *
 *   1. `sincronizarDocumentos` — lê o CRM e escreve o TEXTO. Não custa nada,
 *      não chama API nenhuma, e pode rodar sempre.
 *   2. `gerarEmbeddingsPendentes` — pega o que ainda não tem vetor e gasta
 *      chamada de embedding.
 *
 * Separar permite rodar a primeira sem chave de IA configurada — o texto fica
 * pronto, a busca ainda não funciona, e no dia em que a chave entrar basta a
 * segunda etapa. Junto, seria tudo ou nada.
 *
 * ## O hash é o que impede a conta de doer
 *
 * Cada documento carrega o hash do próprio conteúdo. Se o pagamento não mudou,
 * o hash é o mesmo, o texto não é reescrito e o `indexado_em` continua lá —
 * então a etapa 2 não o vê. Sem isso, reindexar 80 pagamentos por dia seria
 * 80 embeddings por dia para nenhum ganho.
 */

type Client = SupabaseClient<Database>;

export interface ResultadoSincronizacao {
  lidos: number;
  criados: number;
  atualizados: number;
  inalterados: number;
}

export interface ResultadoEmbeddings {
  pendentes: number;
  indexados: number;
  trechos: number;
  erro?: string;
}

// ---------------------------------------------------------------------------
// Etapa 1: dado do CRM → texto
// ---------------------------------------------------------------------------

async function coletarPagamentos(supabase: Client): Promise<DocumentoIndexavel[]> {
  const { data, error } = await supabase
    .from('pagamentos')
    .select(
      'id, valor, data_pagamento, descricao, observacoes, status_pagto, origem, obras ( id, nome ), fornecedores ( nome ), categorias ( nome )',
    )
    .is('deleted_at', null);

  if (error) throw new Error(`Falha ao ler pagamentos: ${error.message}`);

  return (data ?? []).map((p) =>
    pagamentoParaDocumento({
      id: p.id,
      valor: Number(p.valor),
      data_pagamento: p.data_pagamento,
      descricao: p.descricao,
      observacoes: p.observacoes,
      status_pagto: String(p.status_pagto),
      origem: String(p.origem),
      obra: (p.obras as { id: string; nome: string } | null) ?? null,
      fornecedor: (p.fornecedores as { nome: string } | null) ?? null,
      categoria: (p.categorias as { nome: string } | null) ?? null,
    }),
  );
}

async function coletarObras(supabase: Client): Promise<DocumentoIndexavel[]> {
  const { data: obras, error } = await supabase
    .from('obras')
    .select('id, nome, cliente, tipo, status, orcamento, data_inicio')
    .is('deleted_at', null);

  if (error) throw new Error(`Falha ao ler obras: ${error.message}`);

  const { data: pagamentos } = await supabase
    .from('pagamentos')
    .select('obra_id, valor')
    .is('deleted_at', null);

  // Agregação em memória e não no banco: são dezenas de obras e centenas de
  // pagamentos. Uma query por obra seria N+1 para economizar o que cabe num
  // Map.
  const porObra = new Map<string, { total: number; qtd: number }>();
  for (const p of pagamentos ?? []) {
    if (!p.obra_id) continue;
    const atual = porObra.get(p.obra_id) ?? { total: 0, qtd: 0 };
    atual.total += Number(p.valor);
    atual.qtd += 1;
    porObra.set(p.obra_id, atual);
  }

  return (obras ?? []).map((o) => {
    const agg = porObra.get(o.id) ?? { total: 0, qtd: 0 };
    return obraParaDocumento({
      id: o.id,
      nome: o.nome,
      cliente: o.cliente,
      tipo: o.tipo ? String(o.tipo) : null,
      status: o.status ? String(o.status) : null,
      orcamento: o.orcamento != null ? Number(o.orcamento) : null,
      data_inicio: o.data_inicio,
      totalGasto: agg.total,
      qtdPagamentos: agg.qtd,
    });
  });
}

async function coletarFornecedores(supabase: Client): Promise<DocumentoIndexavel[]> {
  const { data: fornecedores, error } = await supabase
    .from('fornecedores')
    .select('id, nome, razao_social, categorias ( nome )')
    .is('deleted_at', null);

  if (error) throw new Error(`Falha ao ler fornecedores: ${error.message}`);

  const { data: pagamentos } = await supabase
    .from('pagamentos')
    .select('fornecedor_id, valor, obras ( nome )')
    .is('deleted_at', null)
    .not('fornecedor_id', 'is', null);

  const porFornecedor = new Map<string, { total: number; qtd: number; obras: Set<string> }>();
  for (const p of pagamentos ?? []) {
    if (!p.fornecedor_id) continue;
    const atual = porFornecedor.get(p.fornecedor_id) ?? { total: 0, qtd: 0, obras: new Set() };
    atual.total += Number(p.valor);
    atual.qtd += 1;
    const obra = (p.obras as { nome: string } | null)?.nome;
    if (obra) atual.obras.add(obra);
    porFornecedor.set(p.fornecedor_id, atual);
  }

  return (fornecedores ?? []).map((f) => {
    const agg = porFornecedor.get(f.id) ?? { total: 0, qtd: 0, obras: new Set<string>() };
    return fornecedorParaDocumento({
      id: f.id,
      nome: f.nome,
      razao_social: f.razao_social,
      categoria: (f.categorias as { nome: string } | null) ?? null,
      totalPago: agg.total,
      qtdPagamentos: agg.qtd,
      obras: [...agg.obras].sort(),
    });
  });
}

/**
 * Reescreve os textos de conhecimento a partir do estado atual do CRM.
 *
 * Não gera embedding nenhum. É barato e idempotente: rodar duas vezes seguidas
 * devolve tudo como `inalterados`.
 */
export async function sincronizarDocumentos(supabase: Client): Promise<ResultadoSincronizacao> {
  const documentos = [
    ...(await coletarPagamentos(supabase)),
    ...(await coletarObras(supabase)),
    ...(await coletarFornecedores(supabase)),
  ];

  const { data: existentes } = await supabase
    .from('knowledge_documents')
    .select('id, origem, origem_id, hash_conteudo')
    .is('deleted_at', null);

  const porChave = new Map(
    (existentes ?? []).map((e) => [`${e.origem}|${e.origem_id}`, e] as const),
  );

  const resultado: ResultadoSincronizacao = {
    lidos: documentos.length,
    criados: 0,
    atualizados: 0,
    inalterados: 0,
  };

  const aCriar: Array<{
    origem: string;
    origem_id: string;
    obra_id: string | null;
    titulo: string;
    conteudo: string;
    hash_conteudo: string;
  }> = [];

  for (const doc of documentos) {
    const existente = porChave.get(`${doc.origem}|${doc.origemId}`);

    if (existente && existente.hash_conteudo === doc.hash) {
      resultado.inalterados += 1;
      continue;
    }

    if (existente) {
      // Conteúdo mudou: zera `indexado_em` para a etapa 2 pegá-lo, e apaga os
      // trechos antigos. Manter os trechos velhos faria a busca devolver o
      // valor de ontem com a confiança de hoje.
      await supabase.from('knowledge_chunks').delete().eq('documento_id', existente.id);
      const { error } = await supabase
        .from('knowledge_documents')
        .update({
          titulo: doc.titulo,
          conteudo: doc.conteudo,
          hash_conteudo: doc.hash,
          obra_id: doc.obraId,
          indexado_em: null,
        })
        .eq('id', existente.id);

      if (error) throw new Error(`Falha ao atualizar conhecimento: ${error.message}`);
      resultado.atualizados += 1;
      continue;
    }

    // Acumula em vez de inserir: os inserts vão em lote no fim.
    aCriar.push({
      origem: doc.origem,
      origem_id: doc.origemId,
      obra_id: doc.obraId,
      titulo: doc.titulo,
      conteudo: doc.conteudo,
      hash_conteudo: doc.hash,
    });
  }

  // ---------------------------------------------------------------------
  // Os novos, em lote
  // ---------------------------------------------------------------------
  // Um INSERT por documento custou **24,7 segundos** para 98 documentos na
  // primeira indexação em produção — cerca de 250ms cada, que é o preço de uma
  // ida e volta entre a função (Virgínia) e o banco (São Paulo).
  //
  // Não era lentidão de banco: era latência multiplicada por 98. Em lote, a
  // mesma carga cabe em poucas requisições. Importa mais do que parece porque
  // a função tem tempo limitado — e uma carga nova de 80 pagamentos repetiria
  // o cenário, agora perto do teto.
  //
  // As atualizações continuam uma a uma: são raras (só quando um pagamento
  // muda) e cada uma precisa apagar os trechos antigos antes.
  const LOTE = 50;
  for (let i = 0; i < aCriar.length; i += LOTE) {
    const { error } = await supabase.from('knowledge_documents').insert(aCriar.slice(i, i + LOTE));
    if (error) throw new Error(`Falha ao criar conhecimento: ${error.message}`);
    resultado.criados += Math.min(LOTE, aCriar.length - i);
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// Etapa 2: texto → vetor
// ---------------------------------------------------------------------------

/**
 * Gera embedding para os documentos que ainda não têm.
 *
 * `limite` existe porque isto roda numa função com tempo limitado e custa
 * dinheiro por chamada. Processar em levas, chamado de tempos em tempos, é
 * melhor que uma varredura que pode ser interrompida no meio.
 */
export async function gerarEmbeddingsPendentes(
  supabase: Client,
  limite = MAX_LOTE,
): Promise<ResultadoEmbeddings> {
  if (!embeddingsAtivo()) {
    return {
      pendentes: 0,
      indexados: 0,
      trechos: 0,
      erro: 'Embeddings desativados (IA_EMBEDDINGS_PROVIDER=none). O texto está indexado; a busca por semelhança é que não funciona.',
    };
  }

  const { data: pendentes, error } = await supabase
    .from('knowledge_documents')
    .select('id, conteudo')
    .is('deleted_at', null)
    .is('indexado_em', null)
    .order('updated_at', { ascending: true })
    .limit(Math.min(limite, MAX_LOTE));

  if (error) throw new Error(`Falha ao listar pendentes: ${error.message}`);

  const lista = pendentes ?? [];
  if (lista.length === 0) {
    return { pendentes: 0, indexados: 0, trechos: 0 };
  }

  // Um documento pode virar mais de um trecho, então a lista de textos não
  // casa 1:1 com a de documentos. O mapa guarda a volta.
  const textos: string[] = [];
  const dono: Array<{ documentoId: string; ordem: number }> = [];

  for (const doc of lista) {
    const trechos = dividirEmTrechos(doc.conteudo);
    trechos.forEach((t, i) => {
      textos.push(t);
      dono.push({ documentoId: doc.id, ordem: i });
    });
  }

  if (textos.length > MAX_LOTE) {
    // Corta no limite do lote em vez de falhar: os que sobraram continuam
    // pendentes e entram na próxima leva.
    const corte = textos.length - MAX_LOTE;
    textos.length = MAX_LOTE;
    dono.length = MAX_LOTE;
    console.warn(`[rag] ${corte} trecho(s) ficaram para a próxima leva.`);
  }

  const emb = await gerarEmbeddings(textos);
  if (!emb.ok) {
    return {
      pendentes: lista.length,
      indexados: 0,
      trechos: 0,
      erro: `${emb.motivo}${emb.detalhe ? `: ${emb.detalhe}` : ''}`,
    };
  }

  const linhas = textos.map((conteudo, i) => ({
    documento_id: dono[i]?.documentoId ?? '',
    ordem: dono[i]?.ordem ?? 0,
    conteudo,
    embedding: paraLiteralVetor(emb.vetores[i] ?? []),
  }));

  const { error: erroInsert } = await supabase.from('knowledge_chunks').insert(linhas as never);
  if (erroInsert) throw new Error(`Falha ao gravar trechos: ${erroInsert.message}`);

  // `indexado_em` só depois dos trechos gravados. Marcar antes e falhar no
  // insert deixaria o documento como indexado sem nenhum vetor — invisível
  // para a busca e invisível para a fila de pendentes.
  const indexados = [...new Set(dono.map((d) => d.documentoId))];
  const { error: erroMarca } = await supabase
    .from('knowledge_documents')
    .update({ indexado_em: new Date().toISOString() })
    .in('id', indexados);

  if (erroMarca) throw new Error(`Falha ao marcar indexados: ${erroMarca.message}`);

  return {
    pendentes: lista.length,
    indexados: indexados.length,
    trechos: linhas.length,
  };
}
