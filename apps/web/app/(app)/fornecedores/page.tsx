import { FiltroDeSituacao } from '@/components/completude/filtro-situacao';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { corDaCategoria } from '@/lib/categorias/cor';
import {
  type FiltroDeSituacao as Situacao,
  avaliarFornecedor,
  lerFiltroDeSituacao,
  passaNoFiltro,
} from '@/lib/completude/regras';
import { listCategorias } from '@/lib/data/categorias';
import { type Fornecedor, listFornecedores } from '@/lib/data/fornecedores';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { FornecedoresTable } from './fornecedores-table';

export const metadata = { title: 'Fornecedores' };

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'arquivado', label: 'Arquivados' },
];

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; categoria_id?: string; situacao?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status ?? '') as '' | 'ativo' | 'arquivado';
  const categoriaId = params.categoria_id ?? '';
  const situacao = lerFiltroDeSituacao(params.situacao);

  const [todos, categorias]: [Fornecedor[], Awaited<ReturnType<typeof listCategorias>>] =
    await Promise.all([
      listFornecedores({
        onlyArchived: status === 'arquivado',
        categoria_id: categoriaId || undefined,
      }),
      listCategorias(),
    ]);

  // Semáforo do cadastro (regra pura, sem consulta extra) e filtro em memória.
  const completude = Object.fromEntries(todos.map((f) => [f.id, avaliarFornecedor(f)]));
  const contagem: Record<Situacao, number> = {
    '': todos.length,
    pendente: 0,
    critico: 0,
    completo: 0,
  };
  for (const f of todos) {
    const c = completude[f.id];
    if (!c) continue;
    if (c.nivel === 'completo') contagem.completo += 1;
    else contagem.pendente += 1;
    if (c.nivel === 'critico') contagem.critico += 1;
  }
  const fornecedores = todos.filter((f) =>
    passaNoFiltro(completude[f.id] ?? { nivel: 'completo' }, situacao),
  );
  const hrefCom = (over: { status?: string; categoria_id?: string; situacao?: string }) => {
    const p = new URLSearchParams();
    const st = over.status ?? status;
    const cat = over.categoria_id ?? categoriaId;
    const sit = over.situacao ?? situacao;
    if (st) p.set('status', st);
    if (cat) p.set('categoria_id', cat);
    if (sit) p.set('situacao', sit);
    const qs = p.toString();
    return qs ? `/fornecedores?${qs}` : '/fornecedores';
  };

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
            const href = hrefCom({ status: opt.value });
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
              href={hrefCom({ categoria_id: '' })}
              className={categoriaId === '' ? 'obras-filter-tab is-active' : 'obras-filter-tab'}
            >
              Todas
            </Link>
            {categorias.map((cat) => {
              const href = hrefCom({ categoria_id: cat.id });
              const active = categoriaId === cat.id;
              return (
                <Link
                  key={cat.id}
                  href={href}
                  className={active ? 'obras-filter-tab is-active' : 'obras-filter-tab'}
                  style={{ borderLeft: `3px solid ${corDaCategoria(cat)}`, paddingLeft: 10 }}
                >
                  {cat.nome}
                </Link>
              );
            })}
          </div>
        </div>

        {status !== 'arquivado' ? (
          <FiltroDeSituacao
            atual={situacao}
            buildHref={(v) => hrefCom({ situacao: v })}
            contagem={contagem}
          />
        ) : null}

        <div style={{ marginTop: 24 }}>
          <FornecedoresTable
            fornecedores={fornecedores}
            categorias={categorias}
            completude={status === 'arquivado' ? undefined : completude}
          />
        </div>
      </div>
    </>
  );
}
