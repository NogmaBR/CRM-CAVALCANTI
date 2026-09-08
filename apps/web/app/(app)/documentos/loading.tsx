import { Skeleton } from '@/components/nogma/Skeleton';

/**
 * Loading skeleton pra biblioteca de documentos (grid ou tabela).
 */
export default function DocumentosLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando documentos">
      <div className="nos-topbar" aria-hidden="true">
        <div className="nos-topbar__left">
          <div className="nos-topbar__heading">
            <Skeleton width={140} height={24} />
            <Skeleton width={200} height={14} style={{ marginTop: 6 }} />
          </div>
        </div>
      </div>

      <div style={{ padding: 24, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width={160} height={36} />
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 16,
                display: 'grid',
                gap: 8,
              }}
            >
              <Skeleton width="100%" height={100} />
              <Skeleton width="80%" height={14} />
              <Skeleton width="50%" height={12} />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando documentos…</span>
    </div>
  );
}
