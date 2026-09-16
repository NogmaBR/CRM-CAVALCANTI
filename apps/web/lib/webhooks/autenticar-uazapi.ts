import { timingSafeEqual } from 'node:crypto';
import { verifyHmacSignature } from './hmac';

/**
 * Como se sabe que a request veio mesmo do UAZAPI.
 *
 * O UAZAPI **não assina** o webhook (não há HMAC nem header de segredo na
 * configuração — conferido no OpenAPI de docs.uazapi.com, `POST /webhook`).
 * O que ele manda é o **token da instância dentro do corpo** (`token`), o
 * mesmo segredo que o CRM usa para chamar a API dele. Comparar esse campo com
 * `UAZAPI_TOKEN`, em tempo constante, prova a origem tão bem quanto um HMAC:
 * quem não tem o token não fabrica o corpo.
 *
 * O HMAC em `x-signature` continua valendo — é o que o harness de teste e um
 * relay (n8n) usam. Uma das duas provas basta.
 */
export type Autenticacao = 'hmac' | 'token' | null;

export function autenticarWebhookUazapi(
  rawBody: string,
  json: unknown,
  headers: { signature: string | null },
  env: { hmacSecret: string | undefined; uazapiToken: string | undefined },
): Autenticacao {
  if (env.hmacSecret && verifyHmacSignature(rawBody, headers.signature, env.hmacSecret)) {
    return 'hmac';
  }
  const token = env.uazapiToken;
  if (!token || !json || typeof json !== 'object') return null;
  const recebido = (json as Record<string, unknown>).token;
  if (typeof recebido !== 'string' || recebido.length === 0) return null;
  const a = Buffer.from(recebido, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length) return null;
  try {
    return timingSafeEqual(a, b) ? 'token' : null;
  } catch {
    return null;
  }
}
