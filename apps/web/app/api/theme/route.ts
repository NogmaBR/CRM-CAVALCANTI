import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Persiste preferência de tema em cookie.
 *
 * Audit MED fix: httpOnly + secure + sameSite strict.
 *   - httpOnly: theme é lido apenas server-side (RootLayout via cookies())
 *     e escrito só via este endpoint. Cliente inspeciona o tema atual via
 *     `document.documentElement.dataset.theme`, não via cookie. Portanto
 *     JS não precisa acessar o cookie → httpOnly bloqueia leitura por XSS.
 *   - secure: só HTTPS em produção.
 *   - sameSite=strict: previne CSRF (não vai em requests cross-site).
 */
export async function POST(req: Request) {
  const { theme } = await req.json();
  if (theme !== 'light' && theme !== 'black' && theme !== 'dark') {
    return NextResponse.json({ error: 'invalid theme' }, { status: 400 });
  }
  const store = await cookies();
  store.set('nogma-theme', theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  return NextResponse.json({ ok: true });
}
