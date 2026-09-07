import Link from 'next/link';
import { Mail, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { listNotificacoes, type NotificacaoEmail } from '@/lib/data/notificacoes';
import { reenviarNotificacao } from './actions';
import './notificacoes.css';

type StatusFilter = 'enviado' | 'falhou' | 'pendente' | '';

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'enviado', label: 'Enviadas' },
  { value: 'falhou', label: 'Falhas' },
  { value: 'pendente', label: 'Pendentes' },
];

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

function NotifCard({ n }: { n: NotificacaoEmail }) {
  const status = getStatus(n);
  const contexto = n.contexto as Record<string, unknown> | null;
  const tipoContexto = contexto?.tipo as string | undefined;
  const canResend = status === 'falhou' || status === 'pendente';

  return (
    <article className="notif-card">
      <div className="notif-card__header">
        <span className="notif-card__destinatario">{n.destinatario}</span>
        <span>·</span>
        <span>{formatDateTime(n.created_at)}</span>
        <StatusBadge status={status} />
      </div>

      <div className="notif-card__assunto">{n.assunto}</div>

      {tipoContexto ? (
        <div>
          <span className="notif-card__tipo-tag">tipo: {tipoContexto}</span>
        </div>
      ) : null}

      {n.erro != null ? (
        <div className="notif-error" role="alert">
          {n.erro}
        </div>
      ) : null}

      <div className="notif-card__actions">
        <Link href={`/notificacoes/${n.id}`} className="notif-action-link">
          Ver conteudo
        </Link>

        {canResend ? (
          <form action={reenviarNotificacao} style={{ display: 'contents' }}>
            <input type="hidden" name="id" value={n.id} />
            <button type="submit" className="notif-action-btn">
              <RefreshCw size={13} aria-hidden="true" />
              Reenviar
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export default async function NotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const rawStatus = (params.status ?? '') as StatusFilter;
  const statusFilter = FILTER_OPTIONS.some((o) => o.value === rawStatus) ? rawStatus : '';
  const successMsg = params.success ?? null;
  const errorMsg = params.error ?? null;

  const notificacoes = await listNotificacoes(
    statusFilter ? { status: statusFilter as 'enviado' | 'falhou' | 'pendente' } : {},
  );

  return (
    <>
      <TopBar title="Notificacoes" subtitle="Historico de emails enviados pelo sistema" />
      <div className="nos-page-body">
        {successMsg ? (
          <div className="notif-banner notif-banner--success" role="status">
            {successMsg}
          </div>
        ) : null}

        {errorMsg ? (
          <div className="notif-banner notif-banner--error" role="alert">
            {errorMsg}
          </div>
        ) : null}

        <nav className="notif-filter-tabs" aria-label="Filtrar por status">
          {FILTER_OPTIONS.map((opt) => {
            const href = opt.value === '' ? '/notificacoes' : `/notificacoes?status=${opt.value}`;
            const active = opt.value === statusFilter;
            return (
              <Link
                key={opt.value || 'todas'}
                href={href}
                className={active ? 'notif-filter-tab is-active' : 'notif-filter-tab'}
                aria-current={active ? 'page' : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>

        {notificacoes.length === 0 ? (
          <div className="notif-empty">
            <Mail size={32} aria-hidden="true" style={{ opacity: 0.5, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>
              {statusFilter
                ? `Nenhuma notificacao com status "${FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ?? statusFilter}".`
                : 'Nenhuma notificacao registrada ainda.'}
            </p>
          </div>
        ) : (
          <ul className="notif-feed" style={{ listStyle: 'none', padding: 0 }}>
            {notificacoes.map((n) => (
              <li key={n.id}>
                <NotifCard n={n} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
