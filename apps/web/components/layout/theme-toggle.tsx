'use client';
import { IconButton } from '@/components/nogma/IconButton';
import type { Theme } from '@/lib/theme';
import { Moon, Sun, Waves } from 'lucide-react';
import { useState } from 'react';

const LABEL: Record<Theme, string> = {
  light: 'Claro',
  black: 'Escuro (Nogma)',
  dark: 'Petróleo',
};

const ORDEM: Theme[] = ['light', 'black', 'dark'];

/**
 * Alterna entre os três temas. O tema inicial vem do servidor (cookie lido
 * no `TopBar`): antes o estado começava em `black` e o ícone piscava errado
 * no primeiro paint de quem usa o tema claro.
 */
export function ThemeToggle({ initial = 'black' }: { initial?: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  async function cycle() {
    const next = ORDEM[(ORDEM.indexOf(theme) + 1) % ORDEM.length] ?? 'light';
    if (next === 'light') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
    await fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    });
  }

  const Icon = theme === 'light' ? Sun : theme === 'black' ? Moon : Waves;
  return (
    <IconButton
      label={`Tema: ${LABEL[theme]} — clique para trocar`}
      icon={<Icon size={18} />}
      onClick={cycle}
    />
  );
}
