import { redirect } from 'next/navigation';
import type { ZodError } from 'zod';

/**
 * Erro de validação sem perder o formulário.
 *
 * As server actions deste app fazem `redirect('?error=…')` quando o Zod
 * recusa: o usuário voltava para a tela vazia, com "valor: Required" no topo
 * (QA gstack, ISSUE-006). Este helper devolve a pessoa para a mesma tela com:
 *
 *   ?error=<rótulo humano: mensagem>   — a frase que aparece no banner
 *   &campo=<name do input>             — o campo que o formulário destaca
 *   &v=<valores digitados>             — base64url de um JSON só com strings
 *
 * O formulário lê `valores` e usa como `defaultValue`, então nada digitado
 * se perde. Nunca vão para a URL: arquivos, senhas, `secret`/`token` e
 * campos maiores que 2 KB (o teto total é 6 KB, abaixo do limite de URL).
 */

/** Tradução `name` → rótulo, por formulário. O que não estiver aqui usa o name. */
export type Rotulos = Record<string, string>;

const NUNCA_PRESERVAR = /senha|password|secret|token|csrf/iu;
const TETO_CAMPO = 2_000;
const TETO_TOTAL = 6_000;

export function mensagemDeErro(
  erro: ZodError,
  rotulos: Rotulos = {},
): { msg: string; campo: string | null } {
  const first = erro.issues[0];
  if (!first) return { msg: 'Dados inválidos.', campo: null };
  const campo = first.path.map(String).join('.');
  const rotulo = rotulos[campo] ?? rotulos[first.path[0] as string] ?? campo;
  return { msg: `${rotulo}: ${traduzir(first.message)}`, campo: campo || null };
}

/** As mensagens padrão do Zod 3 são em inglês; as que aparecem de fato viram português. */
function traduzir(m: string): string {
  const mapa: Record<string, string> = {
    Required: 'obrigatório',
    'Expected number, received nan': 'informe um número',
    'Expected number, received string': 'informe um número',
    'Invalid date': 'data inválida',
    'Invalid uuid': 'seleção inválida',
    'Invalid email': 'e-mail inválido',
  };
  return mapa[m] ?? m;
}

export function codificarValores(fd: FormData): string | null {
  const obj: Record<string, string> = {};
  let total = 0;
  for (const [k, v] of fd.entries()) {
    if (typeof v !== 'string' || NUNCA_PRESERVAR.test(k) || v.length > TETO_CAMPO) continue;
    total += k.length + v.length;
    if (total > TETO_TOTAL) break;
    obj[k] = v;
  }
  if (Object.keys(obj).length === 0) return null;
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

export function decodificarValores(v: string | undefined | null): Record<string, string> {
  if (!v) return {};
  try {
    const obj: unknown = JSON.parse(Buffer.from(v, 'base64url').toString('utf8'));
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const saida: Record<string, string> = {};
    for (const [k, val] of Object.entries(obj)) if (typeof val === 'string') saida[k] = val;
    return saida;
  } catch {
    return {};
  }
}

/**
 * Volta para `path` com o erro, o campo e os valores digitados. `never`: o
 * `redirect` do Next lança por dentro.
 */
export function voltarComErro(
  path: string,
  erro: ZodError | string,
  opcoes: { rotulos?: Rotulos; valores?: FormData; campo?: string } = {},
): never {
  const { msg, campo } =
    typeof erro === 'string'
      ? { msg: erro, campo: opcoes.campo ?? null }
      : mensagemDeErro(erro, opcoes.rotulos);
  const q = new URLSearchParams({ error: msg });
  if (campo) q.set('campo', campo);
  const v = opcoes.valores ? codificarValores(opcoes.valores) : null;
  if (v) q.set('v', v);
  redirect(`${path}${path.includes('?') ? '&' : '?'}${q.toString()}`);
}

/** O que a página passa ao formulário depois de ler `searchParams`. */
export interface EstadoDoFormulario {
  error?: string;
  campo?: string;
  valores: Record<string, string>;
}

export function estadoDoFormulario(params: {
  error?: string;
  campo?: string;
  v?: string;
}): EstadoDoFormulario {
  return { error: params.error, campo: params.campo, valores: decodificarValores(params.v) };
}
