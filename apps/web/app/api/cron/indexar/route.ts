import 'server-only';
import { randomUUID } from 'node:crypto';
import { comContexto, logger } from '@/lib/log';
import { gerarEmbeddingsPendentes, sincronizarDocumentos } from '@/lib/rag/indexador';
import { bearerConfere } from '@/lib/security/bearer';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger('cron');

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
  if (!bearerConfere(request.headers.get('authorization'), process.env.CRON_SECRET)) {
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

  return comContexto({ correlacao: randomUUID(), rota: 'cron/indexar' }, async () => {
    try {
      const textos = await sincronizarDocumentos(supabase);

      if (apenasTexto) {
        log.info('indexar_rodou', { apenasTexto: true, duracao_ms: Date.now() - inicio, textos });
        return NextResponse.json({
          ok: true,
          duracao_ms: Date.now() - inicio,
          textos,
          embeddings: null,
        });
      }

      const embeddings = await gerarEmbeddingsPendentes(supabase, limite);

      if (embeddings.erro) {
        // A indexação parou sem lançar: chave ausente, quota, rede. Sem esta
        // linha, a busca simplesmente "não acha" e ninguém sabe desde quando.
        log.erro('indexar_embeddings_falhou', {
          erro: embeddings.erro,
          pendentes: embeddings.pendentes,
        });
      } else {
        log.info('indexar_rodou', { duracao_ms: Date.now() - inicio, textos, embeddings });
      }

      return NextResponse.json({
        ok: true,
        duracao_ms: Date.now() - inicio,
        textos,
        embeddings,
      });
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : String(err);
      log.erro('indexar_falhou', { detalhe });
      // Só o log recebe o detalhe: mensagem de Postgres ou de rede é
      // reconhecimento de graça para quem chama.
      return NextResponse.json({ ok: false, error: 'erro interno' }, { status: 500 });
    }
  });
}
