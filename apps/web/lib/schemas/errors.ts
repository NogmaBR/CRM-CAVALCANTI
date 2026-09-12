import { logger } from '@/lib/log';

const log = logger('erros');
/**
 * Traduz erros conhecidos do Postgres/Supabase para mensagens amigáveis
 * que podem ser expostas ao usuário via `?error=` sem vazar detalhes
 * internos (nomes de constraint, coluna, schema, etc.).
 *
 * Referência de códigos: https://www.postgresql.org/docs/current/errcodes-appendix.html
 * Referência PostgREST: https://postgrest.org/en/stable/references/errors.html
 */

interface DbErrorLike {
  code?: string;
  message?: string;
}

const CODE_MESSAGES: Record<string, string> = {
  '23502': 'Um campo obrigatório está vazio.',
  '23503': 'Este registro está referenciado por outro e não pode ser modificado.',
  '23505': 'Já existe um registro com esses dados únicos.',
  '23514': 'Um dos valores viola uma regra do banco.',
  '42501': 'Permissão negada para esta operação.',
  '42P01': 'Recurso não encontrado.',
  PGRST116: 'Registro não encontrado.',
  PGRST301: 'Sessão expirada. Faça login novamente.',
};

export function mapDbError(
  err: DbErrorLike | null | undefined,
  fallback = 'Erro ao processar. Tente novamente.',
): string {
  if (!err) return fallback;
  const code = err.code ?? '';
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code]!;
  // Fallback: nunca expor raw message em prod
  return fallback;
}

/**
 * Variante que aceita overrides context-específicos.
 * Ex: mapDbErrorWithContext(err, { '23505': 'CNPJ já cadastrado' })
 */
export function mapDbErrorWithContext(
  err: DbErrorLike | null | undefined,
  overrides: Record<string, string>,
  fallback = 'Erro ao processar. Tente novamente.',
): string {
  if (!err) return fallback;
  const code = err.code ?? '';
  if (code && overrides[code]) return overrides[code]!;
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code]!;
  return fallback;
}

/**
 * Sanitiza erro vindo da Admin API do Supabase (auditoria 2026-09-09,
 * finding M-4).
 *
 * As actions de `/config/usuarios` interpolavam `result.error` direto no
 * `?error=` — mensagem crua da GoTrue/Postgres na URL, visível pro usuário e
 * gravada no histórico. Está atrás de `assertAdmin()`, então o impacto é
 * baixo, mas é a mesma classe de bug já corrigida em `apelido-actions.ts` e
 * não havia motivo pra manter a exceção.
 *
 * O detalhe real vai pro log do servidor, onde a operação é debugável; o
 * usuário recebe o que consegue acionar.
 */
export function sanitizarErroAdmin(operacao: string, erroBruto: string): string {
  log.erro('admin_api_falhou', { operacao, erro: erroBruto });

  const normalizado = erroBruto.toLowerCase();
  if (normalizado.includes('already') || normalizado.includes('422')) {
    return 'Este e-mail já foi convidado ou já é usuário.';
  }
  if (normalizado.includes('rate') || normalizado.includes('429')) {
    return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  }
  if (normalizado.includes('not found') || normalizado.includes('404')) {
    return 'Usuário não encontrado.';
  }
  return `Não foi possível ${operacao}. Tente novamente — se persistir, verifique os logs.`;
}
