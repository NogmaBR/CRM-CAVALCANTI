'use client';

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/nogma/Input';
import './data-table.css';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado.',
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
          />
        </div>
        <div className="nos-dt__count">
          {table.getFilteredRowModel().rows.length} resultado{table.getFilteredRowModel().rows.length === 1 ? '' : 's'}
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
                    className={header.column.getCanSort() ? 'nos-dt__th nos-dt__th--sortable' : 'nos-dt__th'}
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
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="nos-dt__tr">
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
