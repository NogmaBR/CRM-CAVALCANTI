'use client';

import { Miniatura } from '@/components/arquivos/miniatura';
import { colunaDeSituacao } from '@/components/completude/coluna-situacao';
import { DataTable } from '@/components/data-table';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import type { Completude } from '@/lib/completude/regras';
import type { Documento } from '@/lib/data/documentos';
import type { Fornecedor } from '@/lib/data/fornecedores';
import type { Obra } from '@/lib/data/obras';
import { ANEXO_TIPO_LABELS, type AnexoTipo, formatBytes } from '@/lib/schemas/documento';
import { CATEGORIA_LABELS } from '@/lib/status-labels';
import type { ColumnDef } from '@tanstack/react-table';
import { FileText, Image as ImageIcon, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

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
  filtrando = false,
  completude,
}: {
  documentos: Documento[];
  obras: Obra[];
  fornecedores: Fornecedor[];
  /** Há busca ou filtro ativo na página: o vazio é "nada bateu", não "não há documentos". */
  filtrando?: boolean;
  /** Semáforo por documento (obra, pagamento ligado, nº da NF…). */
  completude?: Record<string, Completude>;
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
          const ehImagem = row.original.mime_type.startsWith('image/');
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {ehImagem ? (
                <Miniatura
                  origem="documento"
                  id={row.original.id}
                  mime={row.original.mime_type}
                  nome={row.original.nome_arquivo}
                  tamanho={32}
                />
              ) : (
                <Icon size={14} aria-hidden="true" style={{ opacity: 0.6 }} />
              )}
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
        accessorKey: 'categoria',
        header: 'Pasta',
        cell: ({ row }) => {
          const c = CATEGORIA_LABELS[row.original.categoria];
          return (
            <span style={{ whiteSpace: 'nowrap' }}>
              <span aria-hidden="true">{c.icone}</span> {c.rotulo}
            </span>
          );
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
      ...(completude ? [colunaDeSituacao<Documento>(completude)] : []),
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
        meta: { label: 'Tamanho' },
        cell: ({ row }) => (
          <span className="obras-orcamento" style={{ display: 'block', textAlign: 'right' }}>
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
    [obraMap, fornMap, completude],
  );

  return (
    // A busca é a da página (cobre arquivo, NF, fornecedor e obra); a interna
    // da tabela só repetia parte dela e confundia qual valia.
    <DataTable
      columns={columns}
      data={documentos}
      semBusca
      emptyMessage={
        filtrando
          ? 'Nenhum documento bate com a busca ou os filtros.'
          : "Nenhum documento encontrado. Clique em 'Novo Documento' para começar."
      }
    />
  );
}
