'use server';

import { getDocumento } from '@/lib/data/documentos';
import { logger } from '@/lib/log';
import {
  DocumentoMetaCreateSchema,
  DocumentoUpdateSchema,
  validateFileMagicBytes,
  validateUploadedFile,
} from '@/lib/schemas/documento';
import { mapDbError, mapDbErrorWithContext } from '@/lib/schemas/errors';
import { serviceClient } from '@/lib/storage/documents';
import {
  deleteDocumentFile,
  getSignedUrl,
  makeStoragePath,
  sha256Hex,
  uploadDocumentBuffer,
} from '@/lib/storage/documents';
import { erroDeEscrita } from '@/lib/supabase/escrita';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type Rotulos, voltarComErro } from '../_shared/form-erros';

const log = logger('documentos');

const ROTULOS_DOCUMENTO: Rotulos = {
  file: 'Arquivo',
  tipo: 'Tipo',
  numero_nf: 'Número da NF',
  chave_acesso_nf: 'Chave de acesso NF',
  obra_id: 'Obra',
  pagamento_id: 'Pagamento',
  fornecedor_id: 'Fornecedor',
};

/**
 * O arquivo não sobrevive ao redirect (nunca vai para a URL), então todo
 * erro do upload volta com os metadados preservados e o aviso de reanexar.
 */
function voltarAoNovo(erro: string, formData: FormData, campo?: string): never {
  voltarComErro('/documentos/novo', `${erro} Selecione o arquivo de novo.`, {
    valores: formData,
    campo,
  });
}

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

function formToRecord(fd: FormData): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== 'string') continue;
    rec[key] = value;
  }
  return rec;
}

export async function createDocumento(formData: FormData) {
  // 1) Valida metadata
  const meta = DocumentoMetaCreateSchema.safeParse(formToRecord(formData));
  if (!meta.success) {
    voltarComErro('/documentos/novo', meta.error, {
      rotulos: ROTULOS_DOCUMENTO,
      valores: formData,
    });
  }

  // 2) Valida file
  const fileField = formData.get('file');
  const fileCheck = validateUploadedFile(fileField);
  if (!fileCheck.ok) {
    voltarAoNovo(fileCheck.error, formData, 'file');
  }
  const file = fileCheck.file;

  // 3) Lê buffer 1x → alimenta magic-bytes check + hash SHA-256 (dedup) + upload
  const buffer = await file.arrayBuffer();

  // 3.5) Magic bytes validation (audit MED fix): confirma que o conteúdo bate
  // com o MIME declarado. Sem isso, atacante pode renomear .exe → .pdf.
  const magicCheck = validateFileMagicBytes(buffer, file.type);
  if (!magicCheck.ok) {
    voltarAoNovo(magicCheck.error, formData, 'file');
  }

  const hash = sha256Hex(buffer);

  // 4) Insert do row (obtém id) — storage_path placeholder temporário
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const criadoPor = userData.user?.id ?? null;

  const insertRes = await supabase
    .from('documentos')
    .insert({
      obra_id: meta.data.obra_id,
      pagamento_id: meta.data.pagamento_id ?? null,
      fornecedor_id: meta.data.fornecedor_id ?? null,
      tipo: meta.data.tipo,
      nome_arquivo: file.name,
      mime_type: file.type,
      tamanho_bytes: file.size,
      storage_path: 'pending', // atualizado após upload
      numero_nf: meta.data.numero_nf ?? null,
      chave_acesso_nf: meta.data.chave_acesso_nf ?? null,
      hash_sha256: hash,
      criado_por_user_id: criadoPor,
    })
    .select('id')
    .single();

  if (insertRes.error) {
    // Detecta qual constraint disparou 23505 pra dar mensagem targeted
    const dupMsg =
      insertRes.error.code === '23505'
        ? insertRes.error.message?.includes('idx_documentos_hash')
          ? 'Arquivo idêntico já existe (mesmo conteúdo). Verifique documentos anteriores.'
          : insertRes.error.message?.includes('idx_documentos_chave_nf')
            ? 'Já existe documento com esta chave de acesso de NF.'
            : 'Já existe documento com esta chave de NF ou hash.'
        : undefined;
    voltarAoNovo(
      mapDbErrorWithContext(insertRes.error, {
        '23503': 'Obra, pagamento ou fornecedor referenciado não existe',
        ...(dupMsg ? { '23505': dupMsg } : {}),
      }),
      formData,
    );
  }

  const documentoId = insertRes.data.id;
  const path = makeStoragePath(meta.data.obra_id, documentoId, file.name);

  // 5) Upload buffer to Storage — se falhar, rollback row
  try {
    await uploadDocumentBuffer(path, buffer, file.type);
  } catch (uploadErr) {
    // O rollback usa service role: a RLS só deixa admin apagar, e o cliente
    // de sessão de um gestor apagava zero linhas em silêncio — a linha órfã
    // com o hash bloqueava o reenvio do mesmo arquivo até o sweep das 03h.
    await desfazerDocumento(documentoId);
    log.erro('upload_documento_falhou', {
      documentoId,
      erro: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
    });
    voltarAoNovo('Falha ao enviar o arquivo. Tente de novo.', formData, 'file');
  }

  // 6) Update storage_path final
  const upd = await supabase
    .from('documentos')
    .update({ storage_path: path })
    .eq('id', documentoId);
  if (upd.error) {
    // path inconsistente — tenta cleanup e falha
    try {
      await deleteDocumentFile(path);
    } catch {
      /* best effort */
    }
    await desfazerDocumento(documentoId);
    voltarAoNovo(mapDbError(upd.error), formData);
  }

  // Dispatch outbound webhook (fase n8n) — best-effort
  try {
    const { dispatchEvento } = await import('@/lib/services/dispatch-webhook');
    await dispatchEvento('documento_created', {
      id: documentoId,
      obra_id: meta.data.obra_id,
      pagamento_id: meta.data.pagamento_id ?? null,
      fornecedor_id: meta.data.fornecedor_id ?? null,
      tipo: meta.data.tipo,
      nome_arquivo: file.name,
      mime_type: file.type,
      tamanho_bytes: file.size,
      storage_path: path,
    });
  } catch {
    // Silencioso
  }

  // Evento de domínio para as automações (uma nota anexada encerra a cobrança
  // daquele pagamento). Import dinâmico como o dispatch acima: fora do caminho
  // quente de quem só renderiza esta rota.
  const { emitir } = await import('@/lib/events/bus');
  await emitir(
    'documento.anexado',
    {
      documentoId,
      pagamentoId: meta.data.pagamento_id ?? null,
      obraId: meta.data.obra_id,
      tipo: meta.data.tipo,
    },
    { userId: criadoPor },
  );

  revalidatePath('/documentos');
  revalidatePath('/painel');
  revalidatePath('/pendentes');
  revalidatePath(`/obras/${meta.data.obra_id}`);
  redirect(`/documentos/${documentoId}`);
}

