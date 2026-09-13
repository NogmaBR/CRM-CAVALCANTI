import { z } from 'zod';

/**
 * O que o classificador (mock ou modelo real) escreve em
 * `mensagens_whats.dados_extraidos`, e o que o "SIM" lê de lá para virar
 * linha em `pagamentos`.
 *
 * Até a revisão gstack de 2026-09-12 esse JSONB entrava no INSERT com um
 * cast (`as DadosExtraidos`) e `!`: um `valor: "1.200"` editado à mão no
 * painel, ou uma saída inesperada do modelo, virava erro cru do Postgres no
 * meio da confirmação. Agora tudo passa por aqui. Chave desconhecida é
 * descartada (não é erro: o modelo pode ganhar campos antes do código);
 * valor inválido zera o campo e a confirmação cai em `dados_incompletos`,
 * que é o caminho humano.
 */
export const DadosExtraidosSchema = z.object({
  valor: z.number().finite().positive().max(1_000_000_000).optional(),
  data_pagamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'data no formato YYYY-MM-DD')
    .optional(),
  obra_id: z.string().uuid().optional(),
  fornecedor_id: z.string().uuid().optional(),
  fornecedor_nome_novo: z.string().trim().min(1).max(200).optional(),
  tipo_documento: z.enum(['nota_fiscal', 'comprovante', 'contrato', 'outro']).optional(),
  numero_nf: z.string().trim().min(1).max(60).optional(),
  descricao: z.string().trim().min(1).max(500).optional(),
  raciocinio: z.string().max(2000).optional(),
});

export type DadosExtraidos = z.infer<typeof DadosExtraidosSchema>;

/** Dados que bastam para lançar: valor e obra presentes. */
export type DadosLancaveis = DadosExtraidos & { valor: number; obra_id: string };

/**
 * Lê o JSONB com tolerância: campo inválido é descartado, o resto sobrevive.
 * `null` só quando não é um objeto. Nunca lança — quem chama decide se os
 * campos que sobraram bastam (`temDadosParaLancar`).
 */
export function lerDadosExtraidos(bruto: unknown): DadosExtraidos | null {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null;
  const inteiro = DadosExtraidosSchema.safeParse(bruto);
  if (inteiro.success) return inteiro.data;

  // Campo a campo: o que passa fica; o que não passa some.
  const limpo: Record<string, unknown> = {};
  for (const [chave, schema] of Object.entries(DadosExtraidosSchema.shape)) {
    const v = (bruto as Record<string, unknown>)[chave];
    if (v === undefined || v === null) continue;
    const r = schema.safeParse(v);
    if (r.success) limpo[chave] = r.data;
  }
  return limpo as DadosExtraidos;
}

export function temDadosParaLancar(d: DadosExtraidos | null): d is DadosLancaveis {
  return d != null && typeof d.valor === 'number' && typeof d.obra_id === 'string';
}
