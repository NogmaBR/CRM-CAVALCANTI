import Link from 'next/link';
import { Plus } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Card } from '@/components/nogma/Card';
import { listCategorias } from '@/lib/data/categorias';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import {
  listPagamentos,
  sumPagamentosBy,
  type Pagamento,
} from '@/lib/data/pagamentos';
import { formatBRL } from '@/lib/schemas/pagamento';
import { PagamentosFilters } from './pagamentos-filters';
import { PagamentosTable } from './pagamentos-table';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'erro', label: 'Erro' },
  { value: 'arquivado', label: 'Arquivados' },
];

type Status = 'confirmado' | 'aguardando' | 'erro';

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    obra_id?: string;
    fornecedor_id?: string;
    categoria_id?: string;
  }>;
}) {
  const params = await searchParams;
  const status = params.status ?? '';
  const obraId = params.obra_id ?? '';
  const fornecedorId = params.fornecedor_id ?? '';
  const categoriaId = params.categoria_id ?? '';

  const isArquivado = status === 'arquivado';
  const statusPagto: Status | undefined = isArquivado
    ? undefined
    : (['confirmado', 'aguardando', 'erro'] as const).includes(status as Status)
      ? (status as Status)
      : undefined;

  const commonFilters = {
    obra_id: obraId || undefined,
    fornecedor_id: fornecedorId || undefined,
    categoria_id: categoriaId || undefined,
    status_pagto: statusPagto,
    onlyArchived: isArquivado,
  };

  const [pagamentos, obras, fornecedores, categorias, sumResult]: [
    Pagamento[],
    Awaited<ReturnType<typeof listObras>>,
    Awaited<ReturnType<typeof listFornecedores>>,
    Awaited<ReturnType<typeof listCategorias>>,
    { total: number; count: number },
  ] = await Promise.all([
    listPagamentos(commonFilters),
    listObras({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
    listCategorias(),
    isArquivado
      ? Promise.resolve({ total: 0, count: 0 })
      : sumPagamentosBy({
          obra_id: obraId || undefined,
          status_pagto: statusPagto,
        }),
  ]);

  const buildHref = (overrides: Partial<Record<string, string>>) => {
    const p = new URLSearchParams();
    const merged = {
      status,
      obra_id: obraId,
      fornecedor_id: fornecedorId,
      categoria_id: categoriaId,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && typeof v === 'string' && v.length > 0) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/pagamentos?${qs}` : '/pagamentos';
  };

  return (
    <>
      <TopBar
        title="Pagamentos"
        subtitle="Lançamentos financeiros por obra"
        actions={
          <Link href="/pagamentos/novo" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>
              Novo Pagamento
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        {!isArquivado ? (
          <Card style={{ padding: '18px 22px', marginBottom: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: 4,
                  }}
                >
                  Total filtrado
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatBRL(sumResult.total)}
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {sumResult.count} pagamento{sumResult.count === 1 ? '' : 's'}
              </div>
            </div>
          </Card>
        ) : null}

        <nav className="obras-filter-tabs" aria-label="Filtrar por status">
          {STATUS_OPTIONS.map((opt) => {
            const href = buildHref({ status: opt.value });
            const active = opt.value === status;
            return (
              <Link
                key={opt.value || 'todos'}
                href={href}
                className={active ? 'obras-filter-tab is-active' : 'obras-filter-tab'}
                aria-current={active ? 'page' : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>

        <PagamentosFilters
          obras={obras.map((o) => ({ value: o.id, label: o.nome }))}
          fornecedores={fornecedores.map((f) => ({ value: f.id, label: f.nome }))}
          categorias={categorias.map((c) => ({ value: c.id, label: c.nome }))}
          selectedObraId={obraId}
          selectedFornecedorId={fornecedorId}
          selectedCategoriaId={categoriaId}
        />

        <div style={{ marginTop: 24 }}>
          <PagamentosTable
            pagamentos={pagamentos}
            obras={obras}
            fornecedores={fornecedores}
            categorias={categorias}
          />
        </div>
      </div>
    </>
  );
}
