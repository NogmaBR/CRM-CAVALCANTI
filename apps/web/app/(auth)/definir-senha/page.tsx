import { redirect } from 'next/navigation';
import { DefinirSenhaForm } from './definir-senha-form';
import { createClient } from '@/lib/supabase/server';

/**
 * Página de auto-cadastro de senha após clicar em invite email.
 *
 * Fluxo:
 *  1. Admin convida via /config/usuarios/convidar
 *  2. Supabase manda email com link https://<project>.supabase.co/auth/v1/verify?...&redirect_to={APP_URL}/definir-senha
 *  3. Usuário clica → Supabase confirma email + redireciona pra /definir-senha?code=xxx
 *     (PKCE flow — code é one-time exchange)
 *  4. Server component exchange code by session (via callback route OU
 *     supabase-ssr fará auto-exchange no getUser)
 *  5. Form renderizado, user define senha, chama server action que
 *     invoca supabase.auth.updateUser({ password })
 *  6. Redirect pra /painel
 *
 * Se acesso sem session válida → redirect /login.
 * Se já tem senha (já confirmado antes), aceita re-set (comportamento
 * padrão de "esqueci minha senha") sem exigir estado especial.
 */
export default async function DefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Se veio com code, tenta trocar por session (PKCE)
  if (params.code) {
    const { error: exchErr } = await supabase.auth.exchangeCodeForSession(params.code);
    if (exchErr) {
      redirect(
        `/definir-senha?error=${encodeURIComponent(`Link expirado ou inválido: ${exchErr.message}`)}`,
      );
    }
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    // Se não veio com code E não tem session, direto pra login
    redirect('/login?error=Sess%C3%A3o%20expirada.%20Fa%C3%A7a%20login%20ou%20use%20o%20link%20do%20email.');
  }

  return (
    <div className="nos-login">
      <div className="nos-login__card">
        <h1 className="nos-login__title">Defina sua senha</h1>
        <p className="nos-login__lead">
          Olá, {user.email}. Crie uma senha segura para acessar o painel.
        </p>
        {params.error ? (
          <div className="nos-login__error" role="alert">
            {params.error}
          </div>
        ) : null}
        <DefinirSenhaForm />
      </div>
    </div>
  );
}
