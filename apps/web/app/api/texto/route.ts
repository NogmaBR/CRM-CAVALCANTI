import { TEXTO_COOKIE, ehTamanho } from '@/lib/texto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/** Persiste o tamanho do texto. Mesmas propriedades do cookie do tema. */
export async function POST(req: Request) {
  const { tamanho } = await req.json();
  if (!ehTamanho(tamanho)) {
    return NextResponse.json({ error: 'invalid size' }, { status: 400 });
  }
  const store = await cookies();
  store.set(TEXTO_COOKIE, tamanho, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  return NextResponse.json({ ok: true });
}
