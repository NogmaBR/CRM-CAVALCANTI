import { getServerTheme } from '@/lib/theme';
import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

/**
 * `viewport-fit=cover` deixa a barra inferior e o topo respeitarem o
 * recorte do iPhone (usamos `env(safe-area-inset-*)` no CSS). O zoom fica
 * liberado — travar zoom é barreira de acessibilidade.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1F2560' },
    { media: '(prefers-color-scheme: dark)', color: '#070707' },
  ],
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-cavalcanti.vercel.app';
const APP_NAME = 'Gestor de Obras · Nogma';
const APP_DESCRIPTION =
  'CRM de gestão financeira de obras com bot WhatsApp e classificação por IA.';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: APP_NAME,
    template: '%s · Nogma',
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  authors: [{ name: 'Nogma Corp' }],
  keywords: ['CRM', 'construção civil', 'gestão financeira', 'obras', 'WhatsApp', 'IA'],
  robots: {
    index: false, // App interno — não indexar
    follow: false,
    nocache: true,
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: APP_URL,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
    images: [
      {
        url: '/logos/logo-nogma-white.png',
        width: 1200,
        height: 630,
        alt: 'Nogma — Gestor de Obras',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ['/logos/logo-nogma-white.png'],
  },
  icons: {
    icon: [
      { url: '/logos/isotype-n-petroleum.png', type: 'image/png', sizes: '512x512' },
      {
        url: '/logos/isotype-n-white.png',
        type: 'image/png',
        sizes: '512x512',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/logos/isotype-n-petroleum.png',
  },
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getServerTheme();
  return (
    <html lang="pt-BR" data-theme={theme === 'light' ? undefined : theme} suppressHydrationWarning>
      <body>
        <a href="#main-content" className="a11y-skip-link">
          Pular para o conteúdo principal
        </a>
        {children}
      </body>
    </html>
  );
}
