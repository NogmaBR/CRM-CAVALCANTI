import 'server-only';
import { cookies } from 'next/headers';

/**
 * Entrega one-time do secret de webhook (auditoria 2026-09-09, finding A-3).
 *
 * Antes o secret de 256 bits voltava na query string
 * (`/config/webhooks?secret=<hex>`). Uma URL não é canal de entrega de
 * segredo: ela fica no histórico do navegador, nos logs de acesso do Vercel,
 * em qualquer proxy/CDN/analytics no caminho, e sobrevive a bookmark e
 * refresh. O secret continuava recuperável muito depois de ser exibido.
 *
 * Agora ele vai num cookie httpOnly de vida curta:
 *   - httpOnly  → XSS não lê;
 *   - sameSite  → não vaza em navegação cross-site;
 *   - maxAge 60 → morre sozinho mesmo se o dismiss falhar;
 *   - path restrito à própria tela.
 *
 * A página lê, renderiza uma vez, e um dismiss client-side apaga o cookie
 * imediatamente (ver `app/api/config/webhook-secret/route.ts`). O HTML já
 * entregue continua mostrando o valor — que é o comportamento desejado —
 * mas um refresh não traz o secret de volta.
 */

export const COOKIE_SECRET_WEBHOOK = 'nogma_wh_secret';

export async function guardarSecretFlash(secret: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_SECRET_WEBHOOK, secret, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/config/webhooks',
    maxAge: 60,
  });
}

export async function lerSecretFlash(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_SECRET_WEBHOOK)?.value ?? null;
}
