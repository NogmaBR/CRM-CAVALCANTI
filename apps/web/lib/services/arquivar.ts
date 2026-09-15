import 'server-only';
import { logger } from '@/lib/log';
import { CATEGORIA_LABELS, type DocCategoria } from '@/lib/status-labels';
import {
  downloadDocumentBytes,
  makeStoragePath,
  sha256Hex,
  uploadDocumentBuffer,
} from '@/lib/storage/documents';
import { hojeBR } from '@/lib/util/datas';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Arquivar na obra o que chega pelo grupo e NÃO é pagamento.
 *
 * Dois destinos:
 *   - `arquivarDocumentoDeObra`: foto, projeto, proposta… vira `documentos`
 *     na pasta (`categoria`) da obra, com `origem = 'whatsapp'`. Mesma
 *     mecânica de `anexarMidiaComoDocumento` (hash, 23505, cópia para o
 *     caminho canônico), sem pagamento.
 *   - `registrarNaObra`: texto ou áudio do dia a dia vira `registros_obra`
 *     (o diário), com a transcrição como texto e o áudio guardado.
 *
 * Os dois são idempotentes por mensagem: retry do provider e a corrida entre
 * o "2" da pessoa e um clique no painel não duplicam nada.
 *
 * A resposta no WhatsApp é curta e mostra onde foi parar — é o feedback que
 * substitui a pergunta "confirma?" para o que não é dinheiro.
 */

type Client = SupabaseClient<Database>;
type AnexoTipo = Database['public']['Enums']['anexo_tipo'];

const log = logger('arquivar');

/** Download injetável para teste; o padrão lê do Storage. */
export interface DepsArquivar {
  baixar: (storagePath: string) => Promise<Uint8Array | null>;
  subir: (destino: string, bytes: ArrayBuffer, mime: string) => Promise<void>;
}

const depsPadrao: DepsArquivar = {
  baixar: downloadDocumentBytes,
  subir: uploadDocumentBuffer,
};

const MIMES_DOCUMENTO = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export type ResultadoArquivar =
  | { ok: true; documentoId: string; jaExistia: boolean }
  | { ok: false; motivo: 'sem_midia' | 'mime_nao_suportado' | 'midia_nao_lida' | 'erro_insert' };

export async function arquivarDocumentoDeObra(
  supabase: Client,
  args: {
    mensagemId: string;
    obraId: string;
    categoria: DocCategoria;
    tipo: AnexoTipo;
    storagePath: string | null;
    mime: string | null;
    autorizadoId: string | null;
    legenda?: string | null;
  },
  deps: DepsArquivar = depsPadrao,
): Promise<ResultadoArquivar> {
  if (!args.storagePath) return { ok: false, motivo: 'sem_midia' };
  const mime = args.mime?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!MIMES_DOCUMENTO.has(mime)) return { ok: false, motivo: 'mime_nao_suportado' };

  // Já arquivado por esta mensagem (retry, corrida)? Devolve o mesmo.
  const { data: msg } = await supabase
    .from('mensagens_whats')
    .select('documento_id')
    .eq('id', args.mensagemId)
    .maybeSingle();
  if (msg?.documento_id) return { ok: true, documentoId: msg.documento_id, jaExistia: true };

  try {
    const bytes = await deps.baixar(args.storagePath);
    if (!bytes) {
      log.aviso('midia_nao_lida', { storage_path: args.storagePath });
      return { ok: false, motivo: 'midia_nao_lida' };
    }
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const hash = sha256Hex(buffer);

    const { data: existente } = await supabase
      .from('documentos')
      .select('id')
      .eq('hash_sha256', hash)
      .is('deleted_at', null)
      .maybeSingle();
    if (existente) {
      await ligarMensagem(supabase, args.mensagemId, { documento_id: existente.id });
      return { ok: true, documentoId: existente.id, jaExistia: true };
    }

    const nome = args.storagePath.split('/').pop() || `arquivo.${mime.split('/')[1] ?? 'bin'}`;
    const { data: novo, error } = await supabase
      .from('documentos')
      .insert({
        obra_id: args.obraId,
        tipo: args.tipo,
        categoria: args.categoria,
        origem: 'whatsapp',
        nome_arquivo: nome,
        mime_type: mime,
        tamanho_bytes: bytes.byteLength,
        storage_path: 'pending',
        hash_sha256: hash,
      })
      .select('id')
      .single();

    if (error || !novo) {
      if (error?.code === '23505') {
        const { data: vencedor } = await supabase
          .from('documentos')
          .select('id')
          .eq('hash_sha256', hash)
          .is('deleted_at', null)
          .maybeSingle();
        if (vencedor) {
          await ligarMensagem(supabase, args.mensagemId, { documento_id: vencedor.id });
          return { ok: true, documentoId: vencedor.id, jaExistia: true };
        }
      }
      log.erro('insert_documento_falhou', { mensagemId: args.mensagemId, erro: error });
      return { ok: false, motivo: 'erro_insert' };
    }

    // Caminho canônico (`<obra>/<documento>/<arquivo>`), como o painel. Sem a
    // cópia, aponta para o objeto original em `whatsapp/` — abre do mesmo jeito.
    const destino = makeStoragePath(args.obraId, novo.id, nome);
    let storagePath = destino;
    try {
      await deps.subir(destino, buffer, mime);
    } catch (err) {
      log.aviso('copia_midia_falhou', { documentoId: novo.id, err });
      storagePath = args.storagePath;
    }
    await supabase.from('documentos').update({ storage_path: storagePath }).eq('id', novo.id);
    await ligarMensagem(supabase, args.mensagemId, { documento_id: novo.id });

    return { ok: true, documentoId: novo.id, jaExistia: false };
  } catch (err) {
    log.erro('arquivar_falhou', { mensagemId: args.mensagemId, err });
    return { ok: false, motivo: 'erro_insert' };
  }
}

