import 'server-only';
import { randomUUID } from 'node:crypto';
import { comContexto, logger } from '@/lib/log';
import { consumirFila } from '@/lib/queue/consumidor';
import { metricas } from '@/lib/queue/fila';
import { HANDLERS, filasComHandler } from '@/lib/queue/handlers';
import { LOTE_POR_FILA, type NomeFila } from '@/lib/queue/tipos';
import { bearerConfere } from '@/lib/security/bearer';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * 60 s é o teto do plano Hobby da Vercel; sem declarar, a função morre em
 * 10 s no meio de um lote e a mensagem só volta pelo visibility timeout.
 */
export const maxDuration = 60;

const log = logger('fila');

/**
 * Orçamento de tempo da drenagem, abaixo do `maxDuration` com folga para as
 * métricas e a resposta. Dentro dele a rota repete o lote enquanto a fila
 * tiver mensagem: antes era um lote por invocação, e como `whatsapp_inbound`
 * lê 1 por vez e o `pg_cron` chama uma vez por minuto, quatro fotos seguidas
 * levavam quatro minutos (eng review gstack, A2).
 */
const ORCAMENTO_MS = 45_000;

/**
 * Drena as filas.
 *
 * É o worker — só que em vez de um processo vivo consumindo para sempre, é uma
 * rota chamada de tempos em tempos. Sem VPS não há processo vivo; com `pgmq`
 * não é preciso ter um.
 *
 * Autenticação igual à dos crons: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Parâmetros de operação:
 *
 *   ?fila=<nome>   drena só uma fila, para depurar sem mexer nas outras
 *   ?qtd=<n>       tamanho do lote (padrão 5, teto 25)
 *   ?rodadas=<n>   teto de lotes por fila nesta invocação (padrão 50)
 *
 * ## Sobre o tamanho do lote
 *
 * O teto existe porque esta rota roda numa função com tempo limitado. Drenar
 * um lote grande e ser interrompido no meio não perde trabalho — as mensagens
 * não concluídas voltam pelo visibility timeout — mas desperdiça: elas são
 * relidas do zero e o `read_ct` sobe sem que nada tenha falhado de verdade.
 * Lote pequeno e chamada frequente é melhor que lote grande e chamada rara.
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
  const apenas = params.get('fila') as NomeFila | null;
  const qtd = Math.min(Math.max(Number(params.get('qtd') ?? 5) || 5, 1), 25);
  const rodadasMax = Math.min(Math.max(Number(params.get('rodadas') ?? 50) || 50, 1), 200);

  const registradas = filasComHandler();

  if (apenas && !registradas.includes(apenas)) {
    return NextResponse.json(
      { error: `Fila "${apenas}" não existe ou não tem handler.`, disponiveis: registradas },
      { status: 400 },
    );
  }

  const alvo = apenas ? [apenas] : registradas;
  const inicio = Date.now();
  const lotes = [];

  // Cada invocação do consumidor ganha um id: é o que agrupa "este lote" no
  // log quando o `pg_cron` chama a rota a cada minuto.
  const invocacao = randomUUID();

  for (const fila of alvo) {
    const handler = HANDLERS[fila];
    if (!handler) continue;

    try {
      // Drena em laço: lote, e de novo, enquanto vier mensagem e houver tempo.
      // Cada lote lê no máximo `LOTE_POR_FILA` (1 para o inbound), mas a
      // invocação não para no primeiro — para quando a fila esvazia, quando o
      // orçamento acaba ou no teto de rodadas.
      const acumulado = { fila, lidas: 0, concluidas: 0, arquivadas: 0, devolvidas: 0, rodadas: 0 };
      for (let rodada = 0; rodada < rodadasMax; rodada++) {
        if (Date.now() - inicio > ORCAMENTO_MS) {
          log.aviso('drenagem_interrompida_por_tempo', { invocacao, fila, rodadas: rodada });
          break;
        }
        // O cast existe porque `HANDLERS[fila]` perde a ligação entre a chave
        // e o tipo do payload ao ser indexado por uma variável. A ligação é
        // real — o registro é tipado por fila — só não sobrevive à indexação.
        const lote = await comContexto({ invocacao, rodada }, () =>
          consumirFila(
            supabase,
            fila,
            handler as Parameters<typeof consumirFila>[2],
            // `?qtd=` só reduz; nunca passa do lote seguro da fila.
            Math.min(qtd, LOTE_POR_FILA[fila]),
          ),
        );
        acumulado.lidas += lote.lidas;
        acumulado.concluidas += lote.concluidas;
        acumulado.arquivadas += lote.arquivadas;
        acumulado.devolvidas += lote.devolvidas;
        acumulado.rodadas += 1;
        if (lote.lidas === 0) break;
      }
      lotes.push(acumulado);
    } catch (err) {
      // Falha aqui é da leitura da fila, não de uma mensagem — as de mensagem
      // são tratadas dentro do consumidor. Uma fila que não abre não pode
      // impedir as outras de serem drenadas.
      const detalhe = err instanceof Error ? err.message : String(err);
      log.erro('drenar_falhou', { invocacao, fila, detalhe });
      lotes.push({ fila, erro: detalhe });
    }
  }

  // As métricas vêm junto para que uma única chamada responda "processou o
  // quê" e "quanto ainda falta". Sem isso, saber se a fila está encolhendo
  // exigiria uma segunda consulta e uma subtração mental.
  let filas: Awaited<ReturnType<typeof metricas>> = [];
  try {
    filas = await metricas(supabase);
  } catch (err) {
    log.erro('metricas_indisponiveis', { invocacao, err });
  }

  return NextResponse.json({
    ok: true,
    duracao_ms: Date.now() - inicio,
    lotes,
    filas,
  });
}
