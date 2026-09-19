import { describe, expect, it } from 'vitest';
import {
  AJUDA_TEXTO,
  RESPOSTAS,
  brl,
  perguntaDeObraParaArquivo,
  perguntaDePagamento,
  perguntaDePagamentoSemObra,
  respostaArquivado,
  respostaPagamentoLancado,
  respostaRegistrado,
  valorLegivel,
} from './textos';

/**
 * Legibilidade, afirmada por regra — não por gosto:
 *   - nenhuma linha com mais de 14 palavras;
 *   - toda pergunta termina dizendo o que responder;
 *   - nenhum jargão de sistema;
 *   - valor grande vem com o por extenso curto.
 */

const JARGAO =
  /\b(id|uuid|null|json|classificador|ferramenta|pendência técnica|payload|status)\b/iu;

function linhasLongas(texto: string): string[] {
  return texto.split('\n').filter((l) => l.replace(/[*•]/gu, '').trim().split(/\s+/u).length > 14);
}

const OPCOES = [
  { n: 1, id: 'a', nome: 'Aguirre' },
  { n: 2, id: 'b', nome: 'Garibaldi' },
];

const TODOS: Array<[string, string]> = [
  [
    'perguntaDePagamento',
    perguntaDePagamento({
      valor: 134231.05,
      obra: 'Garibaldi',
      fornecedor: 'Mathias Velho',
      descricao: 'cimento',
      data: '2026-09-16',
      categoria: 'Estrutura',
    }),
  ],
  [
    'perguntaDePagamentoSemObra',
    perguntaDePagamentoSemObra({ valor: 1200, deAnexo: true }, OPCOES),
  ],
  ['respostaPagamentoLancado', respostaPagamentoLancado({ valor: 1200, obra: 'Garibaldi' })],
  [
    'respostaPagamentoLancado com link',
    respostaPagamentoLancado({
      valor: 1200,
      obra: 'Garibaldi',
      link: 'https://crm-cavalcanti.vercel.app/pagamentos/abc',
    }),
  ],
  ['perguntaDePagamento de áudio', perguntaDePagamento({ valor: 300, deAudio: true })],
  ['respostaArquivado em lote', respostaArquivado('Garibaldi', 'fotos', { quantidade: 5 })],
  ['perguntaDeObraParaArquivo', perguntaDeObraParaArquivo('documento', OPCOES)],
  ['respostaArquivado', respostaArquivado('Garibaldi', 'fotos')],
  ['respostaRegistrado', respostaRegistrado('Garibaldi')],
  ['AJUDA_TEXTO', AJUDA_TEXTO],
  ...Object.entries(RESPOSTAS),
];

describe('legibilidade de todo texto fixo', () => {
  it.each(TODOS)('%s: linhas curtas e sem jargão', (_nome, texto) => {
    expect(linhasLongas(texto)).toEqual([]);
    expect(texto).not.toMatch(JARGAO);
    expect(texto.trim().length).toBeGreaterThan(0);
  });

  it('toda pergunta termina dizendo o que responder', () => {
    for (const p of [
      perguntaDePagamento({ valor: 10 }),
      perguntaDePagamentoSemObra({ valor: 10 }, OPCOES),
      perguntaDeObraParaArquivo('registro', OPCOES),
    ]) {
      expect(p.split('\n').at(-1)).toMatch(/^Responda /u);
    }
  });
});

describe('perguntaDePagamento', () => {
  it('repete cada dado em linha própria, com o valor por extenso', () => {
    const t = perguntaDePagamento({
      valor: 134231.05,
      obra: 'Garibaldi',
      fornecedor: 'Mathias Velho',
      descricao: 'cimento',
      data: '2026-09-16',
    });
    expect(t).toContain(`• Valor: *${brl(134231.05)} (134,2 mil)*`);
    expect(t).toContain('• Obra: *Garibaldi*');
    expect(t).toContain('• Fornecedor: Mathias Velho');
    expect(t).toContain('• O que foi: cimento');
    expect(t).toContain('• Data: 16/09/2026');
  });

  it('sem fornecedor e sem data diz isso com todas as letras', () => {
    const t = perguntaDePagamento({ valor: 500, obra: 'Aguirre' });
    expect(t).toContain('• Fornecedor: não informado');
    expect(t).toContain('• Data: hoje');
  });

  it('sem obra: a lista numerada e a instrução do número', () => {
    const t = perguntaDePagamentoSemObra({ valor: 500 }, OPCOES);
    expect(t).toContain('1) Aguirre\n2) Garibaldi');
    expect(t.split('\n').at(-1)).toContain('número');
  });
});

describe('valorLegivel', () => {
  it('por extenso só acima de 10 mil', () => {
    expect(valorLegivel(9999)).toBe(brl(9999));
    expect(valorLegivel(10000)).toBe(`${brl(10000)} (10 mil)`);
    expect(valorLegivel(1_250_000)).toBe(`${brl(1_250_000)} (1,3 milhões)`);
  });
});

describe('a primeira linha diz o que o agente fez de verdade', () => {
  it('anexo → "Li o comprovante"; áudio → "Ouvi o áudio"; texto → "Entendi assim"', () => {
    expect(perguntaDePagamento({ valor: 10, deAnexo: true })).toMatch(/^Li o comprovante\./u);
    expect(perguntaDePagamento({ valor: 10, deAudio: true })).toMatch(/^Ouvi o áudio\./u);
    expect(perguntaDePagamento({ valor: 10 })).toMatch(/^Entendi assim\./u);
    expect(perguntaDePagamentoSemObra({ valor: 10, deAudio: true }, OPCOES)).toMatch(
      /^Ouvi o áudio:/u,
    );
  });

  it('com link, a resposta aponta direto para o item; sem link, o caminho pelo menu', () => {
    const com = respostaPagamentoLancado({ valor: 1, link: 'https://x/pagamentos/1' });
    expect(com).toContain('Ver no painel: https://x/pagamentos/1');
    expect(com).not.toContain('menu Pagamentos');
    expect(respostaPagamentoLancado({ valor: 1 })).toContain('menu Pagamentos');
    expect(respostaArquivado('Casa EJ', 'fotos', { link: 'https://x/documentos/1' })).toContain(
      'Ver: https://x/documentos/1',
    );
    expect(respostaArquivado('Casa EJ', 'fotos', { quantidade: 5 })).toContain(
      'Guardei 5 arquivos na obra *Casa EJ*',
    );
    expect(respostaRegistrado('Casa EJ', { link: 'https://x/obras/1#diario' })).toContain(
      'Ver: https://x/obras/1#diario',
    );
  });
});
