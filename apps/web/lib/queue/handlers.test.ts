import { describe, expect, it } from 'vitest';
import { HANDLERS, filasComHandler } from './handlers';
import { FILAS, MAX_TENTATIVAS, VISIBILITY_TIMEOUT } from './tipos';

/**
 * Invariantes do catálogo de filas.
 *
 * Sem processo vivo, uma fila sem handler não dá erro — ela simplesmente não é
 * drenada, e as mensagens ficam paradas até alguém abrir a tela e perguntar por
 * quê. Esses testes existem para que o silêncio não seja o primeiro sintoma.
 */

describe('catálogo de filas', () => {
  it('toda fila declarada tem visibility timeout', () => {
    for (const fila of FILAS) {
      expect(VISIBILITY_TIMEOUT[fila], `${fila} sem visibility timeout`).toBeGreaterThan(0);
    }
  });

  /**
   * O visibility timeout precisa ser maior que o pior tempo de processamento.
   * Curto demais e a mensagem reaparece enquanto ainda está sendo processada —
   * duas invocações fazendo o mesmo trabalho ao mesmo tempo.
   *
   * 30s é o piso: abaixo disso não cabe nem uma chamada de rede com folga.
   */
  it('nenhum visibility timeout é curto a ponto de causar processamento duplo', () => {
    for (const fila of FILAS) {
      expect(VISIBILITY_TIMEOUT[fila], `${fila} com timeout curto demais`).toBeGreaterThanOrEqual(
        30,
      );
    }
  });

  it('a fila mais lenta é a da IA', () => {
    const maior = FILAS.reduce((a, b) => (VISIBILITY_TIMEOUT[a] >= VISIBILITY_TIMEOUT[b] ? a : b));
    expect(maior).toBe('ia_classificacao');
  });
});

describe('registro de handlers', () => {
  it('todo handler registrado aponta para uma fila que existe', () => {
    for (const chave of filasComHandler()) {
      expect(FILAS, `"${chave}" tem handler mas não está no catálogo`).toContain(chave);
    }
  });

  it('a fila de entrada tem handler — sem ela o webhook não teria para onde enfileirar', () => {
    expect(HANDLERS.whatsapp_inbound).toBeTypeOf('function');
  });

  /**
   * `midia` e `ia_classificacao` são reservadas: o download e a classificação
   * acontecem dentro de `whatsapp_inbound`, porque a ordem das etapas em
   * `processarInbound` é deliberada. Este teste registra essa decisão — se
   * alguém der handler a elas, é porque decidiu separar o fluxo, e aí precisa
   * mexer aqui de propósito.
   */
  it('as filas reservadas seguem sem handler', () => {
    expect(HANDLERS.midia).toBeUndefined();
    expect(HANDLERS.ia_classificacao).toBeUndefined();
  });
});

describe('política de retentativa', () => {
  it('três tentativas: o que separa "deu azar" de "está quebrado"', () => {
    expect(MAX_TENTATIVAS).toBe(3);
  });
});
