'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import { IconButton } from '@/components/nogma/IconButton';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

/**
 * Mobile-only navigation drawer. Renders a hamburger IconButton that opens
 * a full-height sheet from the left containing the same sidebar content.
 * Hidden on md+ via CSS (`.nos-mobile-nav-trigger`).
 */
export function MobileNav() {
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
        <Dialog.Content className="nos-drawer on-black" aria-describedby={undefined}>
          <VisuallyHidden>
            <Dialog.Title>Menu de navegação</Dialog.Title>
          </VisuallyHidden>
          <div className="nos-drawer__brand">
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
            <Dialog.Close asChild>
              <IconButton icon={<X size={18} />} label="Fechar menu" className="nos-drawer__close" />
            </Dialog.Close>
          </div>
          <SidebarNav onNavigate={() => {
            // Radix Dialog closes on outside click; we also want to close on link click.
            // Since SidebarNav uses Next Link, adding onClick to close.
          }} />
          <div className="nos-drawer__foot">
            <UserMenu />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
