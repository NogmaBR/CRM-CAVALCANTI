import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifica header `x-signature` (hex HMAC-SHA256) contra o body raw.
 * Retorna true se válida, false se inválida ou ausente. Comparação usa
 * `timingSafeEqual` pra prevenir timing attack.
 *
 * Convention: signature = hex(HMAC-SHA256(secret, rawBody)).
 * O provider (UAZAPI ou test harness) precisa assinar o body EXATAMENTE
 * como enviado (mesma serialização, sem whitespace normalization).
 */
export function verifyHmacSignature(rawBody: string, signature: string | null | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const cleaned = signature.trim().toLowerCase().replace(/^sha256=/u, '');
  if (!/^[0-9a-f]{64}$/u.test(cleaned)) return false;

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(cleaned, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Utilitário pra harness local: gera signature dado body + secret. */
export function signHmac(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}
