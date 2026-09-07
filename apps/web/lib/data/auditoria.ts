import 'server-only';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

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
 * RLS ativa (admin/gestor only via policy audit_admin_gestor_select).
 *
 * Diff é JSONB — sem type strict (varia por tabela). UI faz safe render.
 */
export async function listAuditLog(
  filters: AuditListFilters = {},
  limit = 200,
): Promise<AuditListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters.entidade) query = query.eq('entidade', filters.entidade);
  if (filters.entidade_id) query = query.eq('entidade_id', filters.entidade_id);
  if (filters.user_id) query = query.eq('user_id', filters.user_id);
  if (filters.acao) query = query.eq('acao', filters.acao);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar auditoria: ${error.message}`);
  const rows = data ?? [];

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

  return rows.map((r) => {
    const prof = r.user_id ? profilesMap.get(r.user_id) : undefined;
    return {
      ...r,
      user_nome: prof?.nome ?? null,
      user_papel: prof?.papel ?? null,
    };
  });
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
