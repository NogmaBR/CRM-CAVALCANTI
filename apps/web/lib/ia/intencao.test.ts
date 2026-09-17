import { describe, expect, it } from 'vitest';
import { classificarIntencao, intencaoDisponivel, lerIntencao } from './intencao';

/** Saída fechada: fora das cinco palavras é `nenhuma` (o fluxo de hoje). */

describe('lerIntencao', () => {
  it('aceita só as cinco intenções', () => {
    expect(lerIntencao('{"intencao":"pergunta"}')).toBe('pergunta');
    expect(lerIntencao('{"intencao":"acao"}')).toBe('acao');
    expect(lerIntencao('{"intencao":"apagar"}')).toBe('nenhuma');
    expect(lerIntencao('não é json')).toBe('nenhuma');
    expect(lerIntencao(null)).toBe('nenhuma');
  });
});

describe('classificarIntencao', () => {
  it('manda json_schema estrito e lê a resposta', async () => {
    let corpoEnviado: Record<string, unknown> = {};
    const r = await classificarIntencao('velho, quanto tô lucrando no garibaldi', {
      chat: async (corpo) => {
        corpoEnviado = corpo;
        return {
          ok: true,
          resposta: {
            choices: [{ message: { content: '{"intencao":"pergunta"}' }, finish_reason: 'stop' }],
          },
        };
      },
    });
    expect(r).toBe('pergunta');
    const rf = corpoEnviado.response_format as { type: string; json_schema: { strict: boolean } };
    expect(rf.type).toBe('json_schema');
    expect(rf.json_schema.strict).toBe(true);
  });

  it('falha HTTP → nenhuma', async () => {
    const r = await classificarIntencao('x y z', {
      chat: async () => ({ ok: false, status: 500, detalhe: 'boom' }),
    });
    expect(r).toBe('nenhuma');
  });

  it('sem provider configurado não chama nada', async () => {
    expect(intencaoDisponivel({ disponivel: () => false })).toBe(false);
    expect(await classificarIntencao('qualquer', { disponivel: () => false })).toBe('nenhuma');
  });
});
