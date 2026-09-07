import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import {
  listAuditLog,
  getEntidadeUrl,
  extractChangedKeys,
  AUDIT_ENTIDADES,
  AUDIT_ENTIDADE_LABELS,
  AUDIT_ACAO_LABELS,
  type AuditListItem,
  type AuditEntidade,
  type AuditAcao,
} from '@/lib/data/auditoria';
import './auditoria.css';

// ── helpers ────────────────────────────────────────────────────────────────

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

const ACAO_VARIANT: Record<AuditAcao, BadgeVariant> = {
  insert: 'success',
  update: 'warning',
  delete: 'danger',
};

// ── filter form (pure HTML, server-friendly) ────────────────────────────────

function AuditFilters({
  entidade,
  acao,
  from,
  to,
}: {
  entidade?: string;
  acao?: string;
  from?: string;
  to?: string;
}) {
  return (
    <form action="/auditoria" method="get" className="audit-filters">
      {/* Entidade */}
      <div className="audit-filters__group">
        <label className="audit-filters__label" htmlFor="af-entidade">
          Entidade
        </label>
        <select
          id="af-entidade"
          name="entidade"
          className="audit-filters__select"
          defaultValue={entidade ?? ''}
        >
          <option value="">Todas</option>
          {AUDIT_ENTIDADES.map((e) => (
            <option key={e} value={e}>
              {AUDIT_ENTIDADE_LABELS[e]}
            </option>
          ))}
        </select>
      </div>

      {/* Acao */}
      <div className="audit-filters__group">
        <label className="audit-filters__label" htmlFor="af-acao">
          Acao
        </label>
        <select
          id="af-acao"
          name="acao"
          className="audit-filters__select"
          defaultValue={acao ?? ''}
        >
          <option value="">Todas</option>
          {(Object.entries(AUDIT_ACAO_LABELS) as [AuditAcao, string][]).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="audit-filters__group">
        <label className="audit-filters__label" htmlFor="af-from">
          De
        </label>
        <input
          id="af-from"
          type="date"
          name="from"
          className="audit-filters__date"
          defaultValue={from ?? ''}
        />
      </div>

      <div className="audit-filters__group">
        <label className="audit-filters__label" htmlFor="af-to">
          Ate
        </label>
        <input
          id="af-to"
          type="date"
          name="to"
          className="audit-filters__date"
          defaultValue={to ?? ''}
        />
      </div>

      {/* Actions */}
      <div className="audit-filters__actions">
        <button type="submit" className="audit-filters__submit">
          Aplicar filtros
        </button>
        <a href="/auditoria" className="audit-filters__clear">
          Limpar
        </a>
      </div>
    </form>
  );
}

// ── row card ────────────────────────────────────────────────────────────────

function AuditRow({ item }: { item: AuditListItem }) {
  const acao = item.acao as AuditAcao;
  const acaoLabel = AUDIT_ACAO_LABELS[acao] ?? item.acao;
  const acaoVariant = ACAO_VARIANT[acao] ?? 'neutral';

  const entidadeLabel =
    AUDIT_ENTIDADE_LABELS[item.entidade as AuditEntidade] ?? item.entidade;

  const entidadeUrl =
    item.entidade_id != null
      ? getEntidadeUrl(item.entidade, String(item.entidade_id))
      : null;

  const changedKeys = extractChangedKeys(item.diff);
  const userName = item.user_nome ?? 'Sistema';
  const userPapel = item.user_papel ? ` (${item.user_papel})` : '';

  return (
    <article className="audit-row">
      <div className="audit-row__main">
        <div className="audit-row__header">
          <span className="audit-row__ts">{formatDateTime(item.created_at)}</span>
          <span>·</span>
          <Badge variant={acaoVariant}>{acaoLabel}</Badge>
          <span>·</span>
          <Badge variant="neutral">{entidadeLabel}</Badge>
          {entidadeUrl ? (
            <>
              <span>·</span>
              <Link href={entidadeUrl} className="audit-row__link">
                Ver registro
                <ArrowRight size={11} aria-hidden="true" style={{ verticalAlign: 'middle', marginLeft: 2 }} />
              </Link>
            </>
          ) : null}
        </div>

        <div className="audit-row__user">
          {userName}
          {userPapel ? (
            <span className="audit-row__user-papel">{userPapel}</span>
          ) : null}
        </div>

        {changedKeys.length > 0 ? (
          <div className="audit-row__fields">
            campos: {changedKeys.join(', ')}
          </div>
        ) : null}
      </div>

      <div className="audit-row__side">
        <Link href={`/auditoria/${item.id}`} className="audit-row__diff-btn">
          Ver diff
          <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

// ── page ────────────────────────────────────────────────────────────────────

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    entidade?: string;
    acao?: string;
    from?: string;
    to?: string;
    user_id?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;

  const entidadeParam = AUDIT_ENTIDADES.includes(params.entidade as AuditEntidade)
    ? (params.entidade as AuditEntidade)
    : undefined;

  const acaoParam = (['insert', 'update', 'delete'] as AuditAcao[]).includes(
    params.acao as AuditAcao,
  )
    ? (params.acao as AuditAcao)
    : undefined;

  const items = await listAuditLog(
    {
      entidade: entidadeParam,
      acao: acaoParam,
      from: params.from,
      to: params.to,
      user_id: params.user_id,
    },
    200,
  );

  return (
    <>
      <TopBar
        title="Auditoria"
        subtitle="Historico de alteracoes no sistema"
      />
      <div className="nos-page-body">
        <AuditFilters
          entidade={params.entidade}
          acao={params.acao}
          from={params.from}
          to={params.to}
        />

        {items.length === 0 ? (
          <div className="audit-empty">
            <ShieldCheck size={36} className="audit-empty__icon" aria-hidden="true" />
            <p className="audit-empty__text">Nenhum registro no filtro</p>
          </div>
        ) : (
          <ul className="audit-feed" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map((item) => (
              <li key={item.id}>
                <AuditRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
