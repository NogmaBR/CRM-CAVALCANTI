import { describe, expect, it } from 'vitest';
import { ehPerguntaAoAssistente } from './pergunta';

/**
 * O invariante que importa: **nenhum lançamento pode ser lido como pergunta.**
 *
 * Se isso falhar, a pessoa manda "paguei 500 pro Zé", recebe um resumo de
 * gastos, e o pagamento nunca é registrado. O dinheiro saiu do caixa e não
 * entrou no sistema.
 *
 * O erro contrário — pergunta lida como lançamento — vira uma pendência boba
 * no painel. Chato, reversível, visível.
 */

describe('reconhece pergunta', () => {
  const perguntas = [
    'quanto gastei na obra Garibaldi',
    'quanto gastei em material esse mês?',
    'quais fornecedores atenderam a Casa EJ?',
    'qual o saldo do orçamento da FAIHome',
    'quantos pagamentos estão sem nota?',
    'me diz o total da obra Reservas do Lago',
    'onde estão os gastos com entulho?',
  ];

  for (const p of perguntas) {
    it(`"${p}"`, () => {
      expect(ehPerguntaAoAssistente(p)).toBe(true);
    });
  }
});

describe('NÃO confunde lançamento com pergunta', () => {
  const lancamentos = [
    'paguei 500 pro Zé da obra Garibaldi',
    'R$ 1.200,00 de areia',
    'comprei cimento 340 reais',
    'transferi 2000 pro fornecedor hoje',
    'pix de 850 pra Mathias Velho',
    // O caso traiçoeiro: termina com "?" e fala do domínio, mas cheira a
    // lançamento. O cheiro vence.
    'paguei 300 na obra ontem, tá certo?',
    'quanto foi mesmo? paguei 500 reais',
  ];

  for (const l of lancamentos) {
    it(`"${l}"`, () => {
      expect(ehPerguntaAoAssistente(l)).toBe(false);
    });
  }
});

describe('não morde o que não é consulta', () => {
  it('vazio e nulo', () => {
    expect(ehPerguntaAoAssistente(null)).toBe(false);
    expect(ehPerguntaAoAssistente(undefined)).toBe(false);
    expect(ehPerguntaAoAssistente('')).toBe(false);
  });

  it('curto demais para significar algo', () => {
    expect(ehPerguntaAoAssistente('?')).toBe(false);
    expect(ehPerguntaAoAssistente('e aí?')).toBe(false);
    expect(ehPerguntaAoAssistente('oi')).toBe(false);
  });

  it('pergunta que não é sobre os dados fica de fora', () => {
    expect(ehPerguntaAoAssistente('tudo bem com você?')).toBe(false);
    expect(ehPerguntaAoAssistente('vai chover amanhã?')).toBe(false);
  });

  it('pedido não é consulta, mesmo terminando em interrogação', () => {
    expect(ehPerguntaAoAssistente('me manda a nota?')).toBe(false);
  });

  it('funciona sem acento, como vem do WhatsApp', () => {
    expect(ehPerguntaAoAssistente('quanto gastei em material esse mes')).toBe(true);
    expect(ehPerguntaAoAssistente('qual o orcamento da obra')).toBe(true);
  });

  /**
   * Prova que a remoção de acento funciona de verdade.
   *
   * Estas frases NÃO começam com palavra interrogativa: só passam se
   * "orçamento" virar "orcamento" e casar com o vocabulário do domínio. Sem
   * isso, o teste anterior passaria mesmo com a normalização quebrada — foi o
   * que aconteceu quando a classe de caracteres estava mal formada.
   */
  it('acento removido de verdade, e não por acaso', () => {
    expect(ehPerguntaAoAssistente('tem algum orçamento estourado?')).toBe(true);
    expect(ehPerguntaAoAssistente('sobrou saldo na obra?')).toBe(true);
  });
});
