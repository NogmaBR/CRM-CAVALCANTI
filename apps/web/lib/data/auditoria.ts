import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';

export type AuditLog = Database['public']['Tables']['audit_log']['Row'];
export type AuditAcao = 'insert' | 'update' | 'delete';

/**
 * Entidades auditadas — matches lista da migration 20260907160000.
 * Se adicionar nova tabela ao trigger, adicione aqui também pra o filter.
 */
export const AUDIT_ENTIDADES = [
  'obras',
  'fornecedores',
  'pagamentos',
  'documentos',
  'categorias',
  'autorizados',
] as const;
export type AuditEntidade = (typeof AUDIT_ENTIDADES)[number];

/** Labels human-readable pra UI. */
export const AUDIT_ENTIDADE_LABELS: Record<AuditEntidade, string> = {
  obras: 'Obras',
  fornecedores: 'Fornecedores',
  pagamentos: 'Pagamentos',
  documentos: 'Documentos',
  categorias: 'Categorias',
  autorizados: 'Autorizados WhatsApp',
};

export const AUDIT_ACAO_LABELS: Record<AuditAcao, string> = {
  insert: 'Criação',
  update: 'Alteração',
  delete: 'Exclusão',
};

export interface AuditListFilters {
  entidade?: AuditEntidade;
  entidade_id?: string;
  user_id?: string;
  acao?: AuditAcao;
  from?: string; // ISO datetime inclusive
  to?: string; // ISO datetime inclusive
}

export interface AuditListItem extends AuditLog {
  user_nome: string | null;
  user_papel: Database['public']['Enums']['papel_usuario'] | null;
}

/**
 * Lista audit_log com JOIN em profiles pra pegar nome+papel do user.
 * RLS ativa (admin/gestor only via policy audit_admin_select).
 *
 * Diff é JSONB — sem type strict (varia por tabela). UI faz safe render.
 */
export async function listAuditLog(
  filters: AuditListFilters = {},
  limit = 200,
): Promise<AuditListItem[]> {
  const { itens } = await listAuditLogPaginado(filters, { pagina: 1, porPagina: limit });
  return itens;
}

/** Tamanho de página da tela `/auditoria`. */
export const AUDIT_POR_PAGINA = 50;

export interface AuditPagina {
  itens: AuditListItem[];
  pagina: number;
  porPagina: number;
  /** Total de linhas no filtro (count exato do PostgREST). */
  total: number;
  totalPaginas: number;
}

/**
 * Mesma consulta, paginada por `.range()` com `count: 'exact'` na mesma ida.
 *
 * A tela renderizava 200 cartões de uma vez (14.000px de altura); a lista
 * agora vem em páginas de 50 e a página é `?pagina=N`. Os filtros continuam
 * os mesmos — o `count` é calculado com eles aplicados, então "3 de 5" fala
 * do filtro, não da tabela inteira.
 */
