import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Database } from '@nogma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron sweeper: remove rows órfãs em `documentos` onde `storage_path='pending'`
 * e criação > 10 min atrás. Origem: falha entre insert e upload no fluxo
 * createDocumento (4 steps, dual rollback). Rollback já é best-effort, mas
 * cenários (network down entre insert e delete, edge death) deixam órfãos.
 *
 * Vercel Cron chama esta rota via GET com header
 * `Authorization: Bearer <CRON_SECRET>` — configurado em vercel.json.
 * Schedule daily 03:00 UTC (limite Hobby Vercel: 1x/dia); upgrade Pro
 * pra rodar a cada 15 min se volume de órfãos justificar.
 * Runtime nodejs porque usa service role key (Node-only).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'supabase env missing' }, { status: 500 });
  }

  const supabase = createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('documentos')
    .delete()
    .eq('storage_path', 'pending')
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    // Finding M-5: detalhe do Postgres fica no log do servidor, não na
    // resposta HTTP — code/message de constraint são recon gratuito.
    console.error('[cron/sweep-pending-documentos] delete falhou:', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }

  // Housekeeping do rate limiting: sem isso a tabela `rate_limits` só cresce.
  // Best-effort — falhar aqui não invalida a limpeza de documentos órfãos.
  let rateLimitsPurgados = 0;
  const purge = await supabase.rpc('rate_limit_purge', { p_idade_horas: 24 });
  if (purge.error) {
    console.error('[cron/sweep-pending-documentos] rate_limit_purge falhou:', purge.error);
  } else {
    rateLimitsPurgados = purge.data ?? 0;
  }

  return NextResponse.json({
    ok: true,
    deleted: data?.length ?? 0,
    rate_limits_purgados: rateLimitsPurgados,
    cutoff,
  });
}
