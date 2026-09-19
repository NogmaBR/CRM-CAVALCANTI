import { Badge } from '@/components/nogma/Badge';
import type { Completude } from '@/lib/completude/regras';
import type { ColumnDef } from '@tanstack/react-table';
import { CircleCheck, CircleX } from 'lucide-react';
import Link from 'next/link';

/**
 * A coluna "Comprovante" da lista de pagamentos: ✓ verde quando há nota ou
 * comprovante, ✗ vermelho quando falta — sem precisar abrir o lançamento.
 *
 * O semáforo (coluna Situação) já pintava de vermelho quem não tem
 * comprovante, mas junto com outras faltas. A reunião de 18/09 pediu o dado
 * sozinho, visível na listagem: é a pergunta que o Cavalcanti mais faz.
 * Ordenável (o que falta sobe) e pesquisável ("sem comprovante").
 */
export type EstadoDoComprovante = 'tem' | 'falta' | 'nao_se_aplica';

export function estadoDoComprovante(c: Completude | undefined): EstadoDoComprovante {
  if (!c) return 'nao_se_aplica';
  if (c.faltas.some((f) => f.chave === 'comprovante')) return 'falta';
  // Recusado não precisa de comprovante: a regra nem aponta a falta.
  return 'tem';
}

const ORDEM: Record<EstadoDoComprovante, number> = { falta: 0, tem: 1, nao_se_aplica: 2 };

export function colunaDeComprovante<
  T extends { id: string; deleted_at?: string | null; status_pagto?: string | null },
>(completude: Record<string, Completude>): ColumnDef<T, unknown> {
  return {
    id: 'comprovante',
    accessorFn: (linha) => {
      const e = estadoDoComprovante(completude[linha.id]);
      return e === 'falta' ? 'sem comprovante' : e === 'tem' ? 'com comprovante' : '';
    },
    header: 'Comprovante',
    sortingFn: (a, b) =>
      ORDEM[estadoDoComprovante(completude[a.original.id])] -
      ORDEM[estadoDoComprovante(completude[b.original.id])],
    cell: ({ row }) => {
      if (row.original.deleted_at != null) return null;
      if (row.original.status_pagto === 'recusado') {
        return <span style={{ color: 'var(--text-muted)' }}>—</span>;
      }
      const e = estadoDoComprovante(completude[row.original.id]);
      if (e === 'nao_se_aplica') return null;
      if (e === 'falta') {
        return (
          <Link
            href={`/pagamentos/${row.original.id}#comprovante`}
            style={{ textDecoration: 'none' }}
            title="Sem nota nem comprovante. Clique para anexar."
          >
            <Badge variant="danger" className="comprovante comprovante--falta">
              <CircleX size={13} aria-hidden="true" /> Falta
            </Badge>
          </Link>
        );
      }
      return (
        <Badge variant="success" className="comprovante comprovante--tem" title="Tem comprovante">
          <CircleCheck size={13} aria-hidden="true" /> Anexado
        </Badge>
      );
    },
  };
}
