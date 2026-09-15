import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { extrairCitacoes, perguntar } from './assistente';
import { ferramenta } from './ferramentas/registro';
import type {
  ModeloComFerramentas,
  RespostaDoModelo,
  ResultadoDeFerramenta,
} from './modelo-ferramentas';
import { SEM_EMBEDDINGS, SEM_RESPOSTA } from './prompts/assistente-obra';

type Client = SupabaseClient<Database>;

/**
 * O laço do assistente, sem rede e sem provider: o modelo é um fake que
 * implementa `ModeloComFerramentas`. O que importa aqui é o contrato do laço
 * — ferramenta pedida é executada e devolvida, allowlist e Zod barram o que
 * não pode, o teto de rodadas segura, e falha do modelo vira texto fixo.
 * O adaptador de cada provider (OpenAI/Anthropic) é testado à parte.
 */

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

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

interface Chamada {
  tipo: 'perguntar' | 'continuar';
  prompt?: string;
  resultados?: ResultadoDeFerramenta[];
}

function modeloFake(respostas: RespostaDoModelo[]): ModeloComFerramentas & { chamadas: Chamada[] } {
  const chamadas: Chamada[] = [];
  let i = 0;
  const proxima = () => {
    const r = respostas[Math.min(i, respostas.length - 1)];
    i += 1;
    if (!r) throw new Error('sem resposta');
    return r;
  };
  return {
    chamadas,
    async perguntar(prompt) {
      chamadas.push({ tipo: 'perguntar', prompt });
      return proxima();
    },
    async continuar(resultados) {
      chamadas.push({ tipo: 'continuar', resultados });
      return proxima();
    },
  };
}

const texto = (t: string): RespostaDoModelo => ({
  texto: t,
  usos: [],
  tokensEntrada: 10,
  tokensSaida: 5,
});
const uso = (id: string, nome: string, argumentos: unknown): RespostaDoModelo => ({
  texto: '',
  usos: [{ id, nome, argumentos }],
  tokensEntrada: 10,
  tokensSaida: 5,
});

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
    const modelo = modeloFake([
      uso('tu1', 'soma_fake', { obra: 'garibaldi' }),
      texto('Na Garibaldi foram R$ 1.234,50.'),
    ]);

    const r = await perguntar(cliente, entrada, {
      criarModelo: () => modelo,
      ferramentas: [somaFake],
      hoje: () => '2026-09-11',
    });

    expect(r.usouModelo).toBe(true);
    expect(r.texto).toBe('Na Garibaldi foram R$ 1.234,50.');
    expect(r.ferramentas).toHaveLength(1);
    expect(r.ferramentas[0]).toMatchObject({ ferramenta: 'soma_fake', ok: true });

    expect(modelo.chamadas[0]?.tipo).toBe('perguntar');
    expect(modelo.chamadas[0]?.prompt).toContain('HOJE: 2026-09-11');
    const segunda = modelo.chamadas[1];
    expect(segunda?.tipo).toBe('continuar');
    expect(segunda?.resultados?.[0]).toMatchObject({ id: 'tu1', erro: false });
    expect(String(segunda?.resultados?.[0]?.conteudo)).toContain('1234.5');

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
    const modelo = modeloFake([uso('tu1', 'apagar_tudo', {}), texto('Não consigo fazer isso.')]);

    const r = await perguntar(cliente, entrada, {
      criarModelo: () => modelo,
      ferramentas: [somaFake],
    });

    expect(r.texto).toBe('Não consigo fazer isso.');
    expect(r.ferramentas[0]).toMatchObject({ ferramenta: 'apagar_tudo', ok: false });
    expect(modelo.chamadas[1]?.resultados?.[0]?.erro).toBe(true);
  });

  it('argumento inválido também vira erro, sem executar', async () => {
    const { cliente } = supabaseFake();
    const modelo = modeloFake([uso('tu1', 'soma_fake', { obra: 'x' }), texto('Qual obra?')]);
    const r = await perguntar(cliente, entrada, {
      criarModelo: () => modelo,
      ferramentas: [somaFake],
    });
    expect(r.ferramentas[0]?.ok).toBe(false);
    expect(r.ferramentas[0]?.erro).toContain('obra');
  });

  it('o laço tem teto: modelo que só pede ferramenta não trava', async () => {
    const { cliente } = supabaseFake();
    const modelo = modeloFake([uso('tu', 'soma_fake', { obra: 'garibaldi' })]);

    const r = await perguntar(cliente, entrada, {
      criarModelo: () => modelo,
      ferramentas: [somaFake],
    });

    expect(modelo.chamadas.length).toBeLessThanOrEqual(4);
    expect(r.texto).toBe(SEM_RESPOSTA);
    expect(r.ferramentas.length).toBe(modelo.chamadas.length);
  });

  it('modelo que lança devolve texto fixo, não exceção', async () => {
    const { cliente } = supabaseFake();
    const modelo: ModeloComFerramentas = {
      perguntar: async () => {
        throw new Error('429');
      },
      continuar: async () => {
        throw new Error('429');
      },
    };
    const r = await perguntar(cliente, entrada, {
      criarModelo: () => modelo,
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
