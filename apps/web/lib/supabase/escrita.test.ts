import type { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { NADA_ALTERADO, erroDeEscrita } from './escrita';

/**
 * Com RLS, "sem permissão" chega como sucesso com zero linhas. O helper tem
 * que tratar os três casos: erro do banco, zero linhas e pelo menos uma.
 */
describe('erroDeEscrita', () => {
  it('erro do Postgres vira mensagem humana', () => {
    const error = {
      code: '23505',
      message: 'duplicate key',
      details: '',
      hint: '',
    } as PostgrestError;
    const msg = erroDeEscrita({ data: null, error });
    expect(msg).toBeTruthy();
    expect(msg).not.toContain('duplicate key');
  });

  it('zero linhas (RLS filtrou) é erro, não sucesso', () => {
    expect(erroDeEscrita({ data: [], error: null })).toBe(NADA_ALTERADO);
    expect(erroDeEscrita({ data: null, error: null })).toBe(NADA_ALTERADO);
  });

  it('uma linha afetada é sucesso', () => {
    expect(erroDeEscrita({ data: [{ id: 'x' }], error: null })).toBeNull();
  });
});