export type ResultadoRegistro =
  | { ok: true; registroId: string; jaExistia: boolean }
  | { ok: false; motivo: 'sem_texto' | 'erro_insert' };

export async function registrarNaObra(
  supabase: Client,
  args: {
    mensagemId: string;
    obraId: string;
    texto: string | null;
    resumo?: string | null;
    storagePath: string | null;
    mime: string | null;
    autorizadoId: string | null;
  },
): Promise<ResultadoRegistro> {
  const texto = args.texto?.trim();
  if (!texto) return { ok: false, motivo: 'sem_texto' };

  const { data: existente } = await supabase
    .from('registros_obra')
    .select('id')
    .eq('mensagem_id', args.mensagemId)
    .is('deleted_at', null)
    .maybeSingle();
  if (existente) return { ok: true, registroId: existente.id, jaExistia: true };

  const { data: novo, error } = await supabase
    .from('registros_obra')
    .insert({
      obra_id: args.obraId,
      texto,
      resumo: args.resumo?.trim() || null,
      data_registro: hojeBR(),
      origem: 'whatsapp',
      mensagem_id: args.mensagemId,
      autor_autorizado_id: args.autorizadoId,
      midia_storage_path: args.storagePath,
      midia_mime: args.mime,
    })
    .select('id')
    .single();

  if (error || !novo) {
    if (error?.code === '23505') {
      const { data: vencedor } = await supabase
        .from('registros_obra')
        .select('id')
        .eq('mensagem_id', args.mensagemId)
        .is('deleted_at', null)
        .maybeSingle();
      if (vencedor) return { ok: true, registroId: vencedor.id, jaExistia: true };
    }
    log.erro('insert_registro_falhou', { mensagemId: args.mensagemId, erro: error });
    return { ok: false, motivo: 'erro_insert' };
  }

  await ligarMensagem(supabase, args.mensagemId, { registro_id: novo.id });
  return { ok: true, registroId: novo.id, jaExistia: false };
}

async function ligarMensagem(
  supabase: Client,
  mensagemId: string,
  patch: { documento_id?: string; registro_id?: string },
): Promise<void> {
  const { error } = await supabase
    .from('mensagens_whats')
    .update({ ...patch, status: 'confirmada' })
    .eq('id', mensagemId);
  if (error) log.aviso('mensagem_nao_ligada', { mensagemId, erro: error.message });
}

/** "📁 Garibaldi › Fotos ✔" */
export function respostaArquivado(obraNome: string, categoria: DocCategoria): string {
  return `📁 ${obraNome} › ${CATEGORIA_LABELS[categoria].rotulo} ✔`;
}

/** "📝 Anotado em Garibaldi ✔" */
export function respostaRegistrado(obraNome: string): string {
  return `📝 Anotado em ${obraNome} ✔`;
}
