import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O que precisa ser verdade:
 *  1. Sem bearer → 401, sem tocar em nada.
 *  2. Com bearer, roda extração → indexação → conciliação e devolve JSON com
 *     as contagens (é o que o importador com `--processar` imprime).
 *  3. A extração drena em laço: lote cheio → repete; lote parcial → para.
 */

const extrairTextoPendentes = vi.fn();
const conciliarPendentes = vi.fn(async (..._a: unknown[]) => ({
  analisados: 1,
  vinculados: 1,
  ambiguos: 0,
  semCandidato: 0,
  erros: 0,
}));
const sincronizarDocumentos = vi.fn(async (..._a: unknown[]) => ({
  lidos: 2,
  criados: 1,
  atualizados: 0,
  inalterados: 1,
}));
const gerarEmbeddingsPendentes = vi.fn(async (..._a: unknown[]) => ({
  pendentes: 0,
  indexados: 0,
  trechos: 0,
}));

vi.mock('@/lib/acervo/extrair-texto', () => ({
  extrairTextoPendentes: (...a: unknown[]) => extrairTextoPendentes(...a),
}));
vi.mock('@/lib/acervo/conciliar', () => ({
  conciliarPendentes: (...a: unknown[]) => conciliarPendentes(...a),
}));
vi.mock('@/lib/rag/indexador', () => ({
  sincronizarDocumentos: (...a: unknown[]) => sincronizarDocumentos(...a),
  gerarEmbeddingsPendentes: (...a: unknown[]) => gerarEmbeddingsPendentes(...a),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));

function req(auth?: string) {
  return new NextRequest('http://localhost/api/cron/acervo', {
    method: 'POST',
    headers: auth ? { authorization: auth } : {},
  });
}

describe('POST /api/cron/acervo', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'segredo-de-teste';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste';
    extrairTextoPendentes.mockReset();
    extrairTextoPendentes.mockResolvedValue({ processados: 3, comTexto: 2, semTexto: 1, erros: 0 });
  });

  it('401 sem bearer e com bearer errado, sem processar', async () => {
    const { POST } = await import('./route');
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req('Bearer errado'))).status).toBe(401);
    expect(extrairTextoPendentes).not.toHaveBeenCalled();
  });

  it('com bearer: extrai, indexa, concilia e devolve as contagens', async () => {
    const { POST } = await import('./route');
    const res = await POST(req('Bearer segredo-de-teste'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.extracao).toMatchObject({ processados: 3, comTexto: 2, rodadas: 1 });
    expect(json.textos).toMatchObject({ criados: 1 });
    expect(json.conciliacao).toMatchObject({ vinculados: 1 });
    expect(sincronizarDocumentos).toHaveBeenCalled();
    expect(conciliarPendentes).toHaveBeenCalled();
  });

  it('lote cheio repete a extração; parcial para', async () => {
    extrairTextoPendentes
      .mockResolvedValueOnce({ processados: 40, comTexto: 40, semTexto: 0, erros: 0 })
      .mockResolvedValueOnce({ processados: 40, comTexto: 40, semTexto: 0, erros: 0 })
      .mockResolvedValueOnce({ processados: 5, comTexto: 5, semTexto: 0, erros: 0 });
    const { POST } = await import('./route');
    const json = await (await POST(req('Bearer segredo-de-teste'))).json();
    expect(extrairTextoPendentes).toHaveBeenCalledTimes(3);
    expect(json.extracao).toMatchObject({ processados: 85, rodadas: 3 });
  });
});
