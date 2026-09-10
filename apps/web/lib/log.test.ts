import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { comContexto, contextoAtual, logger, mascararTelefone, registrar } from './log';

/**
 * O que precisa ser verdade no log, sempre:
 *
 *  1. Cada chamada vira UMA linha, e a linha é JSON válido com os campos
 *     fixos. É isso que torna o log pesquisável na Vercel.
 *  2. O que está em `comContexto` chega a todo log de dentro — inclusive
 *     depois de um `await`. É a correlação webhook → fila → resposta.
 *  3. Telefone nunca sai inteiro.
 *  4. Nada aqui lança, nem com payload circular.
 */

type Linha = Record<string, unknown>;
type Espiao = MockInstance<typeof console.error>;

function ultimaLinha(spy: Espiao): Linha {
  const chamada = spy.mock.calls.at(-1);
  expect(chamada, 'nenhuma linha foi emitida').toBeDefined();
  expect(chamada).toHaveLength(1);
  return JSON.parse(String(chamada?.[0])) as Linha;
}

describe('registrar', () => {
  let erro: Espiao;
  let aviso: Espiao;
  let info: Espiao;

  beforeEach(() => {
    erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    info = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emite uma linha JSON com os campos fixos, no stream do nível', () => {
    registrar('erro', 'fila', 'arquivada', { fila: 'whatsapp_outbound', msgId: 42 });

    const linha = ultimaLinha(erro);
    expect(linha).toMatchObject({
      nivel: 'erro',
      area: 'fila',
      evento: 'arquivada',
      fila: 'whatsapp_outbound',
      msgId: 42,
    });
    expect(typeof linha.t).toBe('string');
    expect(Number.isNaN(Date.parse(String(linha.t)))).toBe(false);
    expect(aviso).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('aviso vai para warn e info para log', () => {
    registrar('aviso', 'x', 'a');
    registrar('info', 'x', 'b');
    expect(ultimaLinha(aviso).evento).toBe('a');
    expect(ultimaLinha(info).evento).toBe('b');
    expect(erro).not.toHaveBeenCalled();
  });

  it('os campos fixos não podem ser sobrescritos pela chamada', () => {
    registrar('erro', 'fila', 'x', { nivel: 'info', area: 'outra', evento: 'y' });
    expect(ultimaLinha(erro)).toMatchObject({ nivel: 'erro', area: 'fila', evento: 'x' });
  });

  it('serializa Error como nome + mensagem', () => {
    registrar('erro', 'x', 'falhou', { err: new TypeError('deu ruim') });
    expect(ultimaLinha(erro).err).toEqual({ nome: 'TypeError', mensagem: 'deu ruim' });
  });

  it('mascara qualquer campo de telefone', () => {
    registrar('info', 'inbound', 'recebida', {
      telefone: '5551999998888',
      remetenteTelefone: '(51) 98888-7777',
      aninhado: { telefone: '11987654321' },
    });
    const linha = ultimaLinha(info);
    expect(linha.telefone).toBe('*********8888');
    expect(linha.remetenteTelefone).toBe('*******7777');
    expect((linha.aninhado as Linha).telefone).toBe('*******4321');
    expect(JSON.stringify(linha)).not.toContain('99999');
  });

  it('corta strings longas em vez de estourar a linha', () => {
    registrar('erro', 'x', 'grande', { corpo: 'a'.repeat(10_000) });
    const corpo = String(ultimaLinha(erro).corpo);
    expect(corpo.length).toBeLessThan(2_000);
    expect(corpo.endsWith('…')).toBe(true);
  });

  it('não lança com payload circular nem BigInt', () => {
    const circular: Record<string, unknown> = { n: 1n };
    circular.eu = circular;
    expect(() => registrar('erro', 'x', 'circular', { circular })).not.toThrow();
    const linha = ultimaLinha(erro);
    expect(linha.evento).toBe('circular');
    expect((linha.circular as Linha).n).toBe('1');
  });
});

describe('comContexto', () => {
  let erro: Espiao;

  beforeEach(() => {
    erro = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('anexa os campos a todo log de dentro, inclusive depois de await', async () => {
    const log = logger('fila');
    await comContexto({ correlacao: 'MSG-1', fila: 'whatsapp_inbound' }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      log.erro('falhou');
    });
    expect(ultimaLinha(erro)).toMatchObject({
      area: 'fila',
      evento: 'falhou',
      correlacao: 'MSG-1',
      fila: 'whatsapp_inbound',
    });
  });

  it('fora do contexto não há campos herdados', () => {
    comContexto({ correlacao: 'X' }, () => {});
    registrar('erro', 'x', 'fora');
    expect(ultimaLinha(erro).correlacao).toBeUndefined();
    expect(contextoAtual()).toEqual({});
  });

  it('aninha, e o de dentro vence no conflito', () => {
    comContexto({ correlacao: 'A', canal: 'webhook' }, () => {
      comContexto({ correlacao: 'B' }, () => {
        registrar('erro', 'x', 'dentro');
      });
      registrar('erro', 'x', 'fora');
    });
    const [dentro, fora] = erro.mock.calls.map((c) => JSON.parse(String(c[0])) as Linha);
    expect(dentro).toMatchObject({ correlacao: 'B', canal: 'webhook' });
    expect(fora).toMatchObject({ correlacao: 'A', canal: 'webhook' });
  });

  it('campos da chamada vencem os do contexto', () => {
    comContexto({ tentativa: 1 }, () => registrar('erro', 'x', 'y', { tentativa: 2 }));
    expect(ultimaLinha(erro).tentativa).toBe(2);
  });

  it('devolve o retorno de fn, síncrono ou promessa', async () => {
    expect(comContexto({}, () => 7)).toBe(7);
    await expect(comContexto({}, async () => 'ok')).resolves.toBe('ok');
  });
});

describe('mascararTelefone', () => {
  it('mantém só os 4 últimos dígitos', () => {
    expect(mascararTelefone('5551999998888')).toBe('*********8888');
    expect(mascararTelefone('(51) 9 9999-8888')).toBe('*******8888');
  });

  it('curto demais vira ***', () => {
    expect(mascararTelefone('123')).toBe('***');
    expect(mascararTelefone('')).toBe('***');
    expect(mascararTelefone(null)).toBe('***');
  });
});
