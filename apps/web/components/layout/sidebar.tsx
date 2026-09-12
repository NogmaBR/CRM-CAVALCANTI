import Image from 'next/image';
import Link from 'next/link';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

export function Sidebar() {
  return (
    // Auto-hide zone (desktop ≥768px, ver styles/nos-responsive.css):
    // a faixa fina na borda esquerda revela a sidebar no hover/foco e ela
    // recolhe ao tirar o mouse. Em mobile o wrapper vira `display:contents`
    // e não interfere no comportamento existente do drawer (MobileNav).
    <div className="nos-sidebar-zone">
      <aside className="nos-sidebar" aria-label="Barra lateral">
        <Link href="/painel" className="nos-brand" aria-label="Ir para o painel">
          <span className="nos-brand__mark">
            <Image src="/logos/cavalcanti-mark-light.png" alt="" width={28} height={28} priority />
          </span>
          <span className="nos-brand__wordtext">Cavalcanti</span>
        </Link>
        <SidebarNav />
        <div className="nos-side-foot">
          <UserMenu />
        </div>
      </aside>
    </div>
  );
}
