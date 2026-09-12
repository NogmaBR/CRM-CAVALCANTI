import { MobileTabBar } from '@/components/layout/mobile-tabbar';
import { Sidebar } from '@/components/layout/sidebar';
import { TelaDeEstado } from '@/components/layout/tela-de-estado';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { createClient } from '@/lib/supabase/server';
import { getServerTheme } from '@/lib/theme';
import { Archive, LogOut } from 'lucide-react';
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

/** Contagem para o selo da barra inferior; falha em silêncio. */
async function contarPendencias(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('confirmacoes_pendentes')
      .select('*', { count: 'exact', head: true })
      .eq('resolvida', false);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [arquivado, theme, pendencias] = await Promise.all([
    perfilArquivado(),
    getServerTheme(),
    contarPendencias(),
  ]);

  if (arquivado) {
    return (
      <TelaDeEstado
        icon={<Archive size={28} aria-hidden="true" />}
        title="Conta arquivada"
        actions={
          <form action={logout}>
            <button type="submit" className="ng-btn ng-btn--secondary ng-btn--md">
              <span className="ng-btn__icon" aria-hidden="true">
                <LogOut size={16} />
              </span>
              Sair
            </button>
          </form>
        }
      >
        Esta conta foi arquivada por um administrador e não tem mais acesso ao CRM. Se isso for um
        engano, fale com quem administra o sistema.
      </TelaDeEstado>
    );
  }

  return (
    <div className="nos-app-shell">
      <Sidebar />
      <main id="main-content">{children}</main>
      <MobileTabBar
        userMenu={<UserMenu />}
        themeToggle={<ThemeToggle initial={theme} />}
        pendencias={pendencias}
      />
      <Toaster
        richColors
        position="top-right"
        closeButton
        theme={theme === 'light' ? 'light' : 'dark'}
        toastOptions={{
          style: { fontFamily: 'inherit' },
        }}
      />
    </div>
  );
}
