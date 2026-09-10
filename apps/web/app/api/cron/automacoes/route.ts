import 'server-only';
import { randomUUID } from 'node:crypto';
import { executarAgendadas } from '@/lib/automations/engine';
import { comContexto, logger } from '@/lib/log';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger('cron');

/**
 * Executa as automações agendadas.
 *
 * É o substituto do "Schedule Trigger" do n8n. Chamado pelo Vercel Cron com
 * `Authorization: Bearer <CRON_SECRET>`, mesmo padrão de
 * `/api/cron/sweep-pending-documentos`.
 *
 * Aceita dois parâmetros de query, ambos pensados para operação:
 *
 *   ?simular=true    avalia tudo e registra como `simulada`, sem agir. É como
 *                    se confere o que uma regra faria antes de ligá-la de
 *                    verdade — o equivalente ao "Test workflow" do n8n.
 *   ?regra=<chave>   roda só uma regra, para depurar sem mexer nas outras.
 *
 * Enquanto não houver fila (Fase 3), aqui é também onde rodam as regras
 * marcadas `apenasAgendada` — as que fazem I/O lento e não podem pendurar a
 * request de um usuário.
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

  const simular = request.nextUrl.searchParams.get('simular') === 'true';
  const apenas = request.nextUrl.searchParams.get('regra') ?? undefined;

  const inicio = Date.now();

  // Um id por rodada: todas as regras avaliadas nesta chamada saem com ele.
  return comContexto({ correlacao: randomUUID(), rota: 'cron/automacoes' }, async () => {
    try {
      const relatorio = await executarAgendadas(supabase, { simular, apenas });
      log.info('automacoes_rodou', {
        simulado: simular,
        duracao_ms: Date.now() - inicio,
        regras: relatorio.length,
      });
      return NextResponse.json({
        ok: true,
        simulado: simular,
        duracao_ms: Date.now() - inicio,
        regras: relatorio,
      });
    } catch (err) {
      // O engine já isola falha de regra; chegar aqui significa problema no
      // próprio motor. Devolvemos 500 para o cron registrar como falha.
      const detalhe = err instanceof Error ? err.message : String(err);
      log.erro('automacoes_motor_falhou', { detalhe });
      return NextResponse.json({ ok: false, error: detalhe }, { status: 500 });
    }
  });
}
