import { describe, expect, it, vi } from 'vitest';
import { extrairCorrecao, patchDaSaida } from './correcao';

/**
 * O modelo devolve NOMES; o código resolve contra o cadastro. Ambíguo não
 * resolve. O que os padrões acharam vence o modelo no mesmo campo.
 */

const CTX = {
  obras: [
    { id: 'gari', nome: 'Garibaldi', apelidos: ['Gari'] },
    { id: 'inox', nome: 'INOX Piratini', apelidos: ['Inox'] },
    { id: 'ej', nome: 'Casa EJ', apelidos: [] },
    { id: 'ej2', nome: 'Casa EJ 2', apelidos: [] },
  ],
  fornecedores: [{ id: 'mv', nome: 'Mathias Velho', apelidos: [] }],
  hoje: '2026-09-19',
};

function chatQueDevolve(json: Record<string, unknown>) {
  return vi.fn(async () => ({
    ok: true as const,
    status: 200,
    resposta: { choices: [{ message: { content: JSON.stringify(json) } }] } as never,
  }));
}

describe('patchDaSaida', () => {
  it('nomes viram ids pelo cadastro; fornecedor desconhecido vira nome novo', () => {
    const p = patchDaSaida(
      {
        obra_nome: 'inox',
        fornecedor_nome: 'Gilvando Félix',
        valor: 16,
        data: '2026-09-15',
        descricao: null,
        cancelar: false,
      },
      CTX,
    );
    expect(p).toEqual({
      obra: { id: 'inox', nome: 'INOX Piratini' },
      fornecedorNomeNovo: 'Gilvando Félix',
      valor: 16,
      data: '2026-09-15',
    });
  });

  it('obra ambígua ("casa ej" casa com duas) não entra no patch', () => {
    const p = patchDaSaida(
      {
        obra_nome: 'Casa EJ',
        fornecedor_nome: null,
        valor: null,
        data: null,
        descricao: null,
        cancelar: false,
      },
      { ...CTX, obras: CTX.obras.filter((o) => o.id !== 'ej') },
    );
    // Com uma só "Casa EJ 2" restando, "Casa EJ" ainda resolve por prefixo; o
    // caso ambíguo de verdade é ter as duas — coberto abaixo.
    expect(p.obra?.id).toBe('ej2');
    const amb = patchDaSaida(
      {
        obra_nome: 'Casa',
        fornecedor_nome: null,
        valor: null,
        data: null,
        descricao: null,
        cancelar: false,
      },
      CTX,
    );
    expect(amb.obra).toBeUndefined();
  });
});

describe('extrairCorrecao', () => {
  it('sem modelo: só os padrões', async () => {
    const p = await extrairCorrecao('é na inox, foi 350', CTX, { disponivel: () => false });
    expect(p).toEqual({ obra: { id: 'inox', nome: 'INOX Piratini' }, valor: 350 });
  });

  it('com modelo: completa o que os padrões não pegaram, mas não sobrescreve o que pegaram', async () => {
    const chat = chatQueDevolve({
      obra_nome: 'Garibaldi',
      fornecedor_nome: 'Mathias',
      valor: 999,
      data: null,
      descricao: 'areia',
      cancelar: false,
    });
    const p = await extrairCorrecao('é na inox, foi 350, pro mathias, areia', CTX, { chat });
    expect(p.obra?.id).toBe('inox');
    expect(p.valor).toBe(350);
    expect(p.fornecedor?.id).toBe('mv');
    expect(p.descricao).toBe('areia');
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('modelo fora do ar: vale o dos padrões', async () => {
    const chat = vi.fn(async () => ({ ok: false as const, status: 500, corpo: 'x' }));
    const p = await extrairCorrecao('o valor é 500', CTX, { chat: chat as never });
    expect(p).toEqual({ valor: 500 });
  });
});
