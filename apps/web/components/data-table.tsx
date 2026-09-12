'use client';

import { EmptyState } from '@/components/nogma/EmptyState';
import { Input } from '@/components/nogma/Input';
import {
  type Column,
  type ColumnDef,
  type RowData,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, Inbox, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import './data-table.css';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Rótulo da célula no celular (quando o header não é uma string). */
    label?: string;
  }
}

/**
 * Rótulo que aparece antes de cada célula no celular, onde a tabela vira
 * uma pilha de cartões (ver `data-table.css`). Header string → ele mesmo;
 * header em JSX → `meta.label`; sem nenhum → célula sem rótulo.
 */
export function rotuloDaColuna<TData>(col: Column<TData, unknown>): string {
  const h = col.columnDef.header;
  if (typeof h === 'string') return h;
  return col.columnDef.meta?.label ?? '';
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Ação do estado vazio (ex.: botão "Nova obra"). */
  emptyAction?: ReactNode;
  emptyIcon?: ReactNode;
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado.',
  emptyAction,
  emptyIcon,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const total = table.getFilteredRowModel().rows.length;
  const filtrando = globalFilter.trim().length > 0;

  return (
    <div className="nos-dt">
      <div className="nos-dt__toolbar">
        <div className="nos-dt__search">
          <Input
            leading={<Search size={15} aria-hidden="true" />}
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            aria-label="Buscar"
            type="search"
          />
        </div>
        <div className="nos-dt__count" aria-live="polite">
          {total} resultado{total === 1 ? '' : 's'}
        </div>
      </div>
      {table.getRowModel().rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon ?? <Inbox size={26} aria-hidden="true" />}
          title={filtrando ? 'Nada encontrado com esse termo' : emptyMessage}
          actions={filtrando ? undefined : emptyAction}
        >
          {filtrando ? 'Tente outra palavra ou limpe a busca.' : undefined}
        </EmptyState>
      ) : (
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
                      tabIndex={header.column.getCanSort() ? 0 : undefined}
                      onClick={header.column.getToggleSortingHandler()}
                      onKeyDown={(e) => {
                        if (header.column.getCanSort() && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          header.column.toggleSorting();
                        }
                      }}
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
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="nos-dt__tr">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="nos-dt__td"
                      data-col={cell.column.id}
                      data-label={rotuloDaColuna(cell.column)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </span>
          <button
            type="button"
            className="nos-dt__page-btn"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  );
}