export async function updateDocumento(formData: FormData) {
  const raw = formToRecord(formData);
  const parsed = DocumentoUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const id = typeof raw.id === 'string' ? raw.id : '';
    voltarComErro(`/documentos/${id}/editar`, parsed.error, {
      rotulos: ROTULOS_DOCUMENTO,
      valores: formData,
    });
  }

  const { id, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('documentos')
    .update({
      ...(rest.obra_id !== undefined ? { obra_id: rest.obra_id } : {}),
      ...(rest.pagamento_id !== undefined ? { pagamento_id: rest.pagamento_id ?? null } : {}),
      ...(rest.fornecedor_id !== undefined ? { fornecedor_id: rest.fornecedor_id ?? null } : {}),
      ...(rest.tipo !== undefined ? { tipo: rest.tipo } : {}),
      ...(rest.numero_nf !== undefined ? { numero_nf: rest.numero_nf ?? null } : {}),
      ...(rest.chave_acesso_nf !== undefined
        ? { chave_acesso_nf: rest.chave_acesso_nf ?? null }
        : {}),
    })
    .eq('id', id);

  if (error) {
    voltarComErro(
      `/documentos/${id}/editar`,
      mapDbErrorWithContext(error, {
        '23503': 'Obra, pagamento ou fornecedor referenciado não existe',
        '23505': 'Já existe documento com esta chave de NF',
      }),
      { valores: formData, campo: error.code === '23505' ? 'chave_acesso_nf' : undefined },
    );
  }

  revalidatePath('/documentos');
  revalidatePath(`/documentos/${id}`);
  redirect(`/documentos/${id}`);
}

export async function archiveDocumento(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/documentos?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from('documentos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id'),
  );

  if (erro) redirect(`/documentos/${id}?error=${encodeURIComponent(erro)}`);
  revalidatePath('/documentos');
  revalidatePath(`/documentos/${id}`);
  redirect(`/documentos/${id}`);
}

export async function restoreDocumento(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/documentos?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase.from('documentos').update({ deleted_at: null }).eq('id', id).select('id'),
  );

  if (erro) redirect(`/documentos/${id}?error=${encodeURIComponent(erro)}`);
  revalidatePath('/documentos');
  revalidatePath(`/documentos/${id}`);
  redirect(`/documentos/${id}`);
}

/**
 * Server action: gera signed URL 60s TTL e redirect. Ownership via getDocumento
 * (RLS já cobre — user autenticado só vê docs que RLS permite).
 */
export async function downloadDocumento(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/documentos?error=ID%20inv%C3%A1lido');

  const doc = await getDocumento(id);
  if (!doc) redirect('/documentos?error=Documento%20n%C3%A3o%20encontrado');
  if (doc.deleted_at != null) {
    redirect(
      `/documentos/${id}?error=${encodeURIComponent('Documento arquivado. Restaure antes de baixar.')}`,
    );
  }
  if (!doc.storage_path || doc.storage_path === 'pending') {
    redirect(`/documentos/${id}?error=Arquivo%20n%C3%A3o%20dispon%C3%ADvel`);
  }

  let url: string;
  try {
    url = await getSignedUrl(doc.storage_path, 60);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao gerar URL';
    redirect(`/documentos/${id}?error=${encodeURIComponent(msg)}`);
  }
  redirect(url);
}
