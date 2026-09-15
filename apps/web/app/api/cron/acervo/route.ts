import 'server-only';
import { randomUUID } from 'node:crypto';
import { conciliarPendentes } from '@/lib/acervo/conciliar';
import { extrairTextoPendentes } from '@/lib/acervo/extrair-texto';
import { comContexto, logger } from '@/lib/log';
import { gerarEmbeddingsPendentes, sincronizarDocumentos } from '@/lib/rag/indexador';
import { bearerConfere } from '@/lib/security/bearer';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Extração lê PDF e chama o modelo com visão; uma leva de 40 pode passar de
 * 10 s. Mesmo teto do consumidor de filas.
 */
export const maxDuration = 60;

/** Orçamento de tempo para o laço: sobra margem para responder. */
const ORCAMENTO_MS = 45_000;

const log = logger('cron');

/**
 * Processa o acervo: extrai texto → indexa no RAG → concilia notas.
 *
 * Chamado pelo `pg_cron` (`processar_acervo_agendado`, a cada 20 min, só
 * quando há pendência) e pelo importador com `--processar`. A ordem é a da
 * dependência: a conciliação precisa do texto, e o RAG precisa dos dois.
 *
 * Drena em laço como `/api/queue/consume`: repete a extração enquanto vier
 * lote cheio e houver tempo; o resto fica para a próxima chamada.
 */
async function processar(request: NextRequest) {
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

  const inicio = Date.now();
  const LOTE = 40;

  return comContexto({ correlacao: randomUUID(), rota: 'cron/acervo' }, async () => {
    try {
      const extracao = { processados: 0, comTexto: 0, semTexto: 0, erros: 0, rodadas: 0 };
      while (Date.now() - inicio < ORCAMENTO_MS) {
        const r = await extrairTextoPendentes(supabase, { limite: LOTE });
        extracao.rodadas += 1;
        extracao.processados += r.processados;
        extracao.comTexto += r.comTexto;
        extracao.semTexto += r.semTexto;
        extracao.erros += r.erros;
        if (r.processados < LOTE) break;
      }

      const textos = await sincronizarDocumentos(supabase);
      const embeddings = await gerarEmbeddingsPendentes(supabase);
      if (embeddings.erro) {
        log.aviso('acervo_embeddings_indisponiveis', { erro: embeddings.erro });
      }

      const conciliacao =
        Date.now() - inicio < ORCAMENTO_MS
          ? await conciliarPendentes(supabase, { limite: 20 })
          : { analisados: 0, vinculados: 0, ambiguos: 0, semCandidato: 0, erros: 0 };

      const duracao_ms = Date.now() - inicio;
      log.info('acervo_rodou', { duracao_ms, extracao, textos, embeddings, conciliacao });
      return NextResponse.json({ ok: true, duracao_ms, extracao, textos, embeddings, conciliacao });
    } catch (err) {
      const detalhe = err instanceof Error ? err.message : String(err);
      log.erro('acervo_falhou', { detalhe });
      return NextResponse.json({ ok: false, error: 'erro interno' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return processar(request);
}

export async function GET(request: NextRequest) {
  return processar(request);
}
