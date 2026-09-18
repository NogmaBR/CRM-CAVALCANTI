import { avancoFisico } from '@/lib/financeiro/cronograma';
import { montarResumo } from '@/lib/financeiro/resumo-obra';
import { CATEGORIA_LABELS, type DocCategoria } from '@/lib/status-labels';
import { hojeBR } from '@/lib/util/datas';
import { z } from 'zod/v4';
import { type EscolhaDeObra, agregarPorCategoria, escolherObra, somar } from './obras';
import { type Client, ferramenta } from './registro';

/**
 * Ferramentas de leitura sobre o CRM inteiro — o que faltava para o agente
 * responder "qualquer coisa que esteja no CRM".
 *
 * As cinco de `obras.ts` respondem gasto; estas respondem o resto: quais
 * obras existem, **resultado e lucro** (contrato, recebido), gasto por etapa,
 * fornecedores, documentos por pasta, diário e recebimentos.
 *
 * Mesmas regras de `registro.ts`: só leitura, Zod com limites, nome estável.
 * Consultas finas com listas limitadas e o cruzamento feito em JS — é o que
 * permite testar com o Supabase em memória (que não resolve joins).
 *
 * A conta de resultado é `montarResumo` (`lib/financeiro/resumo-obra.ts`),
 * a mesma da página da obra: os dois lugares não podem discordar.
 */

const STATUS_QUE_CONTAM = ['confirmado', 'aguardando'] as const;

const Data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'use AAAA-MM-DD')
  .describe('Data no formato AAAA-MM-DD');

const NomeObra = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .describe('Nome ou apelido da obra, como o usuário escreveu');

const Limite = z.number().int().min(1).max(20).default(10);

// ---------------------------------------------------------------------------
// Tipos e funções puras
// ---------------------------------------------------------------------------

export interface ObraCompleta {
  id: string;
  nome: string;
  apelidos: string[] | null;
  cliente: string | null;
  status: string | null;
  orcamento: number | null;
  valor_contrato: number | null;
  data_inicio: string | null;
  data_prevista_fim: string | null;
}

export interface PagamentoLido {
  id: string;
  obra_id: string | null;
  valor: number;
  data: string | null;
  descricao: string | null;
  categoria: string | null;
  fornecedor: string | null;
  fornecedor_id: string | null;
  tem_documento: boolean;
}

/**
 * Resultado das obras lado a lado, ordenado do melhor resultado para o pior.
 * Obra sem contrato aparece com `contrato: null` e `margem_prevista: null` —
 * o modelo diz que falta o valor, nunca inventa.
 */
export function compararObras(
  obras: readonly ObraCompleta[],
  pagamentos: readonly { obra_id: string | null; valor: number }[],
  recebimentos: readonly { obra_id: string; valor: number }[],
) {
  return obras
    .map((o) => {
      const gasto = somar(pagamentos.filter((p) => p.obra_id === o.id));
      const recebido = somar(recebimentos.filter((r) => r.obra_id === o.id));
      const r = montarResumo({ contrato: o.valor_contrato, gasto, recebido });
      return {
        obra: o.nome,
        cliente: o.cliente,
        status: o.status,
        contrato: r.contrato,
        gasto: r.gasto,
        recebido: r.recebido,
        resultado: r.resultado,
        margem_prevista: r.margemPrevista,
        percentual_gasto_do_contrato: r.percentualGastoDoContrato,
      };
    })
    .sort((a, b) => b.resultado - a.resultado);
}

