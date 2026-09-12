import { createClient } from '@/lib/supabase/server';
import { getServerTheme } from '@/lib/theme';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { CommandPalette } from './command-palette';
import { MobileNav } from './mobile-nav';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

/**
 * Quantas coisas esperam ação humana agora: confirmações do WhatsApp abertas.
 * É o número do sino. Consulta `head` (só contagem), com a RLS do usuário.
 * Falha em silêncio — o sino sem número é melhor que a página sem topo.
 */
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

/**
 * Cabeçalho de toda tela.
 *
 * Grade de três colunas (`1fr auto 1fr`): o título fica no centro exato do
 * topo, com o hambúrguer à esquerda (celular) e busca, sino, tema e ações à
 * direita. Abaixo de 900px as ações descem para uma linha própria, também
 * centralizada — nunca somem. Pedido do usuário em 2026-09-12: título
 * centralizado, na mesma altura dos controles, em todas as telas.
 */
export async function TopBar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const [pendencias, theme] = await Promise.all([contarPendencias(), getServerTheme()]);
  const rotuloSino =
    pendencias === 0
      ? 'Pendências: nenhuma'
      : pendencias === 1
        ? 'Pendências: 1 confirmação aguardando'
        : `Pendências: ${pendencias} confirmações aguardando`;

  return (
    <header className="nos-topbar">
      <div className="nos-topbar__left">
        <MobileNav userMenu={<UserMenu />} themeToggle={<ThemeToggle initial={theme} />} />
      </div>
      <div className="nos-topbar__heading">
        <h1 className="nos-topbar__title">{title}</h1>
        {subtitle ? <p className="nos-topbar__sub">{subtitle}</p> : null}
      </div>
      <div className="nos-topbar__right">
        <div className="nos-topbar__tools">
          <CommandPalette />
          <Link href="/pendentes" className="nos-bell" aria-label={rotuloSino} title={rotuloSino}>
            <Bell size={19} aria-hidden="true" />
            {pendencias > 0 ? (
              <span className="nos-bell__count" aria-hidden="true">
                {pendencias > 99 ? '99+' : pendencias}
              </span>
            ) : null}
          </Link>
          <span className="nos-topbar__theme">
            <ThemeToggle initial={theme} />
          </span>
        </div>
        {actions ? <div className="nos-topbar__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
