import { z } from 'zod';

export const documentoTipoEnum = z.enum(['cnpj', 'cpf']);
export const origemFornecedorEnum = z.enum(['manual', 'auto_detectado']);

/** Remove qualquer caractere não numérico. */
function onlyDigits(v: string): string {
  return v.replace(/\D/gu, '');
}

/** Valida CPF via check digits (11 dígitos). */
function isValidCPF(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/u.test(cpf)) return false; // rejeita 00000000000, 11111111111 etc.

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number.parseInt(cpf.charAt(i)!, 10) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  if (rev !== Number.parseInt(cpf.charAt(9)!, 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number.parseInt(cpf.charAt(i)!, 10) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  return rev === Number.parseInt(cpf.charAt(10)!, 10);
}

/** Valida CNPJ via check digits (14 dígitos). */
function isValidCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/u.test(cnpj)) return false;

  const weightsA = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weightsB = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number.parseInt(cnpj.charAt(i)!, 10) * weightsA[i]!;
  let rev = sum % 11;
  const digit1 = rev < 2 ? 0 : 11 - rev;
  if (digit1 !== Number.parseInt(cnpj.charAt(12)!, 10)) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += Number.parseInt(cnpj.charAt(i)!, 10) * weightsB[i]!;
  rev = sum % 11;
  const digit2 = rev < 2 ? 0 : 11 - rev;
  return digit2 === Number.parseInt(cnpj.charAt(13)!, 10);
}

/**
 * Recebe string do form (com máscara opcional). Normaliza pra dígitos, detecta
 * tipo pelo tamanho, valida check digit. Retorna undefined se input vazio.
 */
const documentoOptional = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (v == null || v === '') return undefined;
    const digits = onlyDigits(v);
    if (digits.length !== 11 && digits.length !== 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)',
      });
      return z.NEVER;
    }
    const tipo: 'cpf' | 'cnpj' = digits.length === 11 ? 'cpf' : 'cnpj';
    const valid = tipo === 'cpf' ? isValidCPF(digits) : isValidCNPJ(digits);
    if (!valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${tipo === 'cpf' ? 'CPF' : 'CNPJ'} inválido (dígito verificador)`,
      });
      return z.NEVER;
    }
    return { documento: digits, documento_tipo: tipo };
  });

const emailOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v == null || v === '' ? undefined : v))
  .refine(
    (v) => v === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(v),
    'E-mail inválido',
  );

const uuidOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v == null || v === '' ? undefined : v))
  .refine(
    (v) => v === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(v),
    'Categoria inválida',
  );

export const FornecedorCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome precisa de pelo menos 2 caracteres').max(200),
  razao_social: z.string().trim().max(200).optional(),
  documento: documentoOptional,
  categoria_id: uuidOptional,
  telefone: z.string().trim().max(30).optional(),
  email: emailOptional,
  ativo: z
    .union([z.literal('on'), z.literal('true'), z.literal(''), z.literal('false')])
    .optional()
    .transform((v) => v === 'on' || v === 'true'),
});

export const FornecedorUpdateSchema = FornecedorCreateSchema.partial().extend({
  id: z.string().uuid('ID inválido'),
});

export type FornecedorCreateInput = z.infer<typeof FornecedorCreateSchema>;
export type FornecedorUpdateInput = z.infer<typeof FornecedorUpdateSchema>;
export type DocumentoTipo = z.infer<typeof documentoTipoEnum>;

/** Formata CPF/CNPJ para exibição a partir dos dígitos crus. */
export function formatDocumento(digits: string | null | undefined, tipo?: 'cpf' | 'cnpj' | null): string {
  if (!digits) return '—';
  const d = digits.replace(/\D/gu, '');
  if (tipo === 'cpf' || d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }
  if (tipo === 'cnpj' || d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  }
  return digits;
}
