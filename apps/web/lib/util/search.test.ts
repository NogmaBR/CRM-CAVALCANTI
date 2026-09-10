import { describe, it, expect } from 'vitest';
import { sanitizeSearchQuery } from './search';

/**
 * Estes testes existem por causa de PostgREST filter injection: a busca é
 * interpolada em `.or('col.ilike.%q%,outra.ilike.%q%')`, então vírgula,
 * parênteses, dois-pontos e wildcards são metacaracteres — se passarem, o
 * usuário consegue reescrever o filtro.
 */
describe('sanitizeSearchQuery — metacaracteres do PostgREST', () => {
  it('remove vírgula (separador de OR)', () => {
    expect(sanitizeSearchQuery('obra,fornecedor')).toBe('obra fornecedor');
  });

  it('remove parênteses (agrupadores)', () => {
    expect(sanitizeSearchQuery('(nome)')).toBe('nome');
  });

  it('remove dois-pontos (separador de operador)', () => {
    expect(sanitizeSearchQuery('status:ativo')).toBe('status ativo');
  });

  it('remove barra invertida (escape)', () => {
    expect(sanitizeSearchQuery('c:\\temp')).toBe('c  temp'.trim());
  });

  it('remove wildcards % e * (evita scan aberto)', () => {
    expect(sanitizeSearchQuery('%')).toBe('');
    expect(sanitizeSearchQuery('*')).toBe('');
    expect(sanitizeSearchQuery('%abc*')).toBe('abc');
  });

  it('neutraliza tentativa de injeção de filtro completa', () => {
    const ataque = 'x,or(id.gt.0),nome.ilike.%';
    const limpo = sanitizeSearchQuery(ataque);
    for (const meta of [',', '(', ')', '%', '*', ':', '\\']) {
      expect(limpo).not.toContain(meta);
    }
  });
});

describe('sanitizeSearchQuery — preserva busca legítima', () => {
  it('mantém letras, números e espaço', () => {
    expect(sanitizeSearchQuery('Obra 42')).toBe('Obra 42');
  });

  it('mantém acentos e cedilha (nomes em pt-BR)', () => {
    expect(sanitizeSearchQuery('Construções São João')).toBe('Construções São João');
  });

  it('mantém hífen, ponto e barra — usados em CNPJ e nomes', () => {
    expect(sanitizeSearchQuery('12.345.678/0001-90')).toBe('12.345.678/0001-90');
  });

  it('mantém & e acento agudo em razão social', () => {
    expect(sanitizeSearchQuery('Almeida & Filhos')).toBe('Almeida & Filhos');
  });

  it('apara espaços nas pontas', () => {
    expect(sanitizeSearchQuery('  cimento  ')).toBe('cimento');
  });

  it('string vazia continua vazia', () => {
    expect(sanitizeSearchQuery('')).toBe('');
    expect(sanitizeSearchQuery('   ')).toBe('');
  });

  it('é idempotente — sanitizar duas vezes dá o mesmo resultado', () => {
    const entradas = ['obra,x', '%teste%', 'Construções São João', '(a):(b)'];
    for (const e of entradas) {
      const uma = sanitizeSearchQuery(e);
      expect(sanitizeSearchQuery(uma)).toBe(uma);
    }
  });
});
