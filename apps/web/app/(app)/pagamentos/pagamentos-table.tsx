'use client';

import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/nogma/Badge';
import type { Categoria } from '@/lib/data/categorias';
import type { Fornecedor } from '@/lib/data/fornecedores';
import type { Obra } from '@/lib/data/obras';
import type { Pagamento } from '@/lib/data/pagamentos';
import { formatBRL } from '@/lib/schemas/pagamento';
import {
  PAGAMENTO_STATUS_LABEL as STATUS_LABEL,
  PAGAMENTO_STATUS_VARIANT as STATUS_VARIANT,
} from '@/lib/status-labels';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function PagamentosTable({
  pagamentos,
  obras,
  fornecedores,
  categorias,
}: {
  pagamentos: Pagamento[];
  obras: Obra[];
  fornecedores: Fornecedor[];
  categorias: Categoria[];
}) {
  const obraMap = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);
  const fornMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const columns = useMemo<ColumnDef<Pagamento, unknown>[]>(
    () => [
      {
        accessorKey: 'data_pagamento',
        header: 'Data',
        cell: ({ row }) => (
          <span className="obras-orcamento">{formatDate(row.original.data_pagamento)}</span>
        ),
      },
      // `accessorFn` nas três colunas de lookup: sem ele a busca global do
      // TanStack ignora a coluna (só filtra o que tem accessor), e digitar o
      // nome da obra ou do fornecedor devolvia "0 resultados".
      {
        id: 'obra',
        accessorFn: (p) => obraMap.get(p.obra_id)?.nome ?? '',
        header: 'Obra',
        cell: ({ row }) => {
          const obra = obraMap.get(row.original.obra_id);
          if (!obra) return '—';
          return (
            <Link href={`/pagamentos/${row.original.id}`} className="obras-row-link">
              {obra.nome}
            </Link>
          );
        },
      },
      {
        id: 'fornecedor',
        accessorFn: (p) => (p.fornecedor_id ? (fornMap.get(p.fornecedor_id)?.nome ?? '') : ''),
        header: 'Fornecedor',
        cell: ({ row }) => {
          const fid = row.original.fornecedor_id;
          if (!fid) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
          const forn = fornMap.get(fid);
          return forn ? forn.nome : '—';
        },
      },
      {
        id: 'categoria',
        accessorFn: (p) => (p.categoria_id ? (catMap.get(p.categoria_id)?.nome ?? '') : ''),
        header: 'Categoria',
        cell: ({ row }) => {
          const cid = row.original.categoria_id;
          if (!cid) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
          const cat = catMap.get(cid);
          if (!cat) return '—';
          return (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
              }}
            >
              {cat.cor ? (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: cat.cor,
                  }}
                />
              ) : null}
              {cat.nome}
            </span>
          );
        },
      },
      {
        accessorKey: 'valor',
        header: () => <span style={{ textAlign: 'right', display: 'block' }}>Valor</span>,
        meta: { label: 'Valor' },
        cell: ({ row }) => (
          <span
            className="obras-orcamento"
            style={{ display: 'block', textAlign: 'right', fontWeight: 500 }}
          >
            {formatBRL(row.original.valor)}
          </span>
        ),
      },
      {
        accessorKey: 'status_pagto',
        header: 'Status',
        cell: ({ row }) => {
          const isArq = row.original.deleted_at != null;
          if (isArq) return <Badge variant="neutral">Arquivado</Badge>;
          const s = row.original.status_pagto ?? 'confirmado';
          return <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABEL[s]}</Badge>;
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/pagamentos/${row.original.id}/editar`}
            aria-label={`Editar pagamento ${row.original.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <Pencil size={15} aria-hidden="true" />
          </Link>
        ),
      },
    ],
    [obraMap, fornMap, catMap],
  );

  return (
    <DataTable
      columns={columns}
      data={pagamentos}
      searchPlaceholder="Buscar por obra, fornecedor, categoria ou valor..."
      emptyMessage="Nenhum pagamento encontrado. Clique em 'Novo Pagamento' para começar."
    />
  );
}
