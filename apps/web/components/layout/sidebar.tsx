import Image from 'next/image';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

export function Sidebar() {
  return (
    <aside className="nos-sidebar on-black">
      <div className="nos-brand">
        <span className="nos-brand__mark">
          <Image src="/logos/isotype-n-lime.png" alt="Nogma" width={28} height={28} />
        </span>
        <Image
          className="nos-brand__word"
          src="/logos/logo-nogma-lime.png"
          alt="nogma"
          width={100}
          height={24}
        />
      </div>
      <SidebarNav />
      <div className="nos-side-foot">
        <UserMenu />
      </div>
    </aside>
  );
}
