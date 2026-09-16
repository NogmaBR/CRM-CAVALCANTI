import { describe, expect, it } from 'vitest';
import { mapTipoToDb } from './uazapi';

describe('mapTipoToDb', () => {
  it('imagem, figurinha, áudio, vídeo e texto', () => {
    expect(mapTipoToDb('image', 'image/jpeg')).toBe('imagem');
    expect(mapTipoToDb('sticker', 'image/webp')).toBe('imagem');
    expect(mapTipoToDb('audio', 'audio/ogg; codecs=opus')).toBe('audio');
    expect(mapTipoToDb('video', 'video/mp4')).toBe('video');
    expect(mapTipoToDb('text')).toBe('texto');
    expect(mapTipoToDb('location')).toBe('texto');
  });

  it('documento: só PDF é pdf; planilha e Word são arquivo; imagem mandada como documento é imagem', () => {
    expect(mapTipoToDb('document', 'application/pdf')).toBe('pdf');
    expect(
      mapTipoToDb('document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe('arquivo');
    expect(mapTipoToDb('document', 'application/msword')).toBe('arquivo');
    expect(mapTipoToDb('document', 'image/png')).toBe('imagem');
    expect(mapTipoToDb('document', 'video/quicktime')).toBe('video');
    expect(mapTipoToDb('document', null)).toBe('arquivo');
  });
});
