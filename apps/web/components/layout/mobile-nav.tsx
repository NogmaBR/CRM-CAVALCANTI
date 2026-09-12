'use client';

import { IconButton } from '@/components/nogma/IconButton';
import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SidebarNav } from './sidebar-nav';

/**
 * Mobile-only navigation drawer. Renders a hamburger IconButton that opens
 * a full-height sheet from the left containing the same sidebar content.
 * Hidden on md+ via CSS (`.nos-mobile-nav-trigger`).
 *
 * Accepts `userMenu` as a ReactNode so the server parent can pass in the
 * async <UserMenu /> Server Component without violating the client boundary.
 */
export function MobileNav({
  userMenu,
  themeToggle,
}: {
  userMenu?: ReactNode;
  themeToggle?: ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <IconButton
          icon={<Menu size={20} />}
          label="Abrir menu"
          className="nos-mobile-nav-trigger"
        />
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
          {/* Clicar num link fecha o drawer: o Dialog.Close envolve a lista
              inteira e o clique borbulha até ele. Antes o `onNavigate` era
              vazio e o menu ficava aberto por cima da página nova. */}
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
  );
}
