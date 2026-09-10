import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { type Handler, consumirFila } from './consumidor';
import { MAX_TENTATIVAS } from './tipos';

/**
 * O que precisa ser verdade no consumidor, sempre:
 *
 *  1. Mensagem que já bateu o teto de tentativas **não é executada de novo**.
 *     Este é o teste que importa mais: sem ele, uma mensagem de WhatsApp que
 *     falhou três vezes viraria uma quarta mensagem no celular de alguém.
 *  2. Falha devolve por omissão — nada de reenfileirar explicitamente.
 *  3. Uma mensagem que quebra não impede as outras do lote.
 *  4. Sucesso conclui, e concluir significa sair da fila.
 */

type Client = SupabaseClient<Database>;

interface MsgFake {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  payload: unknown;
}

interface EstadoFake {
  mensagens: MsgFake[];
  concluidas: number[];
  arquivadas: number[];
  erroNaLeitura?: string;
}

/**
 * Supabase de mentira com o formato exato que `fila.ts` espera: `fila_ler`
 * passa por `.returns<T>()`, os outros são awaited direto.
 */
function supabaseFake(estado: EstadoFake): Client {
  const rpc = (nome: string, args: Record<string, unknown>) => {
    if (nome === 'fila_ler') {
      const resposta = estado.erroNaLeitura
        ? { data: null, error: { message: estado.erroNaLeitura } }
        : { data: estado.mensagens.slice(0, Number(args.p_qtd ?? 5)), error: null };
      // Só `returns`: `fila_ler` sempre passa por `.returns<T>()`, nunca é
      // awaited direto. Um `then` aqui tornaria o objeto thenable sem
      // necessidade — e objeto thenable de mentira esconde erro de quem o usa.
      return { returns: () => Promise.resolve(resposta) };
    }

    if (nome === 'fila_concluir') {
      estado.concluidas.push(Number(args.p_msg_id));
      return Promise.resolve({ data: true, error: null });
    }

    if (nome === 'fila_arquivar') {
      estado.arquivadas.push(Number(args.p_msg_id));
      return Promise.resolve({ data: true, error: null });
    }

    throw new Error(`rpc inesperada no fake: ${nome}`);
  };

  return { rpc } as unknown as Client;
}

function msg(msg_id: number, read_ct = 1): MsgFake {
  return {
    msg_id,
    read_ct,
    enqueued_at: new Date().toISOString(),
    payload: { telefone: '5551999990000', texto: 'oi', origem: 'automacao' },
  };
}

const OK: Handler<'whatsapp_outbound'> = async () => {};
const QUEBRA: Handler<'whatsapp_outbound'> = async () => {
  throw new Error('provider fora do ar');
};

describe('consumidor — sucesso', () => {
  it('conclui e tira da fila', async () => {
    const estado: EstadoFake = { mensagens: [msg(10)], concluidas: [], arquivadas: [] };
    const r = await consumirFila(supabaseFake(estado), 'whatsapp_outbound', OK);

    expect(r).toMatchObject({ lidas: 1, concluidas: 1, arquivadas: 0, devolvidas: 0 });
    expect(estado.concluidas).toEqual([10]);
    expect(estado.arquivadas).toEqual([]);
  });

  it('processa o lote inteiro', async () => {
    const estado: EstadoFake = {
      mensagens: [msg(1), msg(2), msg(3)],
      concluidas: [],
      arquivadas: [],
    };
    const r = await consumirFila(supabaseFake(estado), 'whatsapp_outbound', OK);

    expect(r.concluidas).toBe(3);
    expect(estado.concluidas).toEqual([1, 2, 3]);
  });
});

describe('consumidor — falha', () => {
  it('devolve por omissão: não conclui e não arquiva', async () => {
    const estado: EstadoFake = { mensagens: [msg(20, 1)], concluidas: [], arquivadas: [] };
    const r = await consumirFila(supabaseFake(estado), 'whatsapp_outbound', QUEBRA);

    expect(r).toMatchObject({ lidas: 1, concluidas: 0, arquivadas: 0, devolvidas: 1 });
    expect(estado.concluidas).toEqual([]);
    expect(estado.arquivadas).toEqual([]);
  });

  it('uma mensagem que quebra não impede a seguinte', async () => {
    const estado: EstadoFake = { mensagens: [msg(1), msg(2)], concluidas: [], arquivadas: [] };
    let chamadas = 0;
    const soAPrimeiraQuebra: Handler<'whatsapp_outbound'> = async () => {
      chamadas += 1;
      if (chamadas === 1) throw new Error('boom');
    };

    const r = await consumirFila(supabaseFake(estado), 'whatsapp_outbound', soAPrimeiraQuebra);

    expect(r).toMatchObject({ concluidas: 1, devolvidas: 1 });
    expect(estado.concluidas).toEqual([2]);
  });

  it('erro ao LER a fila propaga — sem lote, não há o que fazer', async () => {
    const estado: EstadoFake = {
      mensagens: [],
      concluidas: [],
      arquivadas: [],
      erroNaLeitura: 'conexão caiu',
    };
    await expect(consumirFila(supabaseFake(estado), 'whatsapp_outbound', OK)).rejects.toThrow(
      /conexão caiu/u,
    );
  });
});

describe('consumidor — teto de tentativas', () => {
  it('arquiva SEM executar o handler de novo', async () => {
    const estado: EstadoFake = {
      mensagens: [msg(99, MAX_TENTATIVAS + 1)],
      concluidas: [],
      arquivadas: [],
    };

    let executou = false;
    const marcador: Handler<'whatsapp_outbound'> = async () => {
      executou = true;
    };

    const r = await consumirFila(supabaseFake(estado), 'whatsapp_outbound', marcador);

    // O ponto do teste: o handler NÃO roda. Se rodasse, seria a quarta
    // mensagem de WhatsApp para quem já recebeu três.
    expect(executou).toBe(false);
    expect(r).toMatchObject({ arquivadas: 1, concluidas: 0, devolvidas: 0 });
    expect(estado.arquivadas).toEqual([99]);
  });

  it('ainda executa na última tentativa permitida', async () => {
    const estado: EstadoFake = {
      mensagens: [msg(50, MAX_TENTATIVAS)],
      concluidas: [],
      arquivadas: [],
    };
    let executou = false;
    const marcador: Handler<'whatsapp_outbound'> = async () => {
      executou = true;
    };

    await consumirFila(supabaseFake(estado), 'whatsapp_outbound', marcador);

    expect(executou).toBe(true);
    expect(estado.arquivadas).toEqual([]);
  });
});

describe('consumidor — fila vazia', () => {
  it('devolve tudo zerado sem tocar em nada', async () => {
    const estado: EstadoFake = { mensagens: [], concluidas: [], arquivadas: [] };
    const r = await consumirFila(supabaseFake(estado), 'whatsapp_outbound', QUEBRA);

    expect(r).toMatchObject({ lidas: 0, concluidas: 0, arquivadas: 0, devolvidas: 0 });
  });
});
