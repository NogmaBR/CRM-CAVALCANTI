import type { Metadata } from 'next';
import { getServerTheme } from '@/lib/theme';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Gestor de Obras · Nogma',
  description: 'CRM de gestão financeira de obras com bot WhatsApp',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getServerTheme();
  return (
    <html
      lang="pt-BR"
      data-theme={theme === 'light' ? undefined : theme}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
