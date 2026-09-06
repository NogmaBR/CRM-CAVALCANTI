'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, FileText, Image as ImageIcon } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import { DataTable } from '@/components/data-table';
import type { Fornecedor } from '@/lib/data/fornecedores';
import type { Obra } from '@/lib/data/obras';
import type { Documento } from '@/lib/data/documentos';
import { ANEXO_TIPO_LABELS, formatBytes, type AnexoTipo } from '@/lib/schemas/documento';

const TIPO_VARIANT: Record<AnexoTipo, BadgeVariant> = {
  nota_fiscal: 'success',
  comprovante: 'warning',
  contrato: 'neutral',
  outro: 'neutral',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
}

function iconForMime(mime: string): typeof FileText {
  if (mime.startsWith('image/')) return ImageIcon;
  return FileText;
}

export function DocumentosTable({
  documentos,
  obras,
  fornecedores,
}: {
  documentos: Documento[];
  obras: Obra[];
  fornecedores: Fornecedor[];
}) {
  const obraMap = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);
  const fornMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);

  const columns = useMemo<ColumnDef<Documento, unknown>[]>(
    () => [
      {
        accessorKey: 'nome_arquivo',
        header: 'Arquivo',
        cell: ({ row }) => {
          const Icon = iconForMime(row.original.mime_type);
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icon size={14} aria-hidden="true" style={{ opacity: 0.6 }} />
              <Link href={`/documentos/${row.original.id}`} className="obras-row-link">
                {row.original.nome_arquivo}
              </Link>
            </span>
          );
        },
      },
      {
        accessorKey: 'tipo',
        header: 'Tipo',
        cell: ({ row }) => {
          const isArq = row.original.deleted_at != null;
          if (isArq) return <Badge variant="neutral">Arquivado</Badge>;
          const t = row.original.tipo as AnexoTipo;
          return <Badge variant={TIPO_VARIANT[t]}>{ANEXO_TIPO_LABELS[t]}</Badge>;
        },
      },
      {
        id: 'obra',
        header: 'Obra',
        cell: ({ row }) => {
          const id = row.original.obra_id;
          if (!id) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
          const obra = obraMap.get(id);
          return obra ? obra.nome : '—';
        },
      },
      {
        id: 'fornecedor',
        header: 'Fornecedor',
        cell: ({ row }) => {
          const id = row.original.fornecedor_id;
          if (!id) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
          const f = fornMap.get(id);
          return f ? f.nome : '—';
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Data',
        cell: ({ row }) => (
          <span className="obras-orcamento">{formatDate(row.original.created_at)}</span>
        ),
      },
      {
        accessorKey: 'tamanho_bytes',
        header: () => <span style={{ textAlign: 'right', display: 'block' }}>Tamanho</span>,
        cell: ({ row }) => (
          <span
            className="obras-orcamento"
            style={{ display: 'block', textAlign: 'right' }}
          >
            {formatBytes(row.original.tamanho_bytes)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/documentos/${row.original.id}/editar`}
            aria-label={`Editar ${row.original.nome_arquivo}`}
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
    [obraMap, fornMap],
  );

  return (
    <DataTable
      columns={columns}
      data={documentos}
      searchPlaceholder="Buscar por nome ou número da NF..."
      emptyMessage="Nenhum documento encontrado. Clique em 'Novo Documento' para começar."
    />
  );
}
