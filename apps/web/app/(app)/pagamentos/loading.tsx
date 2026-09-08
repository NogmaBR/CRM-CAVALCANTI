import { Skeleton } from '@/components/nogma/Skeleton';

/**
 * Loading skeleton pra lista de pagamentos. Cobre filtros + KPIs + tabela.
 */
export default function PagamentosLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando pagamentos">
      <div className="nos-topbar" aria-hidden="true">
        <div className="nos-topbar__left">
          <div className="nos-topbar__heading">
            <Skeleton width={140} height={24} />
            <Skeleton width={200} height={14} style={{ marginTop: 6 }} />
          </div>
        </div>
      </div>

      <div style={{ padding: 24, display: 'grid', gap: 16 }}>
        {/* Filters bar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width={140} height={36} />
          ))}
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <Skeleton width={80} height={12} />
              <Skeleton width={120} height={24} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>

        {/* Table rows */}
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 12,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 100px',
                gap: 12,
                padding: '10px 8px',
                borderBottom: i < 7 ? '1px solid var(--border-subtle)' : 'none',
                alignItems: 'center',
              }}
            >
              <Skeleton width="80%" height={14} />
              <Skeleton width={80} height={14} />
              <Skeleton width={80} height={14} />
              <Skeleton width={70} height={14} />
              <Skeleton width={60} height={22} />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando pagamentos…</span>
    </div>
  );
}
