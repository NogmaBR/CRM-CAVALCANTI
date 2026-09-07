import 'server-only';
import { render } from '@react-email/render';
import { getEmailProvider, type EmailInput } from '@/lib/email/provider';
import { logNotificacao, getRecipientsByPapel } from '@/lib/data/notificacoes';
import {
  PagamentoAguardandoEmail,
  PendenciaNovaEmail,
  BoasVindasEmail,
  buildPagamentoSubject,
  buildPagamentoText,
  buildPendenciaSubject,
  buildPendenciaText,
  buildBoasVindasSubject,
  buildBoasVindasText,
  type PagamentoAguardandoProps,
  type PendenciaNovaProps,
  type BoasVindasProps,
} from '@/lib/email/templates';

/**
 * Send service — orquestra render (React Email) → provider (Resend/mock)
 * → log (notificacoes_email).
 *
 * Best-effort: nunca throw. Callers seguem seu fluxo mesmo se email
 * falhar (email é "eventual", não bloqueia lançamento crítico).
 *
 * Cada função trigger retorna `SendManyResult` — quantos foram enviados
 * / falharam, pra logs upstream.
 */

const PAINEL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-cavalcanti.vercel.app';

export interface SendManyResult {
  ok: boolean;
  sent: number;
  failed: number;
  attempted: number;
}

async function sendOne(input: EmailInput, contexto?: Record<string, unknown>): Promise<boolean> {
  const destinatario = Array.isArray(input.to) ? input.to.join(', ') : input.to;
  try {
    const provider = await getEmailProvider();
    const result = await provider.send(input);
    if (result.ok) {
      await logNotificacao({
        destinatario,
        assunto: input.subject,
        corpo: input.html,
        contexto: { ...contexto, providerId: result.providerId ?? null },
        enviada_em: new Date().toISOString(),
        erro: null,
      });
      return true;
    }
    await logNotificacao({
      destinatario,
      assunto: input.subject,
      corpo: input.html,
      contexto: contexto ?? null,
      enviada_em: null,
      erro: result.error ?? 'erro desconhecido',
    });
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logNotificacao({
      destinatario,
      assunto: input.subject,
      corpo: input.html,
      contexto: contexto ?? null,
      enviada_em: null,
      erro: `exception: ${msg}`,
    });
    return false;
  }
}

async function sendMany(
  destinatarios: Array<{ email: string; nome: string }>,
  build: (r: { email: string; nome: string }) => Promise<EmailInput>,
  contexto?: Record<string, unknown>,
): Promise<SendManyResult> {
  const results = await Promise.all(
    destinatarios.map(async (r) => {
      const input = await build(r);
      return sendOne(input, contexto);
    }),
  );
  const sent = results.filter(Boolean).length;
  return { ok: sent === results.length, sent, failed: results.length - sent, attempted: results.length };
}

/** Trigger: novo pagamento com status='aguardando'. */
export async function sendPagamentoAguardandoEmail(
  props: Omit<PagamentoAguardandoProps, 'nome_gestor' | 'painel_url'>,
): Promise<SendManyResult> {
  const recipients = await getRecipientsByPapel(['admin', 'gestor'], 'pagamentos_aguardando');
  if (recipients.length === 0) return { ok: true, sent: 0, failed: 0, attempted: 0 };

  return sendMany(
    recipients.map((r) => ({ email: r.email, nome: r.nome })),
    async ({ email, nome }) => {
      const fullProps: PagamentoAguardandoProps = { ...props, nome_gestor: nome, painel_url: PAINEL_URL };
      const html = await render(<PagamentoAguardandoEmail {...fullProps} />, { pretty: false });
      return {
        to: email,
        subject: buildPagamentoSubject(fullProps),
        html,
        text: buildPagamentoText(fullProps),
      };
    },
    { tipo: 'pagamento_aguardando', pagamento_id: props.pagamento_id },
  );
}

/** Trigger: nova pendência WhatsApp (confirmacoes_pendentes inserted). */
export async function sendPendenciaNovaEmail(
  props: Omit<PendenciaNovaProps, 'nome_gestor' | 'painel_url'>,
): Promise<SendManyResult> {
  const recipients = await getRecipientsByPapel(['admin', 'gestor'], 'pendencias_novas');
  if (recipients.length === 0) return { ok: true, sent: 0, failed: 0, attempted: 0 };

  return sendMany(
    recipients.map((r) => ({ email: r.email, nome: r.nome })),
    async ({ email, nome }) => {
      const fullProps: PendenciaNovaProps = { ...props, nome_gestor: nome, painel_url: PAINEL_URL };
      const html = await render(<PendenciaNovaEmail {...fullProps} />, { pretty: false });
      return {
        to: email,
        subject: buildPendenciaSubject(fullProps),
        html,
        text: buildPendenciaText(fullProps),
      };
    },
    { tipo: 'pendencia_nova', pendencia_count: props.pendencia_count },
  );
}

/** Trigger: novo usuário. Envia pra próprio email dele. */
export async function sendBoasVindasEmail(
  props: Omit<BoasVindasProps, 'painel_url'>,
  toEmail: string,
): Promise<boolean> {
  const fullProps: BoasVindasProps = { ...props, painel_url: PAINEL_URL };
  const html = await render(<BoasVindasEmail {...fullProps} />, { pretty: false });
  return sendOne(
    {
      to: toEmail,
      subject: buildBoasVindasSubject(fullProps),
      html,
      text: buildBoasVindasText(fullProps),
    },
    { tipo: 'boas_vindas' },
  );
}

/** Utilitário para reenvio manual — pega uma notificacao_email existente e re-tenta. */
export async function resendNotificacao(
  destinatario: string,
  assunto: string,
  corpo: string,
  contexto: Record<string, unknown> | null,
): Promise<boolean> {
  return sendOne(
    { to: destinatario, subject: assunto, html: corpo },
    { ...(contexto ?? {}), reenvio: true, reenvio_em: new Date().toISOString() },
  );
}