export async function listAuditLogPaginado(
  filters: AuditListFilters = {},
  { pagina = 1, porPagina = AUDIT_POR_PAGINA }: { pagina?: number; porPagina?: number } = {},
): Promise<AuditPagina> {
  const supabase = await createClient();

  const paginaSegura = Number.isFinite(pagina) && pagina >= 1 ? Math.floor(pagina) : 1;
  const inicio = (paginaSegura - 1) * porPagina;

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(inicio, inicio + porPagina - 1);

  if (filters.entidade) query = query.eq('entidade', filters.entidade);
  if (filters.entidade_id) query = query.eq('entidade_id', filters.entidade_id);
  if (filters.user_id) query = query.eq('user_id', filters.user_id);
  if (filters.acao) query = query.eq('acao', filters.acao);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);

  const { data, error, count } = await query;
  // PostgREST responde 416 quando o `range` começa depois do fim: página
  // além do total. Devolve vazio em vez de derrubar a tela.
  if (error && error.code === 'PGRST103') {
    return { itens: [], pagina: paginaSegura, porPagina, total: 0, totalPaginas: 0 };
  }
  if (error) throw new Error(`Falha ao listar auditoria: ${error.message}`);
  const rows = data ?? [];
  const total = count ?? rows.length;

  // Batched lookup nomes+papel via profiles
  const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))];
  const profilesMap = new Map<
    string,
    { nome: string; papel: Database['public']['Enums']['papel_usuario'] }
  >();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, nome, papel')
      .in('user_id', userIds);
    for (const p of profiles ?? []) {
      profilesMap.set(p.user_id, { nome: p.nome, papel: p.papel });
    }
  }

  const itens = rows.map((r) => {
    const prof = r.user_id ? profilesMap.get(r.user_id) : undefined;
    return {
      ...r,
      user_nome: prof?.nome ?? null,
      user_papel: prof?.papel ?? null,
    };
  });

  return {
    itens,
    pagina: paginaSegura,
    porPagina,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

/** Fetch de log específico via id (bigserial). */
export async function getAuditLog(id: number): Promise<AuditListItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('audit_log').select('*').eq('id', id).maybeSingle();
  if (!data) return null;

  if (!data.user_id) {
    return { ...data, user_nome: null, user_papel: null };
  }
  const { data: prof } = await supabase
    .from('profiles')
    .select('nome, papel')
    .eq('user_id', data.user_id)
    .maybeSingle();
  return { ...data, user_nome: prof?.nome ?? null, user_papel: prof?.papel ?? null };
}

/**
 * Retorna URL do detail page da entidade auditada (pra cross-nav).
 * Exemplo: entidade='obras', entidade_id='abc' → '/obras/abc'
 * Para autorizados/categorias que não têm detail, retorna null.
 */
export function getEntidadeUrl(entidade: string, entidade_id: string): string | null {
  const routableEntidades: Record<string, string> = {
    obras: '/obras',
    fornecedores: '/fornecedores',
    pagamentos: '/pagamentos',
    documentos: '/documentos',
  };
  const base = routableEntidades[entidade];
  return base ? `${base}/${entidade_id}` : null;
}

/**
 * Extrai lista de campos alterados de um diff `{before, after}` (UPDATE)
 * ou `{after}` (INSERT) ou `{before}` (DELETE). Retorna keys de forma
 * consistente pra summary em list view.
 */
export function extractChangedKeys(diff: unknown): string[] {
  if (!diff || typeof diff !== 'object') return [];
  const d = diff as Record<string, unknown>;
  const after = d.after && typeof d.after === 'object' ? Object.keys(d.after) : [];
  const before = d.before && typeof d.before === 'object' ? Object.keys(d.before) : [];
  return [...new Set([...after, ...before])].sort();
}

// ── frase humana ────────────────────────────────────────────────────────────

/** Nomes de obra/fornecedor referenciados pelos diffs de uma página. */
export interface AuditNomes {
  obras: Map<string, string>;
  fornecedores: Map<string, string>;
}

