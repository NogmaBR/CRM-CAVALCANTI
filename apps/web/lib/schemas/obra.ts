import { z } from 'zod';

export const obraTipoEnum = z.enum(['nova', 'reforma']);
export const obraStatusEnum = z.enum(['ativa', 'pausada', 'concluida', 'arquivada']);

// Endereço estruturado (opcional — cada campo é opt).
const enderecoSchema = z
  .object({
    cep: z.string().trim().max(9).optional(),
    rua: z.string().trim().max(200).optional(),
    numero: z.string().trim().max(20).optional(),
    bairro: z.string().trim().max(100).optional(),
    cidade: z.string().trim().max(100).optional(),
    uf: z.string().trim().length(2).toUpperCase().optional(),
  })
  .partial()
  .optional();

const isoDateOptional = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Data inválida (use AAAA-MM-DD)')
  .optional()
  .or(z.literal('').transform(() => undefined));

const orcamentoOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v == null || v === '' ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), 'Orçamento deve ser ≥ 0');

const apelidosOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) =>
    v == null || v === '' ? [] : v.split(',').map((s) => s.trim()).filter(Boolean),
  );

export const ObraCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome precisa de pelo menos 2 caracteres').max(200),
  cliente: z.string().trim().max(200).optional(),
  tipo: obraTipoEnum.optional(),
  status: obraStatusEnum.default('ativa'),
  orcamento: orcamentoOptional,
  data_inicio: isoDateOptional,
  data_prevista_fim: isoDateOptional,
  endereco: enderecoSchema,
  apelidos: apelidosOptional,
  observacoes: z.string().trim().max(2000).optional(),
});

export const ObraUpdateSchema = ObraCreateSchema.partial().extend({
  id: z.string().uuid('ID inválido'),
});

export type ObraCreateInput = z.infer<typeof ObraCreateSchema>;
export type ObraUpdateInput = z.infer<typeof ObraUpdateSchema>;
export type ObraStatus = z.infer<typeof obraStatusEnum>;
export type ObraTipo = z.infer<typeof obraTipoEnum>;
