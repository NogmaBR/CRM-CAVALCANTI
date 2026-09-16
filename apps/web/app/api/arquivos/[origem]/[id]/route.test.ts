import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A porta pela qual as telas mostram arquivos.
 *
 * O que precisa ser verdade:
 *  1. Origem desconhecida, id que não é uuid, linha que a RLS não devolve e
 *     upload `pending` respondem o MESMO 404 — nada vaza.
 *  2. O caminho feliz é 302 para a URL assinada, com `no-store`.
 *  3. `?baixar=1` pede a URL com o nome do arquivo (attachment).
 *  4. `?miniatura=1` gera uma vez, guarda no bucket e na segunda só redireciona.
 */

const linha = vi.fn<() => Promise<{ data: unknown; error: unknown }>>();
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => linha() }) }),
    }),
  }),
}));

const getSignedUrl = vi.fn(async (path: string, _ttl: number, op?: { download?: string }) => {
  return `https://storage.test/sign/${path}${op?.download ? `?download=${op.download}` : ''}`;
});
const existeObjeto = vi.fn(async () => false);
const downloadDocumentBytes = vi.fn(async () => new Uint8Array([1, 2, 3]));
const uploadDocumentBuffer = vi.fn(async () => {});
vi.mock('@/lib/storage/documents', () => ({
  getSignedUrl: (...a: unknown[]) => (getSignedUrl as (...x: unknown[]) => unknown)(...a),
  existeObjeto: (...a: unknown[]) => (existeObjeto as (...x: unknown[]) => unknown)(...a),
  downloadDocumentBytes: (...a: unknown[]) =>
    (downloadDocumentBytes as (...x: unknown[]) => unknown)(...a),
  uploadDocumentBuffer: (...a: unknown[]) =>
    (uploadDocumentBuffer as (...x: unknown[]) => unknown)(...a),
}));

const gerarMiniatura = vi.fn(async () => Buffer.from('jpeg'));
vi.mock('@/lib/arquivos/miniatura', () => ({
  gerarMiniatura: (...a: unknown[]) => (gerarMiniatura as (...x: unknown[]) => unknown)(...a),
}));

const ID = '11111111-2222-4333-8444-555555555555';

function chamar(origem: string, id: string, query = '') {
  const req = new NextRequest(`http://localhost/api/arquivos/${origem}/${id}${query}`);
  return import('./route').then(({ GET }) => GET(req, { params: Promise.resolve({ origem, id }) }));
}

describe('GET /api/arquivos/[origem]/[id]', () => {
  beforeEach(() => {
    linha.mockReset();
    getSignedUrl.mockClear();
    existeObjeto.mockReset();
    existeObjeto.mockResolvedValue(false);
    downloadDocumentBytes.mockClear();
    uploadDocumentBuffer.mockClear();
    gerarMiniatura.mockClear();
  });

  it('404 igual para origem inválida, id inválido, linha invisível e upload pendente', async () => {
    linha.mockResolvedValue({ data: null, error: null });
    expect((await chamar('pagamento', ID)).status).toBe(404);
    expect((await chamar('documento', 'nao-e-uuid')).status).toBe(404);
    expect((await chamar('documento', ID)).status).toBe(404);
    linha.mockResolvedValue({
      data: { storage_path: 'pending', mime_type: 'image/jpeg', nome_arquivo: 'x.jpg' },
      error: null,
    });
    expect((await chamar('documento', ID)).status).toBe(404);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('302 para a URL assinada do arquivo, sem cache', async () => {
    linha.mockResolvedValue({
      data: {
        storage_path: 'obra/doc/nf.pdf',
        mime_type: 'application/pdf',
        nome_arquivo: 'nf.pdf',
      },
      error: null,
    });
    const res = await chamar('documento', ID);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://storage.test/sign/obra/doc/nf.pdf');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('?baixar=1 pede a URL com o nome do arquivo (attachment)', async () => {
    linha.mockResolvedValue({
      data: {
        storage_path: 'obra/doc/nf.pdf',
        mime_type: 'application/pdf',
        nome_arquivo: 'NF 123.pdf',
      },
      error: null,
    });
    const res = await chamar('documento', ID, '?baixar=1');
    // O header vem percent-encoded (espaço → %20); o que importa é o nome.
    expect(decodeURIComponent(res.headers.get('location') ?? '')).toContain('?download=NF 123.pdf');
  });

  it('?miniatura=1 gera uma vez, guarda em miniaturas/ e reaproveita', async () => {
    linha.mockResolvedValue({
      data: { midia_storage_path: 'whatsapp/abc/foto.jpeg', midia_mime: 'image/jpeg' },
      error: null,
    });
    const primeira = await chamar('mensagem', ID, '?miniatura=1');
    expect(primeira.headers.get('location')).toBe(
      `https://storage.test/sign/miniaturas/mensagem/${ID}.jpg`,
    );
    expect(gerarMiniatura).toHaveBeenCalledTimes(1);
    expect(uploadDocumentBuffer).toHaveBeenCalledWith(
      `miniaturas/mensagem/${ID}.jpg`,
      expect.anything(),
      'image/jpeg',
    );

    existeObjeto.mockResolvedValue(true);
    const segunda = await chamar('mensagem', ID, '?miniatura=1');
    expect(segunda.headers.get('location')).toBe(
      `https://storage.test/sign/miniaturas/mensagem/${ID}.jpg`,
    );
    expect(gerarMiniatura).toHaveBeenCalledTimes(1);
  });

  it('?miniatura=1 em PDF devolve o original; imagem que o sharp não lê também', async () => {
    linha.mockResolvedValue({
      data: {
        storage_path: 'obra/doc/nf.pdf',
        mime_type: 'application/pdf',
        nome_arquivo: 'nf.pdf',
      },
      error: null,
    });
    const pdf = await chamar('documento', ID, '?miniatura=1');
    expect(pdf.headers.get('location')).toBe('https://storage.test/sign/obra/doc/nf.pdf');
    expect(gerarMiniatura).not.toHaveBeenCalled();

    linha.mockResolvedValue({
      data: {
        storage_path: 'obra/doc/foto.jpg',
        mime_type: 'image/jpeg',
        nome_arquivo: 'foto.jpg',
      },
      error: null,
    });
    gerarMiniatura.mockResolvedValueOnce(null as never);
    const quebrada = await chamar('documento', ID, '?miniatura=1');
    expect(quebrada.headers.get('location')).toBe('https://storage.test/sign/obra/doc/foto.jpg');
    expect(uploadDocumentBuffer).not.toHaveBeenCalled();
  });
});
