'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import { DataTable } from '@/components/data-table';
import type { Obra } from '@/lib/data/obras';

const STATUS_VARIANT: Record<NonNullable<Obra['status']>, BadgeVariant> = {
  ativa: 'success',
  pausada: 'warning',
  concluida: 'neutral',
  arquivada: 'neutral',
};

const STATUS_LABEL: Record<NonNullable<Obra['status']>, string> = {
  ativa: 'Ativa',
  pausada: 'Pausada',
  concluida: 'Concluída',
  arquivada: 'Arquivada',
};

function formatBRL(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function ObrasTable({ obras }: { obras: Obra[] }) {
  const columns = useMemo<ColumnDef<Obra, unknown>[]>(
    () => [
      {
        accessorKey: 'nome',
        header: 'Nome',
        cell: ({ row }) => (
          <Link href={`/obras/${row.original.id}`} className="obras-row-link">
            {row.original.nome}
          </Link>
        ),
      },
      {
        accessorKey: 'cliente',
        header: 'Cliente',
        cell: ({ row }) => row.original.cliente ?? '—',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status ?? 'ativa';
          return <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABEL[s]}</Badge>;
        },
      },
      {
        accessorKey: 'orcamento',
        header: 'Orçamento',
        cell: ({ row }) => (
          <span className="obras-orcamento">{formatBRL(row.original.orcamento)}</span>
        ),
      },
      {
        accessorKey: 'data_inicio',
        header: 'Início',
        cell: ({ row }) => formatDate(row.original.data_inicio),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/obras/${row.original.id}/editar`}
            aria-label={`Editar ${row.original.nome}`}
            style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-secondary)' }}
          >
            <Pencil size={15} aria-hidden="true" />
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={obras}
      searchPlaceholder="Buscar por nome ou cliente..."
      emptyMessage="Nenhuma obra encontrada. Clique em 'Nova Obra' para começar."
    />
  );
}
