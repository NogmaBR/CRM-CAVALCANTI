import { Skeleton } from '@/components/nogma/Skeleton';

/**
 * Loading skeleton pra pendências (fila de confirmação WhatsApp).
 */
export default function PendentesLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando pendências">
      <div className="nos-topbar" aria-hidden="true">
        <div className="nos-topbar__left">
          <div className="nos-topbar__heading">
            <Skeleton width={140} height={24} />
            <Skeleton width={220} height={14} style={{ marginTop: 6 }} />
          </div>
        </div>
      </div>

      <div style={{ padding: 24, display: 'grid', gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 16,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Skeleton variant="circle" width={40} height={40} />
              <div style={{ flex: 1 }}>
                <Skeleton width={200} height={14} />
                <Skeleton width={140} height={12} style={{ marginTop: 6 }} />
              </div>
              <Skeleton width={80} height={20} />
            </div>
            <Skeleton width="100%" height={40} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Skeleton width={100} height={32} />
              <Skeleton width={100} height={32} />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando pendências…</span>
    </div>
  );
}
