import Link from 'next/link';
import { Plus } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { listCategorias } from '@/lib/data/categorias';
import { listFornecedores, type Fornecedor } from '@/lib/data/fornecedores';
import { FornecedoresTable } from './fornecedores-table';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'arquivado', label: 'Arquivados' },
];

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; categoria_id?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status ?? '') as '' | 'ativo' | 'arquivado';
  const categoriaId = params.categoria_id ?? '';

  const [fornecedores, categorias]: [Fornecedor[], Awaited<ReturnType<typeof listCategorias>>] =
    await Promise.all([
      listFornecedores({
        onlyArchived: status === 'arquivado',
        categoria_id: categoriaId || undefined,
      }),
      listCategorias(),
    ]);

  return (
    <>
      <TopBar
        title="Fornecedores"
        subtitle="Cadastro e categorização"
        actions={
          <Link href="/fornecedores/novo" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>
              Novo Fornecedor
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        <nav className="obras-filter-tabs" aria-label="Filtrar por status">
          {STATUS_OPTIONS.map((opt) => {
            const p = new URLSearchParams();
            if (opt.value) p.set('status', opt.value);
            if (categoriaId) p.set('categoria_id', categoriaId);
            const href = p.toString() ? `/fornecedores?${p.toString()}` : '/fornecedores';
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

        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Categoria:
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Link
              href={status ? `/fornecedores?status=${status}` : '/fornecedores'}
              className={
                categoriaId === '' ? 'obras-filter-tab is-active' : 'obras-filter-tab'
              }
            >
              Todas
            </Link>
            {categorias.map((cat) => {
              const p = new URLSearchParams();
              if (status) p.set('status', status);
              p.set('categoria_id', cat.id);
              const href = `/fornecedores?${p.toString()}`;
              const active = categoriaId === cat.id;
              return (
                <Link
                  key={cat.id}
                  href={href}
                  className={active ? 'obras-filter-tab is-active' : 'obras-filter-tab'}
                  style={
                    cat.cor
                      ? {
                          borderLeft: `3px solid ${cat.cor}`,
                          paddingLeft: 10,
                        }
                      : undefined
                  }
                >
                  {cat.nome}
                </Link>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <FornecedoresTable fornecedores={fornecedores} categorias={categorias} />
        </div>
      </div>
    </>
  );
}
