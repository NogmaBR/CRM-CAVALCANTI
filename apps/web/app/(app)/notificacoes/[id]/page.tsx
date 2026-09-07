import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { getNotificacao, type NotificacaoEmail } from '@/lib/data/notificacoes';
import { reenviarNotificacao } from '../actions';
import '../notificacoes.css';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatus(n: NotificacaoEmail): 'enviado' | 'falhou' | 'pendente' {
  if (n.erro != null) return 'falhou';
  if (n.enviada_em != null) return 'enviado';
  return 'pendente';
}

function StatusBadge({ status }: { status: 'enviado' | 'falhou' | 'pendente' }) {
  if (status === 'enviado') {
    return (
      <span className="notif-badge notif-badge--sent">
        <CheckCircle2 size={11} aria-hidden="true" />
        Enviada
      </span>
    );
  }
  if (status === 'falhou') {
    return (
      <span className="notif-badge notif-badge--failed">
        <XCircle size={11} aria-hidden="true" />
        Falhou
      </span>
    );
  }
  return (
    <span className="notif-badge notif-badge--pending">
      <Clock size={11} aria-hidden="true" />
      Pendente
    </span>
  );
}

export default async function NotificacaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notif = await getNotificacao(id);

  if (!notif) {
    notFound();
  }

  const status = getStatus(notif);
  const canResend = status === 'falhou' || status === 'pendente';
  const shortId = notif.id.slice(0, 8);
  const contexto = notif.contexto as Record<string, unknown> | null;

  return (
    <>
      <TopBar
        title={`Notificacao ${shortId}`}
        subtitle="Preview do conteudo enviado"
      />
      <div className="nos-page-body">
        <div className="notif-detail-card">
          <div className="notif-detail-header">
            <div className="notif-detail-meta">
              <div className="notif-card__header" style={{ marginBottom: 4 }}>
                <span className="notif-card__destinatario">{notif.destinatario}</span>
                <span>·</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {formatDateTime(notif.created_at)}
                </span>
                <StatusBadge status={status} />
              </div>
              <div className="notif-card__assunto">{notif.assunto}</div>
            </div>

            <div className="notif-detail-actions">
              <Link href="/notificacoes" className="notif-action-link">
                <ArrowLeft size={13} aria-hidden="true" />
                Voltar
              </Link>

              {canResend ? (
                <form action={reenviarNotificacao} style={{ display: 'contents' }}>
                  <input type="hidden" name="id" value={notif.id} />
                  <button type="submit" className="notif-action-btn">
                    <RefreshCw size={13} aria-hidden="true" />
                    Reenviar
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          {notif.erro != null ? (
            <div className="notif-error" role="alert">
              <strong>Erro:</strong> {notif.erro}
            </div>
          ) : null}

          <iframe
            className="notif-preview-iframe"
            srcDoc={notif.corpo}
            title={`Preview do email: ${notif.assunto}`}
            sandbox="allow-same-origin"
          />

          {contexto != null ? (
            <details>
              <summary className="notif-context-summary">Ver contexto</summary>
              <pre className="notif-context-pre">{JSON.stringify(contexto, null, 2)}</pre>
            </details>
          ) : null}
        </div>
      </div>
    </>
  );
}
