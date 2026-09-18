'use client';

import { colunaDeSituacao } from '@/components/completude/coluna-situacao';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/nogma/Badge';
import type { Completude } from '@/lib/completude/regras';
import type { Categoria } from '@/lib/data/categorias';
import type { Fornecedor } from '@/lib/data/fornecedores';
import { formatDocumento } from '@/lib/schemas/fornecedor';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

export function FornecedoresTable({
  fornecedores,
  categorias,
  completude,
}: {
  fornecedores: Fornecedor[];
  categorias: Categoria[];
  /** Semáforo por fornecedor (CNPJ, telefone, categoria…). */
  completude?: Record<string, Completude>;
}) {
  const catMap = useMemo(() => {
    const m = new Map<string, Categoria>();
    for (const c of categorias) m.set(c.id, c);
    return m;
  }, [categorias]);

  const columns = useMemo<ColumnDef<Fornecedor, unknown>[]>(
    () => [
      {
        accessorKey: 'nome',
        header: 'Nome',
        cell: ({ row }) => (
          <Link href={`/fornecedores/${row.original.id}`} className="obras-row-link">
            {row.original.nome}
          </Link>
        ),
      },
      {
        accessorKey: 'documento',
        header: 'Documento',
        cell: ({ row }) => (
          <span className="obras-orcamento">
            {formatDocumento(row.original.documento, row.original.documento_tipo)}
          </span>
        ),
      },
      {
        id: 'categoria',
        header: 'Categoria',
        cell: ({ row }) => {
          const catId = row.original.categoria_id;
          if (!catId) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
          const cat = catMap.get(catId);
          if (!cat) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
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
      ...(completude ? [colunaDeSituacao<Fornecedor>(completude)] : []),
      {
        accessorKey: 'telefone',
        header: 'Telefone',
        cell: ({ row }) => row.original.telefone ?? '—',
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const isArchived = row.original.deleted_at != null;
          const isActive = row.original.ativo === true && !isArchived;
          if (isArchived) return <Badge variant="neutral">Arquivado</Badge>;
          if (isActive) return <Badge variant="success">Ativo</Badge>;
          return <Badge variant="warning">Inativo</Badge>;
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/fornecedores/${row.original.id}/editar`}
            aria-label={`Editar ${row.original.nome}`}
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
    [catMap, completude],
  );

  return (
    <DataTable
      columns={columns}
      data={fornecedores}
      searchPlaceholder="Buscar por nome, razão social ou documento..."
      emptyMessage="Nenhum fornecedor encontrado. Clique em 'Novo Fornecedor' para começar."
    />
  );
}
