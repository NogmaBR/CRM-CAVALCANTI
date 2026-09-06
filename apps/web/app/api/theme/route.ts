import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { theme } = await req.json();
  if (theme !== 'light' && theme !== 'black' && theme !== 'dark') {
    return NextResponse.json({ error: 'invalid theme' }, { status: 400 });
  }
  const store = await cookies();
  store.set('nogma-theme', theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return NextResponse.json({ ok: true });
}
