import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Tag, Plus, Pencil, Archive, RotateCcw } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { createClient } from '@/lib/supabase/server';
import { listCategoriasComContagem, type CategoriaComContagem } from '@/lib/data/categorias';
import { arquivarCategoria, restaurarCategoria } from './actions';
import './categorias.css';

type StatusFilter = 'active' | 'archived';

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: 'Ativas' },
  { value: 'archived', label: 'Arquivadas' },
];

function formatBRL(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function CategoriaRow({ cat, isArchived }: { cat: CategoriaComContagem; isArchived: boolean }) {
  const hasPayments = cat.qtd_pagamentos > 0;
  return (
    <tr>
      <td>
        <div className="categorias-nome-cell">
          {cat.cor ? (
            <span
              className="categoria-cor-pill"
              style={{ background: cat.cor }}
              aria-hidden="true"
            />
          ) : (
            <span
              className="categoria-cor-pill"
              style={{ background: 'var(--border-subtle)' }}
              aria-hidden="true"
            />
          )}
          <span className="categorias-nome">{cat.nome}</span>
          {isArchived && (
            <span className="categorias-archived-badge">Arquivada</span>
          )}
        </div>
      </td>

      <td>
        {cat.icone ? (
          <span className="categorias-icone-name">{cat.icone}</span>
        ) : (
          <span style={{ color: 'var(--text-muted, #666)', fontSize: 12 }}>—</span>
        )}
      </td>

      <td>
        <span className={hasPayments ? 'categorias-contagem categorias-contagem--active' : 'categorias-contagem'}>
          {cat.qtd_pagamentos === 0
            ? 'Sem pagamentos'
            : `${cat.qtd_pagamentos} pagamento${cat.qtd_pagamentos !== 1 ? 's' : ''} · ${formatBRL(cat.total_valor)}`}
        </span>
      </td>

      <td>
        <div className="categorias-actions">
          {!isArchived && (
            <Link
              href={`/config/categorias/${cat.id}/editar`}
              className="categorias-action-btn"
            >
              <Pencil size={12} aria-hidden="true" />
              Editar
            </Link>
          )}

          {!isArchived && (
            <form action={arquivarCategoria} style={{ display: 'contents' }}>
              <input type="hidden" name="id" value={cat.id} />
              <button
                type="submit"
                className="categorias-action-btn categorias-action-btn--danger"
                title={hasPayments ? `Esta categoria tem ${cat.qtd_pagamentos} pagamento(s) vinculado(s)` : undefined}
              >
                <Archive size={12} aria-hidden="true" />
                Arquivar
              </button>
            </form>
          )}

          {isArchived && (
            <form action={restaurarCategoria} style={{ display: 'contents' }}>
              <input type="hidden" name="id" value={cat.id} />
              <button type="submit" className="categorias-action-btn">
                <RotateCcw size={12} aria-hidden="true" />
                Restaurar
              </button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; success?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();

  if (profile?.papel !== 'admin') notFound();

  const params = await searchParams;
  const rawStatus = params.status ?? 'active';
  const statusFilter: StatusFilter = rawStatus === 'archived' ? 'archived' : 'active';
  const successMsg = params.success ?? null;
  const errorMsg = params.error ?? null;

  // Fetch all (including archived) once, filter in memory
  const all = await listCategoriasComContagem(true);
  const filtered = all.filter((c) =>
    statusFilter === 'archived' ? c.deleted_at != null : c.deleted_at == null,
  );

  return (
    <>
      <TopBar
        title="Categorias"
        subtitle="Contas contábeis pra classificar pagamentos"
        actions={
          <Link href="/config/categorias/nova" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>
              Nova categoria
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        {successMsg ? (
          <div className="categorias-banner categorias-banner--success" role="status">
            {successMsg}
          </div>
        ) : null}

        {errorMsg ? (
          <div className="categorias-banner categorias-banner--error" role="alert">
            {errorMsg}
          </div>
        ) : null}

        <nav className="categorias-filter-tabs" aria-label="Filtrar categorias">
          {FILTER_OPTIONS.map((opt) => {
            const href = `/config/categorias?status=${opt.value}`;
            const active = opt.value === statusFilter;
            return (
              <Link
                key={opt.value}
                href={href}
                className={active ? 'categorias-filter-tab is-active' : 'categorias-filter-tab'}
                aria-current={active ? 'page' : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>

        {filtered.length === 0 ? (
          <div className="categorias-empty">
            <Tag size={32} aria-hidden="true" style={{ opacity: 0.5, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>
              {statusFilter === 'active'
                ? 'Nenhuma categoria ativa. Crie a primeira.'
                : 'Nenhuma categoria arquivada.'}
            </p>
          </div>
        ) : (
          <div className="categorias-table-wrap">
            <table className="categorias-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Icone</th>
                  <th>Uso em pagamentos</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat) => (
                  <CategoriaRow
                    key={cat.id}
                    cat={cat}
                    isArchived={cat.deleted_at != null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
