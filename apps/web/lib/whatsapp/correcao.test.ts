import { describe, expect, it } from 'vitest';
import {
  acharNomeado,
  alcanceDaResposta,
  extrairCorrecaoSimples,
  pareceCorrecao,
  pareceDesfazer,
  semAlcance,
} from './correcao';

/**
 * As frases são as da rodada de 17/09 e as que o Cavalcanti tende a mandar.
 * Regra: correção reconhecida por padrão claro; o resto é `false` e segue o
 * fluxo de sempre.
 */

const OBRAS = [
  { id: 'gari', nome: 'Garibaldi', apelidos: ['Gari'] },
  { id: 'inox', nome: 'INOX Piratini', apelidos: ['Inox'] },
  { id: 'ej', nome: 'Casa EJ', apelidos: ['EJ'] },
  { id: 'agu', nome: 'Aguirre', apelidos: [] },
];
const FORNECEDORES = [
  { id: 'mv', nome: 'Mathias Velho', apelidos: [] },
  { id: 'vero', nome: 'VERO S A', apelidos: ['Vero'] },
];
const CTX = { obras: OBRAS, fornecedores: FORNECEDORES, hoje: '2026-09-19' };

describe('pareceCorrecao', () => {
  it.each([
    'nao , e outra obra?',
    'Não é Garibaldi',
    'Não é na Garibaldi, é em outra obra',
    'é na inox',
    'o valor é 500',
    'errado, foi 350',
    'na verdade foi dia 15',
    'troca a obra pra casa ej',
    'fornecedor é o Mathias',
  ])('reconhece: %s', (t) => {
    expect(pareceCorrecao(t)).toBe(true);
  });

  it.each([
    'sim',
    'paguei 1200 de cimento na gari',
    'como está a obra?',
    'oi',
    'cadastra o fornecedor X',
  ])('não é correção: %s', (t) => {
    expect(pareceCorrecao(t)).toBe(false);
  });
});

describe('pareceDesfazer', () => {
  it.each([
    'Cancela isso',
    'Desfaz, não guarda',
    'desfaz',
    'apaga esse',
    'não era pra guardar',
    'tira isso daí',
    'volta atrás',
  ])('reconhece: %s', (t) => {
    expect(pareceDesfazer(t)).toBe(true);
  });

  it.each(['cancela', 'não', 'apaga todos os dados do sistema', 'cancela a obra X'])(
    'não é desfazer (é recusa, ou outra coisa): %s',
    (t) => {
      expect(pareceDesfazer(t)).toBe(false);
    },
  );
});

describe('extrairCorrecaoSimples', () => {
  it('"não é na Garibaldi, é na INOX" → obra INOX (o nome negado sai)', () => {
    expect(extrairCorrecaoSimples('Não é na Garibaldi, é na INOX', CTX).obra).toEqual({
      id: 'inox',
      nome: 'INOX Piratini',
    });
  });

  it('"não é na Garibaldi, é em outra obra" → sem obra (não chuta)', () => {
    expect(extrairCorrecaoSimples('Não é na Garibaldi, é em outra obra', CTX).obra).toBeUndefined();
  });

  it('"é na inox" → apelido resolve; "casa ej" → nome de duas palavras', () => {
    expect(extrairCorrecaoSimples('é na inox', CTX).obra?.id).toBe('inox');
    expect(extrairCorrecaoSimples('troca pra casa ej', CTX).obra?.id).toBe('ej');
  });

  it('valor: "o valor é 1.200,50", "errado, foi 350", "R$ 90", "500 reais"', () => {
    expect(extrairCorrecaoSimples('o valor é 1.200,50', CTX).valor).toBe(1200.5);
    expect(extrairCorrecaoSimples('errado, foi 350', CTX).valor).toBe(350);
    expect(extrairCorrecaoSimples('não, R$ 90', CTX).valor).toBe(90);
    expect(extrairCorrecaoSimples('500 reais', CTX).valor).toBe(500);
  });

  it('data: "foi dia 15" (mês corrente), "15/09", "ontem" — e "15/09" não vira valor', () => {
    expect(extrairCorrecaoSimples('foi dia 15', CTX).data).toBe('2026-09-15');
    const d = extrairCorrecaoSimples('foi 15/09', CTX);
    expect(d.data).toBe('2026-09-15');
    expect(d.valor).toBeUndefined();
    expect(extrairCorrecaoSimples('foi ontem', CTX).data).toBe('2026-09-18');
  });

  it('fornecedor conhecido por nome parcial; desconhecido vira nome novo', () => {
    expect(extrairCorrecaoSimples('fornecedor é o Mathias', CTX).fornecedor?.id).toBe('mv');
    expect(extrairCorrecaoSimples('fornecedor é João da Silva', CTX).fornecedorNomeNovo).toBe(
      'joao da silva',
    );
  });

  it('"esquece" cancela; frase sem nada reconhecível devolve patch vazio', () => {
    expect(extrairCorrecaoSimples('não, esquece', CTX).cancelar).toBe(true);
    expect(extrairCorrecaoSimples('não é isso', CTX)).toEqual({});
  });

  it('dois nomes sem negação = ambíguo, não resolve', () => {
    expect(acharNomeado('gari ou inox', OBRAS)).toBeUndefined();
  });
});

describe('alcance da resposta', () => {
  it('"sim todos", "todos", "não todas" → todos; "sim" → um', () => {
    expect(alcanceDaResposta('sim todos')).toBe('todos');
    expect(alcanceDaResposta('TODOS')).toBe('todos');
    expect(alcanceDaResposta('não todas')).toBe('todos');
    expect(alcanceDaResposta('sim')).toBe('um');
    expect(semAlcance('não todas')).toBe('não');
    expect(semAlcance('todos')).toBe('sim');
  });
});
