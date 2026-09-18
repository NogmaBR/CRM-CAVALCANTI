import type { Proposta } from '@/lib/ia/ferramentas/acoes';
import { fakeSupabase } from '@/test/fake-supabase';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  abrirPendenciaDeAcao,
  aplicarAcao,
  brl,
  perguntaDaAcao,
  porExtensoCurto,
  respostaDaAcao,
} from './acoes-whatsapp';

/**
 * O SIM de uma ação: executa o que está gravado na pendência, uma vez só, e
 * responde a mesma frase para quem chamou duas vezes. A pergunta é template:
 * cada campo em linha própria, instrução no fim.
 */

type Client = SupabaseClient<Database>;

const GARI = '11111111-1111-4111-8111-111111111111';
const MSG = '99999999-9999-4999-8999-999999999999';

function banco() {
  return fakeSupabase(
    {
      obras: [
        {
          id: GARI,
          nome: 'Garibaldi',
          status: 'ativa',
          valor_contrato: null,
          deleted_at: null,
        },
      ],
      mensagens_whats: [{ id: MSG, autorizado_id: 'aut-1', status: 'recebida' }],
      confirmacoes_pendentes: [],
      fornecedores: [],
      recebimentos: [],
    },
    { unicos: { obras: [['nome']] } },
  );
}

const CRIAR: Proposta = {
  tipo: 'criar_obra',
  dados: {
    nome: 'Sítio do Pedro',
    cliente: 'Pedro Alves',
    tipo_obra: 'nova',
    endereco: null,
    valor_contrato: 850000,
    data_inicio: null,
  },
};

describe('perguntaDaAcao', () => {
  it('repete cada dado em linha própria e termina com a instrução', () => {
    const t = perguntaDaAcao(CRIAR);
    expect(t).toContain('Nome da obra: *Sítio do Pedro*');
    expect(t).toContain('Cliente: Pedro Alves');
    expect(t).toContain('Tipo: obra nova');
    expect(t).toContain(`Valor do contrato: ${brl(850000)} (850 mil)`);
    expect(t.endsWith('Responda *SIM* para confirmar, ou *NÃO* para cancelar.')).toBe(true);
  });

  it('recebimento avisa que é dinheiro que entrou', () => {
    const t = perguntaDaAcao({
      tipo: 'registrar_recebimento',
      dados: {
        obra_id: GARI,
        obra_nome: 'Garibaldi',
        valor: 30000,
        data: '2026-09-16',
        descricao: null,
      },
    });
    expect(t).toContain('Data: 16/09/2026');
    expect(t).toContain('dinheiro que ENTROU');
  });

  it('porExtensoCurto', () => {
    expect(porExtensoCurto(850000)).toBe('850 mil');
    expect(porExtensoCurto(1_200_000)).toBe('1,2 milhões');
    expect(porExtensoCurto(1_000_000)).toBe('1 milhão');
    expect(porExtensoCurto(12500)).toBe('12,5 mil');
    expect(porExtensoCurto(999)).toBeNull();
  });
});

