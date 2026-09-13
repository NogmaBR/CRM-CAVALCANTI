import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A rota que faz o papel de worker.
 *
 * O que precisa ser verdade:
 *  1. Sem bearer (ou com bearer errado) → 401, sem tocar na fila.
 *  2. Com bearer, a rota drena em LAÇO: repete o lote enquanto vier mensagem
 *     e para quando a fila esvazia — quatro mensagens saem numa invocação só,
 *     não em quatro minutos (eng review gstack, A2).
 *  3. O laço respeita o orçamento de tempo: um handler lento não estoura o
 *     `maxDuration`; a rota devolve o que conseguiu e o resto volta pelo
 *     visibility timeout.
 *  4. Falha na leitura de uma fila não impede a drenagem das outras.
 */

const consumirFila = vi.fn();
const metricas = vi.fn(async () => []);

vi.mock('@/lib/queue/consumidor', () => ({
  consumirFila: (...a: unknown[]) => consumirFila(...a),
}));
vi.mock('@/lib/queue/fila', () => ({ metricas: () => metricas() }));
vi.mock('@/lib/queue/handlers', () => ({
  HANDLERS: { whatsapp_inbound: async () => {}, whatsapp_outbound: async () => {} },
  filasComHandler: () => ['whatsapp_inbound', 'whatsapp_outbound'],
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));

function lote(fila: string, lidas: number) {
  return { fila, lidas, concluidas: lidas, arquivadas: 0, devolvidas: 0 };
}

function req(auth?: string, query = '') {
  return new NextRequest(`http://localhost/api/queue/consume${query}`, {
    headers: auth ? { authorization: auth } : {},
  });
}

describe('GET /api/queue/consume', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'segredo-de-teste';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste';
    consumirFila.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('401 sem bearer e com bearer errado, sem ler a fila', async () => {
    const { GET } = await import('./route');
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer errado'))).status).toBe(401);
    expect(consumirFila).not.toHaveBeenCalled();
  });

  it('drena em laço até a fila esvaziar, numa invocação só', async () => {
    const { GET } = await import('./route');
    // whatsapp_inbound: 4 mensagens, 1 por lote; whatsapp_outbound: vazia.
    let restantes = 4;
    consumirFila.mockImplementation(async (_sb: unknown, fila: string) => {
      if (fila !== 'whatsapp_inbound') return lote(fila, 0);
      if (restantes === 0) return lote(fila, 0);
      restantes -= 1;
      return lote(fila, 1);
    });

    const res = await GET(req('Bearer segredo-de-teste'));
    expect(res.status).toBe(200);
    const corpo = await res.json();
    const inbound = corpo.lotes.find((l: { fila: string }) => l.fila === 'whatsapp_inbound');
    expect(inbound).toMatchObject({ lidas: 4, concluidas: 4, rodadas: 5 });
    // 5 chamadas para o inbound (4 com mensagem + 1 vazia) e 1 para o outbound.
    expect(consumirFila).toHaveBeenCalledTimes(6);
  });

  it('para quando o orçamento de tempo acaba e devolve o parcial', async () => {
    vi.useFakeTimers();
    const { GET } = await import('./route');
    consumirFila.mockImplementation(async (_sb: unknown, fila: string) => {
      // Cada lote "leva" 20 s no relógio falso; o orçamento é 45 s.
      vi.advanceTimersByTime(20_000);
      return lote(fila, 1);
    });

    const res = await GET(req('Bearer segredo-de-teste', '?fila=whatsapp_inbound'));
    const corpo = await res.json();
    expect(corpo.lotes[0].rodadas).toBeLessThanOrEqual(3);
    expect(corpo.lotes[0].rodadas).toBeGreaterThanOrEqual(2);
  });

  it('fila que falha na leitura não impede as outras', async () => {
    const { GET } = await import('./route');
    consumirFila.mockImplementation(async (_sb: unknown, fila: string) => {
      if (fila === 'whatsapp_inbound') throw new Error('pgmq indisponível');
      return lote(fila, 0);
    });
    const res = await GET(req('Bearer segredo-de-teste'));
    const corpo = await res.json();
    expect(corpo.ok).toBe(true);
    expect(corpo.lotes).toHaveLength(2);
    expect(corpo.lotes[0]).toMatchObject({ fila: 'whatsapp_inbound', erro: 'pgmq indisponível' });
    expect(corpo.lotes[1]).toMatchObject({ fila: 'whatsapp_outbound', lidas: 0 });
  });
});
