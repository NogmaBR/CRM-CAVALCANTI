import { describe, expect, it } from 'vitest';
import { validarConfig } from './config';
import { AUTOMACOES, buscarAutomacao } from './registry';

/**
 * O "freio de mão" do go-live tem que engatar.
 *
 * O que precisa ser verdade:
 *  1. Toda automação registrada declara `configSchema`, e o seu `configPadrao`
 *     passa nele — senão a regra nasce inválida.
 *  2. Chave desconhecida (typo) é recusada com o nome da chave no erro.
 *  3. Tipo errado ou valor fora do teto é recusado com o campo no erro.
 *  4. Config parcial completa com o padrão; config vazia vale o padrão.
 */

describe('configuração das automações', () => {
  it('toda automação registrada tem schema e o padrão passa nele', () => {
    expect(AUTOMACOES.length).toBeGreaterThan(0);
    for (const a of AUTOMACOES) {
      expect(a.configSchema, a.chave).toBeDefined();
      const r = validarConfig(a, {});
      expect(r.ok, `${a.chave}: ${r.ok ? '' : r.erro}`).toBe(true);
    }
  });

  it('typo no nome do parâmetro é recusado, com a chave no erro', () => {
    const cobranca = buscarAutomacao('cobrar-documento-fornecedor');
    if (!cobranca) throw new Error('regra não registrada');
    const r = validarConfig(cobranca, { limte_por_rodada: 3 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('limte_por_rodada');
  });

  it('tipo errado e valor acima do teto são recusados, com o campo no erro', () => {
    const cobranca = buscarAutomacao('cobrar-documento-fornecedor');
    if (!cobranca) throw new Error('regra não registrada');
    const texto = validarConfig(cobranca, { limite_por_rodada: '3' });
    expect(texto.ok).toBe(false);
    if (!texto.ok) expect(texto.erro).toContain('limite_por_rodada');
    const demais = validarConfig(cobranca, { limite_por_rodada: 500 });
    expect(demais.ok).toBe(false);
  });

  it('config parcial completa com o padrão', () => {
    const cobranca = buscarAutomacao('cobrar-documento-fornecedor');
    if (!cobranca) throw new Error('regra não registrada');
    const r = validarConfig(cobranca, { limite_por_rodada: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.limite_por_rodada).toBe(3);
      expect(r.config.dias_sem_documento).toBe(7);
      expect(r.config.dias_entre_cobrancas).toBe(7);
    }
  });
});
