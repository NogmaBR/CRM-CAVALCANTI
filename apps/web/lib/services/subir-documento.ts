import 'server-only';
import { logger } from '@/lib/log';
import type { DocumentoMetaCreateInput } from '@/lib/schemas/documento';
import { validateFileMagicBytes, validateUploadedFile } from '@/lib/schemas/documento';
import { mapDbError, mapDbErrorWithContext } from '@/lib/schemas/errors';
import {
  deleteDocumentFile,
  makeStoragePath,
  serviceClient,
  sha256Hex,
  uploadDocumentBuffer,
} from '@/lib/storage/documents';
import { createClient } from '@/lib/supabase/server';

const log = logger('documentos');

/**
 * O núcleo do upload de um documento pelo painel — usado por
 * `/documentos/novo` e pelo "Anexar comprovante" inline na tela do
 * pagamento (PM3). Valida o arquivo (tamanho, MIME, magic bytes), grava a
 * linha, sobe para o Storage, fecha o `storage_path`, dispara o webhook e
 * emite `documento.anexado`. Não redireciona: quem chama decide para onde
 * voltar, com ou sem erro.
 */
export type ResultadoDoUpload =
  | { ok: true; documentoId: string }
  | { ok: false; erro: string; campo?: string };

/**
 * Apaga a linha criada antes de um upload que falhou. Usa service role
 * porque a RLS só deixa admin apagar `documentos`; com a sessão de um gestor
 * o DELETE atingia zero linhas e a linha órfã (hash preenchido,
 * storage_path='pending') bloqueava o reenvio do mesmo arquivo.
 */
async function desfazerDocumento(documentoId: string): Promise<void> {
  try {
    const admin = serviceClient();
    const { error } = await admin.from('documentos').delete().eq('id', documentoId);
    if (error) log.erro('rollback_documento_falhou', { documentoId, erro: error.message });
  } catch (err) {
    log.erro('rollback_documento_sem_service_role', {
      documentoId,
      erro: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function subirDocumento(
  meta: DocumentoMetaCreateInput,
  fileField: FormDataEntryValue | null,
): Promise<ResultadoDoUpload> {
  const fileCheck = validateUploadedFile(fileField);
  if (!fileCheck.ok) return { ok: false, erro: fileCheck.error, campo: 'file' };
  const file = fileCheck.file;

  // Lê o buffer uma vez: magic bytes + hash SHA-256 (dedupe) + upload.
  const buffer = await file.arrayBuffer();
  const magicCheck = validateFileMagicBytes(buffer, file.type);
  if (!magicCheck.ok) return { ok: false, erro: magicCheck.error, campo: 'file' };
  const hash = sha256Hex(buffer);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const criadoPor = userData.user?.id ?? null;

  const insertRes = await supabase
    .from('documentos')
    .insert({
      obra_id: meta.obra_id,
      pagamento_id: meta.pagamento_id ?? null,
      fornecedor_id: meta.fornecedor_id ?? null,
      tipo: meta.tipo,
      categoria: meta.categoria,
      origem: 'painel',
      nome_arquivo: file.name,
      mime_type: file.type,
      tamanho_bytes: file.size,
      storage_path: 'pending',
      numero_nf: meta.numero_nf ?? null,
      chave_acesso_nf: meta.chave_acesso_nf ?? null,
      hash_sha256: hash,
      criado_por_user_id: criadoPor,
    })
    .select('id')
    .single();

  if (insertRes.error) {
    const dupMsg =
      insertRes.error.code === '23505'
        ? insertRes.error.message?.includes('idx_documentos_hash')
          ? 'Arquivo idêntico já existe (mesmo conteúdo). Verifique documentos anteriores.'
          : insertRes.error.message?.includes('idx_documentos_chave_nf')
            ? 'Já existe documento com esta chave de acesso de NF.'
            : 'Já existe documento com esta chave de NF ou hash.'
        : undefined;
    return {
      ok: false,
      erro: mapDbErrorWithContext(insertRes.error, {
        '23503': 'Obra, pagamento ou fornecedor referenciado não existe',
        ...(dupMsg ? { '23505': dupMsg } : {}),
      }),
    };
  }

  const documentoId = insertRes.data.id;
  const path = makeStoragePath(meta.obra_id, documentoId, file.name);

  try {
    await uploadDocumentBuffer(path, buffer, file.type);
  } catch (uploadErr) {
    await desfazerDocumento(documentoId);
    log.erro('upload_documento_falhou', {
      documentoId,
      erro: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
    });
    return { ok: false, erro: 'Falha ao enviar o arquivo. Tente de novo.', campo: 'file' };
  }

  const upd = await supabase.from('documentos').update({ storage_path: path }).eq('id', documentoId);
  if (upd.error) {
    try {
      await deleteDocumentFile(path);
    } catch {
      /* best effort */
    }
    await desfazerDocumento(documentoId);
    return { ok: false, erro: mapDbError(upd.error) };
  }

  // Webhook de saída (fase n8n) — best-effort.
  try {
    const { dispatchEvento } = await import('@/lib/services/dispatch-webhook');
    await dispatchEvento('documento_created', {
      id: documentoId,
      obra_id: meta.obra_id,
      pagamento_id: meta.pagamento_id ?? null,
      fornecedor_id: meta.fornecedor_id ?? null,
      tipo: meta.tipo,
      nome_arquivo: file.name,
      mime_type: file.type,
      tamanho_bytes: file.size,
      storage_path: path,
    });
  } catch {
    // Silencioso
  }

  // Evento de domínio: uma nota anexada encerra a cobrança daquele pagamento.
  const { emitir } = await import('@/lib/events/bus');
  await emitir(
    'documento.anexado',
    {
      documentoId,
      pagamentoId: meta.pagamento_id ?? null,
      obraId: meta.obra_id,
      tipo: meta.tipo,
    },
    { userId: criadoPor },
  );

  return { ok: true, documentoId };
}
