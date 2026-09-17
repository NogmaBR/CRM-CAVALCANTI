import { fakeSupabase } from '@/test/fake-supabase';
import { describe, expect, it } from 'vitest';
import { FERRAMENTAS_CRM, compararObras, contarPorPasta } from './crm';
import type { Client } from './registro';
import { executarFerramenta } from './registro';

/**
 * As ferramentas do CRM inteiro, contra o Supabase em memória. O que se
 * afirma é a conta (lucro, margem, "falta contrato") e o comportamento com
 * nome ambíguo — a parte que, errada, faz o agente responder o número errado.
 */

const GARI = '11111111-1111-4111-8111-111111111111';
const INOX = '22222222-2222-4222-8222-222222222222';
const EJ = '33333333-3333-4333-8333-333333333333';

function banco() {
  return fakeSupabase({
    obras: [
      {
        id: GARI,
        nome: 'Garibaldi',
        apelidos: ['gari'],
        cliente: 'Cliente A',
        status: 'ativa',
        orcamento: null,
        valor_contrato: 300000,
        data_inicio: '2026-01-10',
        data_prevista_fim: null,
        deleted_at: null,
      },
      {
        id: INOX,
        nome: 'INOX Piratini',
        apelidos: ['inox'],
        cliente: 'Cliente B',
        status: 'ativa',
        orcamento: null,
        valor_contrato: null,
        data_inicio: null,
        data_prevista_fim: null,
        deleted_at: null,
      },
      {
        id: EJ,
        nome: 'Casa EJ',
        apelidos: [],
        cliente: null,
        status: 'ativa',
        orcamento: null,
        valor_contrato: null,
        data_inicio: null,
        data_prevista_fim: null,
        deleted_at: '2026-09-01T00:00:00Z',
      },
    ],
    categorias: [
      { id: 'c1', nome: 'Alvenaria' },
      { id: 'c2', nome: 'Elétrica' },
    ],
    fornecedores: [
      {
        id: 'f1',
        nome: 'Mathias Velho',
        documento: '123',
        telefone: null,
        ativo: true,
        deleted_at: null,
      },
      {
        id: 'f2',
        nome: 'Maximiliano',
        documento: null,
        telefone: '5551',
        ativo: true,
        deleted_at: null,
      },
    ],
    pagamentos: [
      {
        id: 'p1',
        obra_id: GARI,
        valor: 100000,
        data_pagamento: '2026-09-01',
        descricao: 'tijolo',
        categoria_id: 'c1',
        fornecedor_id: 'f1',
        status_pagto: 'confirmado',
        deleted_at: null,
      },
      {
        id: 'p2',
        obra_id: GARI,
        valor: 20000.5,
        data_pagamento: '2026-09-05',
        descricao: 'fiação',
        categoria_id: 'c2',
        fornecedor_id: 'f2',
        status_pagto: 'aguardando',
        deleted_at: null,
      },
      {
        id: 'p3',
        obra_id: GARI,
        valor: 999,
        data_pagamento: '2026-09-06',
        descricao: 'recusado',
        categoria_id: 'c2',
        fornecedor_id: 'f2',
        status_pagto: 'recusado',
        deleted_at: null,
      },
      {
        id: 'p4',
        obra_id: INOX,
        valor: 5000,
        data_pagamento: '2026-09-02',
        descricao: null,
        categoria_id: null,
        fornecedor_id: 'f1',
        status_pagto: 'confirmado',
        deleted_at: null,
      },
    ],
    recebimentos: [
      {
        id: 'r1',
        obra_id: GARI,
        valor: 150000,
        data_recebimento: '2026-08-01',
        descricao: '1ª parcela',
        deleted_at: null,
      },
      {
        id: 'r2',
        obra_id: GARI,
        valor: 1,
        data_recebimento: '2026-08-02',
        descricao: 'apagada',
        deleted_at: '2026-08-03T00:00:00Z',
      },
    ],
    documentos: [
      {
        id: 'd1',
        obra_id: GARI,
        pagamento_id: 'p1',
        categoria: 'nfs_pagamentos',
        nome_arquivo: 'nf1.pdf',
        tipo: 'nota_fiscal',
        created_at: '2026-09-01T10:00:00Z',
        deleted_at: null,
      },
      {
        id: 'd2',
        obra_id: GARI,
        pagamento_id: null,
        categoria: 'fotos',
        nome_arquivo: 'a.jpg',
        tipo: 'outro',
        created_at: '2026-09-02T10:00:00Z',
        deleted_at: null,
      },
      {
        id: 'd3',
        obra_id: GARI,
        pagamento_id: null,
        categoria: 'fotos',
        nome_arquivo: 'b.jpg',
        tipo: 'outro',
        created_at: '2026-09-03T10:00:00Z',
        deleted_at: null,
      },
    ],
    registros_obra: [
      {
        id: 'g1',
        obra_id: GARI,
        texto: 'concretamos a laje',
        created_at: '2026-09-10T12:00:00Z',
        deleted_at: null,
      },
    ],
  }) as unknown as Client;
}

