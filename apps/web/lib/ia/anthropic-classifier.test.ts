import { describe, expect, it } from 'vitest';
import { montarConteudo } from './anthropic-classifier';

/**
 * A parte da visão que dá para provar sem rede: como a mídia relida do
 * Storage vira bloco de conteúdo para o modelo.
 *
 * O que precisa ser verdade:
 *  1. Sem mídia, o conteúdo é o texto puro (comportamento anterior).
 *  2. Imagem vira bloco `image` em base64, ANTES do texto, com o mime certo.
 *  3. PDF vira bloco `document`.
 *  4. Anexo acima do limite da API não derruba nada: vira aviso em texto.
 */

const CONTEXTO = 'Data de hoje: 2026-09-12\nMensagem:\nsegue a nota';

describe('classificador Anthropic — mídia no prompt', () => {
  it('sem mídia o conteúdo é só o texto', () => {
    expect(montarConteudo(CONTEXTO, null)).toBe(CONTEXTO);
  });

  it('foto vira bloco image em base64, antes do texto', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const conteudo = montarConteudo(CONTEXTO, { bytes, mime: 'image/jpeg' });
    expect(Array.isArray(conteudo)).toBe(true);
    const [midia, texto] = conteudo as unknown as Array<Record<string, unknown>>;
    expect(midia).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/4A==' },
    });
    expect(texto).toEqual({ type: 'text', text: CONTEXTO });
  });

  it('PDF vira bloco document', () => {
    const bytes = new TextEncoder().encode('%PDF-1.4');
    const [midia] = montarConteudo(CONTEXTO, {
      bytes,
      mime: 'application/pdf',
    }) as unknown as Array<Record<string, unknown>>;
    expect(midia?.type).toBe('document');
    expect((midia?.source as { media_type: string }).media_type).toBe('application/pdf');
  });

  it('imagem acima do limite vira aviso em texto, não erro', () => {
    const bytes = new Uint8Array(5 * 1024 * 1024);
    const conteudo = montarConteudo(CONTEXTO, { bytes, mime: 'image/png' });
    expect(typeof conteudo).toBe('string');
    expect(conteudo).toContain('grande demais');
    expect(conteudo).toContain(CONTEXTO);
  });
});