describe('aplicarAcao', () => {
  it('cria a obra no SIM, marca a pendência executada e responde a frase de sucesso', async () => {
    const db = banco();
    const aberta = await abrirPendenciaDeAcao(db as unknown as Client, {
      mensagemId: MSG,
      proposta: CRIAR,
      chatId: 'g@g.us',
    });
    expect(aberta.ok).toBe(true);
    if (!aberta.ok) return;

    const r = await aplicarAcao(db as unknown as Client, {
      confirmacaoId: aberta.id,
      via: 'whatsapp',
      respostaBruta: 'sim',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.jaEstavaResolvida).toBe(false);
    expect(r.texto).toBe(respostaDaAcao(CRIAR));

    const obras = db.linhas('obras');
    expect(obras).toHaveLength(2);
    expect(obras[1]).toMatchObject({
      nome: 'Sítio do Pedro',
      valor_contrato: 850000,
      status: 'ativa',
    });
    expect(db.linhas('confirmacoes_pendentes')[0]).toMatchObject({
      resolvida: true,
      resultado: 'executada',
      resolvida_via: 'whatsapp',
    });
    expect(db.linhas('mensagens_whats')[0]?.status).toBe('confirmada');
  });

  it('segundo SIM não cria de novo e responde a mesma frase', async () => {
    const db = banco();
    const aberta = await abrirPendenciaDeAcao(db as unknown as Client, {
      mensagemId: MSG,
      proposta: CRIAR,
      chatId: null,
    });
    if (!aberta.ok) throw new Error('abrir');
    const um = await aplicarAcao(db as unknown as Client, {
      confirmacaoId: aberta.id,
      via: 'whatsapp',
      respostaBruta: 'sim',
    });
    const dois = await aplicarAcao(db as unknown as Client, {
      confirmacaoId: aberta.id,
      via: 'painel',
      respostaBruta: 'sim',
    });
    expect(um.ok && dois.ok).toBe(true);
    if (!dois.ok) return;
    expect(dois.jaEstavaResolvida).toBe(true);
    expect(db.linhas('obras')).toHaveLength(2);
  });

  it('escrita que falha reabre a pendência com o erro em resultado', async () => {
    const db = banco();
    // Obra com o mesmo nome já existe → 23505 pelo índice único do fake.
    const aberta = await abrirPendenciaDeAcao(db as unknown as Client, {
      mensagemId: MSG,
      proposta: { ...CRIAR, dados: { ...CRIAR.dados, nome: 'Garibaldi' } },
      chatId: null,
    });
    if (!aberta.ok) throw new Error('abrir');
    const r = await aplicarAcao(db as unknown as Client, {
      confirmacaoId: aberta.id,
      via: 'whatsapp',
      respostaBruta: 'sim',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.codigo).toBe('erro_escrita');
    expect(db.linhas('confirmacoes_pendentes')[0]).toMatchObject({ resolvida: false });
    expect(String(db.linhas('confirmacoes_pendentes')[0]?.resultado)).toMatch(/^erro:/u);
  });

  it('cada tipo executa a escrita certa', async () => {
    const db = banco();
    const abrir = (proposta: Proposta) =>
      abrirPendenciaDeAcao(db as unknown as Client, { mensagemId: MSG, proposta, chatId: null });
    const sim = (id: string) =>
      aplicarAcao(db as unknown as Client, {
        confirmacaoId: id,
        via: 'whatsapp',
        respostaBruta: 'sim',
      });

    const f = await abrir({
      tipo: 'cadastrar_fornecedor',
      dados: { nome: 'Elétrica Silva', documento: '12345678000190', telefone: null },
    });
    const c = await abrir({
      tipo: 'definir_contrato',
      dados: { obra_id: GARI, obra_nome: 'Garibaldi', valor: 500000, valor_anterior: null },
    });
    const rc = await abrir({
      tipo: 'registrar_recebimento',
      dados: {
        obra_id: GARI,
        obra_nome: 'Garibaldi',
        valor: 1000,
        data: '2026-09-16',
        descricao: '1ª',
      },
    });
    const a = await abrir({
      tipo: 'arquivar_obra',
      dados: { obra_id: GARI, obra_nome: 'Garibaldi' },
    });
    for (const x of [f, c, rc, a]) {
      if (!x.ok) throw new Error('abrir');
      const r = await sim(x.id);
      expect(r.ok, r.ok ? '' : r.motivo).toBe(true);
    }
    expect(db.linhas('fornecedores')[0]).toMatchObject({
      nome: 'Elétrica Silva',
      documento_tipo: 'cnpj',
    });
    expect(db.linhas('obras')[0]).toMatchObject({ valor_contrato: 500000, status: 'arquivada' });
    expect(db.linhas('obras')[0]?.deleted_at).toBeTruthy();
    expect(db.linhas('recebimentos')[0]).toMatchObject({
      obra_id: GARI,
      valor: 1000,
      origem: 'whatsapp',
      autorizado_id: 'aut-1',
    });
  });

  it('medição: atualiza a etapa existente, ou cria com o nome no SIM', async () => {
    const db = banco();
    const ETAPA = '22222222-2222-4222-8222-222222222222';
    db.linhas('etapas_obra').push({
      id: ETAPA,
      obra_id: GARI,
      nome: 'Laje',
      ordem: 1,
      percentual_concluido: 40,
      deleted_at: null,
    });
    const abrir = (proposta: Proposta) =>
      abrirPendenciaDeAcao(db as unknown as Client, { mensagemId: MSG, proposta, chatId: null });
    const sim = (id: string) =>
      aplicarAcao(db as unknown as Client, {
        confirmacaoId: id,
        via: 'whatsapp',
        respostaBruta: 'sim',
      });

    const existente = await abrir({
      tipo: 'registrar_medicao',
      dados: {
        obra_id: GARI,
        obra_nome: 'Garibaldi',
        etapa_id: ETAPA,
        etapa_nome: 'Laje',
        percentual: 100,
        percentual_anterior: 40,
      },
    });
    const nova = await abrir({
      tipo: 'registrar_medicao',
      dados: {
        obra_id: GARI,
        obra_nome: 'Garibaldi',
        etapa_id: null,
        etapa_nome: 'Alvenaria',
        percentual: 60,
        percentual_anterior: null,
      },
    });
    for (const x of [existente, nova]) {
      if (!x.ok) throw new Error('abrir');
      const r = await sim(x.id);
      expect(r.ok, r.ok ? '' : r.motivo).toBe(true);
    }
    const etapas = db.linhas('etapas_obra');
    expect(etapas.find((e) => e.id === ETAPA)).toMatchObject({ percentual_concluido: 100 });
    expect(etapas.find((e) => e.nome === 'Alvenaria')).toMatchObject({
      percentual_concluido: 60,
      origem: 'whatsapp',
      autorizado_id: 'aut-1',
      ordem: 2,
    });
    expect(
      perguntaDaAcao({
        tipo: 'registrar_medicao',
        dados: {
          obra_id: GARI,
          obra_nome: 'Garibaldi',
          etapa_id: null,
          etapa_nome: 'Alvenaria',
          percentual: 60,
          percentual_anterior: null,
        },
      }),
    ).toContain('Alvenaria* (nova)');
  });

  it('pendência de outro tipo é recusada', async () => {
    const db = banco();
    db.linhas('confirmacoes_pendentes').push({
      id: 'x',
      mensagem_id: MSG,
      tipo: 'pagamento',
      resolvida: false,
      acao: null,
    });
    const r = await aplicarAcao(db as unknown as Client, {
      confirmacaoId: 'x',
      via: 'painel',
      respostaBruta: 'sim',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe('tipo_diferente');
  });
});
