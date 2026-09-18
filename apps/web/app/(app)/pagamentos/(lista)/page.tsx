import { FiltroDeSituacao } from '@/components/completude/filtro-situacao';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import {
  type FiltroDeSituacao as Situacao,
  lerFiltroDeSituacao,
  passaNoFiltro,
} from '@/lib/completude/regras';
import { listCategorias } from '@/lib/data/categorias';
import { completudeDosPagamentos } from '@/lib/data/completude';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { listPagamentos } from '@/lib/data/pagamentos';
import { PAGAMENTO_STATUS_FILTROS, type PagamentoStatus } from '@/lib/status-labels';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { PagamentosFilters } from '../pagamentos-filters';
import { PagamentosTable } from '../pagamentos-table';
import { ResumoDosPagamentos } from '../resumo';

export const metadata = { title: 'Pagamentos' };

// Vocabulário e lista vêm de um lugar só (`status-labels.ts`): antes esta
// tela tinha a própria lista, sem `recusado` — o filtro que o gestor pediu.
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  ...PAGAMENTO_STATUS_FILTROS,
  { value: 'arquivado', label: 'Arquivados' },
];

const STATUS_VALIDOS: readonly PagamentoStatus[] = ['confirmado', 'aguardando', 'recusado', 'erro'];
type Status = PagamentoStatus;

/**
 * A página só lê a URL e devolve o cabeçalho e o conteúdo como irmãos: o
 * `TopBar` (que conta pendências e lê o tema) e `PagamentosConteudo` (cinco
 * consultas em paralelo) rendem ao mesmo tempo. Antes o `TopBar` só começava
 * depois das cinco consultas — duas idas ao banco em série (QA, ISSUE-009).
 */
export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    obra_id?: string;
    fornecedor_id?: string;
    categoria_id?: string;
    situacao?: string;
  }>;
}) {
  const params = await searchParams;
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
      <PagamentosConteudo params={params} />
    </>
  );
}

async function PagamentosConteudo({
  params,
}: {
  params: {
    status?: string;
    obra_id?: string;
    fornecedor_id?: string;
    categoria_id?: string;
    situacao?: string;
  };
}) {
  const status = params.status ?? '';
  const obraId = params.obra_id ?? '';
  const fornecedorId = params.fornecedor_id ?? '';
  const categoriaId = params.categoria_id ?? '';
  const situacao = lerFiltroDeSituacao(params.situacao);

  const isArquivado = status === 'arquivado';
  const statusPagto: Status | undefined = isArquivado
    ? undefined
    : STATUS_VALIDOS.includes(status as Status)
      ? (status as Status)
      : undefined;

  const commonFilters = {
    obra_id: obraId || undefined,
    fornecedor_id: fornecedorId || undefined,
    categoria_id: categoriaId || undefined,
    status_pagto: statusPagto,
    onlyArchived: isArquivado,
  };

  const [todos, obras, fornecedores, categorias] = await Promise.all([
    listPagamentos(commonFilters),
    listObras({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
    listCategorias(),
  ]);

  // O semáforo de cada lançamento (uma consulta em documentos) e o filtro
  // de situação, em memória — a listagem já carrega tudo. O resumo do topo
  // sai da mesma lista, então respeita TODOS os filtros (antes a soma
  // ignorava fornecedor e categoria).
  const completudeMap = await completudeDosPagamentos(todos);
  const completude = Object.fromEntries(completudeMap);
  const contagem: Record<Situacao, number> = {
    '': todos.length,
    pendente: 0,
    critico: 0,
    completo: 0,
  };
  for (const p of todos) {
    const c = completudeMap.get(p.id);
    if (!c) continue;
    if (c.nivel === 'completo') contagem.completo += 1;
    else contagem.pendente += 1;
    if (c.nivel === 'critico') contagem.critico += 1;
  }
  const pagamentos = isArquivado
    ? todos
    : todos.filter((p) =>
        passaNoFiltro(completudeMap.get(p.id) ?? { nivel: 'completo' }, situacao),
      );

  const buildHref = (overrides: Partial<Record<string, string>>) => {
    const p = new URLSearchParams();
    const merged = {
      status,
      obra_id: obraId,
      fornecedor_id: fornecedorId,
      categoria_id: categoriaId,
      situacao,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && typeof v === 'string' && v.length > 0) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/pagamentos?${qs}` : '/pagamentos';
  };

  return (
    <div className="nos-page-body">
      {!isArquivado ? (
        <ResumoDosPagamentos pagamentos={pagamentos} completude={completudeMap} />
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

      {!isArquivado ? (
        <FiltroDeSituacao
          atual={situacao}
          buildHref={(v) => buildHref({ situacao: v })}
          contagem={contagem}
        />
      ) : null}

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
          completude={isArquivado ? undefined : completude}
        />
      </div>
    </div>
  );
}
