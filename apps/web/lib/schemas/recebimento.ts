import { parseValorBR } from '@/lib/util/moeda';
import { z } from 'zod';

const isoDateRequired = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Data inválida (use AAAA-MM-DD)');

/** Valor como o brasileiro digita (mesma regra do pagamento), e tem que ser > 0. */
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
    .positive('precisa ser maior que zero'),
);

/**
 * Parcela recebida do cliente da obra. É o outro lado do `pagamentos`: o que
 * entra. Resultado da obra = recebido − gasto.
 */
export const RecebimentoCreateSchema = z.object({
  obra_id: z.string().uuid('Obra inválida'),
  valor: valorBR,
  data_recebimento: isoDateRequired,
  descricao: z
    .string()
    .trim()
    .max(200, 'no máximo 200 caracteres')
    .optional()
    .transform((v) => (v ? v : undefined)),
  observacoes: z
    .string()
    .trim()
    .max(1000, 'no máximo 1000 caracteres')
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type RecebimentoCreateInput = z.infer<typeof RecebimentoCreateSchema>;
