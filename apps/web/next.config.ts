import type { NextConfig } from 'next';

/**
 * Security headers (audit CRIT F-01 fix) aplicados a TODAS as rotas.
 * Rationale:
 *   - X-Frame-Options DENY: previne clickjacking (app não é embedável)
 *   - X-Content-Type-Options nosniff: previne MIME sniffing
 *   - Referrer-Policy: privacidade — não vaza URL interna em outbound links
 *   - Permissions-Policy: bloqueia APIs sensíveis não usadas (cam/mic/geo)
 *   - Strict-Transport-Security: força HTTPS (Vercel já força mas belt+suspenders)
 *
 * Content-Security-Policy NÃO incluído aqui porque quebra Recharts SVGs
 * inline + hCaptcha iframe + Supabase Storage image URLs. CSP restrito
 * requer nonces por-request (extensão futura — Fase 20.x).
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  async redirects() {
    return [{ source: '/', destination: '/painel', permanent: false }];
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
