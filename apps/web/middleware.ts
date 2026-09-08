import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Exclui assets estáticos + manifest (PWA precisa acesso não-autenticado
    // pra install prompt) + robots.txt/sitemap.xml (crawlers, ignoram robots).
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|fonts/|logos/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
};
