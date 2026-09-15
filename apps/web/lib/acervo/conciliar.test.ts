import { describe, expect, it } from 'vitest';
import { type PagamentoCandidato, decidirConciliacao, escolherCandidato } from './conciliar';

/**
 * A regra é conservadora de propósito: vincular a nota errada a um pagamento
 * é pior que deixar as duas coisas separadas para o gestor ligar à mão. Um
 * candidato só, valor exato, data perto — senão, nada.
 */

const cand = (
  id: string,
  valor: number,
  data: string,
  fornecedor: string | null = null,
): PagamentoCandidato => ({
  id,
  valor,
  data_pagamento: data,
  fornecedor_id: fornecedor,
});

describe('escolherCandidato', () => {
  it('um candidato com valor igual e data dentro de 7 dias', () => {
    const r = escolherCandidato({ valor: 3450, data: '2026-01-10' }, [
      cand('p1', 3450, '2026-01-13'),
    ]);
    expect(r?.id).toBe('p1');
  });

  it('tolera um centavo, não mais', () => {
    expect(
      escolherCandidato({ valor: 3450, data: null }, [cand('p1', 3450.01, '2026-01-10')])?.id,
    ).toBe('p1');
    expect(
      escolherCandidato({ valor: 3450, data: null }, [cand('p1', 3450.5, '2026-01-10')]),
    ).toBeNull();
  });

  it('data a mais de 7 dias descarta', () => {
    expect(
      escolherCandidato({ valor: 3450, data: '2026-01-10' }, [cand('p1', 3450, '2026-01-25')]),
    ).toBeNull();
  });

  it('sem data extraída, só o valor decide', () => {
    expect(
      escolherCandidato({ valor: 3450, data: null }, [cand('p1', 3450, '2026-03-01')])?.id,
    ).toBe('p1');
  });

  it('dois candidatos iguais é ambíguo → null', () => {
    expect(
      escolherCandidato({ valor: 3450, data: '2026-01-10' }, [
        cand('p1', 3450, '2026-01-10'),
        cand('p2', 3450, '2026-01-12'),
      ]),
    ).toBeNull();
  });

  it('dois com o mesmo valor, mas só um na janela de data → esse', () => {
    expect(
      escolherCandidato({ valor: 3450, data: '2026-01-10' }, [
        cand('p1', 3450, '2026-01-10'),
        cand('p2', 3450, '2026-02-20'),
      ])?.id,
    ).toBe('p1');
  });

  it('sem valor extraído não casa nada', () => {
    expect(
      escolherCandidato({ valor: null, data: '2026-01-10' }, [cand('p1', 3450, '2026-01-10')]),
    ).toBeNull();
  });
});

describe('decidirConciliacao', () => {
  it('vinculado: preenche o que o documento e o pagamento não tinham', () => {
    const r = decidirConciliacao({
      documento: { id: 'd1', tipo: 'outro', numero_nf: null, fornecedor_id: null },
      extraido: {
        valor: 100,
        data: null,
        numero_nf: '55',
        fornecedor_id: 'f1',
        tipo_documento: 'nota_fiscal',
      },
      candidatos: [cand('p1', 100, '2026-01-01')],
    });
    expect(r.resultado).toBe('vinculado');
    expect(r.documento).toEqual({
      pagamento_id: 'p1',
      tipo: 'nota_fiscal',
      numero_nf: '55',
      fornecedor_id: 'f1',
    });
    expect(r.pagamento).toEqual({ id: 'p1', fornecedor_id: 'f1' });
  });

  it('não sobrescreve tipo, número ou fornecedor já preenchidos', () => {
    const r = decidirConciliacao({
      documento: { id: 'd1', tipo: 'comprovante', numero_nf: '1', fornecedor_id: 'f0' },
      extraido: {
        valor: 100,
        data: null,
        numero_nf: '55',
        fornecedor_id: 'f1',
        tipo_documento: 'nota_fiscal',
      },
      candidatos: [cand('p1', 100, '2026-01-01', 'f9')],
    });
    expect(r.documento).toEqual({ pagamento_id: 'p1' });
    expect(r.pagamento).toBeNull();
  });

  it('ambíguo e sem candidato não vinculam, mas guardam número e tipo', () => {
    const amb = decidirConciliacao({
      documento: { id: 'd1', tipo: 'outro', numero_nf: null, fornecedor_id: null },
      extraido: {
        valor: 100,
        data: null,
        numero_nf: '55',
        fornecedor_id: null,
        tipo_documento: 'nota_fiscal',
      },
      candidatos: [cand('p1', 100, '2026-01-01'), cand('p2', 100, '2026-01-02')],
    });
    expect(amb.resultado).toBe('ambiguo');
    expect(amb.documento).toEqual({ tipo: 'nota_fiscal', numero_nf: '55' });

    const nada = decidirConciliacao({
      documento: { id: 'd1', tipo: 'outro', numero_nf: null, fornecedor_id: null },
      extraido: {
        valor: 100,
        data: null,
        numero_nf: null,
        fornecedor_id: null,
        tipo_documento: null,
      },
      candidatos: [],
    });
    expect(nada.resultado).toBe('sem_candidato');
    expect(nada.documento).toEqual({});
  });
});
