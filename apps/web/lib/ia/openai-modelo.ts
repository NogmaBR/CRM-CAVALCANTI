import 'server-only';
import { z } from 'zod/v4';
import type { Ferramenta } from './ferramentas/registro';
import type {
  ModeloComFerramentas,
  OpcoesDoModelo,
  RespostaDoModelo,
  ResultadoDeFerramenta,
} from './modelo-ferramentas';
import { type MensagemChat, chatCompletions, modeloOpenAI } from './openai';

/**
 * Modelo com ferramentas via OpenAI Chat Completions (function calling).
 *
 * As ferramentas viram `tools: [{ type: 'function', ... }]` com o JSON Schema
 * do Zod (modo `input`, como no adaptador Anthropic: campo com `.default()`
 * não vira obrigatório). Não usamos `strict: true` nas ferramentas: o modo
 * estrito exige todos os campos obrigatórios, e as ferramentas de obra têm
 * opcionais de propósito — a validação de verdade é o Zod em
 * `executarFerramenta`.
 */

const MAX_TOKENS = 1024;

export function paraOpenAI(lista: readonly Ferramenta[]): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return lista.map((f) => {
    const { $schema: _ignorado, ...schema } = z.toJSONSchema(f.schema, { io: 'input' }) as Record<
      string,
      unknown
    >;
    return {
      type: 'function' as const,
      function: {
        name: f.nome,
        description: f.descricao,
        parameters: { ...schema, type: 'object' },
      },
    };
  });
}

export class ModeloOpenAI implements ModeloComFerramentas {
  private readonly mensagens: MensagemChat[];
  private readonly tools: ReturnType<typeof paraOpenAI>;

  constructor(opts: OpcoesDoModelo) {
    this.mensagens = [{ role: 'system', content: opts.sistema }];
    this.tools = paraOpenAI(opts.ferramentas);
  }

  async perguntar(prompt: string): Promise<RespostaDoModelo> {
    this.mensagens.push({ role: 'user', content: prompt });
    return this.chamar();
  }

  async continuar(resultados: ResultadoDeFerramenta[]): Promise<RespostaDoModelo> {
    for (const r of resultados) {
      this.mensagens.push({ role: 'tool', tool_call_id: r.id, content: r.conteudo });
    }
    return this.chamar();
  }

  private async chamar(): Promise<RespostaDoModelo> {
    const r = await chatCompletions({
      model: modeloOpenAI(),
      messages: this.mensagens,
      tools: this.tools.length > 0 ? this.tools : undefined,
      max_completion_tokens: MAX_TOKENS,
      reasoning_effort: 'low',
    });
    if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${r.detalhe}`);

    const escolha = r.resposta.choices[0];
    const msg = escolha?.message;
    const toolCalls = msg?.tool_calls ?? [];

    // A mensagem do assistente volta inteira para o histórico — inclusive os
    // tool_calls, que a API exige antes das mensagens `tool`.
    this.mensagens.push({
      role: 'assistant',
      content: msg?.content ?? null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });

    return {
      texto: (msg?.content ?? '').trim(),
      usos: toolCalls.map((t) => ({
        id: t.id,
        nome: t.function.name,
        argumentos: lerArgumentos(t.function.arguments),
      })),
      tokensEntrada: r.resposta.usage?.prompt_tokens ?? 0,
      tokensSaida: r.resposta.usage?.completion_tokens ?? 0,
    };
  }
}

/** Argumentos chegam como string JSON; JSON inválido vira `{}` e o Zod da ferramenta recusa. */
function lerArgumentos(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
