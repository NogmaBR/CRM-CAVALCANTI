import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/nogma/Avatar';

export function UserMenu() {
  return (
    <div className="nos-userpill">
      <Avatar name="Fernando Cavalcanti" size="sm" />
      <div className="nos-userpill__meta">
        <div className="nos-userpill__name">Fernando Cavalcanti</div>
        <div className="nos-userpill__org">Administrador</div>
      </div>
      <LogOut size={16} color="var(--petroleum-300)" />
    </div>
  );
}
