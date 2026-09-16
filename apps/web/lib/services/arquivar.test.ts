import { fakeSupabase } from '@/test/fake-supabase';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  arquivarDocumentoDeObra,
  registrarNaObra,
  respostaArquivado,
  respostaRegistrado,
} from './arquivar';

/**
 * O que precisa ser verdade:
 *  - arquivar cria `documentos` na obra/pasta certa, origem whatsapp, e liga
 *    a mensagem;
 *  - é idempotente por mensagem e por hash (retry do provider, mesma foto
 *    mandada duas vezes);
 *  - registrar cria `registros_obra` com a data civil e liga a mensagem;
 *  - as respostas são as que o gestor vê no grupo.
 */

const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function deps() {
  return {
    baixar: vi.fn(async () => bytes),
    subir: vi.fn(async () => {}),
  };
}

function db() {
  return fakeSupabase(
    {
      mensagens_whats: [{ id: 'm1', status: 'recebida', documento_id: null, registro_id: null }],
      documentos: [],
      registros_obra: [],
    },
    { unicos: { documentos: [['hash_sha256']], registros_obra: [['mensagem_id']] } },
  );
}

const cliente = (f: ReturnType<typeof db>) => f as unknown as SupabaseClient<Database>;

describe('arquivarDocumentoDeObra', () => {
  it('cria o documento na pasta da obra e liga a mensagem', async () => {
    const f = db();
    const d = deps();
    const r = await arquivarDocumentoDeObra(
      cliente(f),
      {
        mensagemId: 'm1',
        obraId: 'obra-1',
        categoria: 'fotos',
        tipo: 'outro',
        storagePath: 'whatsapp/2026/09/foto.jpg',
        mime: 'image/jpeg',
        autorizadoId: 'aut-1',
      },
      d,
    );
    expect(r.ok).toBe(true);
    const doc = f.linhas('documentos')[0];
    expect(doc).toMatchObject({
      obra_id: 'obra-1',
      categoria: 'fotos',
      origem: 'whatsapp',
      mime_type: 'image/jpeg',
      nome_arquivo: 'foto.jpg',
    });
    expect(String(doc?.storage_path)).toBe(`obra-1/${doc?.id}/foto.jpg`);
    expect(d.subir).toHaveBeenCalledWith(
      `obra-1/${doc?.id}/foto.jpg`,
      expect.anything(),
      'image/jpeg',
    );
    expect(f.linhas('mensagens_whats')[0]).toMatchObject({
      documento_id: doc?.id,
      status: 'confirmada',
    });
  });

  it('segunda chamada pela mesma mensagem não duplica', async () => {
    const f = db();
    const d = deps();
    const args = {
      mensagemId: 'm1',
      obraId: 'obra-1',
      categoria: 'fotos' as const,
      tipo: 'outro' as const,
      storagePath: 'whatsapp/foto.jpg',
      mime: 'image/jpeg',
      autorizadoId: null,
    };
    const a = await arquivarDocumentoDeObra(cliente(f), args, d);
    const b = await arquivarDocumentoDeObra(cliente(f), args, d);
    expect(a.ok && b.ok && a.documentoId === b.documentoId).toBe(true);
    expect(b.ok && b.jaExistia).toBe(true);
    expect(f.linhas('documentos')).toHaveLength(1);
    expect(d.baixar).toHaveBeenCalledTimes(1);
  });

  it('mesma foto mandada por outra mensagem reaproveita pelo hash', async () => {
    const f = db();
    f.linhas('mensagens_whats').push({ id: 'm2', status: 'recebida', documento_id: null });
    const d = deps();
    const base = {
      obraId: 'obra-1',
      categoria: 'fotos' as const,
      tipo: 'outro' as const,
      storagePath: 'whatsapp/foto.jpg',
      mime: 'image/jpeg',
      autorizadoId: null,
    };
    await arquivarDocumentoDeObra(cliente(f), { ...base, mensagemId: 'm1' }, d);
    const r = await arquivarDocumentoDeObra(cliente(f), { ...base, mensagemId: 'm2' }, d);
    expect(r.ok && r.jaExistia).toBe(true);
    expect(f.linhas('documentos')).toHaveLength(1);
    expect(f.linhas('mensagens_whats')[1]?.documento_id).toBe(f.linhas('documentos')[0]?.id);
  });

  it('sem mídia, mime estranho ou download falho não cria nada', async () => {
    const f = db();
    const base = {
      mensagemId: 'm1',
      obraId: 'o',
      categoria: 'fotos' as const,
      tipo: 'outro' as const,
      autorizadoId: null,
    };
    expect(
      await arquivarDocumentoDeObra(
        cliente(f),
        { ...base, storagePath: null, mime: 'image/jpeg' },
        deps(),
      ),
    ).toEqual({
      ok: false,
      motivo: 'sem_midia',
    });
    expect(
      await arquivarDocumentoDeObra(
        cliente(f),
        // Vídeo passou a ser guardado (2026-09-16); só executável fica de fora.
        { ...base, storagePath: 'x', mime: 'application/x-msdownload' },
        deps(),
      ),
    ).toEqual({
      ok: false,
      motivo: 'mime_nao_suportado',
    });
    const d = deps();
    d.baixar.mockResolvedValueOnce(null as never);
    expect(
      await arquivarDocumentoDeObra(
        cliente(f),
        { ...base, storagePath: 'x', mime: 'image/jpeg' },
        d,
      ),
    ).toEqual({
      ok: false,
      motivo: 'midia_nao_lida',
    });
    expect(f.linhas('documentos')).toHaveLength(0);
  });

  it('cópia para o caminho canônico falhando, aponta para o original', async () => {
    const f = db();
    const d = deps();
    d.subir.mockRejectedValueOnce(new Error('storage fora'));
    const r = await arquivarDocumentoDeObra(
      cliente(f),
      {
        mensagemId: 'm1',
        obraId: 'o',
        categoria: 'fotos',
        tipo: 'outro',
        storagePath: 'whatsapp/foto.jpg',
        mime: 'image/jpeg',
        autorizadoId: null,
      },
      d,
    );
    expect(r.ok).toBe(true);
    expect(f.linhas('documentos')[0]?.storage_path).toBe('whatsapp/foto.jpg');
  });
});

