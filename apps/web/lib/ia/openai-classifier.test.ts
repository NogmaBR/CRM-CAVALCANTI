import { describe, expect, it, vi } from 'vitest';
import { SaidaSchema } from './classificador-comum';
import type { ClassifierInput } from './classifier';
import {
  JSON_SCHEMA_SAIDA,
  OpenAIClassifier,
  corpoDaChamada,
  montarConteudoOpenAI,
} from './openai-classifier';

/**
 * Sem rede: o que dá para garantir é que (1) o JSON Schema estrito enviado à
 * API tem exatamente as chaves do Zod que valida a resposta — se um lado
 * ganhar um campo e o outro não, a API recusa ou o Zod recusa, e a mensagem
 * vira `nao_identificado` em silêncio; (2) mídia vira o bloco certo;
 * (3) a resposta passa pela barreira `montarSaida` (id inexistente é
 * descartado); (4) anexo recusado refaz só com texto.
 *
 * Com rede (`TESTE_REAL=1`): `openai-classifier.real.test.ts`.
 */

const OBRAS = [
  { id: '11111111-1111-4111-8111-111111111111', nome: 'Garibaldi', apelidos: ['Gari'] },
];

function input(over: Partial<ClassifierInput> = {}): ClassifierInput {
  return {
    texto: 'paguei 1200 de areia na Gari',
    midiaStoragePath: null,
    midiaMime: null,
    telefone: '5551',
    contexto: { obrasAtivas: OBRAS, fornecedoresConhecidos: [], grupoObraId: null },
    ...over,
  };
}

