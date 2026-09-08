import { Skeleton } from '@/components/nogma/Skeleton';

/**
 * Loading skeleton pra relatórios. Cobre filtros + preview tabular + export buttons.
 */
export default function RelatoriosLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando relatórios">
      <div className="nos-topbar" aria-hidden="true">
        <div className="nos-topbar__left">
          <div className="nos-topbar__heading">
            <Skeleton width={140} height={24} />
            <Skeleton width={220} height={14} style={{ marginTop: 6 }} />
          </div>
        </div>
      </div>

      <div style={{ padding: 24, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width={140} height={36} />
          ))}
        </div>

        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 20,
            display: 'grid',
            gap: 12,
          }}
        >
          <Skeleton width={200} height={16} />
          <Skeleton width="100%" height={260} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Skeleton width={120} height={36} />
            <Skeleton width={120} height={36} />
          </div>
        </div>
      </div>
      <span className="sr-only">Carregando relatórios…</span>
    </div>
  );
}
