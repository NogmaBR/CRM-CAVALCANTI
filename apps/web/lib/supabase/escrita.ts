import { mapDbError } from '@/lib/schemas/errors';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Confere o resultado de um `.update()/.delete()` feito com a sessão do
 * usuário.
 *
 * Com RLS, um papel sem permissão **não recebe erro**: a policy filtra as
 * linhas e o Postgres responde "0 linhas afetadas" com sucesso. Antes as
 * actions de arquivar/restaurar só olhavam `error`, e um papel `leitura`
 * via "Obra arquivada" com nada mudado (eng review gstack, C1). A pendência
 * do WhatsApp já seguia este padrão desde o PR #21; agora é um helper só.
 *
 * Uso: encadeie `.select('id')` na escrita e passe o resultado aqui. Devolve
 * a mensagem para o usuário, ou `null` quando pelo menos uma linha mudou.
 */
export const NADA_ALTERADO =
  'Nada foi alterado: o registro não existe, já estava neste estado ou você não tem permissão.';

export function erroDeEscrita(resultado: {
  data: unknown[] | null;
  error: PostgrestError | null;
}): string | null {
  if (resultado.error) return mapDbError(resultado.error);
  if (!resultado.data || resultado.data.length === 0) return NADA_ALTERADO;
  return null;
}
