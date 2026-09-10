import 'server-only';
import { comContexto, logger } from '@/lib/log';
import { UazapiInboundSchema, normalizeTelefone } from '@/lib/schemas/uazapi';
import { LIMITES, ipDaRequest, resposta429, verificarLimite } from '@/lib/security/rate-limit';
import { processarInbound } from '@/lib/services/inbound-whatsapp';
import { verifyHmacSignature } from '@/lib/webhooks/hmac';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger('webhook');

/**
 * Webhook inbound do UAZAPI.
 *
 * A rota faz só o que é responsabilidade de porta de entrada — autenticar,
 * validar formato e limitar volume. Toda a regra de negócio (autorização do
 * remetente, transcrição, resposta a pendência, classificação, resposta no
 * WhatsApp) mora em `processarInbound`, que é testável sem HTTP.
 *
 *   1. HMAC-SHA256 do corpo cru contra `WEBHOOK_HMAC_SECRET` (header
 *      `x-signature`). Sem secret no ambiente ou assinatura inválida → 401.
 *   2. Rate limit por remetente (o provider faz retry legítimo, então o teto
 *      é generoso; o que se quer barrar é inundação vinda de um número só).
 *   3. Zod no payload → 400 se o formato mudou.
 *   4. Delega e devolve 200.
 *
 * **Sempre 200 quando o processamento roda**, mesmo que a mensagem seja
 * ignorada ou dê erro interno: um não-2xx faz o UAZAPI reenviar o evento em
 * loop, e reprocessar não conserta nenhuma das falhas possíveis aqui.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WEBHOOK_HMAC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook secret missing' }, { status: 500 });
  }

  const raw = await request.text();
  const signature = request.headers.get('x-signature');
  if (!verifyHmacSignature(raw, signature, secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = UazapiInboundSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: 'schema validation failed',
        detail: first ? `${first.path.join('.')}: ${first.message}` : undefined,
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  // Chave por remetente; cai pro IP quando o telefone vem inutilizável.
  const identificador = normalizeTelefone(payload.from) || ipDaRequest(request.headers);
  const limite = await verificarLimite(LIMITES.webhookInbound, identificador);
  if (!limite.permitido) {
    return resposta429(limite.retryApos);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'supabase env missing' }, { status: 500 });
  }
  // Service role: não há sessão de usuário num webhook. A autorização aqui é
  // o HMAC (a request veio mesmo do provider) somada à checagem de
  // `autorizados` lá dentro (o número pode mesmo lançar pagamento).
  const supabase = createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // -------------------------------------------------------------------------
  // Assíncrono, quando ligado
  // -------------------------------------------------------------------------
  // Com `FILA_WHATSAPP=true`, o webhook para de processar e passa a só
  // enfileirar. É a razão de existir da Fase 3: hoje download de mídia,
  // transcrição e chamada de LLM rodam aqui dentro, e se qualquer um demorar o
  // provider dá timeout e reenvia — a idempotência segura a duplicata, mas o
  // trabalho é refeito do zero.
  //
  // A chave existe porque isto muda o coração do produto. Mergear com ela
  // desligada deixa o código pronto, testado e em produção sem mudar
  // comportamento nenhum; ligar depois é uma variável de ambiente e um
  // redeploy, sem tocar em código.
  //
  // Quando desligada, o caminho abaixo é exatamente o de sempre.
  //
  // A correlação é o id da mensagem no provider. O mesmo id vai para o
  // handler da fila, então uma busca por ele no log mostra a mensagem
  // chegando aqui, entrando na fila, sendo processada e respondida.
  return comContexto({ correlacao: payload.id, canal: 'webhook' }, async () => {
    if (process.env.FILA_WHATSAPP === 'true') {
      try {
        const { enfileirar } = await import('@/lib/queue/fila');
        const msgId = await enfileirar(supabase, 'whatsapp_inbound', { payload });
        log.info('enfileirada', { fila: 'whatsapp_inbound', msgId });
        return NextResponse.json({ ok: true, acao: 'enfileirada', jobId: msgId });
      } catch (err) {
        // Não conseguiu enfileirar: cai para o processamento síncrono em vez de
        // perder a mensagem. Pior um webhook lento que uma nota fiscal que
        // nunca chegou — e este é o único caminho em que a degradação vale mais
        // que a consistência.
        log.erro('fila_indisponivel_processando_sincrono', { err });
      }
    }

    const resultado = await processarInbound(supabase, payload).catch((err) => {
      log.erro('processamento_falhou', { err });
      return {
        acao: 'erro' as const,
        detalhe: err instanceof Error ? err.message : String(err),
      };
    });

    log.info('processada', { acao: resultado.acao, detalhe: resultado.detalhe });
    return NextResponse.json({ ok: true, ...resultado });
  });
}
