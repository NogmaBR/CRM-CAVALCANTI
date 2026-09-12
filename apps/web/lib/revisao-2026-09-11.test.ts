import { describe, expect, it } from 'vitest';
import { MockClassifier } from './ia/mock-classifier';
import { parseCsv } from './util/csv-parser';
import { hojeBR, inicioDoMesBR, inicioDoMesPassadoBR } from './util/datas';
import { interpretarResposta } from './whatsapp/resposta';

/**
 * Os bugs que a revisão de 2026-09-11 achou em funções puras, pinados.
 * Cada `it` reproduz o caso exato do achado; se voltar, falha aqui.
 */

describe('classificador simulado — valores', () => {
  const ctx = { obrasAtivas: [], fornecedoresConhecidos: [] };
  const valorDe = async (texto: string) =>
    (
      await new MockClassifier().classify({
        texto,
        midiaUrl: null,
        midiaMime: null,
        telefone: '5551',
        contexto: ctx,
      })
    ).extracted.valor;

  it('"1200" é mil e duzentos, não cento e vinte', async () => {
    expect(await valorDe('paguei 1200 de areia')).toBe(1200);
    expect(await valorDe('R$ 1500')).toBe(1500);
    expect(await valorDe('pix de 3500 pro ze')).toBe(3500);
    expect(await valorDe('12000')).toBe(12000);
  });

  it('continua lendo os formatos com separador', async () => {
    expect(await valorDe('R$ 1.234,56')).toBe(1234.56);
    expect(await valorDe('500,00')).toBe(500);
    expect(await valorDe('R$ 500')).toBe(500);
  });
});

describe('interpretarResposta — o que a revisão pegou', () => {
  it('pergunta não confirma', () => {
    expect(interpretarResposta('sim?')).toBe('outro');
    expect(interpretarResposta('ok?')).toBe('outro');
    expect(interpretarResposta('confirma?')).toBe('outro');
    expect(interpretarResposta('nao?')).toBe('outro');
  });

  it('emoji contraditório não age, em nenhuma direção', () => {
    expect(interpretarResposta('sim 👎')).toBe('outro');
    expect(interpretarResposta('ok ❌')).toBe('outro');
    expect(interpretarResposta('nao 👍')).toBe('outro');
  });

  it('o caminho feliz continua igual', () => {
    expect(interpretarResposta('sim')).toBe('sim');
    expect(interpretarResposta('ok 👍')).toBe('sim');
    expect(interpretarResposta('nao')).toBe('nao');
    expect(interpretarResposta('não, o valor é 500')).toBe('outro');
  });
});

describe('datas em Brasília', () => {
  it('22h de terça em Brasília ainda é terça, mesmo sendo quarta em UTC', () => {
    // 2026-09-15T22:30 em Brasília = 2026-09-16T01:30Z
    const instante = new Date('2026-09-16T01:30:00Z');
    expect(hojeBR(instante)).toBe('2026-09-15');
  });

  it('virada de mês respeita o fuso', () => {
    const instante = new Date('2026-10-01T01:00:00Z'); // 30/09 22h em Brasília
    expect(hojeBR(instante)).toBe('2026-09-30');
    expect(inicioDoMesBR(instante)).toBe('2026-09-01');
    expect(inicioDoMesPassadoBR(instante)).toBe('2026-08-01');
  });

  it('janeiro volta para dezembro do ano anterior', () => {
    expect(inicioDoMesPassadoBR(new Date('2026-01-15T12:00:00Z'))).toBe('2025-12-01');
  });
});

describe('CSV com separador sobrando no fim da linha (Excel)', () => {
  it('não gera cabeçalho vazio nem coluna extra', () => {
    const r = parseCsv('obra,valor,\nGaribaldi,100,\nRecreio,200,\n');
    expect(r.headers).toEqual(['obra', 'valor']);
    expect(r.rows).toEqual([
      ['Garibaldi', '100'],
      ['Recreio', '200'],
    ]);
  });
});
