import type { MetadataRoute } from 'next';

/**
 * PM5 — o CRM como app no celular: "Adicionar à tela inicial" abre em tela
 * cheia, com o ícone da Cavalcanti, direto no painel. O manifest é servido em
 * `/manifest.webmanifest` (fora do middleware de sessão — o navegador busca
 * sem cookie) e os ícones moram em `/logos/`, também públicos.
 *
 * Sem service worker de propósito: cache de app-shell num CRM que muda
 * todo deploy vira tela velha; o Chrome não exige SW para instalar desde
 * 2024, e o iOS nunca exigiu.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CRM Cavalcanti — Gestor de Obras',
    short_name: 'Cavalcanti',
    description: 'Gestão financeira de obras: pagamentos, notas, documentos e WhatsApp.',
    id: '/painel',
    start_url: '/painel',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'pt-BR',
    dir: 'ltr',
    background_color: '#1F2560',
    theme_color: '#1F2560',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/logos/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/logos/pwa-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/logos/pwa-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Painel', url: '/painel', icons: [{ src: '/logos/pwa-192.png', sizes: '192x192' }] },
      {
        name: 'Pendentes',
        url: '/pendentes',
        icons: [{ src: '/logos/pwa-192.png', sizes: '192x192' }],
      },
      {
        name: 'Pagamentos',
        url: '/pagamentos',
        icons: [{ src: '/logos/pwa-192.png', sizes: '192x192' }],
      },
      {
        name: 'Nova obra',
        url: '/obras/novo',
        icons: [{ src: '/logos/pwa-192.png', sizes: '192x192' }],
      },
    ],
  };
}