/** Conta documentos por pasta, com o rótulo humano da pasta. */
export function contarPorPasta(
  documentos: readonly { categoria: string | null }[],
): Array<{ pasta: string; quantidade: number }> {
  const mapa = new Map<string, number>();
  for (const d of documentos) {
    const c = (d.categoria ?? 'outro') as DocCategoria;
    const rotulo = CATEGORIA_LABELS[c]?.rotulo ?? c;
    mapa.set(rotulo, (mapa.get(rotulo) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([pasta, quantidade]) => ({ pasta, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

function respostaDeEscolha(termo: string, escolha: EscolhaDeObra) {
  if (escolha.tipo === 'nenhuma')
    return { ok: false as const, erro: `nenhuma obra casa com "${termo}"` };
  return {
    ok: false as const,
    erro: `mais de uma obra casa com "${termo}"; pergunte ao usuário qual`,
    candidatas: escolha.tipo === 'ambigua' ? escolha.candidatas.map((o) => o.nome) : [],
  };
}

// ---------------------------------------------------------------------------
// Acesso ao banco (fino)
// ---------------------------------------------------------------------------

export async function carregarObras(
  supabase: Client,
  opts: { incluirArquivadas?: boolean } = {},
): Promise<ObraCompleta[]> {
  let q = supabase
    .from('obras')
    .select(
      'id, nome, apelidos, cliente, status, orcamento, valor_contrato, data_inicio, data_prevista_fim, deleted_at',
    )
    .limit(200);
  if (!opts.incluirArquivadas) q = q.is('deleted_at', null);
  const { data, error } = await q;
  if (error) throw new Error(`obras: ${error.message}`);
  return (data ?? []).map((o) => ({
    id: o.id,
    nome: o.nome,
    apelidos: o.apelidos,
    cliente: o.cliente ?? null,
    status: o.status ?? null,
    orcamento: o.orcamento == null ? null : Number(o.orcamento),
    valor_contrato: o.valor_contrato == null ? null : Number(o.valor_contrato),
    data_inicio: o.data_inicio ?? null,
    data_prevista_fim: o.data_prevista_fim ?? null,
  }));
}

async function resolverObra(
  supabase: Client,
  termo: string,
): Promise<{ ok: true; obra: ObraCompleta } | { ok: false; erro: string; candidatas?: string[] }> {
  const obras = await carregarObras(supabase);
  const escolha = escolherObra(termo, obras);
  if (escolha.tipo === 'uma') {
    const obra = obras.find((o) => o.id === escolha.obra.id);
    if (obra) return { ok: true, obra };
  }
  return respostaDeEscolha(termo, escolha);
}

async function carregarPagamentos(
  supabase: Client,
  filtro: { obraId?: string; de?: string; ate?: string } = {},
): Promise<PagamentoLido[]> {
  let q = supabase
    .from('pagamentos')
    .select('id, obra_id, valor, data_pagamento, descricao, categoria_id, fornecedor_id')
    .is('deleted_at', null)
    .in('status_pagto', [...STATUS_QUE_CONTAM])
    .order('data_pagamento', { ascending: false })
    .limit(3000);
  if (filtro.obraId) q = q.eq('obra_id', filtro.obraId);
  if (filtro.de) q = q.gte('data_pagamento', filtro.de);
  if (filtro.ate) q = q.lte('data_pagamento', filtro.ate);
  const [{ data, error }, categorias, fornecedores, docs] = await Promise.all([
    q,
    supabase.from('categorias').select('id, nome').limit(300),
    supabase.from('fornecedores').select('id, nome').limit(1000),
    // "Tem nota" = existe documento vivo ligado ao pagamento (mesma regra da
    // RPC `pagamentos_sem_documento`).
    supabase
      .from('documentos')
      .select('pagamento_id')
      .not('pagamento_id', 'is', null)
      .is('deleted_at', null)
      .limit(5000),
  ]);
  if (error) throw new Error(`pagamentos: ${error.message}`);
  const comDocumento = new Set((docs.data ?? []).map((d) => d.pagamento_id));
  const nomeCat = new Map((categorias.data ?? []).map((c) => [c.id, c.nome]));
  const nomeForn = new Map((fornecedores.data ?? []).map((f) => [f.id, f.nome]));
  return (data ?? []).map((p) => ({
    id: p.id,
    obra_id: p.obra_id ?? null,
    valor: Number(p.valor),
    data: p.data_pagamento ?? null,
    descricao: p.descricao ?? null,
    categoria: p.categoria_id ? (nomeCat.get(p.categoria_id) ?? null) : null,
    fornecedor: p.fornecedor_id ? (nomeForn.get(p.fornecedor_id) ?? null) : null,
    fornecedor_id: p.fornecedor_id ?? null,
    tem_documento: comDocumento.has(p.id),
  }));
}

async function carregarRecebimentos(supabase: Client, obraId?: string) {
  let q = supabase
    .from('recebimentos')
    .select('id, obra_id, valor, data_recebimento, descricao')
    .is('deleted_at', null)
    .order('data_recebimento', { ascending: false })
    .limit(2000);
  if (obraId) q = q.eq('obra_id', obraId);
  const { data, error } = await q;
  if (error) throw new Error(`recebimentos: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    obra_id: r.obra_id,
    valor: Number(r.valor),
    data: r.data_recebimento,
    descricao: r.descricao ?? null,
  }));
}

// ---------------------------------------------------------------------------
// As ferramentas
// ---------------------------------------------------------------------------

export const listarObras = ferramenta({
  nome: 'listar_obras',
  descricao:
    'Lista as obras em andamento com cliente, status, contrato, gasto e recebido. Use para "quais obras temos", "que obras estão ativas", "lista as obras", ou antes de outra ferramenta quando não souber o nome exato da obra.',
  schema: z.object({
    incluir_arquivadas: z.boolean().default(false).describe('Inclui obras arquivadas'),
  }),
  executar: async (supabase, args) => {
    const [obras, pagamentos, recebimentos] = await Promise.all([
      carregarObras(supabase, { incluirArquivadas: args.incluir_arquivadas }),
      carregarPagamentos(supabase),
      carregarRecebimentos(supabase),
    ]);
    return {
      ok: true,
      quantidade: obras.length,
      obras: compararObras(obras, pagamentos, recebimentos),
    };
  },
});

export const resumoDaObra = ferramenta({
  nome: 'resumo_da_obra',
  descricao:
    'Tudo de UMA obra numa chamada: contrato, gasto, recebido, resultado (lucro até agora), margem prevista, avanço físico (% executado, por etapa do cronograma), gasto por etapa, últimos pagamentos, notas faltando, documentos por pasta e último registro do diário. Use para "como está a obra X", "em que pé está a X", "quanto estou lucrando na X", "me fala da X", "resumo da X".',
  schema: z.object({ obra: NomeObra }),
  executar: async (supabase, args) => {
    const r = await resolverObra(supabase, args.obra);
    if (!r.ok) return r;
    const obra = r.obra;
    const [pagamentos, recebimentos, docs, diario, etapasR] = await Promise.all([
      carregarPagamentos(supabase, { obraId: obra.id }),
      carregarRecebimentos(supabase, obra.id),
      supabase
        .from('documentos')
        .select('id, categoria')
        .eq('obra_id', obra.id)
        .is('deleted_at', null)
        .limit(2000),
      supabase
        .from('registros_obra')
        .select('texto, created_at')
        .eq('obra_id', obra.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1),
      // Sem a migration do cronograma a consulta falha: tratamos como "sem etapas".
      supabase
        .from('etapas_obra')
        .select('nome, percentual_concluido, peso')
        .eq('obra_id', obra.id)
        .is('deleted_at', null)
        .order('ordem')
        .limit(100),
    ]);
    const etapas = (etapasR.data ?? []).map((e) => ({
      nome: e.nome,
      percentual_concluido: Number(e.percentual_concluido),
      peso: Number(e.peso),
    }));
    const resumo = montarResumo({
      contrato: obra.valor_contrato,
      gasto: somar(pagamentos),
      recebido: somar(recebimentos),
    });
    const semNota = pagamentos.filter((p) => !p.tem_documento);
    const ultimo = diario.data?.[0];
    return {
      ok: true,
      obra: obra.nome,
      cliente: obra.cliente,
      status: obra.status,
      inicio: obra.data_inicio,
      previsao_fim: obra.data_prevista_fim,
      contrato: resumo.contrato,
      orcamento: obra.orcamento,
      gasto: resumo.gasto,
      recebido: resumo.recebido,
      resultado_ate_agora: resumo.resultado,
      margem_prevista: resumo.margemPrevista,
      percentual_gasto_do_contrato: resumo.percentualGastoDoContrato,
      avanco_fisico_percentual: avancoFisico(etapas),
      etapas_do_cronograma: etapas.map((e) => ({
        etapa: e.nome,
        concluido: e.percentual_concluido,
      })),
      aviso_contrato:
        resumo.contrato == null
          ? 'Sem valor de contrato: lucro e margem não podem ser calculados. Peça o valor ("o contrato da obra é 850 mil").'
          : null,
      quantidade_pagamentos: pagamentos.length,
      gasto_por_etapa: agregarPorCategoria(pagamentos).slice(0, 5),
      ultimos_pagamentos: pagamentos.slice(0, 5).map((p) => ({
        data: p.data,
        valor: p.valor,
        fornecedor: p.fornecedor,
        descricao: p.descricao,
      })),
      pagamentos_sem_nota: { quantidade: semNota.length, total: somar(semNota) },
      documentos_por_pasta: contarPorPasta(docs.data ?? []),
      ultimo_registro_diario: ultimo
        ? { quando: ultimo.created_at, texto: String(ultimo.texto).slice(0, 200) }
        : null,
    };
  },
});

export const lucroPorObra = ferramenta({
  nome: 'lucro_por_obra',
  descricao:
    'Compara todas as obras: contrato, gasto, recebido, resultado (recebido − gasto) e margem prevista (contrato − gasto). Use para "qual obra dá mais lucro", "como estão as obras", "quanto estou lucrando no total", "compara as obras".',
  schema: z.object({}),
  executar: async (supabase) => {
    const [obras, pagamentos, recebimentos] = await Promise.all([
      carregarObras(supabase),
      carregarPagamentos(supabase),
      carregarRecebimentos(supabase),
    ]);
    const linhas = compararObras(obras, pagamentos, recebimentos);
    return {
      ok: true,
      obras: linhas,
      totais: {
        contrato: somar(
          linhas.filter((l) => l.contrato != null).map((l) => ({ valor: l.contrato ?? 0 })),
        ),
        gasto: somar(linhas.map((l) => ({ valor: l.gasto }))),
        recebido: somar(linhas.map((l) => ({ valor: l.recebido }))),
        resultado: somar(linhas.map((l) => ({ valor: l.resultado }))),
        obras_sem_contrato: linhas.filter((l) => l.contrato == null).map((l) => l.obra),
      },
    };
  },
});

export const gastoPorEtapa = ferramenta({
  nome: 'gasto_por_etapa',
  descricao:
    'Gasto por etapa/categoria do plano de contas (fundação, alvenaria, elétrica…), de uma obra ou de todas, com período opcional. Use para "quanto gastei com elétrica", "em que etapa está indo mais dinheiro", "gasto por categoria na X".',
  schema: z.object({
    obra: NomeObra.optional(),
    de: Data.optional(),
    ate: Data.optional(),
    limite: Limite,
  }),
  executar: async (supabase, args) => {
    let obraId: string | undefined;
    let nomeObra: string | null = null;
    if (args.obra) {
      const r = await resolverObra(supabase, args.obra);
      if (!r.ok) return r;
      obraId = r.obra.id;
      nomeObra = r.obra.nome;
    }
    const pagamentos = await carregarPagamentos(supabase, { obraId, de: args.de, ate: args.ate });
    return {
      ok: true,
      obra: nomeObra ?? 'todas',
      periodo: args.de || args.ate ? { de: args.de ?? null, ate: args.ate ?? null } : 'todo',
      total: somar(pagamentos),
      por_etapa: agregarPorCategoria(pagamentos).slice(0, args.limite),
    };
  },
});

export const pagamentosRecentes = ferramenta({
  nome: 'pagamentos_recentes',
  descricao:
    'Os últimos pagamentos (data, valor, fornecedor, descrição, etapa), filtrando por obra, fornecedor e/ou período. Use para "o que foi pago essa semana", "últimos pagamentos da X", "o que paguei pro fornecedor Y", "quando paguei o Z".',
  schema: z.object({
    obra: NomeObra.optional(),
    fornecedor: z.string().trim().min(2).max(80).optional().describe('Nome do fornecedor'),
    de: Data.optional(),
    ate: Data.optional(),
    limite: Limite,
  }),
  executar: async (supabase, args) => {
    let obraId: string | undefined;
    if (args.obra) {
      const r = await resolverObra(supabase, args.obra);
      if (!r.ok) return r;
      obraId = r.obra.id;
    }
    let pagamentos = await carregarPagamentos(supabase, { obraId, de: args.de, ate: args.ate });
    if (args.fornecedor) {
      const { resolverPorNome } = await import('../resolver-nomes');
      const fornecedores = [
        ...new Map(
          pagamentos
            .filter((p) => p.fornecedor_id && p.fornecedor)
            .map((p) => [
              p.fornecedor_id as string,
              { id: p.fornecedor_id as string, nome: p.fornecedor as string },
            ]),
        ).values(),
      ];
      const f = resolverPorNome(args.fornecedor, fornecedores);
      if (!f) {
        return {
          ok: false,
          erro: `nenhum fornecedor único casa com "${args.fornecedor}" nesses pagamentos`,
        };
      }
      pagamentos = pagamentos.filter((p) => p.fornecedor_id === f.id);
    }
    const obras = await carregarObras(supabase, { incluirArquivadas: true });
    const nomeObra = new Map(obras.map((o) => [o.id, o.nome]));
    return {
      ok: true,
      quantidade: pagamentos.length,
      total: somar(pagamentos),
      pagamentos: pagamentos.slice(0, args.limite).map((p) => ({
        data: p.data,
        valor: p.valor,
        obra: p.obra_id ? (nomeObra.get(p.obra_id) ?? null) : null,
        fornecedor: p.fornecedor,
        etapa: p.categoria,
        descricao: p.descricao,
        tem_nota: p.tem_documento,
      })),
    };
  },
});

export const listarFornecedores = ferramenta({
  nome: 'listar_fornecedores',
  descricao:
    'Fornecedores cadastrados (com busca por nome): total pago, quantidade de pagamentos, se tem CNPJ e telefone. Use para "quem são os fornecedores", "tem o fornecedor X cadastrado", "quanto paguei pro X no total", "fornecedores sem telefone".',
  schema: z.object({
    busca: z.string().trim().max(80).optional().describe('Parte do nome'),
    limite: Limite,
  }),
  executar: async (supabase, args) => {
    const [{ data, error }, pagamentos] = await Promise.all([
      supabase
        .from('fornecedores')
        .select('id, nome, documento, telefone, ativo')
        .is('deleted_at', null)
        .limit(1000),
      carregarPagamentos(supabase),
    ]);
    if (error) throw new Error(`fornecedores: ${error.message}`);
    const { normalizarNome } = await import('../resolver-nomes');
    const alvo = normalizarNome(args.busca);
    const totais = new Map<string, { total: number; quantidade: number }>();
    for (const p of pagamentos) {
      if (!p.fornecedor_id) continue;
      const t = totais.get(p.fornecedor_id) ?? { total: 0, quantidade: 0 };
      t.total = Math.round((t.total + p.valor) * 100) / 100;
      t.quantidade += 1;
      totais.set(p.fornecedor_id, t);
    }
    const lista = (data ?? [])
      .filter((f) => !alvo || normalizarNome(f.nome).includes(alvo))
      .map((f) => ({
        nome: f.nome,
        total_pago: totais.get(f.id)?.total ?? 0,
        pagamentos: totais.get(f.id)?.quantidade ?? 0,
        tem_cnpj: Boolean(f.documento),
        tem_telefone: Boolean(f.telefone),
        ativo: f.ativo !== false,
      }))
      .sort((a, b) => b.total_pago - a.total_pago);
    return { ok: true, quantidade: lista.length, fornecedores: lista.slice(0, args.limite) };
  },
});

export const documentosDaObra = ferramenta({
  nome: 'documentos_da_obra',
  descricao:
    'Documentos de uma obra: quantidade por pasta (Documentação, NFs, Proposta, Projeto, Fotos…) e os últimos arquivos, com filtro de pasta opcional. Use para "tem projeto aprovado da X", "quantas fotos tem da X", "que documentos tem na pasta Y", "cadê a proposta da X".',
  schema: z.object({
    obra: NomeObra,
    pasta: z
      .enum([
        'documentacao',
        'nfs_pagamentos',
        'proposta',
        'projeto',
        'projeto_aprovado',
        'cronograma',
        'orcamentos',
        'fotos',
        'outro',
      ])
      .optional(),
    limite: Limite,
  }),
  executar: async (supabase, args) => {
    const r = await resolverObra(supabase, args.obra);
    if (!r.ok) return r;
    let q = supabase
      .from('documentos')
      .select('id, nome_arquivo, categoria, tipo, created_at')
      .eq('obra_id', r.obra.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(2000);
    if (args.pasta) q = q.eq('categoria', args.pasta);
    const { data, error } = await q;
    if (error) throw new Error(`documentos: ${error.message}`);
    const docs = data ?? [];
    return {
      ok: true,
      obra: r.obra.nome,
      pasta: args.pasta ? CATEGORIA_LABELS[args.pasta].rotulo : 'todas',
      quantidade: docs.length,
      por_pasta: contarPorPasta(docs),
      ultimos: docs.slice(0, args.limite).map((d) => ({
        arquivo: d.nome_arquivo,
        pasta: CATEGORIA_LABELS[(d.categoria ?? 'outro') as DocCategoria]?.rotulo ?? d.categoria,
        quando: d.created_at,
      })),
    };
  },
});

export const diarioDaObra = ferramenta({
  nome: 'diario_da_obra',
  descricao:
    'Últimos registros do diário da obra (o que a equipe anotou por áudio ou texto: "concretamos a laje", "chegou o material"). Use para "o que aconteceu na X essa semana", "última anotação da X", "andamento da obra X".',
  schema: z.object({ obra: NomeObra, limite: Limite }),
  executar: async (supabase, args) => {
    const r = await resolverObra(supabase, args.obra);
    if (!r.ok) return r;
    const { data, error } = await supabase
      .from('registros_obra')
      .select('texto, created_at')
      .eq('obra_id', r.obra.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(args.limite);
    if (error) throw new Error(`registros_obra: ${error.message}`);
    return {
      ok: true,
      obra: r.obra.nome,
      registros: (data ?? []).map((x) => ({
        quando: x.created_at,
        texto: String(x.texto).slice(0, 300),
      })),
    };
  },
});

export const recebimentosDaObra = ferramenta({
  nome: 'recebimentos_da_obra',
  descricao:
    'Parcelas que o cliente da obra já pagou (data, valor, descrição), total recebido e quanto falta do contrato. Use para "quanto o cliente já pagou da X", "quanto falta receber da X", "quando foi a última parcela da X".',
  schema: z.object({ obra: NomeObra, limite: Limite }),
  executar: async (supabase, args) => {
    const r = await resolverObra(supabase, args.obra);
    if (!r.ok) return r;
    const recebimentos = await carregarRecebimentos(supabase, r.obra.id);
    const total = somar(recebimentos);
    const contrato = r.obra.valor_contrato;
    return {
      ok: true,
      obra: r.obra.nome,
      contrato,
      total_recebido: total,
      falta_receber: contrato == null ? null : Math.round((contrato - total) * 100) / 100,
      quantidade: recebimentos.length,
      ultimos: recebimentos.slice(0, args.limite),
      hoje: hojeBR(),
    };
  },
});

export const FERRAMENTAS_CRM = [
  listarObras,
  resumoDaObra,
  lucroPorObra,
  gastoPorEtapa,
  pagamentosRecentes,
  listarFornecedores,
  documentosDaObra,
  diarioDaObra,
  recebimentosDaObra,
] as const;
