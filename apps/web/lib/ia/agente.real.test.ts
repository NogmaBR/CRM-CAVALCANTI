import { fakeSupabase } from '@/test/fake-supabase';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { perguntar } from './assistente';
import { classificarIntencao } from './intencao';

/**
 * Teste REAL do agente (modelo com ferramentas + roteador) contra a OpenAI.
 * Roda com `TESTE_REAL=1` e as variáveis do `.env.local` exportadas:
 *
 *   TESTE_REAL=1 pnpm exec vitest run lib/ia/agente.real.test.ts
 *
 * O banco é o fake em memória: o que se prova é que o modelo escolhe a
 * ferramenta certa, respeita "lucro só com contrato" e devolve uma proposta
 * (nunca grava) quando a pessoa pede um cadastro.
 */

const REAL = process.env.TESTE_REAL === '1' && Boolean(process.env.OPENAI_API_KEY);

/** O vitest esconde o console de teste que passa; stderr aparece sempre. */
function mostrar(rotulo: string, texto: string): void {
  process.stderr.write(`
${rotulo}→ ${texto}
`);
}

const GARI = '11111111-1111-4111-8111-111111111111';
const INOX = '22222222-2222-4222-8222-222222222222';

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
        valor_contrato: null,
        data_inicio: null,
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
        valor_contrato: 500000,
        data_inicio: null,
        data_prevista_fim: null,
        deleted_at: null,
      },
    ],
    categorias: [{ id: 'c1', nome: 'Alvenaria' }],
    fornecedores: [
      {
        id: 'f1',
        nome: 'Mathias Velho',
        documento: null,
        telefone: null,
        ativo: true,
        deleted_at: null,
      },
    ],
    pagamentos: [
      {
        id: 'p1',
        obra_id: GARI,
        valor: 134231.05,
        data_pagamento: '2026-09-01',
        descricao: 'tijolo',
        categoria_id: 'c1',
        fornecedor_id: 'f1',
        status_pagto: 'confirmado',
        deleted_at: null,
      },
      {
        id: 'p2',
        obra_id: INOX,
        valor: 100000,
        data_pagamento: '2026-09-02',
        descricao: 'aço',
        categoria_id: 'c1',
        fornecedor_id: 'f1',
        status_pagto: 'confirmado',
        deleted_at: null,
      },
    ],
    recebimentos: [
      {
        id: 'r1',
        obra_id: INOX,
        valor: 300000,
        data_recebimento: '2026-08-01',
        descricao: '1ª',
        deleted_at: null,
      },
    ],
    documentos: [],
    registros_obra: [],
    ai_conversations: [],
    ai_messages: [],
    ai_tool_calls: [],
    knowledge_documents: [],
  }) as unknown as SupabaseClient<Database>;
}

describe.skipIf(!REAL)('agente de verdade', () => {
  it('lucro sem contrato: diz que falta o valor e mostra o gasto', async () => {
    const r = await perguntar(banco(), {
      pergunta: 'velho, queria saber quanto tô lucrando ali no garibaldi',
      canal: 'whatsapp',
      autorizadoId: null,
    });
    mostrar('LUCRO', r.texto);
    console.log(
      'lucro sem contrato →',
      r.texto,
      r.ferramentas.map((f) => f.ferramenta),
    );
    expect(r.ferramentas.map((f) => f.ferramenta)).toContain('resumo_da_obra');
    expect(r.texto.toLowerCase()).toMatch(/contrato/u);
    expect(r.texto).toContain('134');
    expect(r.proposta).toBeUndefined();
  }, 90_000);

  it('lucro com contrato e recebido: responde resultado e margem', async () => {
    const r = await perguntar(banco(), {
      pergunta: 'como está a obra inox?',
      canal: 'whatsapp',
      autorizadoId: null,
    });
    mostrar('INOX', r.texto);
    console.log('inox →', r.texto);
    expect(r.texto).toMatch(/200/u); // resultado 300k − 100k
    expect(r.texto).toMatch(/400/u); // margem 500k − 100k
  }, 90_000);

  it('"cria uma obra" vira proposta, e nada é gravado', async () => {
    const db = banco();
    const r = await perguntar(db, {
      pergunta: 'cria aí uma obra nova chamada Sítio do Pedro, cliente Pedro Alves',
      canal: 'whatsapp',
      autorizadoId: null,
    });
    mostrar('CRIAR', `${r.texto} ${JSON.stringify(r.proposta)}`);
    console.log('criar obra →', r.texto, r.proposta);
    expect(r.proposta?.tipo).toBe('criar_obra');
    if (r.proposta?.tipo === 'criar_obra') {
      expect(r.proposta.dados.nome).toMatch(/s[ií]tio do pedro/iu);
      expect(r.proposta.dados.cliente).toMatch(/pedro alves/iu);
    }
    expect((db as unknown as ReturnType<typeof fakeSupabase>).linhas('obras')).toHaveLength(2);
  }, 90_000);

  it('roteador: intenção do modelo', async () => {
    expect(
      await classificarIntencao('velho, queria saber quanto tô lucrando ali no garibaldi'),
    ).toBe('pergunta');
    expect(await classificarIntencao('bom dia pessoal')).toBe('conversa');
    expect(await classificarIntencao('mandei 300 pro zé ontem')).toBe('lancamento');
    expect(await classificarIntencao('o contrato da inox ficou em 600 mil')).toBe('acao');
  }, 90_000);
});
