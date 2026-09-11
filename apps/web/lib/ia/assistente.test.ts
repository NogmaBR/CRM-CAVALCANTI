import type { Message } from '@anthropic-ai/sdk/resources/messages/messages';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { type ClienteDeMensagens, extrairCitacoes, perguntar } from './assistente';
import { ferramenta } from './ferramentas/registro';
import { SEM_EMBEDDINGS, SEM_RESPOSTA } from './prompts/assistente-obra';

/**
 * O laço de ferramentas, sem rede e sem banco.
 *
 * O que precisa ser verdade:
 *
 *  1. O modelo pede uma ferramenta → ela executa com argumentos validados →
 *     o resultado volta como `tool_result` → o modelo redige.
 *  2. Ferramenta fora da allowlist volta como erro para o modelo, e o laço
 *     continua — não derruba a resposta.
 *  3. O laço tem teto. Um modelo que pede ferramenta para sempre não trava.
 *  4. Tudo é gravado: conversa, duas mensagens, e uma linha por ferramenta.
 *  5. Sem modelo e sem embeddings, a resposta é o texto fixo — sem chamada.
 */

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

/** Supabase mínimo: registra inserts e devolve ids; `buscar` recebe erro de rpc. */
function supabaseFake() {
  const inserts: Array<{ tabela: string; linhas: unknown }> = [];
  let seq = 0;
  const cliente = {
    from(tabela: string) {
      return {
        insert(linhas: unknown) {
          inserts.push({ tabela, linhas });
          const id = `${tabela}-${++seq}`;
          // Uma Promise de verdade (para `await insert(...)`) que também
          // aceita `.select().single()` — as duas formas que o código usa.
          return Object.assign(Promise.resolve({ error: null }), {
            select: () => ({ single: async () => ({ data: { id }, error: null }) }),
          });
        },
      };
    },
    rpc: async () => ({ data: null, error: { message: 'sem rpc no teste' } }),
  };
  return { cliente: cliente as unknown as Client, inserts };
}

function msg(content: Message['content'], stop: Message['stop_reason']): Message {
  return {
    id: 'msg',
    type: 'message',
    role: 'assistant',
    model: 'fake',
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 } as Message['usage'],
  } as Message;
}

const texto = (t: string) => ({ type: 'text' as const, text: t, citations: null });
const usoDe = (id: string, name: string, input: unknown) => ({
  type: 'tool_use' as const,
  id,
  name,
  input,
  caller: { type: 'direct' as const },
});

/** Cliente que devolve as respostas na ordem, e guarda o que recebeu. */
function clienteFake(respostas: Message[]): ClienteDeMensagens & { chamadas: unknown[] } {
  const chamadas: unknown[] = [];
  let i = 0;
  return {
    chamadas,
    async create(params) {
      chamadas.push(params);
      const r = respostas[Math.min(i, respostas.length - 1)];
      i += 1;
      if (!r) throw new Error('sem resposta');
      return r;
    },
  };
}

const somaFake = ferramenta({
  nome: 'soma_fake',
  descricao: 'devolve um total fixo para a obra pedida, para o teste do laço do assistente',
  schema: z.object({ obra: z.string().min(2) }),
  executar: async (_s, args) => ({ ok: true, obra: args.obra, total: 1234.5 }),
});

const entrada = { pergunta: 'quanto gastei na garibaldi?', canal: 'whatsapp' as const };

