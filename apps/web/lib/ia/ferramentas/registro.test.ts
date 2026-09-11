import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { type Client, executarFerramenta, ferramenta, paraAnthropic } from './registro';

/**
 * O que precisa ser verdade na allowlist, sempre:
 *
 *  1. Nome fora da lista NÃO executa. Nem com argumentos perfeitos.
 *  2. Argumento fora do schema NÃO chega ao banco.
 *  3. Falha dentro da ferramenta vira `{ ok: false }`, nunca exceção.
 *  4. O schema que o modelo vê é o mesmo que valida.
 */

const fake = {} as Client;

const eco = ferramenta({
  nome: 'eco',
  descricao: 'devolve o que recebeu',
  schema: z.object({ texto: z.string().max(5), n: z.number().int().max(20).default(1) }),
  executar: async (_s, args) => ({ recebido: args }),
});

const explode = ferramenta({
  nome: 'explode',
  descricao: 'sempre falha',
  schema: z.object({}),
  executar: async () => {
    throw new Error('banco caiu');
  },
});

const LISTA = [eco, explode];

describe('executarFerramenta', () => {
  it('executa uma ferramenta da lista com argumentos válidos', async () => {
    const r = await executarFerramenta(fake, LISTA, 'eco', { texto: 'oi' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resultado).toEqual({ recebido: { texto: 'oi', n: 1 } });
  });

  it('recusa ferramenta fora da allowlist', async () => {
    const r = await executarFerramenta(fake, LISTA, 'apagar_tudo', { texto: 'oi' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('desconhecida');
  });

  it('recusa argumento fora do schema antes de executar', async () => {
    const r = await executarFerramenta(fake, LISTA, 'eco', { texto: 'grande demais' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('texto');

    const r2 = await executarFerramenta(fake, LISTA, 'eco', { texto: 'ok', n: 5000 });
    expect(r2.ok).toBe(false);
  });

  it('argumentos ausentes viram objeto vazio (defaults valem)', async () => {
    const r = await executarFerramenta(fake, LISTA, 'eco', undefined);
    expect(r.ok).toBe(false); // `texto` é obrigatório
  });

  it('exceção dentro da ferramenta vira ok:false com a mensagem', async () => {
    const r = await executarFerramenta(fake, LISTA, 'explode', {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe('banco caiu');
    expect(r.duracao_ms).toBeGreaterThanOrEqual(0);
  });
});

describe('paraAnthropic', () => {
  it('gera name, description e input_schema de objeto a partir do Zod', () => {
    const [def] = paraAnthropic([eco]);
    expect(def?.name).toBe('eco');
    expect(def?.description).toBe('devolve o que recebeu');
    expect(def?.input_schema.type).toBe('object');
    const props = def?.input_schema.properties as Record<string, unknown>;
    expect(Object.keys(props)).toEqual(['texto', 'n']);
    expect(def?.input_schema.required).toEqual(['texto']);
    expect(def?.input_schema).not.toHaveProperty('$schema');
  });
});