async function rodar(nome: string, args: unknown) {
  const r = await executarFerramenta(banco(), FERRAMENTAS_CRM, nome, args);
  expect(r.ok, r.ok ? '' : r.erro).toBe(true);
  return (r as { resultado: Record<string, unknown> }).resultado;
}

describe('resumo_da_obra', () => {
  it('calcula gasto (só o que conta), recebido, resultado e margem com contrato', async () => {
    const r = await rodar('resumo_da_obra', { obra: 'gari' });
    expect(r.obra).toBe('Garibaldi');
    expect(r.gasto).toBe(120000.5);
    expect(r.recebido).toBe(150000);
    expect(r.resultado_ate_agora).toBe(29999.5);
    expect(r.margem_prevista).toBe(179999.5);
    expect(r.percentual_gasto_do_contrato).toBe(40);
    expect(r.aviso_contrato).toBeNull();
    expect(r.pagamentos_sem_nota).toEqual({ quantidade: 1, total: 20000.5 });
    expect(r.documentos_por_pasta).toEqual([
      { pasta: 'Fotos', quantidade: 2 },
      { pasta: 'NFs/Pagamentos', quantidade: 1 },
    ]);
    expect((r.ultimo_registro_diario as { texto: string }).texto).toBe('concretamos a laje');
  });

  it('sem contrato: margem nula e aviso para o modelo pedir o valor', async () => {
    const r = await rodar('resumo_da_obra', { obra: 'inox' });
    expect(r.contrato).toBeNull();
    expect(r.margem_prevista).toBeNull();
    expect(r.resultado_ate_agora).toBe(-5000);
    expect(String(r.aviso_contrato)).toContain('Sem valor de contrato');
  });

  it('nome que não casa devolve erro sem inventar', async () => {
    const r = await executarFerramenta(banco(), FERRAMENTAS_CRM, 'resumo_da_obra', {
      obra: 'praia',
    });
    expect(r.ok).toBe(true);
    const res = (r as { resultado: { ok: boolean; erro: string } }).resultado;
    expect(res.ok).toBe(false);
    expect(res.erro).toContain('nenhuma obra');
  });
});

describe('lucro_por_obra e listar_obras', () => {
  it('compara as obras vivas, ordena por resultado e lista quem está sem contrato', async () => {
    const r = await rodar('lucro_por_obra', {});
    const obras = r.obras as Array<{ obra: string; resultado: number }>;
    expect(obras.map((o) => o.obra)).toEqual(['Garibaldi', 'INOX Piratini']);
    expect(r.totais).toMatchObject({
      contrato: 300000,
      gasto: 125000.5,
      recebido: 150000,
      resultado: 24999.5,
      obras_sem_contrato: ['INOX Piratini'],
    });
  });

  it('listar_obras não traz a arquivada por padrão', async () => {
    const r = await rodar('listar_obras', {});
    expect(r.quantidade).toBe(2);
    const com = await rodar('listar_obras', { incluir_arquivadas: true });
    expect(com.quantidade).toBe(3);
  });
});