describe('perguntar — laço de ferramentas', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('executa a ferramenta pedida, devolve o resultado ao modelo e redige', async () => {
    const { cliente, inserts } = supabaseFake();
    const modelo = clienteFake([
      msg([usoDe('tu1', 'soma_fake', { obra: 'garibaldi' })], 'tool_use'),
      msg([texto('Na Garibaldi foram R$ 1.234,50.')], 'end_turn'),
    ]);

    const r = await perguntar(cliente, entrada, {
      criarCliente: () => modelo,
      ferramentas: [somaFake],
      hoje: () => '2026-09-11',
    });

    expect(r.usouModelo).toBe(true);
    expect(r.texto).toBe('Na Garibaldi foram R$ 1.234,50.');
    expect(r.ferramentas).toHaveLength(1);
    expect(r.ferramentas[0]).toMatchObject({ ferramenta: 'soma_fake', ok: true });

    // A segunda chamada ao modelo recebeu o tool_result certo.
    const segunda = modelo.chamadas[1] as { messages: Array<{ role: string; content: unknown }> };
    expect(segunda.messages).toHaveLength(3);
    const resultado = segunda.messages[2]?.content as Array<Record<string, unknown>>;
    expect(resultado[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'tu1',
      is_error: false,
    });
    expect(String(resultado[0]?.content)).toContain('1234.5');

    // O prompt levou a data de hoje, e as ferramentas foram declaradas.
    const primeira = modelo.chamadas[0] as {
      messages: Array<{ content: string }>;
      tools: unknown[];
    };
    expect(primeira.messages[0]?.content).toContain('HOJE: 2026-09-11');
    expect(primeira.tools).toHaveLength(1);

    // Gravou conversa, 2 mensagens e 1 chamada de ferramenta.
    expect(inserts.map((i) => i.tabela)).toEqual([
      'ai_conversations',
      'ai_messages',
      'ai_messages',
      'ai_tool_calls',
    ]);
    const tools = inserts[3]?.linhas as Array<Record<string, unknown>>;
    expect(tools[0]).toMatchObject({
      ferramenta: 'soma_fake',
      ok: true,
      message_id: 'ai_messages-3',
    });
  });

  it('ferramenta fora da allowlist vira erro para o modelo, e a resposta segue', async () => {
    const { cliente } = supabaseFake();
    const modelo = clienteFake([
      msg([usoDe('tu1', 'apagar_tudo', {})], 'tool_use'),
      msg([texto('Não consigo fazer isso.')], 'end_turn'),
    ]);

    const r = await perguntar(cliente, entrada, {
      criarCliente: () => modelo,
      ferramentas: [somaFake],
    });

    expect(r.texto).toBe('Não consigo fazer isso.');
    expect(r.ferramentas[0]).toMatchObject({ ferramenta: 'apagar_tudo', ok: false });
    const segunda = modelo.chamadas[1] as { messages: Array<{ content: unknown }> };
    const resultado = segunda.messages[2]?.content as Array<Record<string, unknown>>;
    expect(resultado[0]?.is_error).toBe(true);
  });

  it('argumento inválido também vira erro, sem executar', async () => {
    const { cliente } = supabaseFake();
    const modelo = clienteFake([
      msg([usoDe('tu1', 'soma_fake', { obra: 'x' })], 'tool_use'),
      msg([texto('Qual obra?')], 'end_turn'),
    ]);
    const r = await perguntar(cliente, entrada, {
      criarCliente: () => modelo,
      ferramentas: [somaFake],
    });
    expect(r.ferramentas[0]?.ok).toBe(false);
    expect(r.ferramentas[0]?.erro).toContain('obra');
  });

  it('o laço tem teto: modelo que só pede ferramenta não trava', async () => {
    const { cliente } = supabaseFake();
    const modelo = clienteFake([
      msg([usoDe('tu', 'soma_fake', { obra: 'garibaldi' })], 'tool_use'),
    ]);

    const r = await perguntar(cliente, entrada, {
      criarCliente: () => modelo,
      ferramentas: [somaFake],
    });

    expect(modelo.chamadas.length).toBeLessThanOrEqual(4);
    expect(r.texto).toBe(SEM_RESPOSTA);
    expect(r.ferramentas.length).toBe(modelo.chamadas.length);
  });

  it('modelo que lança devolve texto fixo, não exceção', async () => {
    const { cliente } = supabaseFake();
    const modelo: ClienteDeMensagens = {
      create: async () => {
        throw new Error('429');
      },
    };
    const r = await perguntar(cliente, entrada, {
      criarCliente: () => modelo,
      ferramentas: [somaFake],
    });
    expect(r.usouModelo).toBe(false);
    expect(r.texto.length).toBeGreaterThan(10);
  });

  it('sem modelo e sem embeddings: texto fixo, nenhuma chamada', async () => {
    const { cliente, inserts } = supabaseFake();
    const r = await perguntar(cliente, entrada);
    expect(r.usouModelo).toBe(false);
    expect(r.texto).toBe(SEM_EMBEDDINGS);
    expect(inserts).toHaveLength(0);
  });
});

describe('extrairCitacoes', () => {
  it('pega os [n] do texto, únicos e ordenados', () => {
    expect(extrairCitacoes('Foi R$ 10 [2] e R$ 20 [1]. De novo [2].')).toEqual([1, 2]);
    expect(extrairCitacoes('sem citação')).toEqual([]);
    expect(extrairCitacoes('[0] não conta, [123] é grande demais')).toEqual([]);
  });
});
