import type { MetadataRoute } from 'next';

/**
 * PWA manifest — Fase QA hardening (audit MED fix).
 * Habilita "Adicionar à tela inicial" no mobile e comportamento standalone.
 *
 * Ícones apontam pra isotype-n existentes em /public/logos.
 * Cores match Nogma design system (petróleo + lima).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gestor de Obras · Nogma',
    short_name: 'Nogma CRM',
    description: 'CRM de gestão financeira de obras com bot WhatsApp e classificação por IA.',
    start_url: '/painel',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0C4651',
    theme_color: '#0C4651',
    lang: 'pt-BR',
    icons: [
      {
        src: '/logos/isotype-n-white.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logos/isotype-n-petroleum.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
