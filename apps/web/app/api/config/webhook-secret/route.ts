import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { COOKIE_SECRET_WEBHOOK } from '@/lib/security/flash-secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Apaga o cookie flash com o secret de webhook logo depois que a tela o
 * renderizou (finding A-3). Existe como route handler porque Server
 * Components não podem escrever cookies — só actions e route handlers podem.
 *
 * Sem auth aqui o pior que alguém consegue é apagar o próprio cookie, mas
 * mantemos a checagem por consistência com o resto de /config.
 */
export async function DELETE() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SECRET_WEBHOOK, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/config/webhooks',
    maxAge: 0,
  });
  return res;
}
