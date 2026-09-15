import { describe, expect, it } from 'vitest';
import { type Opcao, formatarOpcoes, interpretarEscolha } from './escolha';

/**
 * Mesma assimetria do parser de SIM: escolher a obra errada arquiva o
 * documento no lugar errado; não escolher só deixa a pergunta aberta. Então
 * só resposta inequívoca vale — número, ordinal por extenso, ou o nome/apelido
 * da obra e mais nada em volta.
 */

const OPCOES: Opcao[] = [
  { n: 1, id: 'a', nome: 'Aguirre', apelidos: [] },
  { n: 2, id: 'b', nome: 'Garibaldi', apelidos: ['Gari'] },
  { n: 3, id: 'c', nome: 'Casa EJ', apelidos: ['EJ', 'E&J', 'Caminho do Meio'] },
];

describe('interpretarEscolha — aceita', () => {
  const casos: Array<[string, string]> = [
    ['2', 'b'],
    [' 2 ', 'b'],
    ['2)', 'b'],
    ['2.', 'b'],
    ['(2)', 'b'],
    ['opção 2', 'b'],
    ['opcao 2', 'b'],
    ['a 2', 'b'],
    ['dois', 'b'],
    ['segunda', 'b'],
    ['um', 'a'],
    ['primeira', 'a'],
    ['três', 'c'],
    ['garibaldi', 'b'],
    ['Garibaldi', 'b'],
    ['gari', 'b'],
    ['da Garibaldi', 'b'],
    ['é da garibaldi', 'b'],
    ['na EJ', 'c'],
    ['e&j', 'c'],
    ['caminho do meio', 'c'],
    ['2 garibaldi', 'b'],
  ];
  for (const [texto, id] of casos) {
    it(`"${texto}" → ${id}`, () => {
      expect(interpretarEscolha(texto, OPCOES)?.id).toBe(id);
    });
  }
});

describe('interpretarEscolha — recusa', () => {
  const casos = [
    '',
    '   ',
    'não sei',
    '12',
    '0',
    '4',
    '2 ou 3',
    'acho que é a 2, mas pode ser a 3',
    'garibaldi ou aguirre',
    'manda pra garibaldi que eu pago amanhã 500 reais',
    'sim',
    'ok',
    'obra',
  ];
  for (const texto of casos) {
    it(`"${texto}" → null`, () => {
      expect(interpretarEscolha(texto, OPCOES)).toBeNull();
    });
  }

  it('null e undefined', () => {
    expect(interpretarEscolha(null, OPCOES)).toBeNull();
    expect(interpretarEscolha(undefined, OPCOES)).toBeNull();
  });

  it('número e nome que discordam → null', () => {
    expect(interpretarEscolha('2 aguirre', OPCOES)).toBeNull();
  });
});

describe('formatarOpcoes', () => {
  it('lista numerada, uma por linha', () => {
    expect(formatarOpcoes(OPCOES)).toBe('1) Aguirre\n2) Garibaldi\n3) Casa EJ');
  });
});
