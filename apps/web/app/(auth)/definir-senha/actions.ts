'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const SenhaSchema = z
  .object({
    password: z.string().min(8, 'Senha precisa ter pelo menos 8 caracteres').max(72),
    password_confirm: z.string(),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'Senhas não conferem',
    path: ['password_confirm'],
  });

export async function definirSenha(formData: FormData) {
  const raw = {
    password: String(formData.get('password') ?? ''),
    password_confirm: String(formData.get('password_confirm') ?? ''),
  };
  const parsed = SenhaSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.message ?? 'Senha inválida';
    redirect(`/definir-senha?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(
      '/login?error=Sess%C3%A3o%20expirada.%20Solicite%20novo%20convite%20ao%20administrador.',
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    redirect(`/definir-senha?error=${encodeURIComponent(`Falha ao definir senha: ${error.message}`)}`);
  }

  redirect('/painel?success=Senha%20definida.%20Bem-vindo%20ao%20Gestor%20de%20Obras.');
}
