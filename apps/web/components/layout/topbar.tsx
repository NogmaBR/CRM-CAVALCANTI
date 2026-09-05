import { Bell, Search } from 'lucide-react';
import { IconButton } from '@/components/nogma/IconButton';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';

export function TopBar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="nos-topbar">
      <div className="nos-topbar__left">
        <MobileNav userMenu={<UserMenu />} />
        <div className="nos-topbar__heading">
          <h1 className="nos-topbar__title">{title}</h1>
          {subtitle ? <div className="nos-topbar__sub">{subtitle}</div> : null}
        </div>
      </div>
      <div className="nos-topbar__right">
        <label className="nos-search nos-search--desktop">
          <Search size={15} color="var(--text-muted)" aria-hidden="true" />
          <input placeholder="Buscar obras, fornecedores, pagamentos..." aria-label="Buscar" />
          <kbd>⌘K</kbd>
        </label>
        <IconButton
          label="Buscar"
          icon={<Search size={19} />}
          className="nos-search-trigger"
        />
        <IconButton label="Alertas" icon={<Bell size={19} />} />
        <ThemeToggle />
        {actions ? <span className="nos-topbar__actions">{actions}</span> : null}
      </div>
    </header>
  );
}
