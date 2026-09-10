import type { Evento } from '@/lib/events/tipos';
import { entidadeDoEvento } from '@/lib/events/tipos';
import { describe, expect, it } from 'vitest';
import { executarAutomacoes } from './engine';
import { AUTOMACOES } from './registry';
import type { Automacao, Client } from './tipos';

/**
 * Os invariantes do motor são o que substitui a confiança que um workflow
 * visual dá "porque dá pra ver rodando". Sem tela, o que resta é teste.
 *
 * O que precisa ser verdade, sempre:
 *   1. regra desligada não roda e não polui o log
 *   2. condição que barra vira `pulada` COM motivo
 *   3. regra que quebra não derruba as outras nem quem emitiu
 *   4. idempotência impede a segunda ação no mesmo dia
 *   5. simulação nunca executa a ação
 */

// ---------------------------------------------------------------------------
// Supabase de mentira, só com o que o engine usa
// ---------------------------------------------------------------------------

interface EstadoFake {
  regras: Array<{ chave: string; ativo: boolean; config: Record<string, unknown> }>;
  /** Execuções de sucesso já existentes hoje, como "chave|entidade". */
  jaExecutou: Set<string>;
  /** Tudo que o engine tentou gravar. */
  gravados: Array<{ regra_chave: string; status: string; motivo: string | null }>;
}

function supabaseFake(estado: EstadoFake): Client {
  const api = {
    from(tabela: string) {
      if (tabela === 'automation_rules') {
        return {
          select: () => ({
            in: (_col: string, chaves: string[]) => ({
              data: estado.regras.filter((r) => chaves.includes(r.chave)),
              error: null,
            }),
          }),
        };
      }

      if (tabela === 'automation_executions') {
        return {
          // Caminho da checagem de idempotência: encadeia eq/eq/eq/gte.
          select: () => {
            const filtros: Record<string, string> = {};
            const encadeavel = {
              eq(col: string, val: string) {
                filtros[col] = val;
                return encadeavel;
              },
              gte() {
                const chave = `${filtros.regra_chave}|${filtros.entidade_id}`;
                return { count: estado.jaExecutou.has(chave) ? 1 : 0, error: null };
              },
            };
            return encadeavel;
          },
          insert: (linha: { regra_chave: string; status: string; motivo: string | null }) => {
            estado.gravados.push(linha);
            return { error: null };
          },
        };
      }

      throw new Error(`tabela inesperada no fake: ${tabela}`);
    },
  };
  return api as unknown as Client;
}

const EVENTO: Evento = {
  nome: 'pagamento.criado',
  payload: {
    pagamentoId: 'pag-1',
    obraId: 'obra-1',
    fornecedorId: null,
    valor: 100,
    origem: 'painel',
  },
  em: new Date().toISOString(),
  userId: null,
};

function automacaoFake(over: Partial<Automacao> = {}): Automacao {
  return {
    chave: 'teste',
    descricao: 'automação de teste',
    gatilhos: ['pagamento.criado'],
    condicao: async () => ({ passa: true }),
    acao: async () => ({ resumo: 'agiu' }),
    ...over,
  };
}

/** Injeta uma automação no registry só durante o teste. */
async function comAutomacao<T>(a: Automacao, fn: () => Promise<T>): Promise<T> {
  AUTOMACOES.push(a);
  try {
    return await fn();
  } finally {
    const i = AUTOMACOES.indexOf(a);
    if (i >= 0) AUTOMACOES.splice(i, 1);
  }
}

function estadoBase(over: Partial<EstadoFake> = {}): EstadoFake {
  return { regras: [], jaExecutou: new Set(), gravados: [], ...over };
}

// ---------------------------------------------------------------------------

describe('engine — regra desligada', () => {
  it('não roda nem grava log quando não há linha em automation_rules', async () => {
    const estado = estadoBase();
    let rodou = false;

    await comAutomacao(
      automacaoFake({
        acao: async () => {
          rodou = true;
          return { resumo: 'x' };
        },
      }),
      () => executarAutomacoes(supabaseFake(estado), EVENTO, { simular: false }),
    );

    expect(rodou).toBe(false);
    expect(estado.gravados).toHaveLength(0);
  });

  it('não roda quando a linha existe mas ativo=false', async () => {
    const estado = estadoBase({ regras: [{ chave: 'teste', ativo: false, config: {} }] });
    let rodou = false;

    await comAutomacao(
      automacaoFake({
        acao: async () => {
          rodou = true;
          return { resumo: 'x' };
        },
      }),
      () => executarAutomacoes(supabaseFake(estado), EVENTO, { simular: false }),
    );

    expect(rodou).toBe(false);
    expect(estado.gravados).toHaveLength(0);
  });
});

describe('engine — condição', () => {
  it('registra "pulada" com o motivo quando a condição barra', async () => {
    const estado = estadoBase({ regras: [{ chave: 'teste', ativo: true, config: {} }] });

    await comAutomacao(
      automacaoFake({ condicao: async () => ({ passa: false, motivo: 'fora do horário' }) }),
      () => executarAutomacoes(supabaseFake(estado), EVENTO, { simular: false }),
    );

    expect(estado.gravados).toHaveLength(1);
    expect(estado.gravados[0]?.status).toBe('pulada');
    expect(estado.gravados[0]?.motivo).toBe('fora do horário');
  });

  it('executa e registra "sucesso" quando a condição passa', async () => {
    const estado = estadoBase({ regras: [{ chave: 'teste', ativo: true, config: {} }] });
    let rodou = false;

    await comAutomacao(
      automacaoFake({
        acao: async () => {
          rodou = true;
          return { resumo: 'mensagem enviada' };
        },
      }),
      () => executarAutomacoes(supabaseFake(estado), EVENTO, { simular: false }),
    );

    expect(rodou).toBe(true);
    expect(estado.gravados[0]?.status).toBe('sucesso');
    expect(estado.gravados[0]?.motivo).toBe('mensagem enviada');
  });
});

