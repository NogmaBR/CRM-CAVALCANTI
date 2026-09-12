import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Confere `Authorization: Bearer <segredo>` em tempo constante.
 *
 * As rotas de cron, do consumidor de filas e de saúde comparavam com `!==`.
 * Numa função serverless a diferença de tempo é pequena demais para explorar
 * pela rede — mas o webhook já fazia certo (`timingSafeEqual`), e não há
 * motivo para ter dois padrões para o mesmo segredo.
 *
 * Compara os hashes SHA-256 dos dois lados: `timingSafeEqual` exige buffers do
 * mesmo tamanho, e o hash garante isso sem vazar o tamanho do segredo.
 */
export function bearerConfere(
  header: string | null | undefined,
  segredo: string | undefined,
): boolean {
  if (!segredo || !header) return false;
  const prefixo = 'Bearer ';
  if (!header.startsWith(prefixo)) return false;
  const token = header.slice(prefixo.length).trim();
  if (!token) return false;

  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(segredo).digest();
  return timingSafeEqual(a, b);
}
