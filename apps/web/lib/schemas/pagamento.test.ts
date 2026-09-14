import { describe, expect, it } from 'vitest';
import { PagamentoCreateSchema, PagamentoUpdateSchema } from './pagamento';

const OBRA = '11111111-1111-4111-8111-111111111111';
const base = { obra_id: OBRA, data_pagamento: '2026-09-14' };

/**
 * O campo de valor virou texto livre (M5): o schema é quem lê "1.250,00".
 * As mensagens são as que `form-erros.ts` mostra ao lado do campo, por isso
 * estão fixadas aqui em português.
 */
describe('PagamentoCreateSchema.valor — texto como o brasileiro digita', () => {
  it('lê os cinco formatos como 1250', () => {
    for (const valor of ['1.250,00', '1250,00', '1250.00', 'R$ 1.250,00', '1250']) {
      const r = PagamentoCreateSchema.safeParse({ ...base, valor });
      expect(r.success, valor).toBe(true);
      if (r.success) expect(r.data.valor).toBe(1250);
    }
  });

  it('vazio é "obrigatório", apontando o campo valor', () => {
    const r = PagamentoCreateSchema.safeParse({ ...base, valor: '  ' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['valor']);
      expect(r.error.issues[0]?.message).toBe('obrigatório');
    }
  });

  it('texto que não é número explica o formato esperado', () => {
    const r = PagamentoCreateSchema.safeParse({ ...base, valor: 'abc' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('informe um valor como 1.250,00');
  });

  it('negativo é recusado', () => {
    const r = PagamentoCreateSchema.safeParse({ ...base, valor: '-10,00' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('não pode ser negativo');
  });

  it('no update, valor continua sendo lido no mesmo formato', () => {
    const r = PagamentoUpdateSchema.safeParse({ id: OBRA, valor: '2.500,50' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.valor).toBe(2500.5);
  });
});
