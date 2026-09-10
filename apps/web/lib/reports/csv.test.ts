import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

/**
 * `csvCell` não é exportada, então testamos através de `toCsv`, que é o
 * contrato real usado pelos exports. Cada célula vira `linha.split(',')`
 * quando não tem quoting.
 */
function primeiraLinha(csv: string): string {
  // Remove BOM e pega a primeira linha (separador é CRLF).
  return csv.replace(/^﻿/u, '').split('\r\n')[0] ?? '';
}

describe('toCsv — formato base', () => {
  it('emite BOM UTF-8 (Excel pt-BR precisa pra acento)', () => {
    expect(toCsv([['a']]).startsWith('﻿')).toBe(true);
  });

  it('usa CRLF como quebra de linha (RFC 4180)', () => {
    const csv = toCsv([['a'], ['b']]);
    expect(csv).toContain('a\r\nb');
  });

  it('termina com CRLF', () => {
    expect(toCsv([['a']]).endsWith('\r\n')).toBe(true);
  });

  it('separa colunas por vírgula', () => {
    expect(primeiraLinha(toCsv([['a', 'b', 'c']]))).toBe('a,b,c');
  });

  it('trata null e undefined como célula vazia', () => {
    expect(primeiraLinha(toCsv([[null, undefined, 'x']]))).toBe(',,x');
  });

  it('converte número para string sem alterar o valor', () => {
    expect(primeiraLinha(toCsv([[1500.5, 0, -3]]))).toBe('1500.5,0,-3');
  });
});

describe('toCsv — escaping RFC 4180', () => {
  it('envolve em aspas célula que contém vírgula', () => {
    expect(primeiraLinha(toCsv([['Obra, bloco A']]))).toBe('"Obra, bloco A"');
  });

  it('duplica aspas internas', () => {
    expect(primeiraLinha(toCsv([['Fornecedor "Silva"']]))).toBe('"Fornecedor ""Silva"""');
  });

  it('envolve em aspas célula com quebra de linha', () => {
    // O split de `primeiraLinha` e por CRLF; uma quebra solta dentro da
    // celula nao parte a linha, entao a celula inteira volta — entre aspas,
    // que e o que impede a quebra de virar uma linha nova no arquivo.
    expect(primeiraLinha(toCsv([['linha1\nlinha2']]))).toBe('"linha1\nlinha2"');
  });

  it('preserva acentos sem escapar', () => {
    expect(primeiraLinha(toCsv([['Construção São João']]))).toBe('Construção São João');
  });
});

/**
 * Regressão do finding D das auditorias de 2026-09-09: descrição/observação de
 * pagamento pode vir de texto livre do WhatsApp ou de CSV importado. Se a
 * célula começar com =, +, -, @ ou tab, Excel/Sheets interpretam como fórmula.
 */
describe('toCsv — formula injection (regressão do finding D)', () => {
  const perigosos = [
    ['=HYPERLINK("http://evil.example","clique")', 'fórmula ='],
    ['+1+1', 'fórmula +'],
    ['-1+1', 'fórmula -'],
    ['@SUM(A1:A9)', 'fórmula @'],
    ['\tvalor', 'tab'],
    ['\rvalor', 'CR'],
    ['=cmd|\' /C calc\'!A0', 'DDE / execução de comando'],
  ];

  for (const [payload, rotulo] of perigosos) {
    it(`neutraliza ${rotulo} com apóstrofo à frente`, () => {
      const celula = primeiraLinha(toCsv([[payload]]));
      const semAspas = celula.replace(/^"|"$/gu, '');
      expect(semAspas.startsWith("'")).toBe(true);
      // o conteúdo original continua legível depois do apóstrofo
      expect(semAspas.slice(1).replace(/""/gu, '"')).toBe(payload);
    });
  }

  it('não mexe em texto que apenas contém = no meio', () => {
    expect(primeiraLinha(toCsv([['total=500']]))).toBe('total=500');
  });

  it('não transforma número negativo em texto', () => {
    // Numero puro e isento do guard, senao todo valor negativo chegaria no
    // Excel como texto e quebraria a soma da coluna.
    expect(primeiraLinha(toCsv([[-3]]))).toBe('-3');
    expect(primeiraLinha(toCsv([['-1.234,56']]))).toBe('"-1.234,56"');
    // Mas "-1+1" parece numero so no comeco: continua barrado pelo guard.
    expect(primeiraLinha(toCsv([['-1+1']]))).toBe("'-1+1");
  });

  it('preserva valor monetário pt-BR normal', () => {
    // Sai entre aspas — obrigatorio, ja que a virgula decimal e tambem o
    // separador de colunas. O que importa e que NAO ganhou o apostrofo do
    // guard de formula: o valor continua sendo numero pro Excel.
    expect(primeiraLinha(toCsv([['1.500,00']]))).toBe('"1.500,00"');
  });
});
