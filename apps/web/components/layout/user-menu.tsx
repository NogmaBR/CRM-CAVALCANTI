import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/nogma/Avatar';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/(auth)/login/actions';

/**
 * User pill at the sidebar foot. Reads the real Supabase session server-side
 * and posts to the logout() server action. When drawer/sidebar mounts on the
 * server, the session cookie is already present (middleware refreshed it).
 */
export async function UserMenu() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware guarantees an authenticated user on (app)/* routes, but the
  // drawer also renders this on the mobile menu open state — defensive fallback.
  const email = user?.email ?? 'convidado';
  const nomeRaw = email.split('@')[0] ?? 'Usuário';
  const nome = nomeRaw
    .split(/[._-]/)
    .map((p) => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(' ');

  return (
    <form action={logout} className="nos-userpill nos-userpill--interactive">
      <Avatar name={nome} size="sm" />
      <div className="nos-userpill__meta">
        <div className="nos-userpill__name">{nome}</div>
        <div className="nos-userpill__org">{email}</div>
      </div>
      <button type="submit" className="nos-userpill__logout" aria-label="Sair">
        <LogOut size={16} aria-hidden="true" />
      </button>
    </form>
  );
}
