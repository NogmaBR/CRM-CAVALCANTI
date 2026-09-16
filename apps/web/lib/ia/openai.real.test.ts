import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lerComVisao } from '../acervo/visao';
import type { ClassifierInput } from './classifier';
import { OpenAIClassifier } from './openai-classifier';
import { transcreverAudio } from './transcricao';

/**
 * Teste REAL contra a API da OpenAI. Só roda com:
 *
 *   TESTE_REAL=1 AMOSTRAS=<pasta com nf.jpeg e nf.pdf> \
 *     pnpm exec vitest run lib/ia/openai.real.test.ts
 *
 * e as variáveis do `.env.local` (`node --env-file` não vale para o vitest;
 * exporte OPENAI_API_KEY, IA_PROVIDER=openai, IA_TRANSCRICAO_PROVIDER=openai).
 *
 * As amostras são arquivos do cliente e ficam FORA do repositório (público).
 * O teste é o que prova que texto, foto, PDF e áudio passam pelo provider —
 * o unitário só prova o contrato.
 */

const REAL = process.env.TESTE_REAL === '1' && Boolean(process.env.OPENAI_API_KEY);
const AMOSTRAS = process.env.AMOSTRAS ?? '';

const OBRAS = [
  { id: '11111111-1111-4111-8111-111111111111', nome: 'Garibaldi', apelidos: ['Gari'] },
  { id: '22222222-2222-4222-8222-222222222222', nome: 'Casa EJ', apelidos: ['EJ'] },
];

function input(over: Partial<ClassifierInput>): ClassifierInput {
  return {
    texto: null,
    midiaStoragePath: null,
    midiaMime: null,
    telefone: '5551',
    contexto: { obrasAtivas: OBRAS, fornecedoresConhecidos: [], grupoObraId: null },
    ...over,
  };
}

describe.skipIf(!REAL)('OpenAI de verdade', () => {
  it('texto: pagamento com obra por apelido', async () => {
    const c = new OpenAIClassifier({ baixarMidia: async () => null });
    const out = await c.classify(input({ texto: 'paguei 1200 de areia pro Zé na Gari' }));
    console.log('texto →', out.kind, out.extracted);
    expect(out.kind).toMatch(/^pagamento_/u);
    expect(out.extracted.valor).toBe(1200);
    expect(out.extracted.obra_id).toBe(OBRAS[0]?.id);
  }, 60_000);

  it('texto: o incidente de 16/09 — "Mathias Velho" resolve para Mathias Velho, com categoria', async () => {
    const forn = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nome: 'Mathias Velho' },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', nome: 'Maximiliano' },
      { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', nome: 'MD Soluções Hidráulicas' },
    ];
    const cats = [
      { id: 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', nome: 'Estrutura (vigas, pilares e lajes)' },
      { id: 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2', nome: 'Reboco' },
      { id: 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', nome: 'Limpeza' },
    ];
    const c = new OpenAIClassifier({ baixarMidia: async () => null });
    const out = await c.classify(
      input({
        texto: 'paguei 1200 de cimento pro Mathias Velho na Garibaldi hoje',
        contexto: {
          obrasAtivas: OBRAS,
          fornecedoresConhecidos: forn,
          categorias: cats,
          grupoObraId: null,
        },
      }),
    );
    console.log('incidente →', out.kind, out.extracted);
    expect(out.kind).toBe('pagamento_completo');
    expect(out.extracted.obra_id).toBe(OBRAS[0]?.id);
    expect(out.extracted.fornecedor_id).toBe(forn[0]?.id);
    expect(out.extracted.fornecedor_nome_novo).toBeUndefined();
    // descrição curta (o que foi pago), não a frase inteira; cimento cai em Estrutura
    expect((out.extracted.descricao ?? '').split(' ').length).toBeLessThanOrEqual(5);
    expect(out.extracted.descricao ?? '').not.toMatch(/paguei|Mathias|Garibaldi|1200/u);
    expect(out.extracted.categoria_id).toBe(cats[0]?.id);
  }, 60_000);

  it('texto: registro de obra', async () => {
    const c = new OpenAIClassifier({ baixarMidia: async () => null });
    const out = await c.classify(
      input({ texto: 'hoje a equipe terminou o contrapiso da EJ, amanhã começa o reboco' }),
    );
    console.log('registro →', out.kind, out.extracted.resumo);
    expect(out.kind).toBe('registro_obra');
    expect(out.extracted.obra_id).toBe(OBRAS[1]?.id);
  }, 60_000);

  it('foto de nota fiscal: lê valor', async () => {
    const bytes = new Uint8Array(readFileSync(`${AMOSTRAS}/nf.jpeg`));
    const c = new OpenAIClassifier({ baixarMidia: async () => bytes });
    const out = await c.classify(
      input({ texto: 'nota do material', midiaStoragePath: 'x/nf.jpeg', midiaMime: 'image/jpeg' }),
    );
    console.log('foto →', out.kind, out.extracted);
    expect(['pagamento_parcial', 'pagamento_completo', 'documento_apenas']).toContain(out.kind);
    expect(out.extracted.valor).toBeGreaterThan(0);
  }, 90_000);

  it('PDF de nota fiscal: lê valor', async () => {
    const bytes = new Uint8Array(readFileSync(`${AMOSTRAS}/nf.pdf`));
    const c = new OpenAIClassifier({ baixarMidia: async () => bytes });
    const out = await c.classify(
      input({ texto: null, midiaStoragePath: 'x/nf.pdf', midiaMime: 'application/pdf' }),
    );
    console.log('pdf →', out.kind, out.extracted);
    expect(out.extracted.valor).toBeGreaterThan(0);
  }, 90_000);

  it('visão do acervo: transcreve a foto', async () => {
    const bytes = new Uint8Array(readFileSync(`${AMOSTRAS}/nf.jpeg`));
    const texto = await lerComVisao(bytes, 'image/jpeg');
    console.log('visão →', (texto ?? '').slice(0, 200));
    expect((texto ?? '').length).toBeGreaterThan(20);
  }, 90_000);

  it('áudio: fala gerada pela própria OpenAI volta transcrita', async () => {
    // TTS gera a amostra; a transcrição tem que devolver o valor e a obra.
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: 'Paguei mil e duzentos reais de areia na obra Garibaldi.',
        response_format: 'mp3',
      }),
    });
    expect(r.ok).toBe(true);
    const audio = new Uint8Array(await r.arrayBuffer());
    const t = await transcreverAudio(audio, 'audio/mpeg');
    console.log('áudio →', t);
    expect(t.ok).toBe(true);
    if (t.ok) expect(t.texto.toLowerCase()).toContain('garibaldi');
  }, 90_000);
});
