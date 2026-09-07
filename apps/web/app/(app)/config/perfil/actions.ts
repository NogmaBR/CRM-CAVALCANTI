'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';
import { PerfilUpdateSchema } from '@/lib/schemas/perfil';
import { mapDbError } from '@/lib/schemas/errors';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export async function salvarPerfil(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect('/login');
  }

  // Extract raw values from FormData
  const nome = String(formData.get('nome') ?? '').trim();
  const telefone = String(formData.get('telefone') ?? '').trim();
  const tema = String(formData.get('tema') ?? '').trim();
  const timezone = String(formData.get('timezone') ?? '').trim();

  // Checkboxes: absent from FormData when unchecked — explicitly default to false
  const email_prefs = {
    pagamentos_aguardando: formData.get('email_prefs.pagamentos_aguardando') === 'on',
    pendencias_novas: formData.get('email_prefs.pendencias_novas') === 'on',
    digest_semanal: formData.get('email_prefs.digest_semanal') === 'on',
  };

  // Build raw object for Zod — only include defined non-empty values
  const raw: Record<string, unknown> = {};
  if (nome) raw.nome = nome;
  raw.telefone = telefone;
  if (tema) raw.tema = tema;
  if (timezone) raw.timezone = timezone;
  raw.email_prefs = email_prefs;

  const parsed = PerfilUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.message ?? 'Dados inválidos';
    redirect(`/config/perfil?error=${encodeURIComponent(msg)}`);
  }

  // Build typed DB update payload — partial update pattern
  const update: ProfileUpdate = {};
  if (parsed.data.nome !== undefined) update.nome = parsed.data.nome;
  if (parsed.data.telefone !== undefined) {
    // After Zod transform: empty string (0 digits) → set null; otherwise keep digits
    update.telefone = parsed.data.telefone === '' ? null : parsed.data.telefone;
  }
  if (parsed.data.tema !== undefined) update.tema_preferido = parsed.data.tema;
  if (parsed.data.timezone !== undefined) update.timezone = parsed.data.timezone;
  if (parsed.data.email_prefs !== undefined) {
    update.email_prefs = parsed.data.email_prefs as Database['public']['Tables']['profiles']['Update']['email_prefs'];
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('user_id', user.id);

  if (error) {
    const msg = mapDbError(error, 'Erro ao salvar preferências');
    redirect(`/config/perfil?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath('/config/perfil');
  revalidatePath('/config/usuarios');
  redirect(`/config/perfil?success=${encodeURIComponent('Preferências salvas')}`);
}
