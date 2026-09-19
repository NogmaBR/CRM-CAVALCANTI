import { fakeSupabase } from '@/test/fake-supabase';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { conversaRecente, formatarConversa, obraRecente } from './memoria-curta';

type Client = SupabaseClient<Database>;

const AGORA = new Date('2026-09-16T15:00:00Z');
const GARI = '11111111-1111-4111-8111-111111111111';

function banco() {
  return fakeSupabase({
    mensagens_whats: [
      {
        id: 'm1',
        chat_id: 'g@g.us',
        telefone_from: '55',
        texto_bruto: 'quanto gastei na garibaldi',
        texto_transcrito: null,
        status: 'recebida',
        created_at: '2026-09-16T14:00:00Z',
        dados_extraidos: null,
      },
      {
        id: 'm2',
        chat_id: 'g@g.us',
        telefone_from: '55',
        texto_bruto: null,
        texto_transcrito: 'paguei 500 pro zé',
        status: 'classificada',
        created_at: '2026-09-16T14:30:00Z',
        dados_extraidos: { kind: 'pagamento', obra_id: GARI, valor: 500 },
      },
      {
        id: 'velha',
        chat_id: 'g@g.us',
        telefone_from: '55',
        texto_bruto: 'ontem',
        texto_transcrito: null,
        status: 'recebida',
        created_at: '2026-09-15T10:00:00Z',
        dados_extraidos: null,
      },
      {
        id: 'outro',
        chat_id: 'x@g.us',
        telefone_from: '55',
        texto_bruto: 'outro grupo',
        texto_transcrito: null,
        status: 'recebida',
        created_at: '2026-09-16T14:40:00Z',
        dados_extraidos: null,
      },
    ],
    ai_conversations: [{ id: 'c1', autorizado_id: 'aut', created_at: '2026-09-16T14:01:00Z' }],
    ai_messages: [
      {
        conversation_id: 'c1',
        papel: 'usuario',
        conteudo: 'quanto gastei na garibaldi',
        created_at: '2026-09-16T14:01:00Z',
      },
      {
        conversation_id: 'c1',
        papel: 'assistente',
        conteudo: 'R$ 120 mil na Garibaldi.',
        created_at: '2026-09-16T14:01:05Z',
      },
    ],
    confirmacoes_pendentes: [],
    conversa_estado: [],
    mensagens_enviadas: [
      {
        id: 'e1',
        chat_id: 'g@g.us',
        texto: 'Entendi assim. Vou lançar R$ 500 na Garibaldi. Responda SIM.',
        tipo: 'pergunta_pendencia',
        created_at: '2026-09-16T14:30:05Z',
      },
      {
        id: 'e-outro',
        chat_id: 'x@g.us',
        texto: 'resposta em outro grupo',
        tipo: 'resposta',
        created_at: '2026-09-16T14:41:00Z',
      },
    ],
    obras: [{ id: GARI, nome: 'Garibaldi', deleted_at: null }],
  }) as unknown as Client;
}

describe('conversaRecente', () => {
  it('junta mensagens do chat, respostas do bot e do assistente, só do último dia, em ordem', async () => {
    const trocas = await conversaRecente(banco(), {
      chatId: 'g@g.us',
      telefone: '55',
      autorizadoId: 'aut',
      agora: AGORA,
    });
    const texto = formatarConversa(trocas);
    expect(texto).not.toContain('ontem');
    expect(texto).not.toContain('outro grupo');
    expect(texto.split('\n')[0]).toContain('Pessoa: quanto gastei na garibaldi');
    expect(texto).toContain('Agente: R$ 120 mil na Garibaldi.');
    expect(texto).toContain('Pessoa: paguei 500 pro zé');
    // O que o bot respondeu de verdade entra como Agente, logo depois da mensagem.
    const linhas = texto.split('\n');
    const iPessoa = linhas.findIndex((l) => l.includes('paguei 500 pro zé'));
    expect(linhas[iPessoa + 1]).toContain('Agente: Entendi assim. Vou lançar R$ 500');
    expect(texto).not.toContain('resposta em outro grupo');
    // Com a resposta real gravada, o "(entendi como…)" sintético não é mais necessário.
    expect(texto).not.toContain('(entendi como');
  });

  it('sem respostas gravadas, ainda descreve o que o CRM fez com cada mensagem', async () => {
    const db = banco();
    (db as unknown as ReturnType<typeof fakeSupabase>).tabelas.mensagens_enviadas = [];
    const texto = formatarConversa(
      await conversaRecente(db, {
        chatId: 'g@g.us',
        telefone: '55',
        autorizadoId: 'aut',
        agora: AGORA,
      }),
    );
    expect(texto).toContain('(entendi como: pagamento, classificada)');
  });

  it('sem nada → vazio, sem erro', async () => {
    const trocas = await conversaRecente(fakeSupabase({}) as unknown as Client, {
      chatId: null,
      telefone: '1',
      autorizadoId: 'a',
      agora: AGORA,
    });
    expect(formatarConversa(trocas)).toBe('');
  });
});

describe('obraRecente', () => {
  it('pega a obra dos dados extraídos da última mensagem do chat', async () => {
    const o = await obraRecente(banco(), {
      chatId: 'g@g.us',
      telefone: '55',
      autorizadoId: 'aut',
      agora: AGORA,
    });
    expect(o).toEqual({ id: GARI, nome: 'Garibaldi' });
  });

  it('obra criada por ação executada há pouco vence', async () => {
    const db = banco();
    (db as unknown as ReturnType<typeof fakeSupabase>)
      .linhas('obras')
      .push({ id: 'n1', nome: 'Sítio do Pedro', deleted_at: null });
    (db as unknown as ReturnType<typeof fakeSupabase>).linhas('confirmacoes_pendentes').push({
      id: 'p1',
      tipo: 'acao',
      resultado: 'executada',
      respondida_em: '2026-09-16T14:50:00Z',
      acao: { tipo: 'criar_obra', dados: { nome: 'Sítio do Pedro' } },
    });
    const o = await obraRecente(db, {
      chatId: 'g@g.us',
      telefone: '55',
      autorizadoId: 'aut',
      agora: AGORA,
    });
    expect(o?.nome).toBe('Sítio do Pedro');
  });

  it('fora da janela de 30 min → null (com 2 h, toda foto da tarde ia para a última obra citada)', async () => {
    const o = await obraRecente(banco(), {
      chatId: 'g@g.us',
      telefone: '55',
      autorizadoId: 'aut',
      agora: new Date('2026-09-16T15:01:00Z'),
    });
    expect(o).toBeNull();
  });

  it('correção ou desfazer zera a memória da obra: só conta o que veio depois do reset', async () => {
    const db = banco();
    (db as unknown as ReturnType<typeof fakeSupabase>).linhas('conversa_estado').push({
      chat_id: 'g@g.us',
      obra_conversa_reset_em: '2026-09-16T14:45:00Z',
    });
    const o = await obraRecente(db, {
      chatId: 'g@g.us',
      telefone: '55',
      autorizadoId: 'aut',
      agora: AGORA,
    });
    expect(o).toBeNull();
  });
});
