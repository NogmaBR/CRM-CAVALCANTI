import { describe, expect, it } from 'vitest';
import { mesmoTelefoneBR, variantesTelefoneBR } from './telefone-br';

describe('variantesTelefoneBR', () => {
  it('celular com 9 (13 dígitos) também vale sem o 9 — é como o WhatsApp manda', () => {
    expect(variantesTelefoneBR('5573998489747')).toEqual(['5573998489747', '557398489747']);
  });

  it('JID sem o 9 (12 dígitos) também vale com o 9 — é como se cadastra', () => {
    expect(variantesTelefoneBR('557398489747@s.whatsapp.net')).toEqual([
      '557398489747',
      '5573998489747',
    ]);
  });

  it('fixo (8 dígitos começando em 2–5) não ganha 9', () => {
    expect(variantesTelefoneBR('555135641234')).toEqual(['555135641234']);
  });

  it('número estrangeiro (12+ dígitos, sem 55) fica como está', () => {
    expect(variantesTelefoneBR('+44 20 7946 0958')).toEqual(['442079460958']);
  });

  it('DDD + número sem DDI assume Brasil, como o cadastro', () => {
    expect(variantesTelefoneBR('(51) 99999-8888')).toEqual(['5551999998888', '555199998888']);
  });

  it('vazio não explode', () => {
    expect(variantesTelefoneBR('')).toEqual([]);
  });
});

describe('mesmoTelefoneBR', () => {
  it('cadastro com 9 e JID sem 9 são a mesma pessoa', () => {
    expect(mesmoTelefoneBR('(73) 99848-9747', '557398489747@s.whatsapp.net')).toBe(true);
    expect(mesmoTelefoneBR('5532988068174', '553288068174')).toBe(true);
  });

  it('números diferentes continuam diferentes', () => {
    expect(mesmoTelefoneBR('5573998489747', '5573998489748')).toBe(false);
    expect(mesmoTelefoneBR('5573998489747', '557388643112')).toBe(false);
  });
});
