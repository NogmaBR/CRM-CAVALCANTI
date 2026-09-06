'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { mapDbError, mapDbErrorWithContext } from '@/lib/schemas/errors';
import {
  DocumentoMetaCreateSchema,
  DocumentoUpdateSchema,
  validateUploadedFile,
} from '@/lib/schemas/documento';
import { getDocumento } from '@/lib/data/documentos';
import {
  deleteDocumentFile,
  getSignedUrl,
  makeStoragePath,
  uploadDocumentFile,
} from '@/lib/storage/documents';

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
    const first = meta.error.issues[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos';
    redirect(`/documentos/novo?error=${encodeURIComponent(msg)}`);
  }

  // 2) Valida file
  const fileField = formData.get('file');
  const fileCheck = validateUploadedFile(fileField);
  if (!fileCheck.ok) {
    redirect(`/documentos/novo?error=${encodeURIComponent(fileCheck.error)}`);
  }
  const file = fileCheck.file;

  // 3) Insert do row (obtém id) — storage_path placeholder temporário
  const supabase = await createClient();
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
    })
    .select('id')
    .single();

  if (insertRes.error) {
    redirect(
      `/documentos/novo?error=${encodeURIComponent(
        mapDbErrorWithContext(insertRes.error, {
          '23503': 'Obra, pagamento ou fornecedor referenciado não existe',
          '23505': 'Já existe documento com esta chave de NF ou hash',
        }),
      )}`,
    );
  }

  const documentoId = insertRes.data.id;
  const path = makeStoragePath(meta.data.obra_id, documentoId, file.name);

  // 4) Upload file to Storage — se falhar, rollback row
  try {
    await uploadDocumentFile(path, file);
  } catch (uploadErr) {
    await supabase.from('documentos').delete().eq('id', documentoId);
    const msg = uploadErr instanceof Error ? uploadErr.message : 'Falha no upload';
    redirect(`/documentos/novo?error=${encodeURIComponent(msg)}`);
  }

  // 5) Update storage_path final
  const upd = await supabase
    .from('documentos')
    .update({ storage_path: path })
    .eq('id', documentoId);
  if (upd.error) {
    // path inconsistente — tenta cleanup e falha
    try { await deleteDocumentFile(path); } catch { /* best effort */ }
    await supabase.from('documentos').delete().eq('id', documentoId);
    redirect(`/documentos/novo?error=${encodeURIComponent(mapDbError(upd.error))}`);
  }

  revalidatePath('/documentos');
  revalidatePath('/painel');
  revalidatePath(`/obras/${meta.data.obra_id}`);
  redirect(`/documentos/${documentoId}`);
}

export async function updateDocumento(formData: FormData) {
  const raw = formToRecord(formData);
  const parsed = DocumentoUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos';
    const id = typeof raw.id === 'string' ? raw.id : '';
    redirect(`/documentos/${id}/editar?error=${encodeURIComponent(msg)}`);
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
      ...(rest.chave_acesso_nf !== undefined ? { chave_acesso_nf: rest.chave_acesso_nf ?? null } : {}),
    })
    .eq('id', id);

  if (error) {
    redirect(
      `/documentos/${id}/editar?error=${encodeURIComponent(
        mapDbErrorWithContext(error, {
          '23503': 'Obra, pagamento ou fornecedor referenciado não existe',
          '23505': 'Já existe documento com esta chave de NF',
        }),
      )}`,
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
  const { error } = await supabase
    .from('documentos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) redirect(`/documentos/${id}?error=${encodeURIComponent(mapDbError(error))}`);
  revalidatePath('/documentos');
  revalidatePath(`/documentos/${id}`);
  redirect(`/documentos/${id}`);
}

export async function restoreDocumento(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/documentos?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const { error } = await supabase
    .from('documentos')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) redirect(`/documentos/${id}?error=${encodeURIComponent(mapDbError(error))}`);
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
