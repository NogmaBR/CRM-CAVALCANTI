'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon, Waves } from 'lucide-react';
import { IconButton } from '@/components/nogma/IconButton';

type Theme = 'light' | 'black' | 'dark';
const LABEL: Record<Theme, string> = {
  light: 'Claro',
  black: 'Escuro (Nogma)',
  dark: 'Petróleo',
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('black');

  useEffect(() => {
    const cur = document.documentElement.getAttribute('data-theme') ?? '';
    setTheme((cur === 'black' || cur === 'dark' ? cur : 'light') as Theme);
  }, []);

  async function cycle() {
    const next: Theme = theme === 'light' ? 'black' : theme === 'black' ? 'dark' : 'light';
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
