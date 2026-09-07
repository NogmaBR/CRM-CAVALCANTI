import 'server-only';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export type NotificacaoEmail = Database['public']['Tables']['notificacoes_email']['Row'];
export type PapelUsuario = Database['public']['Enums']['papel_usuario'];

/**
 * Data helpers para notificações email.
 *
 * `logNotificacao` + `getRecipientsByPapel` usam service role (bypass RLS)
 * porque são operações de sistema — chamadas de dentro de fluxos server
 * (server actions triggers + webhook classifier). RLS ainda protege
 * leitura via UI (`listNotificacoes` usa createClient normal).
 */

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausente');
  return createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Retorna emails de usuários com os papéis solicitados.
 * Fluxo: `profiles` (papel filter) → JOIN em `auth.users` via Admin API
 * (email não vive em profiles). Cache none — número de usuários é
 * pequeno (< 50 em prod), custo é ~200ms por chamada.
 */
export async function getRecipientsByPapel(
  papeis: PapelUsuario[],
): Promise<Array<{ user_id: string; nome: string; email: string; papel: PapelUsuario }>> {
  const supabase = serviceRoleClient();

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('user_id, nome, papel')
    .in('papel', papeis);
  if (error || !profiles) return [];

  // auth.admin.listUsers pagina de 1000 em 1000 — pra <50 users basta 1 page
  const { data: usersRes, error: usersErr } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (usersErr || !usersRes) return [];

  const emailByUserId = new Map(usersRes.users.map((u) => [u.id, u.email ?? '']));

  return profiles
    .map((p) => ({
      user_id: p.user_id,
      nome: p.nome,
      email: emailByUserId.get(p.user_id) ?? '',
      papel: p.papel,
    }))
    .filter((r) => r.email.length > 0);
}

/** Registra tentativa de envio (sucesso ou falha) em notificacoes_email. */
export async function logNotificacao(args: {
  destinatario: string;
  assunto: string;
  corpo: string;
  contexto?: Record<string, unknown> | null;
  enviada_em?: string | null; // ISO string se sucesso, null se falhou
  erro?: string | null;
}): Promise<string | null> {
  const supabase = serviceRoleClient();
  const { data, error } = await supabase
    .from('notificacoes_email')
    .insert({
      destinatario: args.destinatario,
      assunto: args.assunto,
      corpo: args.corpo,
      contexto: (args.contexto ?? null) as never, // JSONB — Supabase Json type is picky

      enviada_em: args.enviada_em ?? null,
      erro: args.erro ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

/**
 * Lista notificações mais recentes (limit 200). Usa createClient normal
 * — RLS filtra por papel do usuário (admin/gestor vê tudo, leitura não vê nada).
 */
export async function listNotificacoes(
  filters: { status?: 'enviado' | 'falhou' | 'pendente' } = {},
): Promise<NotificacaoEmail[]> {
  const supabase = await createClient();
  let query = supabase
    .from('notificacoes_email')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters.status === 'enviado') query = query.not('enviada_em', 'is', null).is('erro', null);
  if (filters.status === 'falhou') query = query.not('erro', 'is', null);
  if (filters.status === 'pendente') query = query.is('enviada_em', null).is('erro', null);

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar notificações: ${error.message}`);
  return data ?? [];
}

export async function getNotificacao(id: string): Promise<NotificacaoEmail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('notificacoes_email').select('*').eq('id', id).maybeSingle();
  return data ?? null;
}
