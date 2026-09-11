import { z } from 'zod/v4';
import { type Client, ferramenta } from './registro';

/**
 * As ferramentas de leitura sobre obras e pagamentos.
 *
 * Cada uma responde a um tipo de pergunta que a busca por semelhança NÃO
 * responde bem: agregados. "Quanto gastei em setembro" não está em nenhum
 * trecho — está na soma de quarenta. Antes destas ferramentas o prompt mandava
 * o modelo dizer "veja no painel"; agora ele soma de verdade, no banco, e
 * devolve o número.
 *
 * ## Desenho
 *
 * As consultas ao Supabase são finas e as agregações são funções puras
 * exportadas (`agregarPorCategoria`, `rankearFornecedores`, `escolherObra`).
 * É o que permite testar a parte que erra — a conta — sem banco.
 *
 * Os limites são fechados aqui, não confiados ao modelo: `limite` no máximo
 * 20, período no máximo 2 anos, texto de busca no máximo 80 caracteres.
 */

const STATUS_QUE_CONTAM = ['confirmado', 'aguardando'] as const;
const HOJE = () => new Date().toISOString().slice(0, 10);

const Data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'use AAAA-MM-DD')
  .describe('Data no formato AAAA-MM-DD');

const NomeObra = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .describe('Nome ou apelido da obra, como o usuário escreveu (busca parcial, sem acento)');

// ---------------------------------------------------------------------------
// Funções puras
// ---------------------------------------------------------------------------

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export interface ObraResumida {
  id: string;
  nome: string;
  apelidos: string[] | null;
  orcamento: number | null;
}

export type EscolhaDeObra =
  | { tipo: 'uma'; obra: ObraResumida }
  | { tipo: 'nenhuma' }
  | { tipo: 'ambigua'; candidatas: ObraResumida[] };

/**
 * Casa o texto do usuário com uma obra, por nome ou apelido.
 *
 * Devolve `ambigua` em vez de escolher: responder o total da obra errada é
 * pior do que pedir para desambiguar. Casamento exato vence o parcial — se
 * "Garibaldi" existe e "Garibaldi II" também, "garibaldi" é a primeira.
 */
export function escolherObra(termo: string, obras: ObraResumida[]): EscolhaDeObra {
  const alvo = normalizar(termo);
  if (!alvo) return { tipo: 'nenhuma' };

  const nomesDe = (o: ObraResumida) => [o.nome, ...(o.apelidos ?? [])].map(normalizar);

  const exatas = obras.filter((o) => nomesDe(o).includes(alvo));
  if (exatas.length === 1 && exatas[0]) return { tipo: 'uma', obra: exatas[0] };

  const parciais = obras.filter((o) =>
    nomesDe(o).some((n) => n.includes(alvo) || alvo.includes(n)),
  );
  if (parciais.length === 1 && parciais[0]) return { tipo: 'uma', obra: parciais[0] };
  if (parciais.length === 0) return { tipo: 'nenhuma' };
  return { tipo: 'ambigua', candidatas: parciais.slice(0, 5) };
}

export interface PagamentoAgregavel {
  valor: number | string;
  categoria?: string | null;
  fornecedor?: string | null;
}

export function somar(pagamentos: readonly { valor: number | string }[]): number {
  // Centavos inteiros para não acumular erro de ponto flutuante em 80 somas.
  const centavos = pagamentos.reduce((acc, p) => acc + Math.round(Number(p.valor) * 100), 0);
  return centavos / 100;
}

export function agregarPorCategoria(
  pagamentos: readonly PagamentoAgregavel[],
): Array<{ categoria: string; total: number; quantidade: number }> {
  const mapa = new Map<string, { total: number; quantidade: number }>();
  for (const p of pagamentos) {
    const chave = p.categoria?.trim() || 'Sem categoria';
    const atual = mapa.get(chave) ?? { total: 0, quantidade: 0 };
    atual.total = Math.round((atual.total + Number(p.valor)) * 100) / 100;
    atual.quantidade += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.entries()]
    .map(([categoria, v]) => ({ categoria, ...v }))
    .sort((a, b) => b.total - a.total);
}

