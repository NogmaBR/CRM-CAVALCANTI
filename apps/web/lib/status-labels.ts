import type { Database } from '@nogma/db';
import type { BadgeVariant } from '@/components/nogma/Badge';

/**
 * Fonte única dos rótulos e cores de status.
 *
 * Estes mapas estavam duplicados em `pagamentos-table.tsx`,
 * `pagamentos/[id]/page.tsx` e `whatsapp/page.tsx`. Ao adicionar o estado
 * `recusado` (briefing 16/09 §3), os três quebraram no typecheck — o que é
 * a prova de que eram a mesma coisa escrita três vezes. Centralizados aqui,
 * adicionar um estado é uma edição só.
 *
 * Vocabulário: o gestor pediu "pendente / recusado / aprovado". O enum do
 * banco continua `aguardando / recusado / confirmado` porque renomear enum
 * em produção exige migration destrutiva sem ganho real — a tradução mora
 * na camada de apresentação, que é onde ela pertence.
 */

export type PagamentoStatus = Database['public']['Enums']['pagamento_status'];
export type MensagemStatus = Database['public']['Enums']['msg_status'];

export const PAGAMENTO_STATUS_VARIANT: Record<PagamentoStatus, BadgeVariant> = {
  confirmado: 'success',
  aguardando: 'warning',
  recusado: 'danger',
  erro: 'danger',
};

export const PAGAMENTO_STATUS_LABEL: Record<PagamentoStatus, string> = {
  confirmado: 'Aprovado',
  aguardando: 'Pendente',
  recusado: 'Recusado',
  // `erro` é falha técnica de processamento — deliberadamente separado de
  // `recusado`, que é decisão do gestor. Antes os dois caíam no mesmo balde.
  erro: 'Erro no processamento',
};

/** Ordem e rótulos do filtro de status em /pagamentos. */
export const PAGAMENTO_STATUS_FILTROS: Array<{ value: PagamentoStatus | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'aguardando', label: 'Pendente' },
  { value: 'confirmado', label: 'Aprovado' },
  { value: 'recusado', label: 'Recusado' },
  { value: 'erro', label: 'Erro no processamento' },
];

export const MSG_STATUS_VARIANT: Record<MensagemStatus, BadgeVariant> = {
  recebida: 'neutral',
  processando: 'warning',
  classificada: 'warning',
  confirmada: 'success',
  recusada: 'danger',
  erro: 'danger',
};

export const MSG_STATUS_LABEL: Record<MensagemStatus, string> = {
  recebida: 'Recebida',
  processando: 'Processando',
  classificada: 'Aguarda confirmação',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
  erro: 'Erro no processamento',
};
