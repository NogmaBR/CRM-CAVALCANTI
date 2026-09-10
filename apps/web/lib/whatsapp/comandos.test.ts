import { describe, expect, it } from 'vitest';
import { interpretarComando } from './comandos';

/**
 * O risco aqui é o espelho do de `resposta.ts`: se uma mensagem que é
 * lançamento for lida como comando, o pagamento **não é registrado** — o bot
 * responde um resumo e o gasto some. Por isso a maior parte dos casos abaixo
 * verifica que algo NÃO virou comando.
 */

describe('interpretarComando — comandos reconhecidos', () => {
  it('reconhece resumo', () => {
    expect(interpretarComando('resumo')).toEqual({ tipo: 'resumo' });
    expect(interpretarComando('Resumo')).toEqual({ tipo: 'resumo' });
    expect(interpretarComando('resumo geral')).toEqual({ tipo: 'resumo' });
    expect(interpretarComando('como estamos?')).toEqual({ tipo: 'resumo' });
  });

  it('reconhece pendências, com e sem acento', () => {
    expect(interpretarComando('pendências')).toEqual({ tipo: 'pendencias' });
    expect(interpretarComando('pendencias')).toEqual({ tipo: 'pendencias' });
    expect(interpretarComando('PENDENTES')).toEqual({ tipo: 'pendencias' });
  });

  it('reconhece ajuda', () => {
    expect(interpretarComando('ajuda')).toEqual({ tipo: 'ajuda' });
    expect(interpretarComando('comandos')).toEqual({ tipo: 'ajuda' });
  });
});

describe('interpretarComando — gasto por obra', () => {
  const variantes: Array<[string, string]> = [
    ['quanto gastei em Recreio', 'recreio'],
    ['quanto gastei na obra Recreio', 'recreio'],
    ['quanto eu já gastei no Recreio', 'recreio'],
    ['quanto foi gasto na Aura Legano', 'aura legano'],
    ['quanto custou a obra Garibaldi', 'garibaldi'],
    ['total da obra Recreio', 'recreio'],
    ['gastos da Aura', 'aura'],
  ];

  for (const [frase, esperado] of variantes) {
    it(`extrai a obra de ${JSON.stringify(frase)}`, () => {
      expect(interpretarComando(frase)).toEqual({ tipo: 'gasto_obra', obra: esperado });
    });
  }

  it('ignora nome de obra curto demais pra ser real', () => {
    expect(interpretarComando('quanto gastei em a')).toBeNull();
  });
});

describe('interpretarComando — o que NÃO pode virar comando', () => {
  const naoComandos = [
    // Lançamentos reais: se virarem comando, o pagamento nao e registrado.
    'paguei 1200 de areia pro Ze da obra do Recreio',
    'segue a nota do material',
    'transferi 3500 pro pedreiro hoje',
    'comprei cimento 890',
    // Conversa comum.
    'bom dia',
    'obrigado',
    'ok',
    'sim',
    // Frase longa que menciona gasto mas nao e pergunta.
    'o gasto da obra do Recreio esse mes foi maior do que a gente esperava',
    // Vazios.
    '',
    '   ',
  ];

  for (const texto of naoComandos) {
    it(`não vira comando: ${JSON.stringify(texto)}`, () => {
      expect(interpretarComando(texto)).toBeNull();
    });
  }

  it('não vira comando em null nem undefined', () => {
    expect(interpretarComando(null)).toBeNull();
    expect(interpretarComando(undefined)).toBeNull();
  });
});
