import { fakeSupabase } from '@/test/fake-supabase';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ContextoExecucao } from '../tipos';

type Client = SupabaseClient<Database>;

/**
 * A regra do resumo diário: só age com telefone válido; em simulação não
 * envia nada mas descreve o que enviaria; um dia = uma entidade.
 */
let regra: typeof import('./resumo-diario-semaforo').resumoDiarioSemaforo;
beforeAll(async () => {
  regra = (await import('./resumo-diario-semaforo')).resumoDiarioSemaforo;
}, 30_000);

const OBRA = '11111111-1111-4111-8111-111111111111';

function banco() {
  return fakeSupabase({
    obras: [
      {
        id: OBRA,
        nome: 'Garibaldi',
        status: 'ativa',
        valor_contrato: null,
        cliente: null,
        tipo: null,
        orcamento: null,
        data_inicio: null,
        data_prevista_fim: null,
        endereco: null,
        deleted_at: null,
      },
    ],
    pagamentos: [],
    fornecedores: [],
    documentos: [],
    recebimentos: [],
    orcamentos_etapa: [],
    confirmacoes_pendentes: [],
  });
}

function ctx(config: Record<string, unknown>, simular = true): ContextoExecucao {
  return {
    supabase: banco() as unknown as Client,
    evento: {
      nome: 'sistema.resumo_diario',
      payload: { dia: '2026-09-18' },
      em: new Date().toISOString(),
      userId: null,
    },
    config,
    simular,
  };
}

describe('resumo-diario-semaforo', () => {
  it('varre um evento por dia, com o dia como entidade', async () => {
    const eventos = await regra.varrer({
      supabase: banco() as unknown as Client,
      config: {},
      simular: true,
    });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.nome).toBe('sistema.resumo_diario');
    expect((eventos[0]?.payload as { dia: string }).dia).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });

  it('sem telefone válido é pulada com motivo claro', async () => {
    const r = await regra.condicao(ctx({ telefones: '123, abc', enviar_quando_tudo_ok: true }));
    expect(r).toMatchObject({ passa: false });
    if (!r.passa) expect(r.motivo).toContain('telefone');
  });

  it('com telefone e pendência (obra sem contrato) passa; e envia em simulação sem sair', async () => {
    const c = ctx({ telefones: '5573998489747', enviar_quando_tudo_ok: false });
    const cond = await regra.condicao(c);
    expect(cond).toEqual({ passa: true });
    const r = await regra.acao(c);
    expect(r.resumo).toContain('enviado a 1 telefone');
    expect(r.resumo).toMatch(/\d+ pendência/u);
  });

  it('"enviar quando tudo ok" ligado passa sem consultar o banco', async () => {
    const r = await regra.condicao(
      ctx({ telefones: '5573998489747', enviar_quando_tudo_ok: true }),
    );
    expect(r).toEqual({ passa: true });
  });
});
