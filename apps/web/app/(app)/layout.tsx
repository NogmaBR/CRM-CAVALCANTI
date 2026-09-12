import { Sidebar } from '@/components/layout/sidebar';
import { createClient } from '@/lib/supabase/server';
import { Toaster } from 'sonner';
import { logout } from '../(auth)/login/actions';

/**
 * Conta arquivada não entra.
 *
 * O middleware só sabe se há sessão; não sabe se o perfil foi arquivado. Até
 * a revisão de 2026-09-11, um usuário arquivado com a senha ainda válida
 * abria o app inteiro. O banimento no Auth (usuarios.ts) e o `deleted_at` em
 * `has_role()` fecham o acesso de verdade; esta checagem é a mensagem
 * humana no lugar de uma tela vazia.
 *
 * Não redireciona para /login: o middleware manda quem tem sessão de volta
 * para /painel, e daria loop. Mostra a tela e oferece o botão de sair.
 */
async function perfilArquivado(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('profiles')
    .select('deleted_at')
    .eq('user_id', user.id)
    .maybeSingle();
  return Boolean(data?.deleted_at);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (await perfilArquivado()) {
    return (
      <main id="main-content" style={{ maxWidth: 480, margin: '10vh auto', padding: 24 }}>
        <h1 style={{ fontSize: '1.25rem' }}>Conta arquivada</h1>
        <p>
          Esta conta foi arquivada por um administrador e não tem mais acesso ao CRM. Se isso for um
          engano, fale com quem administra o sistema.
        </p>
        <form action={logout}>
          <button type="submit" className="nos-btn">
            Sair
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="nos-app-shell">
      <Sidebar />
      <main id="main-content">{children}</main>
      <Toaster
        richColors
        position="top-right"
        closeButton
        theme="dark"
        toastOptions={{
          style: { fontFamily: 'inherit' },
        }}
      />
    </div>
  );
}
