import { type Completude, rotuloCurto } from '@/lib/completude/regras';
import type { ColumnDef } from '@tanstack/react-table';
import { Semaforo } from './semaforo';

const ORDEM = { critico: 0, parcial: 1, completo: 2 } as const;

/**
 * A coluna "Situação" das tabelas: o semáforo por linha. Pesquisável pelo
 * rótulo ("sem comprovante"), ordenável pelo nível (o vermelho sobe), e
 * vazia para linha arquivada. Mesma coluna nas quatro listas.
 */
export function colunaDeSituacao<T extends { id: string; deleted_at?: string | null }>(
  completude: Record<string, Completude>,
): ColumnDef<T, unknown> {
  return {
    id: 'situacao',
    accessorFn: (linha) => {
      const c = completude[linha.id];
      return c ? rotuloCurto(c) : '';
    },
    header: 'Situação',
    sortingFn: (a, b) => {
      const ca = completude[a.original.id]?.nivel ?? 'completo';
      const cb = completude[b.original.id]?.nivel ?? 'completo';
      return ORDEM[ca] - ORDEM[cb];
    },
    cell: ({ row }) => {
      if (row.original.deleted_at != null) return null;
      const c = completude[row.original.id];
      return c ? <Semaforo completude={c} /> : null;
    },
  };
}
