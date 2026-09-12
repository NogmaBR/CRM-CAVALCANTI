import 'server-only';
import { logger } from '@/lib/log';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type PapelUsuario = Database['public']['Enums']['papel_usuario'];

/** Item enriquecido pra list — profile + email + status (invited/active/archived). */
export interface UsuarioItem {
  user_id: string;
  nome: string;
  papel: PapelUsuario;
  telefone: string | null;
  email: string;
  created_at: string | null;
  deleted_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  status: 'ativo' | 'convite_pendente' | 'arquivado';
}

export const PAPEL_LABELS: Record<PapelUsuario, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  financeiro: 'Financeiro',
  leitura: 'Leitura',
};

export const PAPEL_DESCRIPTIONS: Record<PapelUsuario, string> = {
  admin: 'Acesso total, gerencia usuários e configurações',
  gestor: 'Cria/edita obras, pagamentos, aprovações',
  financeiro: 'Visualiza + edita pagamentos e documentos',
  leitura: 'Apenas visualização',
};

/**
 * Service role client. Bypassa RLS + acessa auth.admin API pra emails.
 * Só server-side; nunca expor.
 */
const log = logger('usuarios');

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausente');
  return createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Lista todos os usuários (profiles + auth.users). RLS admin cobre; se
 * caller não for admin, retorna vazio (RLS filtra).
 *
 * Merge com Admin API pra pegar email + last_sign_in_at + email_confirmed_at
 * (dados vivem em auth.users, não em profiles).
 */
export async function listUsuarios(includeArchived = false): Promise<UsuarioItem[]> {
  const supabase = await createClient();
  let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (!includeArchived) query = query.is('deleted_at', null);
  const { data: profiles, error } = await query;
  if (error) throw new Error(`Falha ao listar profiles: ${error.message}`);
  if (!profiles || profiles.length === 0) return [];

  // Admin API pra emails (só service role tem acesso)
  const admin = serviceRoleClient();
  const { data: users, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) throw new Error(`Falha ao listar users: ${usersErr.message}`);

  const emailByUserId = new Map(
    users.users.map((u) => [
      u.id,
      {
        email: u.email ?? '',
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
      },
    ]),
  );

  return profiles.map((p): UsuarioItem => {
    const meta = emailByUserId.get(p.user_id);
    const email = meta?.email ?? '';
    const emailConfirmed = meta?.email_confirmed_at ?? null;
    const lastSignIn = meta?.last_sign_in_at ?? null;

    let status: UsuarioItem['status'];
    if (p.deleted_at != null) status = 'arquivado';
    else if (emailConfirmed == null || lastSignIn == null) status = 'convite_pendente';
    else status = 'ativo';

    return {
      user_id: p.user_id,
      nome: p.nome,
      papel: p.papel,
      telefone: p.telefone,
      email,
      created_at: p.created_at,
      deleted_at: p.deleted_at,
      last_sign_in_at: lastSignIn,
      email_confirmed_at: emailConfirmed,
      status,
    };
  });
}

export async function getUsuario(userId: string): Promise<UsuarioItem | null> {
  const usuarios = await listUsuarios(true);
  return usuarios.find((u) => u.user_id === userId) ?? null;
}

/**
 * Convida usuário via Supabase Auth. Cria auth.user com email_confirmed=false
 * e envia email de invite. `handle_new_user` trigger cria o profile
 * automático com papel do metadata.
 *
 * Chame de server action que já validou (admin only + email/papel Zod).
 */
export async function inviteUsuarioAdmin(args: {
  email: string;
  nome: string;
  papel: PapelUsuario;
  redirectTo?: string;
}): Promise<{ ok: true; user_id: string } | { ok: false; error: string }> {
  const admin = serviceRoleClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-cavalcanti.vercel.app';
  const redirectTo = args.redirectTo ?? `${appUrl}/definir-senha`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(args.email, {
    data: { nome: args.nome, papel: args.papel },
    redirectTo,
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: 'Invite retornou sem user' };
  return { ok: true, user_id: data.user.id };
}

/**
 * Reenviar convite pra usuário existente. Supabase re-gera link válido
 * e envia novo email. Usa mesmo endpoint pois inviteUserByEmail é
 * idempotente pra email já existente (retorna user + envia).
 */
export async function resendInviteAdmin(args: {
  email: string;
  redirectTo?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = serviceRoleClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-cavalcanti.vercel.app';
  const redirectTo = args.redirectTo ?? `${appUrl}/definir-senha`;

  const { error } = await admin.auth.admin.inviteUserByEmail(args.email, { redirectTo });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Atualiza papel de um profile. RLS admin ALL permite; caller precisa
 * ser admin (validar antes na server action).
 *
 * Trigger audit_log_trigger da Fase 11 captura automaticamente (profiles
 * não está incluído nas 6 tabelas atualmente — SE quiser auditar
 * papel change, adicionar trigger em migration futura).
 */
export async function updateUsuarioPapelAdmin(
  userId: string,
  novoPapel: PapelUsuario,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = serviceRoleClient();
  const { error } = await admin.from('profiles').update({ papel: novoPapel }).eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Soft-delete: marca deleted_at + revoga sessions no auth.users
 * (força re-login que vai falhar pra usuário arquivado).
 *
 * Reversível via restoreUsuarioAdmin (limpa deleted_at).
 */
export async function archiveUsuarioAdmin(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = serviceRoleClient();
  const now = new Date().toISOString();

  const { error: updErr } = await admin
    .from('profiles')
    .update({ deleted_at: now })
    .eq('user_id', userId);
  if (updErr) return { ok: false, error: updErr.message };

  // Banir no Auth é o que de fato revoga o acesso. Só marcar `deleted_at` e
  // revogar sessões NÃO bastava: a senha continuava válida, o login passava,
  // e `has_role()` — a base de toda policy — ignorava a coluna. Um admin
  // arquivado seguia admin. Descoberto na revisão de 2026-09-11.
  //
  // `ban_duration` bloqueia login e refresh; o `signOut` abaixo derruba o que
  // já está aberto. A migration 20260911140000 fechou o outro lado: has_role
  // exige deleted_at IS NULL, e o próprio usuário não consegue se desarquivar.
  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: '876000h', // ~100 anos: "para sempre", reversível no restore
  });
  if (banErr) return { ok: false, error: `Arquivado, mas o banimento falhou: ${banErr.message}` };

  const { error: signOutErr } = await admin.auth.admin.signOut(userId);
  if (signOutErr) {
    // Não bloqueia: com o ban, a sessão aberta morre no próximo refresh (≤ 1h)
    // e a RLS já nega tudo pelo deleted_at.
    log.aviso('signout_apos_arquivar_falhou', { erro: signOutErr.message });
  }
  return { ok: true };
}

export async function restoreUsuarioAdmin(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = serviceRoleClient();
  const { error } = await admin.from('profiles').update({ deleted_at: null }).eq('user_id', userId);
  if (error) return { ok: false, error: error.message };

  const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
  if (banErr)
    return { ok: false, error: `Restaurado, mas continua banido no Auth: ${banErr.message}` };
  return { ok: true };
}
