import 'server-only';
import { Resend } from 'resend';
import type { EmailInput, EmailProvider, EmailResult } from './provider';
import { defaultFromAddress } from './provider';

/**
 * ResendEmailProvider — envio via Resend (resend.com).
 *
 * Setup:
 *  1. Criar conta em resend.com (free tier 100 email/dia, 3k/mês).
 *  2. Verificar domínio `nogmacorp.com.br` (SPF+DKIM+DMARC) ou usar
 *     onboarding@resend.dev enquanto valida.
 *  3. `RESEND_API_KEY=re_xxxxx` provisionado em Vercel + .env.local.
 *  4. `EMAIL_PROVIDER=resend`.
 *
 * Erros de API viram EmailResult.ok=false com mensagem — nunca throw
 * pra não derrubar server actions upstream (email é best-effort).
 */
export class ResendEmailProvider implements EmailProvider {
  private client: Resend;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY ausente — não é possível instanciar ResendEmailProvider');
    this.client = new Resend(key);
  }

  async send(input: EmailInput): Promise<EmailResult> {
    try {
      const res = await this.client.emails.send({
        from: input.from ?? defaultFromAddress(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      if (res.error) {
        return { ok: false, error: `Resend: ${res.error.name} — ${res.error.message}` };
      }
      return { ok: true, providerId: res.data?.id };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      };
    }
  }
}
