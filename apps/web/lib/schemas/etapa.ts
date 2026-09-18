import { parseValorBR } from '@/lib/util/moeda';
import { z } from 'zod';

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Data inválida (use AAAA-MM-DD)');

const opcional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

/** 0–100, aceita "45", "45,5" e "45%". */
const percentual = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    const limpo = v.replace('%', '').replace(',', '.').trim();
    if (limpo === '') return undefined;
    const n = Number(limpo);
    return Number.isFinite(n) ? n : v;
  },
  z
    .number({ required_error: 'obrigatório', invalid_type_error: 'informe um número de 0 a 100' })
    .min(0, 'mínimo 0')
    .max(100, 'máximo 100'),
);

/** Valor em reais como o brasileiro digita ("1.250,00"). */
const valorBR = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    if (v.trim() === '') return undefined;
    return parseValorBR(v);
  },
  z
    .number({ required_error: 'obrigatório', invalid_type_error: 'informe um valor como 1.250,00' })
    .positive('precisa ser maior que zero'),
);

/** Etapa nova do cronograma físico. */
export const EtapaCreateSchema = z.object({
  obra_id: z.string().uuid('Obra inválida'),
  nome: z.string().trim().min(2, 'mínimo 2 caracteres').max(120, 'no máximo 120 caracteres'),
  peso: opcional(
    z.preprocess(
      (v) => (typeof v === 'string' ? Number(v.replace(',', '.')) : v),
      z.number().positive('o peso precisa ser maior que zero').max(1000),
    ),
  ),
  percentual_concluido: opcional(percentual),
  categoria_id: opcional(z.string().uuid('Etapa do plano de contas inválida')),
  data_prevista: opcional(isoDate),
});

/** Medição: o % de uma etapa que já existe. */
export const MedicaoSchema = z.object({
  id: z.string().uuid('Etapa inválida'),
  obra_id: z.string().uuid('Obra inválida'),
  percentual_concluido: percentual,
  medido_em: opcional(isoDate),
});

/** Orçado de uma categoria numa obra (upsert). */
export const OrcamentoEtapaSchema = z.object({
  obra_id: z.string().uuid('Obra inválida'),
  categoria_id: z.string().uuid('Escolha a etapa'),
  valor: valorBR,
});

export type EtapaCreateInput = z.infer<typeof EtapaCreateSchema>;
export type MedicaoInput = z.infer<typeof MedicaoSchema>;
export type OrcamentoEtapaInput = z.infer<typeof OrcamentoEtapaSchema>;
