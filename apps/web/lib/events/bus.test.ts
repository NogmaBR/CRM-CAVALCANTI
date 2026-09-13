import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O barramento é chamado de dentro de server actions e do inbound do
 * WhatsApp. A única garantia que esses chamadores precisam: **`emitir` nunca
 * lança e nunca bloqueia o fato que já aconteceu.**
 *
 *  1. Com cliente, o evento chega ao motor com nome, payload e autor.
 *  2. Sem credencial de serviço no ambiente, não faz nada e não lança.
 *  3. Motor quebrando por dentro não sobe para quem emitiu.
 */

const executarAutomacoes = vi.fn();
vi.mock('@/lib/automations/engine', () => ({
  executarAutomacoes: (...a: unknown[]) => executarAutomacoes(...a),
}));

const clienteFake = {} as never;

describe('emitir', () => {
  beforeEach(() => {
    executarAutomacoes.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('entrega o evento ao motor com nome, payload e autor', async () => {
    const { emitir } = await import('./bus');
    executarAutomacoes.mockResolvedValue(undefined);
    await emitir(
      'pagamento.criado',
      { pagamentoId: 'p1', obraId: 'o1', fornecedorId: null, valor: 100, origem: 'painel' },
      { userId: 'u1', cliente: clienteFake },
    );
    expect(executarAutomacoes).toHaveBeenCalledTimes(1);
    const [cliente, evento, opcoes] = executarAutomacoes.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(cliente).toBe(clienteFake);
    expect(evento.nome).toBe('pagamento.criado');
    expect(evento.userId).toBe('u1');
    expect((evento.payload as { valor: number }).valor).toBe(100);
    expect(opcoes.simular).toBe(false);
  });

  it('sem credencial de serviço não despacha e não lança', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const { emitir } = await import('./bus');
    await expect(
      emitir('confirmacao.aberta', { confirmacaoId: 'c1', mensagemId: 'm1' }),
    ).resolves.toBeUndefined();
    expect(executarAutomacoes).not.toHaveBeenCalled();
  });

  it('motor quebrando não sobe para quem emitiu', async () => {
    const { emitir } = await import('./bus');
    executarAutomacoes.mockRejectedValue(new Error('banco caiu'));
    await expect(
      emitir(
        'documento.anexado',
        { documentoId: 'd1', pagamentoId: null, obraId: 'o1', tipo: 'nota_fiscal' },
        { cliente: clienteFake },
      ),
    ).resolves.toBeUndefined();
  });
});
