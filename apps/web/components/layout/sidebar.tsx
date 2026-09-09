import Image from 'next/image';
import Link from 'next/link';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

export function Sidebar() {
  return (
    <aside className="nos-sidebar on-black" aria-label="Barra lateral">
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
  );
}
