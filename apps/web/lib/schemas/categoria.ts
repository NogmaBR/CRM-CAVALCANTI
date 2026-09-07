import { z } from 'zod';

/**
 * Cores permitidas — Nogma DS palette. Restringimos pra manter consistência
 * visual (evita usuário escolher cor que quebra badge/contrast).
 */
export const CATEGORIA_CORES = [
  { value: '#0C4651', label: 'Petróleo' },
  { value: '#CCFF00', label: 'Lime' },
  { value: '#2FA36B', label: 'Verde (sucesso)' },
  { value: '#D6483B', label: 'Vermelho (danger)' },
  { value: '#E8A317', label: 'Amarelo (warning)' },
  { value: '#196E7C', label: 'Petróleo médio' },
  { value: '#565B5B', label: 'Cinza escuro' },
  { value: '#A1A1A1', label: 'Cinza claro' },
] as const;

const corValues = new Set<string>(CATEGORIA_CORES.map((c) => c.value));

export const CategoriaCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(80),
  cor: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v == null || v === '' ? undefined : v))
    .refine((v) => v === undefined || corValues.has(v), 'Cor não suportada'),
  icone: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => (v == null || v === '' ? undefined : v)),
});

export const CategoriaUpdateSchema = CategoriaCreateSchema.partial().extend({
  id: z.string().uuid('ID inválido'),
});

export type CategoriaCreateInput = z.infer<typeof CategoriaCreateSchema>;
export type CategoriaUpdateInput = z.infer<typeof CategoriaUpdateSchema>;
