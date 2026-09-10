import 'server-only';
import { gerarEmbeddingsPendentes, sincronizarDocumentos } from '@/lib/rag/indexador';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Mantém a base de conhecimento em dia.
 *
 * Duas etapas, e a ordem importa: primeiro o texto (barato, sempre roda),
 * depois os embeddings (custa dinheiro, só no que mudou).
 *
 * Parâmetros de operação:
 *
 *   ?apenas=texto   só sincroniza os textos, sem gastar embedding. Útil para
 *                   ver o que mudaria antes de pagar por isso.
 *   ?limite=<n>     quantos documentos embedar nesta rodada (teto 96, que é o
 *                   limite de um lote na API).
 *
 * ## Por que não é o `emitir` que dispara isto
 *
 * Seria elegante reindexar a cada `pagamento.criado`. Seria também uma chamada
 * de embedding por pagamento — e, num import de 80 linhas, 80 chamadas em
 * sequência dentro de uma request. O cron agrupa: uma rodada, um lote, uma
 * chamada.
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

  const params = request.nextUrl.searchParams;
  const apenasTexto = params.get('apenas') === 'texto';
  const limite = Math.min(Math.max(Number(params.get('limite') ?? 96) || 96, 1), 96);

  const inicio = Date.now();

  try {
    const textos = await sincronizarDocumentos(supabase);

    if (apenasTexto) {
      return NextResponse.json({
        ok: true,
        duracao_ms: Date.now() - inicio,
        textos,
        embeddings: null,
      });
    }

    const embeddings = await gerarEmbeddingsPendentes(supabase, limite);

    return NextResponse.json({
      ok: true,
      duracao_ms: Date.now() - inicio,
      textos,
      embeddings,
    });
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : String(err);
    console.error('[cron/indexar] falhou:', detalhe);
    return NextResponse.json({ ok: false, error: detalhe }, { status: 500 });
  }
}
