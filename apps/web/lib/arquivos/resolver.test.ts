import { describe, expect, it } from 'vitest';
import { caminhoDaMiniatura, ehOrigem, limparMime, resolverArquivo } from './resolver';

describe('resolverArquivo', () => {
  it('documento: caminho, MIME limpo e nome do cadastro', () => {
    expect(
      resolverArquivo('documento', {
        storage_path: 'obra/doc/NF 123.pdf',
        mime_type: 'application/pdf; charset=binary',
        nome_arquivo: 'NF 123.pdf',
      }),
    ).toEqual({ path: 'obra/doc/NF 123.pdf', mime: 'application/pdf', nome: 'NF 123.pdf' });
  });

  it('documento com upload pendente ou sem caminho não tem arquivo', () => {
    expect(
      resolverArquivo('documento', { storage_path: 'pending', mime_type: 'image/png', nome_arquivo: 'x' }),
    ).toBeNull();
    expect(resolverArquivo('documento', { storage_path: null, mime_type: null, nome_arquivo: null })).toBeNull();
  });

  it('mensagem e registro: nome vem do fim do caminho', () => {
    expect(
      resolverArquivo('mensagem', { midia_storage_path: 'whatsapp/abc/foto.jpeg', midia_mime: 'image/jpeg' }),
    ).toEqual({ path: 'whatsapp/abc/foto.jpeg', mime: 'image/jpeg', nome: 'foto.jpeg' });
    expect(
      resolverArquivo('registro', { midia_storage_path: 'whatsapp/abc/audio.ogg', midia_mime: 'audio/ogg; codecs=opus' }),
    ).toEqual({ path: 'whatsapp/abc/audio.ogg', mime: 'audio/ogg', nome: 'audio.ogg' });
  });

  it('mensagem sem mídia, linha nula ou não-objeto → null', () => {
    expect(resolverArquivo('mensagem', { midia_storage_path: null, midia_mime: null })).toBeNull();
    expect(resolverArquivo('mensagem', null)).toBeNull();
    expect(resolverArquivo('registro', 'texto')).toBeNull();
  });

  it('MIME vazio vira octet-stream', () => {
    expect(limparMime(null)).toBe('application/octet-stream');
    expect(limparMime('IMAGE/JPEG')).toBe('image/jpeg');
  });

  it('origem só aceita as três conhecidas; miniatura tem caminho próprio', () => {
    expect(ehOrigem('documento')).toBe(true);
    expect(ehOrigem('pagamento')).toBe(false);
    expect(caminhoDaMiniatura('documento', 'abc')).toBe('miniaturas/documento/abc.jpg');
  });
});