function lerLado(diff: unknown, lado: 'before' | 'after'): Record<string, unknown> | null {
  if (!diff || typeof diff !== 'object') return null;
  const v = (diff as Record<string, unknown>)[lado];
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** O lado que descreve o registro: `after` (insert/update) ou `before` (delete). */
function lerRegistro(item: Pick<AuditLog, 'diff'>): Record<string, unknown> | null {
  return lerLado(item.diff, 'after') ?? lerLado(item.diff, 'before');
}

function uuidEm(reg: Record<string, unknown> | null, chave: string): string | null {
  const v = reg?.[chave];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Resolve, numa ida por tabela, os nomes de obra e fornecedor que os diffs
 * de `pagamentos`/`documentos` referenciam por id. É o que permite escrever
 * "de R$ 3.450,00 (FAIHome)" em vez de "obra_id: d81913a7-…".
 */
export async function lookupNomesParaAuditoria(itens: AuditListItem[]): Promise<AuditNomes> {
  const obraIds = new Set<string>();
  const fornecedorIds = new Set<string>();
  for (const item of itens) {
    if (item.entidade !== 'pagamentos' && item.entidade !== 'documentos') continue;
    const reg = lerRegistro(item);
    const o = uuidEm(reg, 'obra_id');
    const f = uuidEm(reg, 'fornecedor_id');
    if (o) obraIds.add(o);
    if (f) fornecedorIds.add(f);
  }

  const nomes: AuditNomes = { obras: new Map(), fornecedores: new Map() };
  if (obraIds.size === 0 && fornecedorIds.size === 0) return nomes;

  const supabase = await createClient();
  const [obras, fornecedores] = await Promise.all([
    obraIds.size > 0
      ? supabase
          .from('obras')
          .select('id, nome')
          .in('id', [...obraIds])
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    fornecedorIds.size > 0
      ? supabase
          .from('fornecedores')
          .select('id, nome')
          .in('id', [...fornecedorIds])
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);
  for (const o of obras.data ?? []) nomes.obras.set(o.id, o.nome);
  for (const f of fornecedores.data ?? []) nomes.fornecedores.set(f.id, f.nome);
  return nomes;
}

const ENTIDADE_SINGULAR: Record<AuditEntidade, string> = {
  obras: 'obra',
  fornecedores: 'fornecedor',
  pagamentos: 'pagamento',
  documentos: 'documento',
  categorias: 'categoria',
  autorizados: 'número autorizado',
};

const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function texto(reg: Record<string, unknown> | null, chave: string): string | null {
  const v = reg?.[chave];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Resumo curto do registro, a partir do diff: "de R$ 3.450,00 (FAIHome)",
 * "Garibaldi", "nota-123.pdf". Best-effort: sem dado reconhecível devolve
 * `null` e a frase fica no genérico.
 */
export function resumirRegistroAuditoria(item: AuditListItem, nomes?: AuditNomes): string | null {
  const reg = lerRegistro(item);
  if (!reg) return null;

  switch (item.entidade as AuditEntidade) {
    case 'pagamentos': {
      const valor = typeof reg.valor === 'number' ? reg.valor : Number(reg.valor);
      const partes: string[] = [];
      if (reg.valor != null && Number.isFinite(valor)) {
        partes.push(`de ${formatadorBRL.format(valor)}`);
      }
      const fornecedor = nomes?.fornecedores.get(uuidEm(reg, 'fornecedor_id') ?? '');
      const obra = nomes?.obras.get(uuidEm(reg, 'obra_id') ?? '');
      const quem = fornecedor ?? obra ?? texto(reg, 'descricao');
      if (quem) partes.push(`(${quem})`);
      return partes.length > 0 ? partes.join(' ') : null;
    }
    case 'documentos': {
      const nome = texto(reg, 'nome_arquivo') ?? texto(reg, 'numero_nf');
      const obra = nomes?.obras.get(uuidEm(reg, 'obra_id') ?? '');
      if (nome && obra) return `${nome} (${obra})`;
      return nome ?? (obra ? `(${obra})` : null);
    }
    case 'autorizados': {
      const nome = texto(reg, 'nome');
      const tel = texto(reg, 'telefone_whats');
      if (nome && tel) return `${nome} (${tel})`;
      return nome ?? tel;
    }
    default:
      return texto(reg, 'nome');
  }
}

/**
 * Frase da linha: "<Ação> de <entidade> <resumo> por <ator>".
 * Ex.: "Criação de pagamento de R$ 3.450,00 (FAIHome) pelo sistema".
 * Num UPDATE o diff só traz as colunas que mudaram; se `nome` não estiver
 * entre elas o resumo fica vazio e a frase cai no genérico — é aceitável.
 */
export function fraseAuditoria(item: AuditListItem, nomes?: AuditNomes): string {
  const acao = AUDIT_ACAO_LABELS[item.acao as AuditAcao] ?? item.acao;
  const entidade = ENTIDADE_SINGULAR[item.entidade as AuditEntidade] ?? item.entidade;
  const resumo = resumirRegistroAuditoria(item, nomes);
  const ator = item.user_nome ? `por ${item.user_nome}` : 'pelo sistema';
  return [acao, 'de', entidade, resumo, ator].filter(Boolean).join(' ');
}
