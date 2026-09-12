import 'server-only';
import { logger } from '@/lib/log';

const log = logger('rate-limit');
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';

/**
 * Rate limiting (auditoria 2026-09-09, finding M-3).
 *
 * O contador vive no Postgres, não em memória. Isso não é preciosismo: cada
 * invocação serverless do Vercel tem o próprio heap, então um `Map` local
 * contaria 1 request por instância e o atacante venceria o limite só variando
 * de conexão. A RPC `rate_limit_hit` resolve o incremento e a expiração da
 * janela numa única statement, sob row lock.
 *
 * Falha aberta por decisão explícita: se o banco estiver fora, `verificarLimite`
 * deixa passar em vez de derrubar o login de todo mundo. Rate limit é defesa em
 * profundidade — a autenticação continua sendo a barreira real.
 */

export interface LimiteConfig {
  /** Prefixo da chave — separa os contadores por rota. */
  escopo: string;
  /** Tamanho da janela em segundos. */
  janelaSegundos: number;
  /** Máximo de requests permitidas dentro da janela. */
  max: number;
}

export interface ResultadoLimite {
  permitido: boolean;
  hits: number;
  /** Segundos até a janela zerar — vira o header `Retry-After`. */
  retryApos: number;
}

/** Presets usados pelas rotas. Centralizados pra ficar fácil auditar os números. */
export const LIMITES = {
  /** Brute force de senha: 8 tentativas em 5 min por e-mail+IP. */
  login: { escopo: 'login', janelaSegundos: 300, max: 8 },
  /** Reset de senha: mesmo racional, um pouco mais apertado. */
  definirSenha: { escopo: 'definir-senha', janelaSegundos: 300, max: 5 },
  /** Exports geram PDF/CSV do banco inteiro — caros. 30/min por usuário. */
  exports: { escopo: 'exports', janelaSegundos: 60, max: 30 },
  /** Webhook do UAZAPI: generoso (provider faz retry), mas com teto. */
  webhookInbound: { escopo: 'webhook-uazapi', janelaSegundos: 60, max: 240 },
} as const satisfies Record<string, LimiteConfig>;

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Extrai o IP do cliente dos headers do proxy. No Vercel, `x-forwarded-for`
 * é preenchido pela edge e o primeiro item é o cliente real; os seguintes são
 * proxies intermediários e são forjáveis, por isso só olhamos o primeiro.
 */
export function ipDaRequest(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const primeiro = forwarded.split(',')[0]?.trim();
    if (primeiro) return primeiro;
  }
  return headers.get('x-real-ip')?.trim() || 'desconhecido';
}

/**
 * Conta um hit e diz se a request pode seguir.
 *
 * `identificador` deve ser o que se quer limitar: e-mail+IP no login, user_id
 * nos exports, telefone no webhook. Ele entra na chave junto com o escopo.
 */
export async function verificarLimite(
  config: LimiteConfig,
  identificador: string,
): Promise<ResultadoLimite> {
  const supabase = serviceRoleClient();
  if (!supabase) {
    // Sem service role configurada (dev local sem env completa) — não bloqueia.
    return { permitido: true, hits: 0, retryApos: 0 };
  }

  const chave = `${config.escopo}:${identificador}`.slice(0, 512);

  try {
    const { data, error } = await supabase.rpc('rate_limit_hit', {
      p_chave: chave,
      p_janela_segundos: config.janelaSegundos,
      p_max: config.max,
    });
    if (error) throw error;

    const linha = Array.isArray(data) ? data[0] : data;
    if (!linha) return { permitido: true, hits: 0, retryApos: 0 };

    const resetEm = new Date(linha.reset_em).getTime();
    const retryApos = Math.max(1, Math.ceil((resetEm - Date.now()) / 1000));

    return { permitido: linha.permitido, hits: linha.hits, retryApos };
  } catch (err) {
    // Fail-open deliberado (ver header do arquivo). Registramos pra não passar
    // despercebido caso a RPC suma numa migration futura.
    log.erro('rate_limit_indisponivel_liberando', {
      erro: err instanceof Error ? err.message : String(err),
    });
    return { permitido: true, hits: 0, retryApos: 0 };
  }
}

/** Zera o contador — usado após um login bem-sucedido. */
export async function limparLimite(config: LimiteConfig, identificador: string): Promise<void> {
  const supabase = serviceRoleClient();
  if (!supabase) return;
  try {
    await supabase.rpc('rate_limit_reset', {
      p_chave: `${config.escopo}:${identificador}`.slice(0, 512),
    });
  } catch {
    // Best-effort: o contador expira sozinho ao fim da janela.
  }
}

/** Resposta 429 padronizada para route handlers. */
export function resposta429(retryApos: number): Response {
  return new Response(JSON.stringify({ error: 'too many requests', retry_after: retryApos }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryApos),
    },
  });
}
