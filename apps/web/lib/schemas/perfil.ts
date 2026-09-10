import { z } from 'zod';

/** Enum matches Postgres `tema_preferido` type (light|black|dark). */
export const temaEnum = z.enum(['light', 'black', 'dark']);
export type Tema = z.infer<typeof temaEnum>;

export const TEMA_LABELS: Record<Tema, string> = {
  light: 'Claro',
  black: 'Preto (padrão Nogma)',
  dark: 'Petróleo (dark alt)',
};

/** Whitelist de timezones populares no BR + globals — evita input livre. */
export const TIMEZONE_OPTIONS = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (UTC−03)' },
  { value: 'America/Manaus', label: 'Manaus (UTC−04)' },
  { value: 'America/Belem', label: 'Belém (UTC−03)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (UTC−03)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (UTC−04)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC−05)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC−02)' },
  { value: 'UTC', label: 'UTC (referência global)' },
] as const;

const timezoneWhitelist = new Set<string>(TIMEZONE_OPTIONS.map((t) => t.value));

/**
 * Schema pra update do próprio perfil. Todos os campos opcionais —
 * update parcial via `...(x !== undefined ? { x } : {})` pattern no action.
 */
export const PerfilUpdateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100).optional(),
  telefone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D+/gu, ''))
    .refine((v) => v.length === 0 || (v.length >= 10 && v.length <= 13), 'Telefone inválido')
    .optional(),
  tema: temaEnum.optional(),
  timezone: z
    .string()
    .refine((v) => timezoneWhitelist.has(v), 'Timezone não suportado')
    .optional(),
});

export type PerfilUpdateInput = z.infer<typeof PerfilUpdateSchema>;