describe('engine — isolamento de falha', () => {
  it('registra "falha" sem propagar a exceção', async () => {
    const estado = estadoBase({ regras: [{ chave: 'teste', ativo: true, config: {} }] });

    await expect(
      comAutomacao(
        automacaoFake({
          acao: async () => {
            throw new Error('provider fora do ar');
          },
        }),
        () => executarAutomacoes(supabaseFake(estado), EVENTO, { simular: false }),
      ),
    ).resolves.toBeUndefined();

    expect(estado.gravados[0]?.status).toBe('falha');
    expect(estado.gravados[0]?.motivo).toContain('provider fora do ar');
  });

  it('uma regra que quebra não impede a seguinte de rodar', async () => {
    const estado = estadoBase({
      regras: [
        { chave: 'quebra', ativo: true, config: {} },
        { chave: 'funciona', ativo: true, config: {} },
      ],
    });
    let segundaRodou = false;

    const quebra = automacaoFake({
      chave: 'quebra',
      acao: async () => {
        throw new Error('boom');
      },
    });
    const funciona = automacaoFake({
      chave: 'funciona',
      acao: async () => {
        segundaRodou = true;
        return { resumo: 'ok' };
      },
    });

    await comAutomacao(quebra, () =>
      comAutomacao(funciona, () =>
        executarAutomacoes(supabaseFake(estado), EVENTO, { simular: false }),
      ),
    );

    expect(segundaRodou).toBe(true);
    expect(estado.gravados.map((g) => g.status)).toEqual(['falha', 'sucesso']);
  });
});

describe('engine — idempotência', () => {
  it('não age duas vezes sobre a mesma entidade no mesmo dia', async () => {
    const estado = estadoBase({
      regras: [{ chave: 'teste', ativo: true, config: {} }],
      jaExecutou: new Set(['teste|pag-1']),
    });
    let rodou = false;

    await comAutomacao(
      automacaoFake({
        acao: async () => {
          rodou = true;
          return { resumo: 'x' };
        },
      }),
      () => executarAutomacoes(supabaseFake(estado), EVENTO, { simular: false }),
    );

    expect(rodou).toBe(false);
    expect(estado.gravados[0]?.status).toBe('pulada');
    expect(estado.gravados[0]?.motivo).toContain('idempotência');
  });
});

describe('engine — simulação', () => {
  it('nunca executa a ação, e registra como "simulada"', async () => {
    const estado = estadoBase({ regras: [{ chave: 'teste', ativo: true, config: {} }] });
    let rodou = false;

    await comAutomacao(
      automacaoFake({
        acao: async () => {
          rodou = true;
          return { resumo: 'x' };
        },
      }),
      () => executarAutomacoes(supabaseFake(estado), EVENTO, { simular: true }),
    );

    expect(rodou).toBe(false);
    expect(estado.gravados[0]?.status).toBe('simulada');
  });
});

describe('engine — regras lentas', () => {
  it('pula apenasAgendada quando disparada por evento', async () => {
    const estado = estadoBase({ regras: [{ chave: 'teste', ativo: true, config: {} }] });
    let rodou = false;

    await comAutomacao(
      automacaoFake({
        apenasAgendada: true,
        acao: async () => {
          rodou = true;
          return { resumo: 'x' };
        },
      }),
      () => executarAutomacoes(supabaseFake(estado), EVENTO, { simular: false }),
    );

    expect(rodou).toBe(false);
    expect(estado.gravados).toHaveLength(0);
  });

  it('roda apenasAgendada quando o cron permite lentas', async () => {
    const estado = estadoBase({ regras: [{ chave: 'teste', ativo: true, config: {} }] });
    let rodou = false;

    await comAutomacao(
      automacaoFake({
        apenasAgendada: true,
        acao: async () => {
          rodou = true;
          return { resumo: 'x' };
        },
      }),
      () =>
        executarAutomacoes(supabaseFake(estado), EVENTO, {
          simular: false,
          permitirLentas: true,
        }),
    );

    expect(rodou).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('registry — invariantes', () => {
  it('nenhuma chave repetida', () => {
    const chaves = AUTOMACOES.map((a) => a.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('toda automação declara pelo menos um gatilho', () => {
    for (const a of AUTOMACOES) {
      expect(a.gatilhos.length, `${a.chave} sem gatilho`).toBeGreaterThan(0);
    }
  });

  it('chave é slug estável (sem espaço, minúscula)', () => {
    for (const a of AUTOMACOES) {
      expect(a.chave, `${a.chave} não é slug`).toMatch(/^[a-z0-9-]+$/u);
    }
  });
});

describe('entidadeDoEvento', () => {
  it('extrai o id da entidade principal', () => {
    expect(entidadeDoEvento(EVENTO)).toBe('pag-1');
  });

  it('devolve null quando o payload não tem entidade', () => {
    const semEntidade: Evento = {
      nome: 'lead.sem_resposta',
      payload: { leadId: '', horas: 24 },
      em: new Date().toISOString(),
      userId: null,
    };
    expect(entidadeDoEvento(semEntidade)).toBeNull();
  });
});
