'use client';

import Link from 'next/link';
import { useMemo, useState, useRef, useEffect } from 'react';
import type { ColumnDef, RowSelectionState, SortingState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Archive, ChevronDown, ChevronUp, Pencil, Search, X } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import { Button } from '@/components/nogma/Button';
import { Checkbox } from '@/components/nogma/Checkbox';
import { Input } from '@/components/nogma/Input';
import type { Obra } from '@/lib/data/obras';
import { bulkArchiveObras } from './actions';
import '@/components/data-table.css';

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

/**
 * Header "select all" checkbox — needs indeterminate state which requires
 * a DOM ref. Nogma Checkbox doesn't forwardRef, so we use a plain input
 * styled consistently via Checkbox CSS class.
 */
function IndeterminateCheckbox({
  indeterminate,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate ?? false;
    }
  }, [indeterminate]);

  return (
    <label className="ng-check" style={{ cursor: 'pointer' }}>
      <input ref={ref} type="checkbox" {...rest} />
      <span className="ng-check__box">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    </label>
  );
}

export function ObrasTable({
  obras,
  successMessage,
  errorMessage,
}: {
  obras: Obra[];
  successMessage?: string;
  errorMessage?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const formRef = useRef<HTMLFormElement>(null);

  const columns = useMemo<ColumnDef<Obra, unknown>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        header: ({ table }) => (
          <IndeterminateCheckbox
            aria-label="Selecionar todas"
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Selecionar ${row.original.nome}`}
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
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

  const table = useReactTable({
    data: obras,
    columns,
    getRowId: (row) => row.id,
    enableRowSelection: (row) => row.original.deleted_at == null,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const selectedIds = Object.entries(rowSelection)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const hasSelection = selectedIds.length > 0;

  function handleBulkArchive() {
    const n = selectedIds.length;
    const confirmed = window.confirm(
      `Arquivar ${n} obra(s)? A acao e reversivel — filtre por "Arquivadas" para restaurar.`,
    );
    if (confirmed) {
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Banners */}
      {successMessage ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: 'var(--success-bg)',
            border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
            color: 'var(--success)',
            fontSize: 14,
          }}
        >
          {successMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: 'var(--danger-bg)',
            border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
            color: 'var(--danger)',
            fontSize: 14,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {/* Bulk action bar — only visible when rows are selected */}
      {hasSelection ? (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            borderRadius: 10,
            background: 'var(--surface-2, #1a1a1a)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{ fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>
            {selectedIds.length} obra(s) selecionada(s)
          </span>

          {/* Hidden form for bulk archive server action */}
          <form ref={formRef} action={bulkArchiveObras} style={{ display: 'contents' }}>
            <input type="hidden" name="ids" value={JSON.stringify(selectedIds)} />
            <Button
              type="button"
              variant="danger"
              size="sm"
              leadingIcon={<Archive size={14} />}
              onClick={handleBulkArchive}
            >
              Arquivar
            </Button>
          </form>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<X size={14} />}
            onClick={() => setRowSelection({})}
          >
            Cancelar selecao
          </Button>
        </div>
      ) : null}

      {/* Table */}
      <div className="nos-dt">
        <div className="nos-dt__toolbar">
          <div className="nos-dt__search">
            <Input
              leading={<Search size={15} aria-hidden="true" />}
              placeholder="Buscar por nome ou cliente..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              aria-label="Buscar"
            />
          </div>
          <div className="nos-dt__count">
            {table.getFilteredRowModel().rows.length} resultado
            {table.getFilteredRowModel().rows.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="nos-dt__scroll">
          <table className="nos-dt__table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={
                        header.column.getCanSort()
                          ? 'nos-dt__th nos-dt__th--sortable'
                          : 'nos-dt__th'
                      }
                      onClick={header.column.getToggleSortingHandler()}
                      aria-sort={
                        header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                            ? 'descending'
                            : 'none'
                      }
                    >
                      <span className="nos-dt__th-inner">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ChevronUp size={13} aria-hidden="true" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ChevronDown size={13} aria-hidden="true" />
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="nos-dt__empty">
                    Nenhuma obra encontrada. Clique em &lsquo;Nova Obra&rsquo; para comecar.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="nos-dt__tr"
                    aria-selected={row.getIsSelected() ? 'true' : undefined}
                    style={
                      row.getIsSelected()
                        ? { background: 'var(--surface-2, rgba(255,255,255,0.04))' }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="nos-dt__td">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {table.getPageCount() > 1 ? (
          <div className="nos-dt__pagination">
            <button
              type="button"
              className="nos-dt__page-btn"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </button>
            <span className="nos-dt__page-info">
              Pagina {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
            </span>
            <button
              type="button"
              className="nos-dt__page-btn"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Proxima
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
