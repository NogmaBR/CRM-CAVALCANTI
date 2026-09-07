import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import {
  getAuditLog,
  getEntidadeUrl,
  AUDIT_ENTIDADE_LABELS,
  AUDIT_ACAO_LABELS,
  type AuditListItem,
  type AuditEntidade,
  type AuditAcao,
} from '@/lib/data/auditoria';
import '../auditoria.css';

// ── helpers ─────────────────────────────────────────────────────────────────

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

/** Safe value renderer for JSONB diff values. */
function renderValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined) {
    return <em style={{ opacity: 0.5 }}>null</em>;
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  // Object or array — monospace code block
  return <code>{JSON.stringify(v, null, 2)}</code>;
}

// ── diff viewer ──────────────────────────────────────────────────────────────

/**
 * INSERT — single pane "Criado com estes valores" (diff.after keys).
 */
function InsertDiff({ after }: { after: Record<string, unknown> }) {
  const keys = Object.keys(after).sort();
  return (
    <div className="audit-diff-section">
      <p className="audit-diff-section__title">Criado com estes valores</p>
      <table className="audit-diff-table" aria-label="Valores criados">
        <thead>
          <tr>
            <th className="audit-diff-table__key">Campo</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="audit-diff-cell">
              <td className="audit-diff-table__key">{k}</td>
              <td className="audit-diff-table__value audit-diff-cell">
                {renderValue(after[k])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * DELETE — single pane "Estado antes da exclusao" (diff.before keys).
 */
function DeleteDiff({ before }: { before: Record<string, unknown> }) {
  const keys = Object.keys(before).sort();
  return (
    <div className="audit-diff-section audit-diff-section--delete">
      <p className="audit-diff-section__title">Estado antes da exclusao</p>
      <table className="audit-diff-table" aria-label="Valores antes da exclusao">
        <thead>
          <tr>
            <th className="audit-diff-table__key">Campo</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="audit-diff-cell">
              <td className="audit-diff-table__key">{k}</td>
              <td className="audit-diff-table__value audit-diff-cell">
                {renderValue(before[k])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * UPDATE — 3-col side-by-side: Campo | Antes | Depois.
 * Rows where before[k] !== after[k] get the --changed modifier.
 */
function UpdateDiff({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  // Union of all keys from both sides
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

  return (
    <div className="audit-diff-section">
      <p className="audit-diff-section__title">Campos alterados</p>
      <table className="audit-diff-table" aria-label="Diferenca de valores">
        <thead>
          <tr>
            <th className="audit-diff-table__key">Campo</th>
            <th className="audit-diff-table__before">Antes</th>
            <th className="audit-diff-arrow" aria-hidden="true"></th>
            <th className="audit-diff-table__after">Depois</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const bVal = before[k];
            const aVal = after[k];
            // Naive equality — adequate for compliance display
            const changed = JSON.stringify(bVal) !== JSON.stringify(aVal);
            return (
              <tr key={k} className={changed ? 'audit-diff-cell audit-diff-cell--changed' : 'audit-diff-cell'}>
                <td className="audit-diff-table__key">{k}</td>
                <td className="audit-diff-table__before audit-diff-cell">
                  {renderValue(bVal)}
                </td>
                <td className="audit-diff-arrow" aria-hidden="true">
                  <ArrowRight size={12} />
                </td>
                <td className="audit-diff-table__after audit-diff-cell">
                  {renderValue(aVal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DiffViewer({ item }: { item: AuditListItem }) {
  const acao = item.acao as AuditAcao;
  const raw = item.diff;

  // Defensive: diff null or not an object
  if (!raw || typeof raw !== 'object') {
    return (
      <div className="audit-diff-section">
        <p className="audit-diff-section__title">Diff</p>
        <div className="audit-diff-empty">Diff vazio</div>
      </div>
    );
  }

  const d = raw as Record<string, unknown>;
  const before = d.before && typeof d.before === 'object' ? (d.before as Record<string, unknown>) : null;
  const after = d.after && typeof d.after === 'object' ? (d.after as Record<string, unknown>) : null;

  if (acao === 'insert') {
    if (!after) return <div className="audit-diff-empty">Diff vazio</div>;
    return <InsertDiff after={after} />;
  }

  if (acao === 'delete') {
    if (!before) return <div className="audit-diff-empty">Diff vazio</div>;
    return <DeleteDiff before={before} />;
  }

  // update
  if (!before && !after) return <div className="audit-diff-empty">Diff vazio</div>;
  return (
    <UpdateDiff
      before={before ?? {}}
      after={after ?? {}}
    />
  );
}

// ── metadata card ────────────────────────────────────────────────────────────

function MetaCard({ item }: { item: AuditListItem }) {
  const acao = item.acao as AuditAcao;
  const acaoLabel = AUDIT_ACAO_LABELS[acao] ?? item.acao;
  const acaoVariant = ACAO_VARIANT[acao] ?? 'neutral';
  const entidadeLabel =
    AUDIT_ENTIDADE_LABELS[item.entidade as AuditEntidade] ?? item.entidade;
  const entidadeUrl =
    item.entidade_id != null
      ? getEntidadeUrl(item.entidade, String(item.entidade_id))
      : null;

  const userName = item.user_nome ?? 'Sistema';
  const userPapel = item.user_papel ?? null;

  return (
    <div className="audit-meta-card">
      <div className="audit-meta-card__header">
        <Badge variant={acaoVariant}>{acaoLabel}</Badge>
        <Badge variant="neutral">{entidadeLabel}</Badge>
        {item.entidade_id != null ? (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            id: {String(item.entidade_id)}
          </span>
        ) : null}
      </div>

      <div className="audit-meta-card__row">
        <span className="audit-meta-card__label">Quando</span>
        <span className="audit-meta-card__ts">{formatDateTime(item.created_at)}</span>
      </div>

      <div className="audit-meta-card__row">
        <span className="audit-meta-card__label">Usuario</span>
        <span className="audit-meta-card__value">
          {userName}
          {userPapel ? (
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>
              ({userPapel})
            </span>
          ) : null}
        </span>
      </div>

      {entidadeUrl ? (
        <div className="audit-meta-card__row">
          <span className="audit-meta-card__label">Registro</span>
          <Link href={entidadeUrl} className="audit-meta-card__link">
            Abrir {entidadeLabel}
            <ArrowRight size={12} aria-hidden="true" style={{ verticalAlign: 'middle', marginLeft: 3 }} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function AuditLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);

  // Invalid id (NaN, float, negative)
  if (!Number.isInteger(numId) || numId <= 0) {
    notFound();
  }

  const item = await getAuditLog(numId);
  if (!item) notFound();

  return (
    <>
      <TopBar
        title={`Registro de auditoria #${id}`}
        subtitle="Detalhes da alteracao"
      />
      <div className="nos-page-body">
        <Link href="/auditoria" className="audit-back">
          ← Voltar
        </Link>

        <div className="audit-detail">
          <MetaCard item={item} />
          <DiffViewer item={item} />
        </div>
      </div>
    </>
  );
}
