import { describe, expect, it } from 'vitest';
import { decidirDestino, pareceAcao } from './roteador';

/**
 * A regra de ouro do fluxo, agora com três camadas: tudo que cheira a
 * lançamento vai ao classificador SEM consultar o modelo; o modelo só
 * separa o resto. Cada linha da tabela é uma frase real do canteiro.
 */

const semModelo = {};
const modelo = (resposta: 'pergunta' | 'acao' | 'lancamento' | 'conversa' | 'nenhuma') => ({
  classificarIntencao: async () => resposta,
});
const modeloQueQuebra = {
  classificarIntencao: async () => {
    throw new Error('timeout');
  },
};

describe('camada 1 — código puro vence sempre', () => {
  it('mídia nunca vai ao assistente, mesmo com legenda de pergunta', async () => {
    const d = await decidirDestino(
      { texto: 'quanto gastei na garibaldi?', temMidia: true },
      modelo('pergunta'),
    );
    expect(d).toEqual({ destino: 'classificador', motivo: 'midia' });
  });

  it.each([
    'paguei 1200 de cimento pro Mathias Velho na Garibaldi hoje',
    'pix de 500 pro zé',
    'comprei 3 sacos de cimento por 150 reais',
    'R$ 2.300 boleto da elétrica',
  ])('cheiro de lançamento com número → classificador, sem modelo: %s', async (texto) => {
    const d = await decidirDestino({ texto, temMidia: false }, modelo('pergunta'));
    expect(d.destino).toBe('classificador');
    expect(d.motivo).toBe('cheiro_de_lancamento');
  });

  it('pergunta inequívoca vai ao assistente sem gastar modelo', async () => {
    let chamou = false;
    const d = await decidirDestino(
      { texto: 'quanto gastei na garibaldi', temMidia: false },
      {
        classificarIntencao: async () => {
          chamou = true;
          return 'nenhuma';
        },
      },
    );
    expect(d).toEqual({ destino: 'assistente', motivo: 'pergunta_inequivoca' });
    expect(chamou).toBe(false);
  });

  it('texto curto demais fica no fluxo de hoje', async () => {
    expect(
      (await decidirDestino({ texto: 'ok', temMidia: false }, modelo('conversa'))).motivo,
    ).toBe('curta');
    expect((await decidirDestino({ texto: '', temMidia: false }, modelo('conversa'))).motivo).toBe(
      'curta',
    );
  });
});

describe('camada 2 — padrão de ação', () => {
  it.each([
    'cria uma obra chamada Sítio do Pedro',
    'Velho, cria aí uma obra nova chamada tal',
    'cadastra o fornecedor Elétrica Silva',
    'arquiva a obra WRB',
    'o contrato da garibaldi é 850 mil',
    'recebi 50 mil do cliente da inox',
    'anota o contrato da casa ej: 1,2 milhão',
  ])('%s → assistente', async (texto) => {
    expect(pareceAcao(texto)).toBe(true);
    const d = await decidirDestino({ texto, temMidia: false }, semModelo);
    expect(d).toEqual({ destino: 'assistente', motivo: 'padrao_de_acao' });
  });

  it('"recebi" não é confundido com pagamento a fornecedor', async () => {
    const d = await decidirDestino(
      { texto: 'recebi 50 mil da garibaldi hoje', temMidia: false },
      semModelo,
    );
    expect(d.destino).toBe('assistente');
  });

  it('verbo sem substantivo do CRM não dispara', () => {
    expect(pareceAcao('cria coragem e vai')).toBe(false);
    expect(pareceAcao('registra aí que hoje choveu')).toBe(false);
  });
});

describe('camada 3 — modelo só no que sobrou', () => {
  const frase = 'velho, queria saber quanto estou lucrando ali no garibaldi';

  it('modelo diz pergunta → assistente', async () => {
    const d = await decidirDestino({ texto: frase, temMidia: false }, modelo('pergunta'));
    expect(d).toEqual({ destino: 'assistente', motivo: 'modelo', intencao: 'pergunta' });
  });

  it('modelo diz conversa → assistente (responde uma linha, não abre pendência)', async () => {
    const d = await decidirDestino(
      { texto: 'bom dia pessoal, tudo certo?', temMidia: false },
      modelo('conversa'),
    );
    expect(d.destino).toBe('assistente');
  });

  it('modelo diz lançamento ou nenhuma → classificador', async () => {
    expect(
      (
        await decidirDestino(
          { texto: 'mandei pro zé ontem', temMidia: false },
          modelo('lancamento'),
        )
      ).destino,
    ).toBe('classificador');
    expect(
      (await decidirDestino({ texto: frase, temMidia: false }, modelo('nenhuma'))).destino,
    ).toBe('classificador');
  });

  it('sem modelo → classificador (comportamento de hoje)', async () => {
    const d = await decidirDestino({ texto: frase, temMidia: false }, semModelo);
    expect(d).toEqual({ destino: 'classificador', motivo: 'sem_modelo' });
  });

  it('modelo que quebra → classificador', async () => {
    const d = await decidirDestino({ texto: frase, temMidia: false }, modeloQueQuebra);
    expect(d).toEqual({ destino: 'classificador', motivo: 'modelo_falhou' });
  });
});
