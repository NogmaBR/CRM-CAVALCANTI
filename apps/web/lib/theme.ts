import { cookies } from 'next/headers';

export type Theme = 'light' | 'black' | 'dark';
export const THEME_COOKIE = 'nogma-theme';
export const DEFAULT_THEME: Theme = 'black';

export async function getServerTheme(): Promise<Theme> {
  const store = await cookies();
  const raw = store.get(THEME_COOKIE)?.value;
  if (raw === 'light' || raw === 'black' || raw === 'dark') return raw;
  return DEFAULT_THEME;
}
