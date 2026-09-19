import type { UazapiInbound } from '@/lib/schemas/uazapi';
import { describe, expect, it } from 'vitest';
import { planejarLote, textoDoLote } from './lote';

function m(over: Partial<UazapiInbound> & { id: string }): UazapiInbound {
  return {
    type: 'text',
    timestamp: 1_000,
    from: '5551999@s.whatsapp.net',
    chatId: 'g@g.us',
    isGroup: true,
    ...over,
  } as UazapiInbound;
}
const foto = (id: string, ts: number, text?: string) =>
  m({ id, type: 'image', timestamp: ts, text, media: { mimetype: 'image/jpeg' } });

describe('planejarLote', () => {
  it('uma mensagem: única, como sempre', () => {
    const p = planejarLote([m({ id: 'a', text: 'oi' })]);
    expect(p.modo).toBe('unico');
  });

  it('só textos: uma mensagem com os textos na ordem do relógio ("obra numa, valor noutra")', () => {
    const p = planejarLote([
      m({ id: 'b', text: 'foi 350 de areia', timestamp: 1_002 }),
      m({ id: 'a', text: 'paguei na inox', timestamp: 1_001 }),
    ]);
    expect(p.modo).toBe('texto_unido');
    if (p.modo !== 'texto_unido') return;
    expect(p.payload.id).toBe('a');
    expect(p.payload.text).toBe('paguei na inox\nfoi 350 de areia');
    expect(p.idsAgrupados).toEqual(['b']);
  });

  it('foto e "inox" dois segundos depois: o texto vira legenda da foto', () => {
    const p = planejarLote([foto('f1', 1_000), m({ id: 't', text: 'Inox', timestamp: 1_002 })]);
    expect(p.modo).toBe('midias');
    if (p.modo !== 'midias') return;
    expect(p.payloads).toHaveLength(1);
    expect(p.payloads[0]?.text).toBe('Inox');
    expect(p.idsDeTexto).toEqual(['t']);
  });

  it('cinco fotos e um texto: a legenda vai para as que não tinham; a que tinha, mantém a sua', () => {
    const p = planejarLote([
      foto('f1', 1_000),
      foto('f2', 1_001, 'fachada'),
      foto('f3', 1_002),
      m({ id: 't', text: 'casa ej', timestamp: 1_003 }),
    ]);
    if (p.modo !== 'midias') throw new Error('esperava mídias');
    expect(p.payloads.map((x) => x.text)).toEqual(['casa ej', 'fachada', 'casa ej']);
  });

  it('áudio não recebe legenda: ele é a fala', () => {
    const p = planejarLote([
      m({ id: 'a', type: 'audio', timestamp: 1_000, media: { mimetype: 'audio/ogg' } }),
      m({ id: 't', text: 'inox', timestamp: 1_001 }),
    ]);
    if (p.modo !== 'midias') throw new Error('esperava mídias');
    expect(p.payloads[0]?.text).toBeUndefined();
  });
});

describe('textoDoLote', () => {
  it('comprovantes viram lista numerada com SIM para todos e a dica do número', () => {
    const t = textoDoLote({
      pagamentos: [
        { n: 1, valor: 8, fornecedor: 'Maria', obra: 'INOX Piratini', descricao: null },
        { n: 2, valor: 16, fornecedor: 'Gilvando', obra: null, descricao: 'PIX' },
      ],
      semObra: { quantidade: 0, opcoes: [] },
      guardados: [],
      anotados: [],
      comProblema: 0,
    });
    expect(t).toContain('Li 2 comprovantes:');
    expect(t).toMatch(/1\) R\$\s8,00 · Maria · INOX Piratini/u);
    expect(t).toMatch(/2\) R\$\s16,00 · Gilvando · PIX/u);
    expect(t).toContain('*SIM* para lançar todos');
    expect(t).toContain('"2 não"');
  });

  it('fotos sem obra: uma pergunta para todas; guardadas: agrupadas por obra e pasta', () => {
    const t = textoDoLote({
      pagamentos: [],
      semObra: {
        quantidade: 5,
        opcoes: [
          { n: 1, id: 'a', nome: 'Aguirre' },
          { n: 2, id: 'g', nome: 'Garibaldi' },
        ],
      },
      guardados: [
        { obra: 'Casa EJ', pasta: 'fotos', quantidade: 3, link: 'https://x/obras/1#pastas' },
        { obra: 'Casa EJ', pasta: 'projeto', quantidade: 1 },
      ],
      anotados: [{ obra: 'Casa EJ', quantidade: 1 }],
      comProblema: 1,
    });
    expect(t).toContain('Recebi 5 arquivos. *De qual obra?*');
    expect(t).toContain('1) Aguirre\n2) Garibaldi');
    expect(t).toContain('vale para todos');
    expect(t).toContain('📁 Guardei 3 arquivos na obra *Casa EJ*, pasta *Fotos*.');
    expect(t).toContain('Ver: https://x/obras/1#pastas');
    expect(t).toContain('📁 Guardei 1 arquivo na obra *Casa EJ*, pasta *Projeto*.');
    expect(t).toContain('📝 Anotei 1 registro no diário da obra *Casa EJ*.');
    expect(t).toContain('⚠️ 1 arquivo ficou sem leitura');
  });
});
