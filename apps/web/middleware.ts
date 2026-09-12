import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Exclui assets estáticos + manifest (PWA precisa acesso não-autenticado
    // pra install prompt) + robots.txt/sitemap.xml (crawlers, ignoram robots).
    //
    // Sem a exclusão por extensão que existia aqui (`.*\.png$` etc.): ela
    // deixava qualquer página passar sem sessão bastando a URL terminar em
    // `.png`. Os assets de verdade moram em /fonts, /logos e /_next, que já
    // estão listados.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|fonts/|logos/).*)',
  ],
};
