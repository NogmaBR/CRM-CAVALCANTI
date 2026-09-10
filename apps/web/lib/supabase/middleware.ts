import type { Database } from '@nogma/db';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session and get the user (do NOT run code between
  // createServerClient and getUser — supabase-ssr expects this ordering).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const isAuthRoute =
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/definir-senha') ||
    url.pathname === '/';
  // "Pública" aqui significa "não passa pela sessão do navegador" — cada uma
  // tem a própria autenticação: HMAC nos webhooks, `CRON_SECRET` nos crons e
  // no consumidor de filas, token na URL nos exports.
  //
  // `/api/queue/` precisa estar aqui, e a falta disso é silenciosa do pior
  // jeito: sem a linha, o middleware manda a chamada do `pg_cron` para o
  // `/login`, que responde **200 com HTML**. Nada registra erro, nenhuma fila
  // é drenada, e quem investigar vai ver "200" e procurar em outro lugar.
  const isPublicApi =
    url.pathname.startsWith('/api/webhooks/') ||
    url.pathname.startsWith('/api/cron/') ||
    url.pathname.startsWith('/api/queue/') ||
    url.pathname.startsWith('/api/health') ||
    url.pathname.startsWith('/api/exports/');
  // Planilha compartilhada: o dono da obra abre por link, sem conta no CRM.
  // A autorização é o token na própria URL, validado em `getPlanilhaPorToken`
  // — mandar pro /login aqui quebraria justamente o entregável do cliente.
  const isPlanilhaPublica = url.pathname.startsWith('/planilha/');

  if (!user && !isAuthRoute && !isPublicApi && !isPlanilhaPublica) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && url.pathname === '/login') {
    url.pathname = '/painel';
    return NextResponse.redirect(url);
  }

  return response;
}
