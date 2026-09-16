import { fakeSupabase } from '@/test/fake-supabase';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O agente no grupo, ponta a ponta sobre o Supabase fake.
 *
 * O que precisa ser verdade:
 *  1. Pessoa autorizada num grupo NÃO cadastrado é ignorada em silêncio.
 *  2. Num grupo cadastrado, toda resposta vai para o grupo (chatId), nunca
 *     para o privado da pessoa.
 *  3. Documento de obra sem obra identificável abre a pergunta numerada; o
 *     "2" arquiva na obra 2 e responde "📁 … ✔".
 *  4. Documento com obra resolvida (grupo dedicado) arquiva direto e avisa.
 *  5. Pagamento continua o de sempre: pergunta e "SIM".
 */

const enviarTexto = vi.fn(async (_destino: string, _texto: string) => ({
  ok: true,
  msgId: 'env-1',
}));
const classifyAndPersist = vi.fn();

vi.mock('./uazapi', () => ({
  enviarTexto: (...a: [string, string]) => enviarTexto(...a),
  baixarMidia: vi.fn(async () => ({ ok: false, motivo: 'nao_configurado' })),
  obterLinkDaMidia: vi.fn(async () => null),
}));
vi.mock('./classify-and-persist', () => ({
  classifyAndPersist: (...a: [string]) => classifyAndPersist(...a),
}));
vi.mock('@/lib/ia/transcricao', () => ({
  transcreverAudio: vi.fn(async () => ({ ok: false, motivo: 'desativado' })),
}));
vi.mock('@/lib/storage/documents', () => ({
  uploadDocumentBuffer: vi.fn(async () => {}),
  downloadDocumentBytes: vi.fn(async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1])),
  makeStoragePath: (o: string, d: string, n: string) => `${o}/${d}/${n}`,
  sha256Hex: () => 'hash-fixo',
}));
vi.mock('@/lib/ia/assistente', () => ({
  assistenteDisponivel: () => false,
  perguntar: vi.fn(),
}));

const GRUPO = '120363000000000001@g.us';
const FERNANDO = '5551981944829@s.whatsapp.net';
const GARI_ID = '11111111-1111-4111-8111-111111111111';

function db() {
  return fakeSupabase(
    {
      autorizados: [
        {
          id: 'aut-1',
          nome: 'Fernando',
          telefone_norm: '5551981944829',
          ativo: true,
          deleted_at: null,
        },
      ],
      whatsapp_grupos: [
        {
          id: 'g-1',
          chat_id: GRUPO,
          nome: 'Obras Cavalcanti',
          ativo: true,
          obra_id: null,
          deleted_at: null,
        },
      ],
      obras: [
        { id: 'o-agu', nome: 'Aguirre', apelidos: [], status: 'ativa', deleted_at: null },
        { id: GARI_ID, nome: 'Garibaldi', apelidos: ['Gari'], status: 'ativa', deleted_at: null },
      ],
      mensagens_whats: [],
      confirmacoes_pendentes: [],
      documentos: [],
      registros_obra: [],
      whatsapp_respostas: [],
    },
    {
      unicos: {
        mensagens_whats: [['msg_id_uazapi']],
        whatsapp_respostas: [['msg_id_uazapi', 'acao']],
        documentos: [['hash_sha256']],
        registros_obra: [['mensagem_id']],
      },
      relacoes: { confirmacoes_pendentes: { mensagens_whats: 'mensagem_id' } },
    },
  );
}
const cliente = (f: ReturnType<typeof db>) => f as unknown as SupabaseClient<Database>;

function msg(over: Record<string, unknown> = {}) {
  return {
    id: `wa-${Math.random().toString(36).slice(2)}`,
    type: 'text' as const,
    timestamp: 1788800100,
    from: FERNANDO,
    chatId: GRUPO,
    isGroup: true,
    text: 'oi',
    ...over,
  };
}

async function inbound() {
  const mod = await import('./inbound-whatsapp');
  return mod.processarInbound;
}

