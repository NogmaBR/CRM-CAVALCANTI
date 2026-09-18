import { describe, expect, it } from 'vitest';
import {
  PALETA_AUTO as PALETA_MJS,
  corAutomatica as corMjs,
} from '../../../../scripts/lib/cor-categoria-core.mjs';
import { PALETA_AUTO, corAutomatica, corDaCategoria, hashTexto } from './cor';

describe('corDaCategoria', () => {
  it('cadastrada vence; vazia cai na automática', () => {
    expect(corDaCategoria({ id: 'x', cor: '#123456' })).toBe('#123456');
    expect(corDaCategoria({ id: 'x', cor: '  ' })).toBe(corAutomatica('x'));
    expect(corDaCategoria({ id: 'x', cor: null })).toBe(corAutomatica('x'));
  });
  it('é determinística e cobre a paleta', () => {
    expect(corAutomatica('abc')).toBe(corAutomatica('abc'));
    const vistas = new Set(Array.from({ length: 200 }, (_, i) => corAutomatica(`id-${i}`)));
    expect(vistas.size).toBe(PALETA_AUTO.length);
  });
  it('hash conhecido (FNV-1a)', () => {
    expect(hashTexto('')).toBe(0x811c9dc5);
    expect(hashTexto('a')).toBe(0xe40c292c);
  });
  it('o script .mjs dá exatamente a mesma cor que o app', () => {
    expect([...PALETA_MJS]).toEqual([...PALETA_AUTO]);
    for (const id of ['1', 'garibaldi', '0b1c2d3e-0000-4000-8000-000000000000', 'áéí']) {
      expect(corMjs(id)).toBe(corAutomatica(id));
    }
  });
});
