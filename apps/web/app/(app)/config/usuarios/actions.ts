'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  inviteUsuarioAdmin,
  resendInviteAdmin,
  updateUsuarioPapelAdmin,
  archiveUsuarioAdmin,
  restoreUsuarioAdmin,
  getUsuario,
} from '@/lib/data/usuarios';

const PAPEIS = ['admin', 'gestor', 'financeiro', 'leitura'] as const;

/** Garante que o caller é admin. Redireciona com ?error= caso não seja. */
async function assertAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect(`/config/usuarios?error=${encodeURIComponent('Sessao expirada. Faca login novamente.')}`);
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();
  if (profile?.papel !== 'admin') {
    redirect(`/config/usuarios?error=${encodeURIComponent('Acesso restrito a administradores.')}`);
  }
  return user.id;
}

const ConvidarSchema = z.object({
  email: z.string().email('Email invalido'),
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  papel: z.enum(PAPEIS, { message: 'Papel invalido' }),
});

export async function convidarUsuario(formData: FormData) {
  await assertAdmin();

  const raw = {
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    nome: String(formData.get('nome') ?? '').trim(),
    papel: String(formData.get('papel') ?? '').trim(),
  };

  const parsed = ConvidarSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.message ?? 'Dados invalidos';
    redirect(`/config/usuarios/convidar?error=${encodeURIComponent(msg)}`);
  }

  const result = await inviteUsuarioAdmin(parsed.data);

  if (!result.ok) {
    // 422 / "User already registered" — email existente
    const isExisting =
      result.error.toLowerCase().includes('already') ||
      result.error.toLowerCase().includes('422') ||
      result.error.toLowerCase().includes('user already registered');
    const msg = isExisting
      ? 'Este email ja foi convidado ou ja e usuario'
      : `Erro ao convidar: ${result.error}`;
    redirect(`/config/usuarios/convidar?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath('/config/usuarios');
  redirect(`/config/usuarios?success=${encodeURIComponent('Convite enviado')}`);
}

const UserIdSchema = z.object({
  user_id: z.string().uuid('user_id invalido'),
});

export async function reenviarConvite(formData: FormData) {
  await assertAdmin();

  const parsed = UserIdSchema.safeParse({
    user_id: String(formData.get('user_id') ?? '').trim(),
  });
  if (!parsed.success) {
    redirect(`/config/usuarios?error=${encodeURIComponent('ID de usuario invalido')}`);
  }

  const usuario = await getUsuario(parsed.data.user_id);
  if (!usuario) {
    redirect(`/config/usuarios?error=${encodeURIComponent('Usuario nao encontrado')}`);
  }

  const result = await resendInviteAdmin({ email: usuario.email });
  if (!result.ok) {
    redirect(`/config/usuarios?error=${encodeURIComponent(`Erro ao reenviar convite: ${result.error}`)}`);
  }

  revalidatePath('/config/usuarios');
  redirect(`/config/usuarios?success=${encodeURIComponent('Convite reenviado')}`);
}

const AlterarPapelSchema = z.object({
  user_id: z.string().uuid('user_id invalido'),
  papel: z.enum(PAPEIS, { message: 'Papel invalido' }),
});

export async function alterarPapelUsuario(formData: FormData) {
  const callerId = await assertAdmin();

  const parsed = AlterarPapelSchema.safeParse({
    user_id: String(formData.get('user_id') ?? '').trim(),
    papel: String(formData.get('papel') ?? '').trim(),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    redirect(`/config/usuarios?error=${encodeURIComponent(first?.message ?? 'Dados invalidos')}`);
  }

  if (parsed.data.user_id === callerId) {
    redirect(`/config/usuarios?error=${encodeURIComponent('Nao e possivel editar seu proprio papel')}`);
  }

  const result = await updateUsuarioPapelAdmin(parsed.data.user_id, parsed.data.papel);
  if (!result.ok) {
    redirect(`/config/usuarios?error=${encodeURIComponent(`Erro ao alterar papel: ${result.error}`)}`);
  }

  revalidatePath('/config/usuarios');
  redirect(`/config/usuarios?success=${encodeURIComponent('Papel atualizado')}`);
}

export async function arquivarUsuario(formData: FormData) {
  const callerId = await assertAdmin();

  const parsed = UserIdSchema.safeParse({
    user_id: String(formData.get('user_id') ?? '').trim(),
  });
  if (!parsed.success) {
    redirect(`/config/usuarios?error=${encodeURIComponent('ID de usuario invalido')}`);
  }

  if (parsed.data.user_id === callerId) {
    redirect(`/config/usuarios?error=${encodeURIComponent('Nao e possivel arquivar sua propria conta')}`);
  }

  const result = await archiveUsuarioAdmin(parsed.data.user_id);
  if (!result.ok) {
    redirect(`/config/usuarios?error=${encodeURIComponent(`Erro ao arquivar usuario: ${result.error}`)}`);
  }

  revalidatePath('/config/usuarios');
  redirect(`/config/usuarios?success=${encodeURIComponent('Usuario arquivado')}`);
}

export async function restaurarUsuario(formData: FormData) {
  await assertAdmin();

  const parsed = UserIdSchema.safeParse({
    user_id: String(formData.get('user_id') ?? '').trim(),
  });
  if (!parsed.success) {
    redirect(`/config/usuarios?error=${encodeURIComponent('ID de usuario invalido')}`);
  }

  const result = await restoreUsuarioAdmin(parsed.data.user_id);
  if (!result.ok) {
    redirect(`/config/usuarios?error=${encodeURIComponent(`Erro ao restaurar usuario: ${result.error}`)}`);
  }

  revalidatePath('/config/usuarios');
  redirect(`/config/usuarios?success=${encodeURIComponent('Usuario restaurado')}`);
}