describe('agente no grupo', () => {
  beforeEach(() => {
    enviarTexto.mockClear();
    classifyAndPersist.mockReset();
  });

  it('grupo não cadastrado: ignorado em silêncio, nada gravado', async () => {
    const f = db();
    const processar = await inbound();
    const r = await processar(cliente(f), msg({ chatId: '120363999@g.us' }) as never);
    expect(r.acao).toBe('ignorada_grupo_nao_autorizado');
    expect(enviarTexto).not.toHaveBeenCalled();
    expect(f.linhas('mensagens_whats')).toHaveLength(0);
  });

  it('pessoa não autorizada num grupo cadastrado: ignorada', async () => {
    const f = db();
    const processar = await inbound();
    const r = await processar(cliente(f), msg({ from: '5551900000000@s.whatsapp.net' }) as never);
    expect(r.acao).toBe('ignorada_nao_autorizada');
  });

  it('documento sem obra: pergunta numerada no GRUPO; "2" arquiva na obra 2 e avisa', async () => {
    const f = db();
    const processar = await inbound();

    // O classificador (mockado) abre a pendência de obra como faria de verdade.
    classifyAndPersist.mockImplementationOnce(async (mensagemId: string) => {
      const opcoes = [
        { n: 1, id: 'o-agu', nome: 'Aguirre', apelidos: [] },
        { n: 2, id: GARI_ID, nome: 'Garibaldi', apelidos: ['Gari'] },
      ];
      const pergunta =
        'De qual obra é esse arquivo?\n1) Aguirre\n2) Garibaldi\nResponda com o número.';
      f.linhas('confirmacoes_pendentes').push({
        id: 'conf-1',
        mensagem_id: mensagemId,
        pergunta_enviada: pergunta,
        tipo: 'obra_documento',
        opcoes,
        resolvida: false,
        created_at: new Date().toISOString(),
      });
      const m = f.linhas('mensagens_whats').find((x) => x.id === mensagemId);
      if (m) {
        m.status = 'classificada';
        m.dados_extraidos = { categoria: 'fotos', tipo_documento: 'outro' };
        m.midia_storage_path = 'whatsapp/x/foto.jpg';
        m.midia_mime = 'image/jpeg';
      }
      return {
        ok: true,
        status: 'classificada',
        confianca: 0.6,
        kind: 'documento_obra',
        confirmacao: { id: 'conf-1', pergunta },
      };
    });

    const foto = msg({
      type: 'image',
      text: undefined,
      media: { url: undefined, mimetype: 'image/jpeg' },
    });
    const r1 = await processar(cliente(f), foto as never);
    expect(r1.acao).toBe('classificada');
    expect(enviarTexto).toHaveBeenLastCalledWith(GRUPO, expect.stringContaining('1) Aguirre'));
    expect(f.linhas('mensagens_whats')[0]).toMatchObject({ chat_id: GRUPO, grupo_id: 'g-1' });

    const r2 = await processar(cliente(f), msg({ text: '2' }) as never);
    expect(r2.acao).toBe('escolheu_obra');
    expect(enviarTexto).toHaveBeenLastCalledWith(GRUPO, '📁 Garibaldi › Fotos ✔');
    expect(f.linhas('documentos')[0]).toMatchObject({
      obra_id: GARI_ID,
      categoria: 'fotos',
      origem: 'whatsapp',
    });
    expect(f.linhas('confirmacoes_pendentes')[0]).toMatchObject({
      resolvida: true,
      resultado: 'confirmada',
    });
    // A resposta "2" é gravada como prova, já resolvida; nada foi classificado de novo.
    expect(f.linhas('mensagens_whats')[1]).toMatchObject({
      status: 'confirmada',
      texto_bruto: '2',
    });
    expect(classifyAndPersist).toHaveBeenCalledTimes(1);
  });

  it('resposta que não é escolha deixa a pergunta aberta e segue como mensagem comum', async () => {
    const f = db();
    f.linhas('mensagens_whats').push({
      id: 'm0',
      msg_id_uazapi: 'wa-0',
      telefone_from: '5551981944829',
      status: 'classificada',
    });
    f.linhas('confirmacoes_pendentes').push({
      id: 'conf-1',
      mensagem_id: 'm0',
      pergunta_enviada: 'De qual obra?',
      tipo: 'obra_documento',
      opcoes: [{ n: 1, id: 'o-agu', nome: 'Aguirre' }],
      resolvida: false,
      created_at: new Date().toISOString(),
    });
    classifyAndPersist.mockResolvedValueOnce({
      ok: true,
      status: 'erro',
      confianca: 0.6,
      kind: 'nao_identificado',
      confirmacao: null,
    });
    const processar = await inbound();
    const r = await processar(cliente(f), msg({ text: 'não sei' }) as never);
    expect(r.acao).toBe('classificada');
    expect(f.linhas('confirmacoes_pendentes')[0]?.resolvida).toBe(false);
  });

  it('"não" a uma pergunta de obra recusa e avisa no grupo', async () => {
    const f = db();
    f.linhas('mensagens_whats').push({
      id: 'm0',
      msg_id_uazapi: 'wa-0',
      telefone_from: '5551981944829',
      status: 'classificada',
    });
    f.linhas('confirmacoes_pendentes').push({
      id: 'conf-1',
      mensagem_id: 'm0',
      pergunta_enviada: 'De qual obra?',
      tipo: 'obra_registro',
      opcoes: [{ n: 1, id: 'o-agu', nome: 'Aguirre' }],
      resolvida: false,
      created_at: new Date().toISOString(),
    });
    const processar = await inbound();
    const r = await processar(cliente(f), msg({ text: 'não' }) as never);
    expect(r.acao).toBe('recusou_pendencia');
    expect(enviarTexto).toHaveBeenLastCalledWith(
      GRUPO,
      expect.stringContaining('deixei sem arquivar'),
    );
    expect(f.linhas('confirmacoes_pendentes')[0]).toMatchObject({
      resolvida: true,
      resultado: 'recusada',
    });
  });

  it('documento com obra resolvida: arquiva direto e avisa uma vez só', async () => {
    const f = db();
    classifyAndPersist.mockResolvedValue({
      ok: true,
      status: 'confirmada',
      confianca: 0.6,
      kind: 'documento_obra',
      confirmacao: null,
      resposta: '📁 Garibaldi › Fotos ✔',
    });
    const processar = await inbound();
    const foto = msg({ type: 'image', text: 'foto da Gari', media: { mimetype: 'image/jpeg' } });
    const r = await processar(cliente(f), foto as never);
    expect(r).toMatchObject({ acao: 'classificada', detalhe: 'documento_obra' });
    expect(enviarTexto).toHaveBeenCalledWith(GRUPO, '📁 Garibaldi › Fotos ✔');

    // Retry do provider com o mesmo id: dedupe, sem segunda resposta.
    enviarTexto.mockClear();
    const r2 = await processar(cliente(f), foto as never);
    expect(r2.acao).toBe('duplicada');
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  it('pagamento no grupo: pergunta no grupo e "sim" lança (caminho de sempre)', async () => {
    const f = db();
    classifyAndPersist.mockImplementationOnce(async (mensagemId: string) => {
      f.linhas('confirmacoes_pendentes').push({
        id: 'conf-p',
        mensagem_id: mensagemId,
        pergunta_enviada: 'Achei R$ 1200 na Garibaldi. Confirma?',
        tipo: 'pagamento',
        opcoes: null,
        resolvida: false,
        created_at: new Date().toISOString(),
      });
      const m = f.linhas('mensagens_whats').find((x) => x.id === mensagemId);
      if (m) {
        m.status = 'classificada';
        m.dados_extraidos = { valor: 1200, obra_id: GARI_ID, data_pagamento: '2026-09-15' };
      }
      return {
        ok: true,
        status: 'classificada',
        confianca: 0.6,
        kind: 'pagamento_parcial',
        confirmacao: { id: 'conf-p', pergunta: 'Achei R$ 1200 na Garibaldi. Confirma?' },
      };
    });
    const processar = await inbound();
    await processar(cliente(f), msg({ text: 'paguei 1200 de areia na Gari' }) as never);
    expect(enviarTexto).toHaveBeenLastCalledWith(GRUPO, expect.stringContaining('Confirma?'));

    const r = await processar(cliente(f), msg({ text: 'sim' }) as never);
    expect(r.acao).toBe('confirmou_pendencia');
    expect(f.linhas('pagamentos')[0]).toMatchObject({
      obra_id: GARI_ID,
      valor: 1200,
      origem: 'whatsapp',
    });
    expect(enviarTexto).toHaveBeenLastCalledWith(GRUPO, 'Lançado ✅ Obrigado!');
  });

  it('no privado, a resposta vai para a própria pessoa', async () => {
    const f = db();
    classifyAndPersist.mockResolvedValue({
      ok: true,
      status: 'confirmada',
      confianca: 0.6,
      kind: 'registro_obra',
      confirmacao: null,
      resposta: '📝 Anotado em Garibaldi ✔',
    });
    const processar = await inbound();
    await processar(
      cliente(f),
      msg({ chatId: undefined, isGroup: false, text: 'hoje terminou a laje da Gari' }) as never,
    );
    expect(enviarTexto).toHaveBeenCalledWith(FERNANDO, '📝 Anotado em Garibaldi ✔');
  });
});