export function rankearFornecedores(
  pagamentos: readonly PagamentoAgregavel[],
  limite: number,
): Array<{ fornecedor: string; total: number; quantidade: number }> {
  const mapa = new Map<string, { total: number; quantidade: number }>();
  for (const p of pagamentos) {
    const chave = p.fornecedor?.trim() || 'Sem fornecedor';
    const atual = mapa.get(chave) ?? { total: 0, quantidade: 0 };
    atual.total = Math.round((atual.total + Number(p.valor)) * 100) / 100;
    atual.quantidade += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.entries()]
    .map(([fornecedor, v]) => ({ fornecedor, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

/** Período válido: `de <= ate`, e no máximo dois anos. */
export function periodoValido(de: string, ate: string): string | null {
  if (de > ate) return 'a data inicial é depois da final';
  const dias = (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000;
  if (dias > 731) return 'período maior que dois anos';
  return null;
}

// ---------------------------------------------------------------------------
// Acesso ao banco (fino)
// ---------------------------------------------------------------------------

async function listarObras(supabase: Client): Promise<ObraResumida[]> {
  const { data, error } = await supabase
    .from('obras')
    .select('id, nome, apelidos, orcamento')
    .is('deleted_at', null)
    .limit(200);
  if (error) throw new Error(`obras: ${error.message}`);
  return (data ?? []).map((o) => ({
    id: o.id,
    nome: o.nome,
    apelidos: o.apelidos,
    orcamento: o.orcamento == null ? null : Number(o.orcamento),
  }));
}

/** Resolve o nome em uma obra, ou devolve o motivo de não ter resolvido. */
async function resolverObra(
  supabase: Client,
  termo: string,
): Promise<{ obra: ObraResumida } | { erro: string; candidatas?: string[] }> {
  const escolha = escolherObra(termo, await listarObras(supabase));
  if (escolha.tipo === 'uma') return { obra: escolha.obra };
  if (escolha.tipo === 'nenhuma') return { erro: `nenhuma obra casa com "${termo}"` };
  return {
    erro: `mais de uma obra casa com "${termo}"; peça para o usuário escolher`,
    candidatas: escolha.candidatas.map((o) => o.nome),
  };
}

interface FiltroPagamentos {
  obraId?: string;
  de?: string;
  ate?: string;
}

async function pagamentosComNomes(supabase: Client, filtro: FiltroPagamentos) {
  let q = supabase
    .from('pagamentos')
    .select('id, valor, data_pagamento, descricao, categorias ( nome ), fornecedores ( nome )')
    .is('deleted_at', null)
    .in('status_pagto', [...STATUS_QUE_CONTAM])
    .limit(2000);
  if (filtro.obraId) q = q.eq('obra_id', filtro.obraId);
  if (filtro.de) q = q.gte('data_pagamento', filtro.de);
  if (filtro.ate) q = q.lte('data_pagamento', filtro.ate);

  const { data, error } = await q;
  if (error) throw new Error(`pagamentos: ${error.message}`);

  return (data ?? []).map((p) => ({
    id: p.id,
    valor: Number(p.valor),
    data: p.data_pagamento,
    descricao: p.descricao,
    categoria: (p.categorias as { nome: string } | null)?.nome ?? null,
    fornecedor: (p.fornecedores as { nome: string } | null)?.nome ?? null,
  }));
}

// ---------------------------------------------------------------------------
// As ferramentas
// ---------------------------------------------------------------------------

export const gastoPorObra = ferramenta({
  nome: 'gasto_por_obra',
  descricao:
    'Total gasto em UMA obra (soma dos pagamentos confirmados e aguardando), com orçamento e percentual consumido. Use quando perguntarem "quanto gastei na obra X", "como está o orçamento da X", "quanto falta na X". Aceita período opcional.',
  schema: z.object({
    obra: NomeObra,
    de: Data.optional(),
    ate: Data.optional(),
  }),
  executar: async (supabase, args) => {
    if (args.de && args.ate) {
      const erro = periodoValido(args.de, args.ate);
      if (erro) return { ok: false, erro };
    }
    const r = await resolverObra(supabase, args.obra);
    if ('erro' in r) return { ok: false, ...r };

    const pagamentos = await pagamentosComNomes(supabase, {
      obraId: r.obra.id,
      de: args.de,
      ate: args.ate,
    });
    const total = somar(pagamentos);
    const orcamento = r.obra.orcamento;

    return {
      ok: true,
      obra: r.obra.nome,
      periodo: args.de || args.ate ? { de: args.de ?? null, ate: args.ate ?? null } : 'todo',
      total,
      quantidade: pagamentos.length,
      orcamento,
      percentual_consumido:
        orcamento && orcamento > 0 ? Math.round((total / orcamento) * 1000) / 10 : null,
      saldo: orcamento && orcamento > 0 ? Math.round((orcamento - total) * 100) / 100 : null,
      por_categoria: agregarPorCategoria(pagamentos).slice(0, 8),
    };
  },
});

export const gastosPorPeriodo = ferramenta({
  nome: 'gastos_por_periodo',
  descricao:
    'Total gasto num período (todas as obras, ou uma obra), quebrado por categoria. Use para "quanto gastei em setembro", "gastos da semana passada", "quanto foi este mês". As datas precisam vir resolvidas em AAAA-MM-DD.',
  schema: z.object({
    de: Data,
    ate: Data,
    obra: NomeObra.optional(),
  }),
  executar: async (supabase, args) => {
    const erro = periodoValido(args.de, args.ate);
    if (erro) return { ok: false, erro };

    let obraId: string | undefined;
    let obraNome: string | null = null;
    if (args.obra) {
      const r = await resolverObra(supabase, args.obra);
      if ('erro' in r) return { ok: false, ...r };
      obraId = r.obra.id;
      obraNome = r.obra.nome;
    }

    const pagamentos = await pagamentosComNomes(supabase, { obraId, de: args.de, ate: args.ate });
    return {
      ok: true,
      obra: obraNome ?? 'todas',
      de: args.de,
      ate: args.ate,
      total: somar(pagamentos),
      quantidade: pagamentos.length,
      por_categoria: agregarPorCategoria(pagamentos).slice(0, 10),
    };
  },
});

export const maioresFornecedores = ferramenta({
  nome: 'maiores_fornecedores',
  descricao:
    'Ranking de fornecedores por valor pago, no total ou numa obra ou período. Use para "quem mais recebeu", "maiores fornecedores", "para quem pagamos mais".',
  schema: z.object({
    obra: NomeObra.optional(),
    de: Data.optional(),
    ate: Data.optional(),
    limite: z.number().int().min(1).max(20).default(5),
  }),
  executar: async (supabase, args) => {
    if (args.de && args.ate) {
      const erro = periodoValido(args.de, args.ate);
      if (erro) return { ok: false, erro };
    }
    let obraId: string | undefined;
    let obraNome: string | null = null;
    if (args.obra) {
      const r = await resolverObra(supabase, args.obra);
      if ('erro' in r) return { ok: false, ...r };
      obraId = r.obra.id;
      obraNome = r.obra.nome;
    }
    const pagamentos = await pagamentosComNomes(supabase, { obraId, de: args.de, ate: args.ate });
    return {
      ok: true,
      obra: obraNome ?? 'todas',
      total_geral: somar(pagamentos),
      ranking: rankearFornecedores(pagamentos, args.limite),
    };
  },
});

export const pagamentosSemDocumento = ferramenta({
  nome: 'pagamentos_sem_documento',
  descricao:
    'Lista pagamentos que ainda não têm nota fiscal nem comprovante anexado, do mais antigo para o mais novo. Use para "o que está sem nota", "quais pagamentos faltam documento", "pendências de nota".',
  schema: z.object({
    obra: NomeObra.optional(),
    dias_minimos: z
      .number()
      .int()
      .min(0)
      .max(365)
      .default(0)
      .describe('Só pagamentos com pelo menos N dias'),
    limite: z.number().int().min(1).max(20).default(10),
  }),
  executar: async (supabase, args) => {
    let obraId: string | undefined;
    if (args.obra) {
      const r = await resolverObra(supabase, args.obra);
      if ('erro' in r) return { ok: false, ...r };
      obraId = r.obra.id;
    }
    const corte = new Date(Date.now() - args.dias_minimos * 86_400_000).toISOString().slice(0, 10);

    let q = supabase
      .from('pagamentos')
      .select(
        'id, valor, data_pagamento, descricao, obras ( nome ), fornecedores ( nome ), documentos ( id, deleted_at )',
      )
      .is('deleted_at', null)
      .in('status_pagto', [...STATUS_QUE_CONTAM])
      .lte('data_pagamento', corte)
      .order('data_pagamento', { ascending: true })
      .limit(500);
    if (obraId) q = q.eq('obra_id', obraId);

    const { data, error } = await q;
    if (error) throw new Error(`pagamentos: ${error.message}`);

    const semDoc = (data ?? []).filter((p) => {
      const docs = (p.documentos ?? []) as Array<{ id: string; deleted_at: string | null }>;
      return docs.every((d) => d.deleted_at !== null);
    });

    return {
      ok: true,
      total_sem_documento: semDoc.length,
      valor_total: somar(semDoc),
      mostrando: Math.min(semDoc.length, args.limite),
      itens: semDoc.slice(0, args.limite).map((p) => ({
        data: p.data_pagamento,
        valor: Number(p.valor),
        obra: (p.obras as { nome: string } | null)?.nome ?? null,
        fornecedor: (p.fornecedores as { nome: string } | null)?.nome ?? null,
        descricao: p.descricao,
      })),
    };
  },
});

export const pendenciasAbertas = ferramenta({
  nome: 'pendencias_abertas',
  descricao:
    'Quantas mensagens de WhatsApp estão esperando confirmação ("SIM") e desde quando. Use para "tem algo pendente", "o que está esperando confirmação".',
  schema: z.object({
    limite: z.number().int().min(1).max(20).default(5),
  }),
  executar: async (supabase, args) => {
    const { data, error, count } = await supabase
      .from('confirmacoes_pendentes')
      .select('id, created_at, pergunta_enviada', { count: 'exact' })
      .eq('resolvida', false)
      .order('created_at', { ascending: true })
      .limit(args.limite);
    if (error) throw new Error(`confirmacoes: ${error.message}`);

    return {
      ok: true,
      abertas: count ?? (data ?? []).length,
      itens: (data ?? []).map((c) => ({
        desde: c.created_at,
        pergunta: c.pergunta_enviada.slice(0, 160),
      })),
    };
  },
});

/** A allowlist. Ferramenta que não está aqui não existe para o modelo. */
export const FERRAMENTAS_DE_OBRA = [
  gastoPorObra,
  gastosPorPeriodo,
  maioresFornecedores,
  pagamentosSemDocumento,
  pendenciasAbertas,
] as const;

export { HOJE };
