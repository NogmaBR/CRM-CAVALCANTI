import Link from 'next/link';
import { Plus } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { listObras, type Obra } from '@/lib/data/obras';
import { ObrasTable } from './obras-table';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'ativa', label: 'Ativas' },
  { value: 'pausada', label: 'Pausadas' },
  { value: 'concluida', label: 'Concluídas' },
  { value: 'arquivada', label: 'Arquivadas' },
];

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status ?? '') as '' | 'ativa' | 'pausada' | 'concluida' | 'arquivada';

  let obras: Obra[] = [];
  let debugError: string | null = null;
  try {
    obras = await listObras({
      status: status === '' ? undefined : status,
      includeArchived: status === 'arquivada',
    });
  } catch (e) {
    debugError =
      e instanceof Error
        ? `${e.name}: ${e.message}\n${e.stack ?? '(no stack)'}`
        : String(e);
  }

  return (
    <>
      <TopBar
        title="Obras"
        subtitle="Cadastro, orçamento e acompanhamento"
        actions={
          <Link href="/obras/novo" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>
              Nova Obra
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        <nav className="obras-filter-tabs" aria-label="Filtrar por status">
          {STATUS_OPTIONS.map((opt) => {
            const href = opt.value === '' ? '/obras' : `/obras?status=${opt.value}`;
            const active = opt.value === status;
            return (
              <Link
                key={opt.value || 'todas'}
                href={href}
                className={active ? 'obras-filter-tab is-active' : 'obras-filter-tab'}
                aria-current={active ? 'page' : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>

        {debugError ? (
          <pre
            style={{
              marginTop: 24,
              padding: 16,
              background: '#111',
              color: '#f88',
              borderRadius: 8,
              fontSize: 12,
              overflow: 'auto',
            }}
          >
            DEBUG listObras error:{'\n'}
            {debugError}
          </pre>
        ) : (
          <div style={{ marginTop: 24 }}>
            <ObrasTable obras={obras} />
          </div>
        )}
      </div>
    </>
  );
}
