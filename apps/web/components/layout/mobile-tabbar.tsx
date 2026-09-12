'use client';

import { IconButton } from '@/components/nogma/IconButton';
import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { AlertCircle, Building2, LayoutDashboard, Menu, Receipt, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { SidebarNav } from './sidebar-nav';

/**
 * Barra inferior do celular: os quatro destinos de um toque + "Menu", que
 * abre o mesmo drawer do hambúrguer com a navegação completa. Só existe
 * abaixo de 768px (CSS em `nos-shell.css`).
 *
 * `pendencias` vem do layout (contagem no servidor) e vira o selo vermelho
 * no item Pendentes — o gestor vê que há algo esperando sem abrir a tela.
 */
const TABS = [
  { href: '/painel', label: 'Painel', icon: LayoutDashboard },
  { href: '/obras', label: 'Obras', icon: Building2 },
  { href: '/pagamentos', label: 'Pagamentos', icon: Receipt },
  { href: '/pendentes', label: 'Pendentes', icon: AlertCircle },
] as const;

export function MobileTabBar({
  userMenu,
  themeToggle,
  pendencias = 0,
}: {
  userMenu?: ReactNode;
  themeToggle?: ReactNode;
  pendencias?: number;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="nos-tabbar" aria-label="Navegação rápida">
      {TABS.map(({ href, label, icon: Icon }) => {
        const ativo = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`nos-tabbar__item${ativo ? ' is-active' : ''}`}
            aria-current={ativo ? 'page' : undefined}
          >
            <span className="nos-tabbar__icon">
              <Icon size={21} aria-hidden="true" strokeWidth={ativo ? 2.4 : 2} />
              {href === '/pendentes' && pendencias > 0 ? (
                <span className="nos-tabbar__badge" aria-label={`${pendencias} pendências`}>
                  {pendencias > 99 ? '99+' : pendencias}
                </span>
              ) : null}
            </span>
            {label}
          </Link>
        );
      })}
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button type="button" className="nos-tabbar__item" aria-label="Abrir menu completo">
            <span className="nos-tabbar__icon">
              <Menu size={21} aria-hidden="true" />
            </span>
            Menu
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="nos-drawer-overlay" />
          <Dialog.Content className="nos-drawer" aria-describedby={undefined}>
            <VisuallyHidden>
              <Dialog.Title>Menu de navegação</Dialog.Title>
            </VisuallyHidden>
            <div className="nos-drawer__brand">
              <Dialog.Close asChild>
                <Link href="/painel" className="nos-brand" aria-label="Ir para o painel">
                  <span className="nos-brand__mark">
                    <Image src="/logos/cavalcanti-mark-light.png" alt="" width={28} height={28} />
                  </span>
                  <span className="nos-brand__wordtext">Cavalcanti</span>
                </Link>
              </Dialog.Close>
              <Dialog.Close asChild>
                <IconButton
                  icon={<X size={18} />}
                  label="Fechar menu"
                  className="nos-drawer__close"
                />
              </Dialog.Close>
            </div>
            <Dialog.Close asChild>
              <div>
                <SidebarNav />
              </div>
            </Dialog.Close>
            <div className="nos-drawer__foot">
              {themeToggle ? (
                <div className="nos-drawer__tema">
                  <span>Tema</span>
                  {themeToggle}
                </div>
              ) : null}
              {userMenu}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </nav>
  );
}
