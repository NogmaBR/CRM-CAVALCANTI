import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Webhook, PlusCircle, Send, Pencil, Archive } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { createClient } from '@/lib/supabase/server';
import { lerSecretFlash } from '@/lib/security/flash-secret';
import { arquivarWebhook, testarWebhook } from './actions';
import { SecretBanner } from './secret-banner';
import './webhooks.css';

type WebhookRow = {
  id: string;
  nome: string;
  url: string;
  eventos: string[];
  ativo: boolean;
  ultima_execucao_em: string | null;
  ultima_execucao_status: number | null;
  total_execucoes: number;
};

function statusClass(status: number | null): string {
  if (status === null || status === 0) return 'wh-exec-status--err';
  if (status >= 200 && status <= 299) return 'wh-exec-status--ok';
  if (status >= 300 && status <= 399) return 'wh-exec-status--redirect';
  return 'wh-exec-status--err';
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.round(diff / 1000);
  if (secs < 60) return rtf.format(-secs, 'second');
  const mins = Math.round(secs / 60);
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  return rtf.format(-days, 'day');
}

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + '...';
}

function WebhookTableRow({ wh }: { wh: WebhookRow }) {
  return (
    <tr>
      <td>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{wh.nome}</span>
      </td>
      <td>
        <span className="wh-url" title={wh.url}>{truncateUrl(wh.url)}</span>
      </td>
      <td>
        <div className="wh-events">
          {wh.eventos.map((ev) => (
            <span key={ev} className="wh-event-badge">{ev}</span>
          ))}
        </div>
      </td>
      <td>
        <span className={`wh-ativo-badge ${wh.ativo ? 'wh-ativo-badge--on' : 'wh-ativo-badge--off'}`}>
          {wh.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        {wh.ultima_execucao_status !== null || wh.ultima_execucao_em ? (
          <>
            <span className={`wh-exec-status ${statusClass(wh.ultima_execucao_status)}`}>
              {wh.ultima_execucao_status === 0 || wh.ultima_execucao_status === null
                ? 'Erro'
                : wh.ultima_execucao_status}
            </span>
            <span className="wh-exec-time">{relativeTime(wh.ultima_execucao_em)}</span>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted, #666)', fontSize: 12 }}>Nunca</span>
        )}
      </td>
      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
        {wh.total_execucoes.toLocaleString('pt-BR')}
      </td>
      <td>
        <div className="wh-actions">
          <form action={testarWebhook} style={{ display: 'contents' }}>
            <input type="hidden" name="id" value={wh.id} />
            <button type="submit" className="wh-action-btn" title="Enviar payload de teste">
              <Send size={12} aria-hidden="true" />
              Testar
            </button>
          </form>
          <Link href={`/config/webhooks/${wh.id}/editar`} className="wh-action-btn">
            <Pencil size={12} aria-hidden="true" />
            Editar
          </Link>
          <form action={arquivarWebhook} style={{ display: 'contents' }}>
            <input type="hidden" name="id" value={wh.id} />
            <button type="submit" className="wh-action-btn wh-action-btn--danger">
              <Archive size={12} aria-hidden="true" />
              Arquivar
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    error?: string;
    created?: string;
    regenerated?: string;
    tested?: string;
    status?: string;
    latency?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();

  if (profile?.papel !== 'admin') notFound();

  const params = await searchParams;
  const successMsg = params.success ?? null;
  const errorMsg = params.error ?? null;
  const createdId = params.created ?? null;
  // Finding A-3: o secret chega por cookie httpOnly de 60s, não pela URL.
  const secretValue = createdId || params.regenerated ? await lerSecretFlash() : null;
  const testedId = params.tested ?? null;
  const testStatus = params.status ?? null;
  const testLatency = params.latency ?? null;

  const { data: webhooks } = await supabase
    .from('webhooks_outbound')
    .select(
      'id, nome, url, eventos, ativo, ultima_execucao_em, ultima_execucao_status, total_execucoes',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const rows = (webhooks ?? []) as WebhookRow[];

  return (
    <>
      <TopBar
        title="Webhooks"
        subtitle="Notificações outbound para n8n, Zapier, Slack e similares"
        actions={
          <Link href="/config/webhooks/novo" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<PlusCircle size={16} />}>
              Novo webhook
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        {secretValue && (
          <SecretBanner
            secret={secretValue}
            titulo={createdId ? 'Webhook criado — guarde este secret' : 'Secret regenerado — guarde agora'}
          />
        )}

        {testedId && testStatus && (
          <div
            className={`wh-test-banner ${testStatus === 'OK' ? 'wh-test-banner--ok' : 'wh-test-banner--err'}`}
            role="status"
          >
            {testStatus === 'OK'
              ? `Teste enviado com sucesso — resposta em ${testLatency}ms`
              : `Falha no teste — verifique a URL e se o endpoint esta acessivel`}
          </div>
        )}

        {successMsg && (
          <div className="wh-banner wh-banner--success" role="status">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="wh-banner wh-banner--error" role="alert">
            {errorMsg}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="wh-empty">
            <Webhook size={32} aria-hidden="true" style={{ opacity: 0.5, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>
              Nenhum webhook configurado. Crie o primeiro para integrar com n8n, Zapier ou Slack.
            </p>
          </div>
        ) : (
          <div className="wh-table-wrap">
            <table className="wh-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>URL</th>
                  <th>Eventos</th>
                  <th>Status</th>
                  <th>Ultima execucao</th>
                  <th>Total</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((wh) => (
                  <WebhookTableRow key={wh.id} wh={wh} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
