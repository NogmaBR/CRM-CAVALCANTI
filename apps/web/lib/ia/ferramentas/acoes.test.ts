import { fakeSupabase } from '@/test/fake-supabase';
import { describe, expect, it } from 'vitest';
import { FERRAMENTAS_DE_ACAO, ehResultadoDeProposta, lerProposta } from './acoes';
import type { Client } from './registro';
import { executarFerramenta } from './registro';

/**
 * As ferramentas de ação nunca gravam: o teste afirma isso pelo log do fake
 * (zero inserts) e afirma que a proposta devolvida passa pelo schema que
 * `aplicarAcao` vai usar para reler.
 */

const GARI = '11111111-1111-4111-8111-111111111111';
const GARI2 = '22222222-2222-4222-8222-222222222222';

function banco() {
  return fakeSupabase({
    obras: [
      {
        id: GARI,
        nome: 'Garibaldi',
        apelidos: ['gari'],
        cliente: null,
        status: 'ativa',
        orcamento: null,
        valor_contrato: 100000,
        data_inicio: null,
        data_prevista_fim: null,
        deleted_at: null,
      },
      {
        id: GARI2,
        nome: 'Garibaldi II',
        apelidos: [],
        cliente: null,
        status: 'ativa',
        orcamento: null,
        valor_contrato: null,
        data_inicio: null,
        data_prevista_fim: null,
        deleted_at: null,
      },
    ],
    fornecedores: [{ id: 'f1', nome: 'Mathias Velho', deleted_at: null }],
  });
}

async function rodar(db: ReturnType<typeof banco>, nome: string, args: unknown) {
  const r = await executarFerramenta(db as unknown as Client, FERRAMENTAS_DE_ACAO, nome, args);
  expect(r.ok, r.ok ? '' : r.erro).toBe(true);
  return (r as { resultado: Record<string, unknown> }).resultado;
}

describe('propor_criar_obra', () => {
  it('devolve proposta válida com defaults nulos e não grava nada', async () => {
    const db = banco();
    const r = await rodar(db, 'propor_criar_obra', { nome: 'Sítio do Pedro' });
    expect(ehResultadoDeProposta(r)).toBe(true);
    expect(r.proposta).toEqual({
      tipo: 'criar_obra',
      dados: {
        nome: 'Sítio do Pedro',
        cliente: null,
        tipo_obra: null,
        endereco: null,
        valor_contrato: null,
        data_inicio: null,
      },
    });
    expect(db.log).toHaveLength(0);
  });

  it('recusa nome que já existe (ignorando acento e caixa)', async () => {
    const r = await rodar(banco(), 'propor_criar_obra', { nome: 'garibáldi' });
    expect(r.ok).toBe(false);
    expect(String(r.erro)).toContain('já existe');
  });
});

describe('propor_cadastrar_fornecedor', () => {
  it('normaliza documento e telefone para dígitos', async () => {
    const r = await rodar(banco(), 'propor_cadastrar_fornecedor', {
      nome: 'Elétrica Silva',
      documento: '12.345.678/0001-90',
      telefone: '(51) 99999-8888',
    });
    expect(r.proposta).toEqual({
      tipo: 'cadastrar_fornecedor',
      dados: { nome: 'Elétrica Silva', documento: '12345678000190', telefone: '51999998888' },
    });
  });

  it('igual já cadastrado → erro; parecido → proposta com aviso', async () => {
    const igual = await rodar(banco(), 'propor_cadastrar_fornecedor', { nome: 'mathias velho' });
    expect(igual.ok).toBe(false);
    const parecido = await rodar(banco(), 'propor_cadastrar_fornecedor', { nome: 'Mathias' });
    expect(parecido.ok).toBe(true);
    expect(String(parecido.aviso)).toContain('Mathias Velho');
  });

  it('documento com tamanho errado é recusado', async () => {
    const r = await rodar(banco(), 'propor_cadastrar_fornecedor', {
      nome: 'Novo',
      documento: '123',
    });
    expect(r.ok).toBe(false);
  });
});

describe('propor_definir_contrato / recebimento / arquivar', () => {
  it('contrato: resolve a obra por apelido e guarda o valor anterior', async () => {
    const r = await rodar(banco(), 'propor_definir_contrato', { obra: 'gari', valor: 850000 });
    expect(r.proposta).toEqual({
      tipo: 'definir_contrato',
      dados: { obra_id: GARI, obra_nome: 'Garibaldi', valor: 850000, valor_anterior: 100000 },
    });
  });

  it('obra ambígua devolve as candidatas em vez de escolher', async () => {
    const r = await rodar(banco(), 'propor_definir_contrato', { obra: 'garibaldi i', valor: 1 });
    expect(r.ok).toBe(false);
    expect(r.candidatas).toEqual(['Garibaldi', 'Garibaldi II']);
  });

  it('recebimento sem data vira hoje', async () => {
    const r = await rodar(banco(), 'propor_registrar_recebimento', { obra: 'gari', valor: 5000 });
    const p = lerProposta(r.proposta);
    expect(p?.tipo).toBe('registrar_recebimento');
    if (p?.tipo === 'registrar_recebimento') {
      expect(p.dados.data).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(p.dados.descricao).toBeNull();
    }
  });

  it('valor zero ou negativo é recusado pelo schema', async () => {
    const r = await executarFerramenta(
      banco() as unknown as Client,
      FERRAMENTAS_DE_ACAO,
      'propor_registrar_recebimento',
      {
        obra: 'gari',
        valor: 0,
      },
    );
    expect(r.ok).toBe(false);
  });

  it('arquivar obra resolve e propõe', async () => {
    const r = await rodar(banco(), 'propor_arquivar_obra', { obra: 'Garibaldi II' });
    expect(r.proposta).toEqual({
      tipo: 'arquivar_obra',
      dados: { obra_id: GARI2, obra_nome: 'Garibaldi II' },
    });
  });
});

describe('lerProposta', () => {
  it('rejeita JSON fora do contrato', () => {
    expect(lerProposta({ tipo: 'apagar_tudo', dados: {} })).toBeNull();
    expect(lerProposta({ tipo: 'criar_obra', dados: { nome: 'x' } })).toBeNull();
    expect(lerProposta(null)).toBeNull();
  });
});
