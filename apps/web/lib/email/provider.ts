import 'server-only';

/**
 * Provider abstraction para envio de email. Um único ponto de troca
 * (factory) permite alternar entre mock (default para dev/testes) e
 * Resend (produção) via env `EMAIL_PROVIDER`.
 *
 * Se Fase 8 usa `IA_PROVIDER=anthropic|mock`, aqui usa
 * `EMAIL_PROVIDER=resend|mock` — mesma convenção.
 */

export interface EmailInput {
  to: string | string[]; // um ou vários destinatários; sempre BCC pra não vazar lista
  from?: string; // opcional — default do provider ('Nogma <no-reply@nogmacorp.com.br>')
  subject: string;
  html: string; // corpo HTML já renderizado (via @react-email/render)
  text?: string; // versão texto plano opcional (recomendado pra deliverability)
  contexto?: Record<string, unknown>; // guardado em notificacoes_email.contexto
}

export interface EmailResult {
  ok: boolean;
  providerId?: string; // id retornado pelo provider (ex: Resend message id)
  error?: string;
}

export interface EmailProvider {
  send(input: EmailInput): Promise<EmailResult>;
}

/**
 * Factory. Seleção via env:
 *   - EMAIL_PROVIDER=mock (default): apenas loga em notificacoes_email
 *     sem envio real. Útil pra dev/testes/CI.
 *   - EMAIL_PROVIDER=resend: envio real via Resend API (RESEND_API_KEY
 *     obrigatório). Free tier Resend suporta 100 email/dia.
 */
export async function getEmailProvider(): Promise<EmailProvider> {
  const provider = process.env.EMAIL_PROVIDER ?? 'mock';
  if (provider === 'mock') {
    const { MockEmailProvider } = await import('./mock-provider');
    return new MockEmailProvider();
  }
  if (provider === 'resend') {
    const { ResendEmailProvider } = await import('./resend-provider');
    return new ResendEmailProvider();
  }
  throw new Error(`EMAIL_PROVIDER desconhecido: ${provider}. Suportados: mock, resend`);
}

/** Default from address — sobrescreve com env `EMAIL_FROM` se quiser custom. */
export function defaultFromAddress(): string {
  return process.env.EMAIL_FROM ?? 'Nogma Gestor de Obras <no-reply@nogmacorp.com.br>';
}
