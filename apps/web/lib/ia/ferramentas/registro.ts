import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod/v4';

/**
 * Registro de ferramentas do assistente — a allowlist.
 *
 * ## Por que existe uma lista, e não "o modelo chama o que quiser"
 *
 * O modelo não executa nada. Ele **pede** uma ferramenta pelo nome, com
 * argumentos em JSON, e este módulo decide se o pedido é válido. Três travas,
 * nesta ordem:
 *
 *   1. **Nome na lista.** Ferramenta que não está em `FERRAMENTAS` não existe.
 *      Nem erro detalhado ela recebe: só "ferramenta desconhecida".
 *   2. **Argumentos pelo schema.** Cada ferramenta declara um schema Zod; o
 *      JSON do modelo passa por ele antes de tocar no banco. Um `limite: 5000`
 *      vira `limite: 20` ou erro de validação, nunca uma varredura.
 *   3. **Só leitura.** Nenhuma ferramenta aqui grava. Isso não é convenção —
 *      é o contrato: uma ferramenta que escrevesse no financeiro a partir de
 *      um pedido do modelo seria o `IA_AUTO_APROVAR=true` por outra porta.
 *
 * ## O que uma ferramenta devolve
 *
 * JSON pequeno e estável. É o que volta para o modelo como `tool_result`, e
 * ele redige em cima. Números vão como número (o modelo formata em R$),
 * listas vêm limitadas, e um erro vira `{ ok: false, erro }` — nunca uma
 * exceção que derrube a resposta.
 */

export type Client = SupabaseClient<Database>;

export interface Ferramenta<S extends z.ZodType = z.ZodType> {
  /** Nome que o modelo usa. snake_case, estável: é gravado em `ai_tool_calls`. */
  nome: string;
  /** Uma frase para o modelo saber QUANDO usar. É a parte que mais importa. */
  descricao: string;
  schema: S;
  executar: (supabase: Client, args: z.infer<S>) => Promise<unknown>;
}

export type ResultadoFerramenta =
  | { ok: true; resultado: unknown; duracao_ms: number }
  | { ok: false; erro: string; duracao_ms: number };

/**
 * Declara uma ferramenta. Só existe para o TypeScript inferir o tipo dos
 * argumentos a partir do schema — sem isto cada `executar` receberia `any`.
 */
export function ferramenta<S extends z.ZodType>(def: Ferramenta<S>): Ferramenta<S> {
  return def;
}

/**
 * Executa uma ferramenta pelo nome, com os argumentos crus do modelo.
 *
 * Nunca lança: ferramenta desconhecida, argumento inválido e falha de banco
 * viram `{ ok: false }`. O modelo recebe o erro como resultado e decide o
 * que fazer — normalmente dizer que não conseguiu, que é o comportamento
 * certo para um assistente financeiro.
 */
export async function executarFerramenta(
  supabase: Client,
  lista: readonly Ferramenta[],
  nome: string,
  argsBrutos: unknown,
): Promise<ResultadoFerramenta> {
  const inicio = Date.now();
  const f = lista.find((x) => x.nome === nome);

  if (!f) {
    return { ok: false, erro: `ferramenta desconhecida: ${nome}`, duracao_ms: 0 };
  }

  const parsed = f.schema.safeParse(argsBrutos ?? {});
  if (!parsed.success) {
    const primeiro = parsed.error.issues[0];
    const onde = primeiro?.path?.length ? `${primeiro.path.join('.')}: ` : '';
    return {
      ok: false,
      erro: `argumentos inválidos — ${onde}${primeiro?.message ?? 'formato inesperado'}`,
      duracao_ms: Date.now() - inicio,
    };
  }

  try {
    const resultado = await f.executar(supabase, parsed.data);
    return { ok: true, resultado, duracao_ms: Date.now() - inicio };
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : String(err),
      duracao_ms: Date.now() - inicio,
    };
  }
}

/**
 * As ferramentas no formato que a API da Anthropic espera.
 *
 * O JSON Schema sai do próprio Zod, então o que o modelo vê e o que o
 * validador aceita são a mesma coisa — não há como divergirem.
 */
export function paraAnthropic(lista: readonly Ferramenta[]): Array<{
  name: string;
  description: string;
  input_schema: { type: 'object'; [k: string]: unknown };
}> {
  return lista.map((f) => {
    // `io: 'input'`: é o que o modelo ENVIA. No modo padrão (saída) um campo
    // com `.default()` aparece como obrigatório, e o modelo passaria a
    // inventar valores para ele.
    const { $schema: _ignorado, ...schema } = z.toJSONSchema(f.schema, { io: 'input' }) as Record<
      string,
      unknown
    >;
    return {
      name: f.nome,
      description: f.descricao,
      input_schema: { ...schema, type: 'object' as const },
    };
  });
}
