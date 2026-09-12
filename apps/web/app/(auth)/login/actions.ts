'use server';

import { logger } from '@/lib/log';

const log = logger('login');

import { LIMITES, ipDaRequest, limparLimite, verificarLimite } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const captchaToken = String(formData.get('captchaToken') ?? '');

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent('E-mail e senha obrigatórios.')}`);
  }
  if (!captchaToken) {
    redirect(`/login?error=${encodeURIComponent('Confirme o captcha para continuar.')}`);
  }

  // Rate limit (finding M-3). A chave junta e-mail e IP: limitar só por IP
  // pune escritório atrás de NAT; limitar só por e-mail deixa um atacante
  // varrer a lista de usuários um por um. Os dois juntos travam o brute force
  // real sem derrubar o time inteiro por causa de um colega desmemoriado.
  const ip = ipDaRequest(await headers());
  const chave = `${email.toLowerCase()}|${ip}`;
  const limite = await verificarLimite(LIMITES.login, chave);
  if (!limite.permitido) {
    const minutos = Math.ceil(limite.retryApos / 60);
    redirect(
      `/login?error=${encodeURIComponent(
        `Muitas tentativas de login. Tente novamente em ${minutos} minuto${minutos > 1 ? 's' : ''}.`,
      )}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  if (error) {
    // Mensagem genérica de propósito: `error.message` distingue "usuário não
    // existe" de "senha errada" de "e-mail não confirmado", o que transforma
    // a tela de login num oráculo de enumeração de contas.
    log.aviso('login_falhou', { erro: error.message });
    redirect(`/login?error=${encodeURIComponent('E-mail ou senha incorretos.')}`);
  }

  // Login válido zera o contador — quem lembrou a senha não fica penalizado
  // pelas tentativas anteriores.
  await limparLimite(LIMITES.login, chave);

  revalidatePath('/', 'layout');
  redirect('/painel');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
