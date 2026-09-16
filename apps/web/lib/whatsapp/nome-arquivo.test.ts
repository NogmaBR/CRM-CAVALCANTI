import { describe, expect, it } from 'vitest';
import { extensaoDoMime, nomeArquivoDaMidia, sanitizarNomeDeArquivo } from './nome-arquivo';

// 17:32 UTC = 14:32 em Brasília.
const QUANDO = new Date('2026-09-16T17:32:10Z');

describe('nomeArquivoDaMidia', () => {
  it('foto sem nome: data, hora de Brasília, tipo e remetente', () => {
    expect(
      nomeArquivoDaMidia({
        tipo: 'image',
        mime: 'image/jpeg',
        remetente: 'Társis Barreto',
        quando: QUANDO,
      }),
    ).toBe('2026-09-16_14h32_foto_tarsis-barreto.jpeg');
  });

  it('áudio, vídeo e figurinha têm palavra própria; sem remetente vira "equipe"', () => {
    expect(
      nomeArquivoDaMidia({ tipo: 'audio', mime: 'audio/ogg; codecs=opus', quando: QUANDO }),
    ).toBe('2026-09-16_14h32_audio_equipe.ogg');
    expect(
      nomeArquivoDaMidia({ tipo: 'video', mime: 'video/mp4', remetente: 'Hugo', quando: QUANDO }),
    ).toBe('2026-09-16_14h32_video_hugo.mp4');
    expect(nomeArquivoDaMidia({ tipo: 'sticker', mime: 'image/webp', quando: QUANDO })).toBe(
      '2026-09-16_14h32_figurinha_equipe.webp',
    );
  });

  it('documento com nome declarado mantém o nome, sanitizado', () => {
    expect(
      nomeArquivoDaMidia({
        tipo: 'document',
        mime: 'application/pdf',
        nomeDeclarado: 'Orçamento elétrica (v2).pdf',
        quando: QUANDO,
      }),
    ).toBe('Orcamento_eletrica_v2_.pdf');
  });

  it('planilha sem nome declarado ganha extensão certa', () => {
    expect(
      nomeArquivoDaMidia({
        tipo: 'document',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        quando: QUANDO,
      }),
    ).toBe('2026-09-16_14h32_documento_equipe.xlsx');
  });
});

describe('extensaoDoMime / sanitizarNomeDeArquivo', () => {
  it('MIME desconhecido usa o subtipo; vazio vira bin', () => {
    expect(extensaoDoMime('application/x-foo')).toBe('foo');
    expect(extensaoDoMime(null)).toBe('bin');
  });
  it('sanitizar tira acento, espaço e caracteres de caminho', () => {
    expect(sanitizarNomeDeArquivo('../NF nº 123 / março.pdf')).toBe('NF_n_123_marco.pdf');
  });
});
