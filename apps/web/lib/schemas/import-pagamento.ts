import { z } from 'zod';

/**
 * Schema Zod pra 1 linha do CSV de import de pagamentos.
 *
 * Colunas esperadas (case-insensitive, headers normalizados no parser):
 *   obra              — nome da obra (matching case-insensitive)
 *   fornecedor        — nome do fornecedor (opcional; se ausente, pagamento sem fornecedor)
 *   categoria         — nome da categoria (opcional)
 *   valor             — R$ formato pt-BR ou EN (1.234,56 ou 1234.56)
 *   data_pagamento    — YYYY-MM-DD OU DD/MM/YYYY
 *   origem            — 'whatsapp' | 'manual' | 'importado' (default 'importado')
 *   status_pagto      — 'confirmado' | 'aguardando' | 'erro' (default 'confirmado')
 *   descricao         — texto livre opcional
 *   observacoes       — texto livre opcional
 */

function parseValorBR(input: string): number {
  const s = input.trim().replace(/R\$\s*/gu, '');
  // Se tem vírgula E ponto → assume pt-BR (1.234,56)
  // Se só tem ponto → assume EN (1234.56)
  // Se só vírgula → pt-BR (1234,56)
  if (s.includes(',') && s.includes('.')) {
    const dotBeforeComma = s.lastIndexOf('.') < s.lastIndexOf(',');
    return dotBeforeComma ? Number(s.replace(/\./gu, '').replace(',', '.')) : Number(s.replace(/,/gu, ''));
  }
  if (s.includes(',')) return Number(s.replace(',', '.'));
  return Number(s);
}

function parseDataBR(input: string): string | null {
  const s = input.trim();
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/u.test(s)) return s;
  // BR DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/u);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export const ImportPagamentoRowSchema = z
  .object({
    obra: z.string().trim().min(1, 'Obra obrigatória'),
    fornecedor: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v == null || v === '' ? undefined : v)),
    categoria: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v == null || v === '' ? undefined : v)),
    valor: z.string().transform((v, ctx) => {
      const n = parseValorBR(v);
      if (!Number.isFinite(n) || n <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valor inválido' });
        return z.NEVER;
      }
      return n;
    }),
    data_pagamento: z.string().transform((v, ctx) => {
      const iso = parseDataBR(v);
      if (!iso) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida (use DD/MM/AAAA ou AAAA-MM-DD)' });
        return z.NEVER;
      }
      return iso;
    }),
    origem: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v == null || v === '' ? 'importado' : v.toLowerCase()))
      .pipe(z.enum(['whatsapp', 'manual', 'importado'])),
    status_pagto: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v == null || v === '' ? 'confirmado' : v.toLowerCase()))
      .pipe(z.enum(['confirmado', 'aguardando', 'erro'])),
    descricao: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v == null || v === '' ? undefined : v)),
    observacoes: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v == null || v === '' ? undefined : v)),
  })
  .strict()
  .transform((data) => data);

export type ImportPagamentoRow = z.infer<typeof ImportPagamentoRowSchema>;

/** Template CSV (linha 1 = headers, linha 2 = exemplo) pra download. */
export const CSV_TEMPLATE = [
  'obra,fornecedor,categoria,valor,data_pagamento,origem,status_pagto,descricao,observacoes',
  'Obra Alpha,Casa das Tintas,Material,"R$ 1.250,00",15/09/2026,manual,confirmado,Cimento CP-2,',
].join('\r\n');
