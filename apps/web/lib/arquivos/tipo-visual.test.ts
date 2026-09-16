import { describe, expect, it } from 'vitest';
import { rotuloDoMime, tipoVisual, urlDoArquivo } from './tipo-visual';

describe('tipoVisual', () => {
  it('separa imagem, pdf, vídeo, áudio e o resto', () => {
    expect(tipoVisual('image/jpeg')).toBe('imagem');
    expect(tipoVisual('IMAGE/PNG')).toBe('imagem');
    expect(tipoVisual('application/pdf')).toBe('pdf');
    expect(tipoVisual('video/mp4')).toBe('video');
    expect(tipoVisual('audio/ogg; codecs=opus')).toBe('audio');
    expect(tipoVisual('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(
      'outro',
    );
    expect(tipoVisual('image/vnd.dwg')).toBe('outro');
    expect(tipoVisual(null)).toBe('outro');
    expect(tipoVisual('')).toBe('outro');
  });
});

describe('rotuloDoMime', () => {
  it('nomeia o que não tem pré-visualização', () => {
    expect(rotuloDoMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(
      'Planilha',
    );
    expect(rotuloDoMime('application/vnd.ms-excel')).toBe('Planilha');
    expect(
      rotuloDoMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe('Word');
    expect(rotuloDoMime('image/vnd.dwg')).toBe('Projeto CAD');
    expect(rotuloDoMime('application/zip')).toBe('Compactado');
    expect(rotuloDoMime('application/pdf')).toBe('PDF');
    expect(rotuloDoMime('video/quicktime')).toBe('Vídeo');
    expect(rotuloDoMime(null)).toBe('Arquivo');
  });
});

describe('urlDoArquivo', () => {
  it('monta a rota nos três modos', () => {
    expect(urlDoArquivo('documento', 'abc')).toBe('/api/arquivos/documento/abc');
    expect(urlDoArquivo('mensagem', 'abc', 'baixar')).toBe('/api/arquivos/mensagem/abc?baixar=1');
    expect(urlDoArquivo('registro', 'abc', 'miniatura')).toBe(
      '/api/arquivos/registro/abc?miniatura=1',
    );
  });
});
