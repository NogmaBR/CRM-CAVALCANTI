import { describe, expect, it } from 'vitest';
import { resolverPorNome } from './resolver-nomes';

// Ids e nomes de fixture; os nomes reproduzem o incidente de 2026-09-16.
const FORN = [
  { id: 'f-mathias', nome: 'Mathias Velho' },
  { id: 'f-max', nome: 'Maximiliano' },
  { id: 'f-md', nome: 'MD Soluções Hidráulicas' },
  { id: 'f-alex', nome: 'Alex' },
  { id: 'f-altair', nome: 'Altair' },
];
const OBRAS = [
  { id: 'o-gari', nome: 'Garibaldi', apelidos: ['Gari'] },
  { id: 'o-ej', nome: 'Casa EJ', apelidos: ['EJ', 'E&J', 'Caminho do Meio'] },
  { id: 'o-inox', nome: 'INOX Piratini', apelidos: ['Inox', 'Piratini'] },
];

describe('resolverPorNome', () => {
  it('o caso do incidente: "Mathias Velho" é Mathias Velho, nunca Maximiliano', () => {
    expect(resolverPorNome('Mathias Velho', FORN)?.id).toBe('f-mathias');
    expect(resolverPorNome('mathias velho', FORN)?.id).toBe('f-mathias');
    expect(resolverPorNome('Ferragem Mathias Velho', FORN)?.id).toBe('f-mathias');
  });

  it('apelido e prefixo: "Max" é Maximiliano, "MD" é MD Soluções', () => {
    expect(resolverPorNome('Max', FORN)?.id).toBe('f-max');
    expect(resolverPorNome('MD Soluções', FORN)?.id).toBe('f-md');
  });

  it('obra por nome, apelido e grafia solta', () => {
    expect(resolverPorNome('Gari', OBRAS)?.id).toBe('o-gari');
    expect(resolverPorNome('garibaldi', OBRAS)?.id).toBe('o-gari');
    expect(resolverPorNome('E&J', OBRAS)?.id).toBe('o-ej');
    expect(resolverPorNome('caminho do meio', OBRAS)?.id).toBe('o-ej');
    expect(resolverPorNome('inox', OBRAS)?.id).toBe('o-inox');
  });

  it('ambíguo não resolve: "Al" bate em Alex e Altair', () => {
    expect(resolverPorNome('Al', FORN)).toBeUndefined();
  });

  it('desconhecido, vazio e null não resolvem', () => {
    expect(resolverPorNome('Cassol', FORN)).toBeUndefined();
    expect(resolverPorNome('', FORN)).toBeUndefined();
    expect(resolverPorNome(null, FORN)).toBeUndefined();
  });

  it('prefixo curto demais (2 letras) não conta como parecido', () => {
    expect(resolverPorNome('Ma', [{ id: 'x', nome: 'Maximiliano' }])).toBeUndefined();
  });
});
