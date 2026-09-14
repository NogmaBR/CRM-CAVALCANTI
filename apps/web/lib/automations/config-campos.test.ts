import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validarConfig } from './config';
import {
  PREFIXO_CAMPO,
  descreverCampos,
  montarConfigDosCampos,
  rotuloDaChave,
} from './config-campos';
import { AUTOMACOES, buscarAutomacao } from './registry';

/**
 * O painel gera um campo por parâmetro a partir do schema e remonta o objeto
 * ao salvar. O que precisa ser verdade:
 *
 *  1. Toda automação registrada é descrita sem erro, com um campo por chave
 *     do schema, rótulo humano e padrão igual ao `configPadrao`.
 *  2. Limites do Zod (`min`, `max`, `int`) chegam ao campo — é o que vira
 *     `min`/`max`/`step` no `<input type="number">`.
 *  3. O que volta do formulário passa em `validarConfig` — ida e volta fecha.
 *  4. Chave desconhecida ganha rótulo legível em vez de quebrar.
 */

function formDe(pares: Record<string, string>): { get(n: string): string | null } {
  return { get: (n) => pares[n] ?? null };
}

describe('descreverCampos', () => {
  it('descreve toda automação registrada, um campo por chave do schema', () => {
    for (const a of AUTOMACOES) {
      const campos = descreverCampos(a);
      const chaves = Object.keys(a.configSchema.shape);
      expect(
        campos.map((c) => c.chave),
        a.chave,
      ).toEqual(chaves);
      for (const c of campos) {
        expect(c.rotulo.length, `${a.chave}.${c.chave}`).toBeGreaterThan(0);
        expect(c.padrao, `${a.chave}.${c.chave}`).toEqual(a.configPadrao?.[c.chave]);
        expect(c.ajuda).toContain('Padrão');
      }
    }
  });

  it('lê min, max e int do schema numérico', () => {
    const cobranca = buscarAutomacao('cobrar-documento-fornecedor');
    if (!cobranca) throw new Error('regra não registrada');
    const campos = descreverCampos(cobranca);
    const limite = campos.find((c) => c.chave === 'limite_por_rodada');
    expect(limite).toMatchObject({
      tipo: 'number',
      min: 1,
      max: 100,
      inteiro: true,
      rotulo: 'Máximo de cobranças por rodada',
    });
    expect(limite?.ajuda).toBe('Padrão: 25 · entre 1 e 100');
  });

  it('reconhece boolean, enum e string, mesmo embrulhados em optional/default', () => {
    const campos = descreverCampos({
      configSchema: z.object({
        avisar_gestor: z.boolean().default(true),
        canal: z.enum(['whatsapp', 'email']).optional(),
        assinatura: z.string(),
      }),
      configPadrao: { avisar_gestor: true, canal: 'whatsapp', assinatura: 'Nogma' },
    });
    expect(campos.map((c) => c.tipo)).toEqual(['boolean', 'enum', 'string']);
    expect(campos[1]?.opcoes).toEqual(['whatsapp', 'email']);
    expect(campos[0]?.ajuda).toBe('Padrão: ligado');
  });
});

describe('rotuloDaChave', () => {
  it('usa o mapa para chave conhecida e humaniza a desconhecida', () => {
    expect(rotuloDaChave('dias_sem_documento')).toBe('Dias sem nota');
    expect(rotuloDaChave('prazo_maximo_horas')).toBe('Prazo maximo horas');
  });
});

describe('montarConfigDosCampos', () => {
  it('ida e volta: campos do formulário passam no schema da regra', () => {
    const cobranca = buscarAutomacao('cobrar-documento-fornecedor');
    if (!cobranca) throw new Error('regra não registrada');
    const campos = descreverCampos(cobranca);
    const config = montarConfigDosCampos(
      formDe({
        chave: 'cobrar-documento-fornecedor',
        [`${PREFIXO_CAMPO}dias_sem_documento`]: '10',
        [`${PREFIXO_CAMPO}limite_por_rodada`]: '5',
        [`${PREFIXO_CAMPO}dias_entre_cobrancas`]: '14',
      }),
      campos,
    );
    expect(config).toEqual({
      dias_sem_documento: 10,
      limite_por_rodada: 5,
      dias_entre_cobrancas: 14,
    });
    expect(validarConfig(cobranca, config).ok).toBe(true);
  });

  it('campo vazio fica de fora (padrão completa) e texto vira NaN para o schema recusar', () => {
    const cobranca = buscarAutomacao('cobrar-documento-fornecedor');
    if (!cobranca) throw new Error('regra não registrada');
    const campos = descreverCampos(cobranca);
    const config = montarConfigDosCampos(
      formDe({
        [`${PREFIXO_CAMPO}dias_sem_documento`]: '',
        [`${PREFIXO_CAMPO}limite_por_rodada`]: 'abc',
      }),
      campos,
    );
    expect(config).not.toHaveProperty('dias_sem_documento');
    expect(Number.isNaN(config.limite_por_rodada)).toBe(true);
    const r = validarConfig(cobranca, config);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('limite_por_rodada');
  });

  it('aceita vírgula decimal e trata checkbox ausente como false', () => {
    const campos = descreverCampos({
      configSchema: z.object({ limiar: z.number(), avisar: z.boolean(), ligado: z.boolean() }),
      configPadrao: { limiar: 80, avisar: false, ligado: false },
    });
    const config = montarConfigDosCampos(
      formDe({ [`${PREFIXO_CAMPO}limiar`]: '12,5', [`${PREFIXO_CAMPO}ligado`]: 'on' }),
      campos,
    );
    expect(config).toEqual({ limiar: 12.5, avisar: false, ligado: true });
  });
});
