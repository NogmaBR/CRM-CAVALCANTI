import 'server-only';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export interface MyProfile extends Profile {
  email: string;
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

  return {
    ...profile,
    email: user.email ?? '',
  };
}
