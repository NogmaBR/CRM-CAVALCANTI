import { z } from 'zod';

/**
 * Grupo de WhatsApp em que o agente age.
 *
 * O `chat_id` é o JID do grupo como o provider entrega
 * (`120363012345678901@g.us`). Aceitamos também só os dígitos e completamos
 * o sufixo — é o que aparece no log `ignorada_grupo_nao_autorizado`, e é de
 * lá que o gestor copia.
 */
export function normalizarChatId(bruto: string): string {
  const s = bruto.trim();
  if (/^\d{8,25}@g\.us$/u.test(s)) return s;
  const digitos = s.replace(/\D+/gu, '');
  return digitos ? `${digitos}@g.us` : s;
}

export const GrupoCreateSchema = z.object({
  chat_id: z
    .string()
    .trim()
    .min(3, 'Informe o id do grupo')
    .transform(normalizarChatId)
    .refine(
      (v) => /^\d{8,25}@g\.us$/u.test(v),
      'Id de grupo inválido (ex.: 120363012345678901@g.us)',
    ),
  nome: z.string().trim().min(2, 'Nome muito curto').max(120, 'Nome muito longo'),
  obra_id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v == null || v === '' ? undefined : v))
    .refine((v) => v === undefined || z.string().uuid().safeParse(v).success, 'Obra inválida'),
  ativo: z.boolean().optional(),
});

export const GrupoUpdateSchema = GrupoCreateSchema.partial().extend({
  id: z.string().uuid('ID inválido'),
});

export type GrupoCreateInput = z.infer<typeof GrupoCreateSchema>;