function respostaOk(saida: Record<string, unknown>) {
  return {
    ok: true as const,
    resposta: {
      choices: [{ message: { content: JSON.stringify(saida) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    },
  };
}

const SAIDA_BASE = {
  kind: 'pagamento_parcial',
  confidence: 0.7,
  valor: 1200,
  data_pagamento: null,
  obra_nome: 'Gari',
  fornecedor_nome: 'Zé',
  categoria_nome: null,
  tipo_documento: null,
  numero_nf: null,
  descricao: 'areia',
  categoria: null,
  resumo: null,
  raciocinio: 'valor e obra citados',
  pergunta_confirmacao: 'Confirma R$ 1200 na Garibaldi?',
};

describe('JSON Schema estrito × Zod', () => {
  it('mesmas chaves, todas obrigatórias, sem propriedades extras', () => {
    const chavesZod = Object.keys(SaidaSchema.shape).sort();
    const chavesJson = Object.keys(JSON_SCHEMA_SAIDA.properties).sort();
    expect(chavesJson).toEqual(chavesZod);
    expect([...JSON_SCHEMA_SAIDA.required].sort()).toEqual(chavesZod);
    expect(JSON_SCHEMA_SAIDA.additionalProperties).toBe(false);
  });

  it('uma resposta válida pelo JSON Schema passa no Zod', () => {
    expect(SaidaSchema.safeParse(SAIDA_BASE).success).toBe(true);
  });
});

describe('corpoDaChamada / montarConteudoOpenAI', () => {
  it('system com as instruções, saída presa ao schema, esforço baixo', () => {
    const c = corpoDaChamada('oi') as {
      messages: Array<{ role: string }>;
      response_format: { type: string; json_schema: { strict: boolean } };
      reasoning_effort: string;
    };
    expect(c.messages[0]?.role).toBe('system');
    expect(c.response_format.type).toBe('json_schema');
    expect(c.response_format.json_schema.strict).toBe(true);
    expect(c.reasoning_effort).toBe('low');
  });

  it('imagem vira image_url em data URI; PDF vira file; sem mídia é só texto', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
    const partes = montarConteudoOpenAI('ctx', { bytes: jpeg, mime: 'image/jpeg' });
    expect(Array.isArray(partes)).toBe(true);
    const [midia, texto] = partes as Array<Record<string, unknown>>;
    expect(midia?.type).toBe('image_url');
    expect(String((midia?.image_url as { url: string }).url)).toMatch(/^data:image\/jpeg;base64,/u);
    expect(texto).toEqual({ type: 'text', text: 'ctx' });

    const pdf = montarConteudoOpenAI('ctx', {
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      mime: 'application/pdf',
    });
    expect((pdf as Array<Record<string, unknown>>)[0]?.type).toBe('file');

    expect(montarConteudoOpenAI('ctx', null)).toBe('ctx');
  });

  it('imagem de 5 MB passa (limite da OpenAI é 20 MB, não os 5 MB da Anthropic)', () => {
    const r = montarConteudoOpenAI('ctx', {
      bytes: new Uint8Array(5 * 1024 * 1024),
      mime: 'image/png',
    });
    expect(Array.isArray(r)).toBe(true);
  });

  it('mídia acima do limite vira aviso em texto', () => {
    const grande = new Uint8Array(21 * 1024 * 1024);
    const r = montarConteudoOpenAI('ctx', { bytes: grande, mime: 'image/png' });
    expect(typeof r).toBe('string');
    expect(r).toContain('grande demais');
  });
});

describe('OpenAIClassifier.classify', () => {
  it('resposta válida passa pela barreira de saída', async () => {
    const chamar = vi.fn(async () => respostaOk(SAIDA_BASE));
    const c = new OpenAIClassifier({ chamar, baixarMidia: async () => null });
    const out = await c.classify(input());
    expect(out.kind).toBe('pagamento_parcial');
    expect(out.extracted.valor).toBe(1200);
    expect(out.extracted.obra_id).toBe(OBRAS[0]?.id);
    expect(out.perguntaConfirmacao).toContain('Confirma');
    expect(chamar).toHaveBeenCalledTimes(1);
  });

  it('obra citada que não existe fica sem id e a confiança cai', async () => {
    const chamar = vi.fn(async () =>
      respostaOk({ ...SAIDA_BASE, obra_nome: 'Obra Beta', confidence: 0.95 }),
    );
    const out = await new OpenAIClassifier({ chamar, baixarMidia: async () => null }).classify(
      input(),
    );
    expect(out.extracted.obra_id).toBeUndefined();
    expect(out.confidence).toBeLessThanOrEqual(0.5);
  });

  it('fornecedor é resolvido pelo NOME em código: "Mathias Velho" nunca vira Maximiliano', async () => {
    const forn = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nome: 'Mathias Velho' },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', nome: 'Maximiliano' },
    ];
    const chamar = vi.fn(async () =>
      respostaOk({ ...SAIDA_BASE, fornecedor_nome: 'Mathias Velho', categoria_nome: 'Estrutura' }),
    );
    const out = await new OpenAIClassifier({ chamar, baixarMidia: async () => null }).classify(
      input({
        contexto: {
          obrasAtivas: OBRAS,
          fornecedoresConhecidos: forn,
          categorias: [
            {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              nome: 'Estrutura (vigas, pilares e lajes)',
            },
          ],
          grupoObraId: null,
        },
      }),
    );
    expect(out.extracted.fornecedor_id).toBe(forn[0]?.id);
    expect(out.extracted.fornecedor_nome_novo).toBeUndefined();
    expect(out.extracted.categoria_id).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  });

  it('fornecedor desconhecido vira fornecedor_nome_novo', async () => {
    const chamar = vi.fn(async () => respostaOk({ ...SAIDA_BASE, fornecedor_nome: 'Zé da Areia' }));
    const out = await new OpenAIClassifier({ chamar, baixarMidia: async () => null }).classify(
      input(),
    );
    expect(out.extracted.fornecedor_id).toBeUndefined();
    expect(out.extracted.fornecedor_nome_novo).toBe('Zé da Areia');
  });

  it('anexo recusado (400) refaz só com texto', async () => {
    const chamar = vi
      .fn()
      .mockResolvedValueOnce({ ok: false as const, status: 400, detalhe: 'invalid image' })
      .mockResolvedValueOnce(respostaOk({ ...SAIDA_BASE, kind: 'documento_apenas', valor: null }));
    const c = new OpenAIClassifier({
      chamar,
      baixarMidia: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1]),
    });
    const out = await c.classify(
      input({ midiaStoragePath: 'x/foto.jpg', midiaMime: 'image/jpeg' }),
    );
    expect(chamar).toHaveBeenCalledTimes(2);
    const segunda = chamar.mock.calls[1]?.[0] as { messages: Array<{ content: unknown }> };
    expect(typeof segunda.messages[1]?.content).toBe('string');
    expect(out.kind).toBe('documento_apenas');
  });

  it('erro que não é do anexo propaga (o chamador marca a mensagem como erro)', async () => {
    const chamar = vi.fn(async () => ({ ok: false as const, status: 429, detalhe: 'rate limit' }));
    await expect(
      new OpenAIClassifier({ chamar, baixarMidia: async () => null }).classify(input()),
    ).rejects.toThrow(/429/u);
  });

  it('saída fora do schema vira nao_identificado com confiança zero', async () => {
    const chamar = vi.fn(async () => respostaOk({ kind: 'pagamento_parcial' }));
    const out = await new OpenAIClassifier({ chamar, baixarMidia: async () => null }).classify(
      input(),
    );
    expect(out.kind).toBe('nao_identificado');
    expect(out.confidence).toBe(0);
  });
});
