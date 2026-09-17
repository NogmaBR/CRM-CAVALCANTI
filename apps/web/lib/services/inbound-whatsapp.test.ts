import { fakeSupabase } from '@/test/fake-supabase';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
const baixarMidia = vi.fn(
  async (_url: string | null | undefined): Promise<unknown> => ({
    ok: false,
    motivo: 'nao_configurado',
  }),
);
const uploadDocumentBuffer = vi.fn(async (_p: string, _b: ArrayBuffer, _m: string) => {});

vi.mock('./uazapi', () => ({
  enviarTexto: (...a: [string, string]) => enviarTexto(...a),
  baixarMidia: (...a: [string | null | undefined]) => baixarMidia(...a),
  obterLinkDaMidia: vi.fn(async () => null),
}));
vi.mock('./classify-and-persist', () => ({
  classifyAndPersist: (...a: [string]) => classifyAndPersist(...a),
}));
vi.mock('@/lib/ia/transcricao', () => ({
  transcreverAudio: vi.fn(async () => ({ ok: false, motivo: 'desativado' })),
}));
vi.mock('@/lib/storage/documents', () => ({
  uploadDocumentBuffer: (...a: [string, ArrayBuffer, string]) => uploadDocumentBuffer(...a),
  downloadDocumentBytes: vi.fn(async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1])),
  makeStoragePath: (o: string, d: string, n: string) => `${o}/${d}/${n}`,
  sha256Hex: () => 'hash-fixo',
}));
/** O assistente é ligado por teste: `assistente.disponivel = true` + `perguntar` falso. */
const assistente = {
  disponivel: false,
  perguntar: vi.fn(async (_s: unknown, _e: unknown): Promise<unknown> => null),
};
vi.mock('@/lib/ia/assistente', () => ({
  assistenteDisponivel: () => assistente.disponivel,
  perguntar: (...a: [unknown, unknown]) => assistente.perguntar(...a),
}));
vi.mock('@/lib/ia/intencao', () => ({
  intencaoDisponivel: () => false,
  classificarIntencao: vi.fn(async () => 'nenhuma'),
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
      fornecedores: [],
      recebimentos: [],
      ai_conversations: [],
      ai_messages: [],
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
  // O primeiro `import('./inbound-whatsapp')` compila o grafo inteiro do
  // serviço; com a suíte toda rodando isso passava de 5 s e o primeiro teste
  // estourava sozinho. Paga-se o custo aqui, com folga.
  beforeAll(async () => {
    await inbound();
  }, 30_000);

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

  it('pagamento SEM obra (comprovante de Pix): pergunta a obra numerada; "sim" não basta; "1" lança na obra', async () => {
    const f = db();
    const opcoes = [{ n: 1, id: GARI_ID, nome: 'Garibaldi', apelidos: ['Gari'] }];
    classifyAndPersist.mockImplementationOnce(async (mensagemId: string) => {
      f.linhas('confirmacoes_pendentes').push({
        id: 'conf-sem-obra',
        mensagem_id: mensagemId,
        pergunta_enviada:
          'R$ 16,00 — Pix para Gilvando. De qual obra é esse pagamento? 1) Garibaldi',
        tipo: 'pagamento',
        opcoes,
        resolvida: false,
        created_at: new Date().toISOString(),
      });
      const m = f.linhas('mensagens_whats').find((x) => x.id === mensagemId);
      if (m) {
        m.status = 'classificada';
        m.dados_extraidos = {
          valor: 16,
          data_pagamento: '2026-09-15',
          fornecedor_nome_novo: 'Gilvando',
        };
      }
      return {
        ok: true,
        status: 'classificada',
        confianca: 0.98,
        kind: 'pagamento_parcial',
        confirmacao: { id: 'conf-sem-obra', pergunta: 'De qual obra?' },
      };
    });
    const processar = await inbound();
    await processar(cliente(f), msg({ type: 'image', text: undefined }) as never);

    // "sim" sem obra: não lança, explica o que falta
    const r1 = await processar(cliente(f), msg({ text: 'sim' }) as never);
    expect(r1).toMatchObject({ acao: 'confirmou_pendencia', detalhe: 'falta_obra' });
    expect(f.linhas('pagamentos')).toHaveLength(0);
    expect(enviarTexto).toHaveBeenLastCalledWith(GRUPO, expect.stringContaining('Falta a obra'));

    // o número escolhe a obra E confirma
    const r2 = await processar(cliente(f), msg({ text: '1' }) as never);
    expect(r2.acao).toBe('confirmou_pendencia');
    expect(f.linhas('pagamentos')[0]).toMatchObject({
      obra_id: GARI_ID,
      valor: 16,
      origem: 'whatsapp',
    });
    expect(enviarTexto).toHaveBeenLastCalledWith(GRUPO, 'Lançado em Garibaldi ✅ Obrigado!');
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

  it('vídeo no grupo: baixa, guarda com nome legível e tipo `video`, e vai para o classificador', async () => {
    const f = db();
    const processar = await inbound();
    baixarMidia.mockResolvedValueOnce({
      ok: true,
      bytes: new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]),
      mime: 'video/mp4',
    });
    classifyAndPersist.mockResolvedValue({
      ok: true,
      status: 'confirmada',
      confianca: 0.9,
      kind: 'documento_obra',
      resposta: '📁 Garibaldi › Fotos ✔',
    });

    const video = msg({
      type: 'video',
      text: 'laje da Gari hoje',
      timestamp: 1789234320, // 2026-09-15 17:32 UTC → 14:32 em Brasília
      media: { url: 'https://midia.uazapi.test/v.mp4', mimetype: 'video/mp4' },
    });
    const r = await processar(cliente(f), video as never);
    expect(r.acao).toBe('classificada');

    const [path, , mime] = uploadDocumentBuffer.mock.calls.at(-1) ?? [];
    expect(mime).toBe('video/mp4');
    expect(String(path)).toMatch(
      /^whatsapp\/wa-[a-z0-9]+\/2026-09-\d{2}_\d{2}h\d{2}_video_fernando\.mp4$/u,
    );
    expect(f.linhas('mensagens_whats')[0]).toMatchObject({
      tipo: 'video',
      midia_mime: 'video/mp4',
      midia_storage_path: path,
    });
  });
});

describe('ações pelo WhatsApp (assistente ligado)', () => {
  beforeEach(() => {
    assistente.disponivel = true;
    assistente.perguntar.mockReset();
    enviarTexto.mockClear();
    classifyAndPersist.mockReset();
  });

  const PROPOSTA = {
    tipo: 'criar_obra',
    dados: {
      nome: 'Sítio do Pedro',
      cliente: null,
      tipo_obra: null,
      endereco: null,
      valor_contrato: null,
      data_inicio: null,
    },
  };

  it('"cria a obra X" → pergunta por template no grupo; "sim" cria a obra e avisa', async () => {
    const f = db();
    assistente.perguntar.mockResolvedValueOnce({
      texto: 'Preparei. Confira abaixo:',
      fontes: [],
      usouModelo: true,
      ferramentas: [],
      proposta: PROPOSTA,
    });
    const processar = await inbound();

    const r1 = await processar(cliente(f), msg({ text: 'cria uma obra chamada Sítio do Pedro' }));
    expect(r1.acao).toBe('acao_proposta');
    expect(classifyAndPersist).not.toHaveBeenCalled();
    const pergunta = enviarTexto.mock.calls[0]?.[1] ?? '';
    expect(enviarTexto.mock.calls[0]?.[0]).toBe(GRUPO);
    expect(pergunta).toContain('Nome da obra: *Sítio do Pedro*');
    expect(pergunta).toContain('Responda *SIM*');
    expect(f.linhas('confirmacoes_pendentes')[0]).toMatchObject({ tipo: 'acao', resolvida: false });
    expect(f.linhas('obras')).toHaveLength(2);

    const r2 = await processar(cliente(f), msg({ text: 'SIM' }));
    expect(r2.acao).toBe('executou_acao');
    expect(f.linhas('obras')).toHaveLength(3);
    expect(f.linhas('obras')[2]).toMatchObject({ nome: 'Sítio do Pedro', status: 'ativa' });
    expect(enviarTexto.mock.calls[1]?.[1]).toContain('✅ Obra *Sítio do Pedro* criada');
    expect(f.linhas('confirmacoes_pendentes')[0]).toMatchObject({
      resolvida: true,
      resultado: 'executada',
    });
  });

  it('"não" cancela a ação sem gravar nada', async () => {
    const f = db();
    assistente.perguntar.mockResolvedValueOnce({
      texto: '',
      fontes: [],
      usouModelo: true,
      ferramentas: [],
      proposta: PROPOSTA,
    });
    const processar = await inbound();
    await processar(cliente(f), msg({ text: 'cria uma obra chamada Sítio do Pedro' }));
    const r = await processar(cliente(f), msg({ text: 'não' }));
    expect(r.acao).toBe('recusou_pendencia');
    expect(f.linhas('obras')).toHaveLength(2);
    expect(f.linhas('confirmacoes_pendentes')[0]).toMatchObject({ resolvida: true });
    expect(enviarTexto.mock.calls[1]?.[1]).toBe('Ok, cancelei. Nada foi gravado.');
  });

  it('pergunta livre: o assistente responde e nada vira pendência', async () => {
    const f = db();
    assistente.perguntar.mockResolvedValueOnce({
      texto: 'Obra *Garibaldi*: R$ 134.231,05 (134 mil) gastos.',
      fontes: [],
      usouModelo: true,
      ferramentas: [{ ferramenta: 'resumo_da_obra' }],
    });
    const processar = await inbound();
    const r = await processar(cliente(f), msg({ text: 'quanto estou lucrando na garibaldi' }));
    expect(r.acao).toBe('pergunta');
    expect(enviarTexto.mock.calls[0]?.[1]).toContain('Garibaldi');
    expect(f.linhas('confirmacoes_pendentes')).toHaveLength(0);
    expect(f.linhas('mensagens_whats')).toHaveLength(0);
  });

  it('lançamento nunca vai ao assistente, mesmo ligado', async () => {
    const f = db();
    classifyAndPersist.mockResolvedValueOnce({
      ok: true,
      status: 'classificada',
      confianca: 0.9,
      kind: 'pagamento',
      confirmacao: null,
    });
    const processar = await inbound();
    await processar(cliente(f), msg({ text: 'paguei 1200 de cimento pro Mathias na Garibaldi' }));
    expect(assistente.perguntar).not.toHaveBeenCalled();
    expect(classifyAndPersist).toHaveBeenCalledTimes(1);
  });
});
