import 'server-only';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_EMAIL_PREFS, type EmailPrefs } from '@/lib/schemas/perfil';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export interface MyProfile extends Profile {
  email: string;
  parsed_email_prefs: EmailPrefs;
}

/**
 * Retorna profile do usuário autenticado + email do auth.user.
 * Usa createClient (RLS ativa; profiles_self_select cobre).
 */
export async function getMyProfile(): Promise<MyProfile | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !profile) return null;

  const raw = profile.email_prefs as unknown;
  const parsed: EmailPrefs =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...DEFAULT_EMAIL_PREFS, ...(raw as Partial<EmailPrefs>) }
      : DEFAULT_EMAIL_PREFS;

  return {
    ...profile,
    email: user.email ?? '',
    parsed_email_prefs: parsed,
  };
}

/**
 * Parseia email_prefs de qualquer profile pra shape tipada com defaults.
 * Usado em getRecipientsByPapel (Fase 10 — filtra por prefs).
 */
export function parseEmailPrefs(raw: unknown): EmailPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_EMAIL_PREFS;
  const obj = raw as Partial<EmailPrefs>;
  return {
    pagamentos_aguardando: obj.pagamentos_aguardando ?? DEFAULT_EMAIL_PREFS.pagamentos_aguardando,
    pendencias_novas: obj.pendencias_novas ?? DEFAULT_EMAIL_PREFS.pendencias_novas,
    digest_semanal: obj.digest_semanal ?? DEFAULT_EMAIL_PREFS.digest_semanal,
  };
}
