'use client';
import {
  AlertCircle,
  Building2,
  FileBarChart,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Settings,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Grupo principal = o que se opera todo dia. Pagamentos é o objeto central do
// CRM financeiro e faltava aqui (a tabbar e a busca ⌘K já tinham); Auditoria
// é leitura de admin e desce para o grupo de baixo (design review 2026-09-12).
const NAV = [
  { href: '/painel', label: 'Painel', icon: LayoutDashboard },
  { href: '/obras', label: 'Obras', icon: Building2 },
  { href: '/pagamentos', label: 'Pagamentos', icon: Receipt },
  { href: '/documentos', label: 'Documentos', icon: FileText },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { href: '/pendentes', label: 'Pendentes', icon: AlertCircle },
  { href: '/fornecedores', label: 'Fornecedores', icon: Users },
] as const;

const SECONDARY = [
  { href: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { href: '/auditoria', label: 'Auditoria', icon: ShieldCheck },
  { href: '/config/perfil', label: 'Meu perfil', icon: User },
  { href: '/config', label: 'Configurações', icon: Settings },
] as const;

interface SidebarNavProps {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps = {}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav className="nos-nav" aria-label="Navegação principal">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`nos-navitem${isActive(href) ? ' is-active' : ''}`}
          onClick={onNavigate}
          aria-current={isActive(href) ? 'page' : undefined}
        >
          <Icon size={19} aria-hidden="true" />
          <span className="nos-navitem__label">{label}</span>
        </Link>
      ))}
      <div className="nos-nav__sep" />
      {SECONDARY.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`nos-navitem${isActive(href) ? ' is-active' : ''}`}
          onClick={onNavigate}
          aria-current={isActive(href) ? 'page' : undefined}
        >
          <Icon size={19} aria-hidden="true" />
          <span className="nos-navitem__label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
