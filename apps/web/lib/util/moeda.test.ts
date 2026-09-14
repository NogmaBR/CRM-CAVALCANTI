import { describe, expect, it } from 'vitest';
import { formatarValorBR, parseValorBR } from './moeda';

/**
 * O campo de valor deixou de ser `type="number"` (design review, M5):
 * agora quem lê o que o brasileiro digita é `parseValorBR`. Estes testes
 * fixam os cinco formatos aceitos e as duas ambiguidades de ponto/vírgula.
 */
describe('parseValorBR — os cinco formatos do formulário', () => {
  it('"1.250,00" (pt-BR completo)', () => {
    expect(parseValorBR('1.250,00')).toBe(1250);
  });

  it('"1250,00" (vírgula sem milhar)', () => {
    expect(parseValorBR('1250,00')).toBe(1250);
  });

  it('"1250.00" (ponto decimal, padrão do teclado numérico)', () => {
    expect(parseValorBR('1250.00')).toBe(1250);
  });

  it('"R$ 1.250,00" (colado de outro lugar, com prefixo)', () => {
    expect(parseValorBR('R$ 1.250,00')).toBe(1250);
    expect(parseValorBR('R$1.250,00')).toBe(1250);
  });

  it('"1250" (inteiro)', () => {
    expect(parseValorBR('1250')).toBe(1250);
  });
});

describe('parseValorBR — ambiguidades de ponto e vírgula', () => {
  it('"1.250" é mil duzentos e cinquenta (ponto de milhar)', () => {
    expect(parseValorBR('1.250')).toBe(1250);
  });

  it('"1,250" é um vírgula vinte e cinco (vírgula é sempre decimal)', () => {
    expect(parseValorBR('1,250')).toBe(1.25);
  });

  it('"1.250.000,50" e "1.250.000" (vários grupos de milhar)', () => {
    expect(parseValorBR('1.250.000,50')).toBe(1250000.5);
    expect(parseValorBR('1.250.000')).toBe(1250000);
  });

  it('"12.5" é doze e meio (um ponto fora do padrão de milhar é decimal)', () => {
    expect(parseValorBR('12.5')).toBe(12.5);
  });

  it('"0,50" e "0.50" são cinquenta centavos', () => {
    expect(parseValorBR('0,50')).toBe(0.5);
    expect(parseValorBR('0.50')).toBe(0.5);
  });

  it('aceita o espaço fino que o Intl põe depois do "R$"', () => {
    expect(
      parseValorBR((1250).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })),
    ).toBe(1250);
  });
});

describe('parseValorBR — rejeições', () => {
  it('rejeita "abc"', () => {
    expect(parseValorBR('abc')).toBeNull();
  });

  it('rejeita vazio e só espaços', () => {
    expect(parseValorBR('')).toBeNull();
    expect(parseValorBR('   ')).toBeNull();
  });

  it('rejeita duas vírgulas, dois pontos decimais e letras misturadas', () => {
    expect(parseValorBR('1,250,00')).toBeNull();
    expect(parseValorBR('1.2.3')).toBeNull();
    expect(parseValorBR('12abc')).toBeNull();
    expect(parseValorBR('1.250,')).toBeNull();
  });

  it('negativo passa aqui (o schema é quem rejeita valor < 0)', () => {
    expect(parseValorBR('-10,00')).toBe(-10);
  });
});

describe('formatarValorBR — o que o campo mostra ao editar', () => {
  it('1250 → "1.250,00"', () => {
    expect(formatarValorBR(1250)).toBe('1.250,00');
  });

  it('aceita a string NUMERIC que o Postgres devolve', () => {
    expect(formatarValorBR('1250.5')).toBe('1.250,50');
  });

  it('nulo e inválido viram vazio (o campo fica em branco)', () => {
    expect(formatarValorBR(null)).toBe('');
    expect(formatarValorBR(undefined)).toBe('');
    expect(formatarValorBR('abc')).toBe('');
  });

  it('vai e volta sem perder centavos', () => {
    expect(parseValorBR(formatarValorBR(98765.43))).toBe(98765.43);
  });
});
