import 'server-only';
import type { EmailInput, EmailProvider, EmailResult } from './provider';

/**
 * MockEmailProvider — retorna ok=true sem enviar nada real.
 *
 * O log de destinatário/assunto/corpo/contexto é feito upstream em
 * `send-email` (que grava em `notificacoes_email` independente do
 * provider). Aqui só simulamos o resultado do envio.
 *
 * Útil pra dev local e ambientes CI onde não queremos emails reais.
 * Em prod deve trocar por ResendEmailProvider via `EMAIL_PROVIDER=resend`.
 */
export class MockEmailProvider implements EmailProvider {
  async send(input: EmailInput): Promise<EmailResult> {
    const recipients = Array.isArray(input.to) ? input.to.join(', ') : input.to;
    if (process.env.NODE_ENV !== 'production') {
      // Log estruturado só em dev pra não poluir logs prod
      console.info('[email:mock] would send:', {
        to: recipients,
        subject: input.subject,
        bytes: input.html.length,
      });
    }
    return {
      ok: true,
      providerId: `mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }
}
