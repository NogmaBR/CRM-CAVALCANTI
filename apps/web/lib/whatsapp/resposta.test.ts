import { describe, expect, it } from 'vitest';
import { interpretarResposta } from './resposta';

/**
 * O contrato aqui é assimétrico de propósito, e os testes existem pra travar
 * essa assimetria: um falso "sim" grava um pagamento errado no financeiro do
 * cliente, enquanto um falso "outro" só faz o gestor confirmar no painel —
 * que é o que ele já fazia antes desta feature existir.
 *
 * Por isso a maior parte dos casos abaixo verifica que algo NÃO virou 'sim'.
 */

describe('interpretarResposta — afirmativas', () => {
  const afirmativas = [
    'sim',
    'SIM',
    'Sim.',
    '  sim  ',
    's',
    'ok',
    'OK!',
    'blz',
    'beleza',
    'isso mesmo',
    'confirmo',
    'ta certo',
    'tá certo',
    'está certo',
    'correto',
    'perfeito',
    'pode lançar',
    'pode sim',
    'tudo certo',
    'aprovado',
    'yes',
  ];

  for (const texto of afirmativas) {
    it(`aceita ${JSON.stringify(texto)}`, () => {
      expect(interpretarResposta(texto)).toBe('sim');
    });
  }
});

describe('interpretarResposta — negativas', () => {
  const negativas = [
    'não',
    'nao',
    'NÃO',
    'Não!',
    'n',
    'negativo',
    'cancela',
    'cancelar',
    'errado',
    'tá errado',
    'nada disso',
    'esquece',
    'não confirmo',
    'nao aprovo',
    'no',
  ];

  for (const texto of negativas) {
    it(`aceita ${JSON.stringify(texto)}`, () => {
      expect(interpretarResposta(texto)).toBe('nao');
    });
  }
});

describe('interpretarResposta — emojis', () => {
  it('👍 sozinho confirma', () => {
    expect(interpretarResposta('👍')).toBe('sim');
  });

  it('✅ sozinho confirma', () => {
    expect(interpretarResposta('✅')).toBe('sim');
  });

  it('👎 sozinho recusa', () => {
    expect(interpretarResposta('👎')).toBe('nao');
  });

  it('❌ sozinho recusa', () => {
    expect(interpretarResposta('❌')).toBe('nao');
  });

  it('emoji reforçando a palavra mantém a decisão', () => {
    expect(interpretarResposta('ok 👍')).toBe('sim');
    expect(interpretarResposta('cancela ❌')).toBe('nao');
  });

  it('emojis contraditórios não agem', () => {
    expect(interpretarResposta('👍❌')).toBe('outro');
  });

  it('palavra com emoji contraditório não age (revisão 2026-09-11)', () => {
    // "nao 👍" é ambíguo, mas o texto é o canal explícito — e o resultado
    // seguro dos dois é não gravar nada automaticamente.
    expect(interpretarResposta('nao 👍')).toBe('outro');
  });
});

describe('interpretarResposta — o que NÃO pode virar ação automática', () => {
  const naoAge = [
    // Correções: contêm um "não"/"sim" mas o cliente está mandando dados novos.
    'não, o valor é 500',
    'nao foi esse fornecedor, foi o outro',
    'sim mas o valor está errado',
    'isso, só que a obra é a do Recreio',
    // Mensagens novas que por acaso são curtas.
    'bom dia',
    'quanto ficou?',
    'manda o comprovante',
    'paguei 1200 de areia',
    'e a nota fiscal?',
    // Vazios e lixo.
    '',
    '   ',
    '...',
    '?',
  ];

  for (const texto of naoAge) {
    it(`não age em ${JSON.stringify(texto)}`, () => {
      expect(interpretarResposta(texto)).toBe('outro');
    });
  }

  it('não age em null nem undefined', () => {
    expect(interpretarResposta(null)).toBe('outro');
    expect(interpretarResposta(undefined)).toBe('outro');
  });

  it('não age em resposta longa, mesmo começando com sim', () => {
    expect(interpretarResposta('sim pode lançar esse valor todo por favor')).toBe('outro');
  });
});
