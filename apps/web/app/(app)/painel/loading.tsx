import { Skeleton } from '@/components/nogma/Skeleton';

/**
 * Loading skeleton pro dashboard. Aparece durante fetch server-side dos
 * KPIs, série mensal, gasto por categoria e atividade recente.
 *
 * Layout espelha o painel real: topbar + 4 KPI cards + 2 chart cards + list.
 * Marcado role="status" + aria-busy pro leitor de tela anunciar.
 */
export default function PainelLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando painel">
      <div className="nos-topbar" aria-hidden="true">
        <div className="nos-topbar__left">
          <div className="nos-topbar__heading">
            <Skeleton width={180} height={24} />
            <Skeleton width={240} height={14} style={{ marginTop: 6 }} />
          </div>
        </div>
      </div>

      <div style={{ padding: 24, display: 'grid', gap: 16 }}>
        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
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
              <Skeleton width={80} height={12} />
              <Skeleton width={120} height={28} />
              <Skeleton width={60} height={10} />
            </div>
          ))}
        </div>

        {/* Big chart card */}
        <div
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <Skeleton width={140} height={14} />
          <div style={{ marginTop: 16 }}>
            <Skeleton width="100%" height={220} />
          </div>
        </div>

        {/* Two-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 20,
              }}
            >
              <Skeleton width={140} height={14} />
              <div style={{ marginTop: 16 }}>
                <Skeleton width="100%" height={200} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando painel…</span>
    </div>
  );
}
