import { z } from 'zod';

/**
 * Números de WhatsApp autorizados a lançar pagamentos.
 *
 * Esta lista é a fronteira de segurança do fluxo inbound: `processarInbound`
 * descarta qualquer mensagem cujo remetente não esteja aqui, ativo. Sem ela,
 * qualquer número que alcançasse o webhook viraria lançamento no financeiro
 * do cliente (achado A da auditoria de 2026-09-09).
 *
 * A tabela existia desde a primeira migration, mas nunca teve tela nem
 * verificação — cadastrar dependia de rodar SQL à mão.
 */

/**
 * Guarda só dígitos, no mesmo formato que `normalizeTelefone` produz a partir
 * do que o provider manda. É o que torna a comparação possível: o cadastro é
 * digitado como "(51) 99999-8888" e o UAZAPI envia "5551999998888".
 *
 * O DDI é assumido como 55 quando o usuário digita só DDD + número, que é
 * como brasileiro escreve telefone.
 */
export function normalizarTelefoneCadastro(bruto: string): string {
  const digitos = bruto.replace(/\D+/gu, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

const telefone = z
  .string()
  .trim()
  .min(1, 'Informe o telefone')
  .transform(normalizarTelefoneCadastro)
  .refine(
    (v) => v.length >= 12 && v.length <= 15,
    'Telefone inválido. Use DDD + número, ex: (51) 99999-8888',
  );

export const AutorizadoCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(120),
  telefone_whats: telefone,
  papel_obra: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v == null || v === '' ? undefined : v)),
  ativo: z.boolean().optional(),
});

export const AutorizadoUpdateSchema = AutorizadoCreateSchema.partial().extend({
  id: z.string().uuid('ID inválido'),
});

export type AutorizadoCreateInput = z.infer<typeof AutorizadoCreateSchema>;
export type AutorizadoUpdateInput = z.infer<typeof AutorizadoUpdateSchema>;

/** Formata para leitura: 5551999998888 → +55 (51) 99999-8888 */
export function formatarTelefone(digitos: string): string {
  const d = digitos.replace(/\D+/gu, '');
  if (d.length === 13 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return `+${d}`;
}
