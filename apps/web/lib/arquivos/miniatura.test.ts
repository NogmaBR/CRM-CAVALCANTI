import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { LARGURA_MINIATURA, gerarMiniatura } from './miniatura';

describe('gerarMiniatura', () => {
  it('reduz uma imagem grande a um JPEG que cabe em 480 px', async () => {
    const grande = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: '#336699' },
    })
      .png()
      .toBuffer();

    const mini = await gerarMiniatura(new Uint8Array(grande), 'image/png');
    expect(mini).not.toBeNull();
    // Assinatura JPEG: FF D8 FF
    expect([...(mini as Buffer).subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    const meta = await sharp(mini as Buffer).metadata();
    expect(meta.width).toBe(LARGURA_MINIATURA);
    expect(meta.height).toBe(270);
  });

  it('imagem pequena não é ampliada', async () => {
    const pequena = await sharp({
      create: { width: 120, height: 80, channels: 3, background: '#000' },
    })
      .jpeg()
      .toBuffer();
    const mini = await gerarMiniatura(new Uint8Array(pequena), 'image/jpeg');
    const meta = await sharp(mini as Buffer).metadata();
    expect(meta.width).toBe(120);
  });

  it('não-imagem e bytes que não são imagem → null, sem lançar', async () => {
    expect(await gerarMiniatura(new Uint8Array([1, 2, 3]), 'application/pdf')).toBeNull();
    expect(await gerarMiniatura(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 'image/jpeg')).toBeNull();
  });
});
