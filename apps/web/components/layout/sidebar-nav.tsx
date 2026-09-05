'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, FileText, MessageSquare,
  AlertCircle, Users, Settings, FileBarChart,
} from 'lucide-react';

const NAV = [
  { href: '/painel',       label: 'Painel',       icon: LayoutDashboard },
  { href: '/obras',        label: 'Obras',        icon: Building2 },
  { href: '/documentos',   label: 'Documentos',   icon: FileText },
  { href: '/whatsapp',     label: 'WhatsApp',     icon: MessageSquare },
  { href: '/pendentes',    label: 'Pendentes',    icon: AlertCircle },
  { href: '/fornecedores', label: 'Fornecedores', icon: Users },
] as const;

const SECONDARY = [
  { href: '/relatorios', label: 'Relatórios',    icon: FileBarChart },
  { href: '/config',     label: 'Configurações', icon: Settings },
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  return (
    <nav className="nos-nav">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href as never}
          className={'nos-navitem' + (isActive(href) ? ' is-active' : '')}
        >
          <Icon size={19} />
          <span className="nos-navitem__label">{label}</span>
        </Link>
      ))}
      <div className="nos-nav__sep" />
      {SECONDARY.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href as never}
          className={'nos-navitem' + (isActive(href) ? ' is-active' : '')}
        >
          <Icon size={19} />
          <span className="nos-navitem__label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
