import { describe, expect, it } from 'vitest';
import {
  avancoFisico,
  compararFisicoComFinanceiro,
  fraseDoTripe,
  orcadoVsRealizado,
  situacaoDaEtapa,
} from './cronograma';

describe('avancoFisico', () => {
  it('sem etapas é nulo', () => {
    expect(avancoFisico([])).toBeNull();
  });
  it('média ponderada pelo peso', () => {
    expect(
      avancoFisico([
        { peso: 3, percentual_concluido: 100 },
        { peso: 1, percentual_concluido: 0 },
      ]),
    ).toBe(75);
  });
  it('ignora peso zero e trava em 0–100', () => {
    expect(
      avancoFisico([
        { peso: 0, percentual_concluido: 100 },
        { peso: 1, percentual_concluido: 130 },
        { peso: 1, percentual_concluido: -5 },
      ]),
    ).toBe(50);
  });
});

describe('compararFisicoComFinanceiro e fraseDoTripe', () => {
  it('dez pontos de folga', () => {
    expect(compararFisicoComFinanceiro(60, 45)).toBe('obra_na_frente');
    expect(compararFisicoComFinanceiro(45, 60)).toBe('dinheiro_na_frente');
    expect(compararFisicoComFinanceiro(50, 55)).toBe('em_linha');
    expect(compararFisicoComFinanceiro(null, 55)).toBeNull();
  });
  it('frase sem medição orienta a cadastrar', () => {
    expect(fraseDoTripe({ fisicoPct: null, financeiroPct: 40, prazoPct: 30 })).toContain(
      'laje 100%',
    );
  });
  it('frase com os três números e a leitura', () => {
    const f = fraseDoTripe({ fisicoPct: 60, financeiroPct: 45, prazoPct: 33 });
    expect(f).toBe(
      '60% da obra executada, 45% do contrato gasto, 33% do prazo usado. A obra avança mais rápido que o dinheiro sai — bom sinal.',
    );
    expect(fraseDoTripe({ fisicoPct: 30, financeiroPct: 60, prazoPct: null })).toContain(
      'vale conferir o orçado por etapa',
    );
    expect(fraseDoTripe({ fisicoPct: 30, financeiroPct: null, prazoPct: null })).toContain(
      'Informe o contrato',
    );
  });
});

describe('orcadoVsRealizado', () => {
  const nomes = new Map([
    ['a', 'Alvenaria'],
    ['e', 'Estrutura'],
    ['h', 'Hidráulica'],
  ]);
  it('situações: ok, atenção (≥90%), estourado (>100%), sem orçado', () => {
    expect(situacaoDaEtapa(1000, 500)).toBe('ok');
    expect(situacaoDaEtapa(1000, 900)).toBe('atencao');
    expect(situacaoDaEtapa(1000, 1000.01)).toBe('estourado');
    expect(situacaoDaEtapa(null, 10)).toBe('sem_orcado');
  });
  it('estouradas primeiro, depois por orçado, sem orçado no fim; totais', () => {
    const r = orcadoVsRealizado(
      [
        { categoria_id: 'a', valor: 10_000 },
        { categoria_id: 'e', valor: 50_000 },
      ],
      new Map([
        ['a', 12_000],
        ['e', 20_000],
        ['h', 3_000.5],
      ]),
      nomes,
    );
    expect(r.linhas.map((l) => l.categoria)).toEqual(['Alvenaria', 'Estrutura', 'Hidráulica']);
    expect(r.linhas[0]).toMatchObject({ situacao: 'estourado', saldo: -2000, pct: 120 });
    expect(r.linhas[1]).toMatchObject({ situacao: 'ok', saldo: 30_000, pct: 40 });
    expect(r.linhas[2]).toMatchObject({ situacao: 'sem_orcado', orcado: null, pct: null });
    expect(r.totais).toEqual({ orcado: 60_000, realizado: 35_000.5, estouradas: 1 });
  });
  it('categoria orçada sem gasto aparece com realizado zero', () => {
    const r = orcadoVsRealizado([{ categoria_id: 'a', valor: 100 }], new Map(), nomes);
    expect(r.linhas[0]).toMatchObject({ realizado: 0, saldo: 100, pct: 0, situacao: 'ok' });
  });
});
