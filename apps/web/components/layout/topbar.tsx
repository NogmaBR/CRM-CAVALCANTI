import { Menu, Bell } from 'lucide-react';
import { IconButton } from '@/components/nogma/IconButton';
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
        <IconButton label="Menu" icon={<Menu size={20} />} />
        <div>
          <h1 className="nos-topbar__title">{title}</h1>
          {subtitle ? <div className="nos-topbar__sub">{subtitle}</div> : null}
        </div>
      </div>
      <div className="nos-topbar__right">
        <label className="nos-search">
          <input placeholder="Buscar obras, fornecedores, pagamentos..." />
          <kbd>⌘K</kbd>
        </label>
        <IconButton label="Alertas" icon={<Bell size={19} />} />
        <ThemeToggle />
        {actions}
      </div>
    </header>
  );
}
