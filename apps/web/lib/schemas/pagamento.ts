import { parseValorBR } from '@/lib/util/moeda';
import { z } from 'zod';

export const pagamentoOrigemEnum = z.enum(['whatsapp', 'manual', 'importado']);
export const pagamentoStatusEnum = z.enum(['confirmado', 'aguardando', 'recusado', 'erro']);

const isoDateRequired = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Data inválida (use AAAA-MM-DD)');

/**
 * Valor como o brasileiro digita: "1.250,00", "1250,00", "1250.00",
 * "R$ 1.250,00" ou "1250" (`parseValorBR`, com teste). Vazio é "obrigatório";
 * texto que não é número vira uma frase com o formato esperado — as duas
 * mensagens já saem em português, então `form-erros.ts` não precisa traduzir.
 */
const valorBR = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    if (v.trim() === '') return undefined;
    return parseValorBR(v);
  },
  z
    .number({
      required_error: 'obrigatório',
      invalid_type_error: 'informe um valor como 1.250,00',
    })
    .min(0, 'não pode ser negativo'),
);

const uuidRequired = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu, 'ID inválido');

const uuidOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v == null || v === '' ? undefined : v))
  .refine(
    (v) =>
      v === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(v),
    'ID inválido',
  );

export const PagamentoCreateSchema = z.object({
  obra_id: uuidRequired,
  fornecedor_id: uuidOptional,
  categoria_id: uuidOptional,
  valor: valorBR,
  data_pagamento: isoDateRequired,
  origem: pagamentoOrigemEnum.default('manual'),
  status_pagto: pagamentoStatusEnum.default('confirmado'),
  descricao: z.string().trim().max(500).optional(),
  observacoes: z.string().trim().max(2000).optional(),
});

export const PagamentoUpdateSchema = PagamentoCreateSchema.partial().extend({
  id: z.string().uuid('ID inválido'),
});

export type PagamentoCreateInput = z.infer<typeof PagamentoCreateSchema>;
export type PagamentoUpdateInput = z.infer<typeof PagamentoUpdateSchema>;
export type PagamentoOrigem = z.infer<typeof pagamentoOrigemEnum>;
export type PagamentoStatus = z.infer<typeof pagamentoStatusEnum>;

/** Formata valor NUMERIC(12,2) como BRL. */
export function formatBRL(
  n: number | string | null | undefined,
  opts: { compact?: boolean } = {},
): string {
  if (n == null || n === '') return '—';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: opts.compact ? 0 : 2,
  });
}
