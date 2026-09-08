import 'server-only';
import { createHmac } from 'node:crypto';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Database } from '@nogma/db';

/**
 * Outbound webhook dispatch — usado pra notificar n8n/Zapier/Make.com etc
 * quando eventos importantes acontecem no CRM.
 *
 * Assinatura: header `X-Nogma-Signature: sha256=<hex>` — receiver valida
 * com o `secret` do webhook.
 *
 * Best-effort: nunca throw upstream, sempre loga status/erro em
 * webhooks_outbound.ultima_execucao_*.
 *
 * Fire-and-forget: caller não aguarda — mas dentro de server actions,
 * o Vercel serverless mantém a request ativa até timeout. Pra volume
 * alto, considerar queue (Vercel Queue, Inngest).
 */

export type EventoWebhook =
  | 'pagamento_created'
  | 'pagamento_updated'
  | 'confirmacao_pendente_created'
  | 'documento_created'
  | 'obra_created'
  | 'obra_archived'
  | 'test';

export interface WebhookPayload {
  evento: EventoWebhook;
  ocorrido_em: string; // ISO
  dados: Record<string, unknown>;
}

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE env ausente');
  return createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

/**
 * Dispatch um evento pra TODOS os webhooks_outbound ativos que
 * incluem esse evento em `eventos[]`.
 *
 * Retorna nada — best-effort logging em cada webhook.
 */
export async function dispatchEvento(evento: EventoWebhook, dados: Record<string, unknown>): Promise<void> {
  const supabase = serviceRoleClient();

  const { data: webhooks } = await supabase
    .from('webhooks_outbound')
    .select('id, url, secret, eventos, ativo')
    .eq('ativo', true)
    .is('deleted_at', null)
    .contains('eventos', [evento]);

  if (!webhooks || webhooks.length === 0) return;

  const payload: WebhookPayload = {
    evento,
    ocorrido_em: new Date().toISOString(),
    dados,
  };
  const body = JSON.stringify(payload);

  // Dispatch em paralelo, best-effort
  await Promise.allSettled(
    webhooks.map(async (wh) => {
      const signature = sign(body, wh.secret);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000); // 10s max
      try {
        const res = await fetch(wh.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Nogma-Signature': `sha256=${signature}`,
            'X-Nogma-Event': evento,
            'User-Agent': 'Nogma-Webhook/1.0',
          },
          body,
          signal: controller.signal,
        });
        await logWebhookExecution(supabase, wh.id, res.status, res.ok ? null : `HTTP ${res.status}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logWebhookExecution(supabase, wh.id, 0, `Exception: ${msg}`);
      } finally {
        clearTimeout(timeout);
      }
    }),
  );
}

async function logWebhookExecution(
  supabase: ReturnType<typeof serviceRoleClient>,
  id: string,
  status: number,
  erro: string | null,
): Promise<void> {
  try {
    // Increment total_execucoes usando raw sql seria melhor; aqui fazemos read-modify-write
    const { data: cur } = await supabase
      .from('webhooks_outbound')
      .select('total_execucoes')
      .eq('id', id)
      .maybeSingle();
    await supabase
      .from('webhooks_outbound')
      .update({
        ultima_execucao_em: new Date().toISOString(),
        ultima_execucao_status: status,
        ultima_execucao_erro: erro,
        total_execucoes: (cur?.total_execucoes ?? 0) + 1,
      })
      .eq('id', id);
  } catch {
    // Silencioso
  }
}

/**
 * Testa um webhook enviando payload dummy. Retorna resultado direto
 * (não usa Promise.allSettled — queremos error propagado).
 */
export async function testWebhook(id: string): Promise<{
  ok: boolean;
  status: number;
  latency_ms: number;
  error?: string;
}> {
  const supabase = serviceRoleClient();
  const { data: wh } = await supabase
    .from('webhooks_outbound')
    .select('url, secret')
    .eq('id', id)
    .maybeSingle();

  if (!wh) return { ok: false, status: 0, latency_ms: 0, error: 'Webhook não encontrado' };

  const payload: WebhookPayload = {
    evento: 'test',
    ocorrido_em: new Date().toISOString(),
    dados: { mensagem: 'Este é um teste do CRM Nogma-Cavalcanti. Se você recebeu, tá funcionando!' },
  };
  const body = JSON.stringify(payload);
  const signature = sign(body, wh.secret);

  const t0 = Date.now();
  try {
    const res = await fetch(wh.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Nogma-Signature': `sha256=${signature}`,
        'X-Nogma-Event': 'test',
        'User-Agent': 'Nogma-Webhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const latency_ms = Date.now() - t0;
    await logWebhookExecution(supabase, id, res.status, res.ok ? null : `HTTP ${res.status}`);
    return { ok: res.ok, status: res.status, latency_ms };
  } catch (err) {
    const latency_ms = Date.now() - t0;
    const errorMsg = err instanceof Error ? err.message : String(err);
    await logWebhookExecution(supabase, id, 0, `Exception: ${errorMsg}`);
    return { ok: false, status: 0, latency_ms, error: errorMsg };
  }
}

/** Gera secret pseudo-random 64 chars hex — usado no create. */
export function generateWebhookSecret(): string {
  return createHmac('sha256', Math.random().toString(36))
    .update(Date.now().toString() + Math.random().toString(36))
    .digest('hex');
}