describe('outras leituras', () => {
  it('gasto_por_etapa agrega pela categoria', async () => {
    const r = await rodar('gasto_por_etapa', { obra: 'Garibaldi' });
    expect(r.por_etapa).toEqual([
      { categoria: 'Alvenaria', total: 100000, quantidade: 1 },
      { categoria: 'Elétrica', total: 20000.5, quantidade: 1 },
    ]);
  });

  it('pagamentos_recentes filtra por fornecedor com nome parecido', async () => {
    const r = await rodar('pagamentos_recentes', { fornecedor: 'mathias' });
    expect(r.quantidade).toBe(2);
    expect(r.total).toBe(105000);
    const lista = r.pagamentos as Array<{ obra: string; tem_nota: boolean }>;
    expect(lista.map((p) => p.obra)).toEqual(['INOX Piratini', 'Garibaldi']);
    expect(lista[1]?.tem_nota).toBe(true);
  });

  it('listar_fornecedores traz total pago e se tem CNPJ/telefone', async () => {
    const r = await rodar('listar_fornecedores', {});
    expect(r.fornecedores).toEqual([
      {
        nome: 'Mathias Velho',
        total_pago: 105000,
        pagamentos: 2,
        tem_cnpj: true,
        tem_telefone: false,
        ativo: true,
      },
      {
        nome: 'Maximiliano',
        total_pago: 20000.5,
        pagamentos: 1,
        tem_cnpj: false,
        tem_telefone: true,
        ativo: true,
      },
    ]);
  });

  it('documentos_da_obra por pasta', async () => {
    const r = await rodar('documentos_da_obra', { obra: 'gari', pasta: 'fotos' });
    expect(r.quantidade).toBe(2);
    expect(r.pasta).toBe('Fotos');
  });

  it('recebimentos_da_obra diz quanto falta do contrato', async () => {
    const r = await rodar('recebimentos_da_obra', { obra: 'gari' });
    expect(r.total_recebido).toBe(150000);
    expect(r.falta_receber).toBe(150000);
    expect(r.quantidade).toBe(1);
  });

  it('diario_da_obra devolve os registros', async () => {
    const r = await rodar('diario_da_obra', { obra: 'gari' });
    expect((r.registros as unknown[]).length).toBe(1);
  });

  it('limite acima de 20 é recusado pelo schema', async () => {
    const r = await executarFerramenta(banco(), FERRAMENTAS_CRM, 'diario_da_obra', {
      obra: 'gari',
      limite: 500,
    });
    expect(r.ok).toBe(false);
  });
});

describe('funções puras', () => {
  it('compararObras ordena do melhor resultado para o pior', () => {
    const r = compararObras(
      [
        {
          id: 'a',
          nome: 'A',
          apelidos: null,
          cliente: null,
          status: 'ativa',
          orcamento: null,
          valor_contrato: null,
          data_inicio: null,
          data_prevista_fim: null,
        },
        {
          id: 'b',
          nome: 'B',
          apelidos: null,
          cliente: null,
          status: 'ativa',
          orcamento: null,
          valor_contrato: 100,
          data_inicio: null,
          data_prevista_fim: null,
        },
      ],
      [{ obra_id: 'a', valor: 50 }],
      [{ obra_id: 'b', valor: 10 }],
    );
    expect(r.map((o) => o.obra)).toEqual(['B', 'A']);
    expect(r[1]?.margem_prevista).toBeNull();
  });

  it('contarPorPasta usa o rótulo humano', () => {
    expect(contarPorPasta([{ categoria: 'fotos' }, { categoria: null }])).toEqual([
      { pasta: 'Fotos', quantidade: 1 },
      { pasta: 'Outros', quantidade: 1 },
    ]);
  });
});
