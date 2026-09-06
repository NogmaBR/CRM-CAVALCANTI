'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import { DataTable } from '@/components/data-table';
import type { Categoria } from '@/lib/data/categorias';
import type { Fornecedor } from '@/lib/data/fornecedores';
import type { Obra } from '@/lib/data/obras';
import type { Pagamento } from '@/lib/data/pagamentos';
import { formatBRL } from '@/lib/schemas/pagamento';

const STATUS_VARIANT: Record<NonNullable<Pagamento['status_pagto']>, BadgeVariant> = {
  confirmado: 'success',
  aguardando: 'warning',
  erro: 'danger',
};

const STATUS_LABEL: Record<NonNullable<Pagamento['status_pagto']>, string> = {
  confirmado: 'Confirmado',
  aguardando: 'Aguardando',
  erro: 'Erro',
};

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
      {
        id: 'obra',
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
      searchPlaceholder="Buscar por descrição ou observações..."
      emptyMessage="Nenhum pagamento encontrado. Clique em 'Novo Pagamento' para começar."
    />
  );
}
