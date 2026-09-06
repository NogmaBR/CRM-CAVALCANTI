import { z } from 'zod';

export const pagamentoOrigemEnum = z.enum(['whatsapp', 'manual', 'importado']);
export const pagamentoStatusEnum = z.enum(['confirmado', 'aguardando', 'erro']);

const isoDateRequired = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Data inválida (use AAAA-MM-DD)');

const valorRequired = z
  .string()
  .trim()
  .min(1, 'Valor é obrigatório')
  .transform((v, ctx) => {
    // Aceita "1.234,56" (pt-BR) e "1234.56" (padrão)
    const normalized = v.includes(',')
      ? v.replace(/\./gu, '').replace(',', '.')
      : v;
    const n = Number(normalized);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valor inválido (deve ser ≥ 0)',
      });
      return z.NEVER;
    }
    return n;
  });

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
    (v) => v === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(v),
    'ID inválido',
  );

export const PagamentoCreateSchema = z.object({
  obra_id: uuidRequired,
  fornecedor_id: uuidOptional,
  categoria_id: uuidOptional,
  valor: valorRequired,
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
export function formatBRL(n: number | string | null | undefined, opts: { compact?: boolean } = {}): string {
  if (n == null || n === '') return '—';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: opts.compact ? 0 : 2,
  });
}