describe('registrarNaObra', () => {
  it('cria o registro com a data civil e liga a mensagem', async () => {
    const f = db();
    const r = await registrarNaObra(cliente(f), {
      mensagemId: 'm1',
      obraId: 'obra-1',
      texto: '  hoje terminou a laje  ',
      resumo: 'Laje concluída',
      storagePath: 'whatsapp/audio.ogg',
      mime: 'audio/ogg',
      autorizadoId: 'aut-1',
    });
    expect(r.ok).toBe(true);
    expect(f.linhas('registros_obra')[0]).toMatchObject({
      obra_id: 'obra-1',
      texto: 'hoje terminou a laje',
      resumo: 'Laje concluída',
      origem: 'whatsapp',
      mensagem_id: 'm1',
      autor_autorizado_id: 'aut-1',
      midia_storage_path: 'whatsapp/audio.ogg',
    });
    expect(String(f.linhas('registros_obra')[0]?.data_registro)).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(f.linhas('mensagens_whats')[0]).toMatchObject({
      registro_id: f.linhas('registros_obra')[0]?.id,
      status: 'confirmada',
    });
  });

  it('idempotente por mensagem; sem texto não registra', async () => {
    const f = db();
    const args = {
      mensagemId: 'm1',
      obraId: 'o',
      texto: 'anotação qualquer',
      storagePath: null,
      mime: null,
      autorizadoId: null,
    };
    const a = await registrarNaObra(cliente(f), args);
    const b = await registrarNaObra(cliente(f), args);
    expect(a.ok && b.ok && a.registroId === b.registroId && b.jaExistia).toBe(true);
    expect(f.linhas('registros_obra')).toHaveLength(1);
    expect(await registrarNaObra(cliente(f), { ...args, mensagemId: 'm9', texto: '   ' })).toEqual({
      ok: false,
      motivo: 'sem_texto',
    });
  });
});

describe('respostas', () => {
  it('curtas, com o destino visível', () => {
    expect(respostaArquivado('Garibaldi', 'fotos')).toBe('📁 Garibaldi › Fotos ✔');
    expect(respostaArquivado('Casa EJ', 'nfs_pagamentos')).toBe('📁 Casa EJ › NFs/Pagamentos ✔');
    expect(respostaRegistrado('Garibaldi')).toBe('📝 Anotado em Garibaldi ✔');
  });
});
