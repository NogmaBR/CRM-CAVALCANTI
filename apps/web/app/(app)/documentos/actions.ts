'use server';

import { DocumentoMetaCreateSchema, DocumentoUpdateSchema } from '@/lib/schemas/documento';
import { mapDbError, mapDbErrorWithContext } from '@/lib/schemas/errors';
import { subirDocumento } from '@/lib/services/subir-documento';
import { erroDeEscrita } from '@/lib/supabase/escrita';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type Rotulos, voltarComErro } from '../_shared/form-erros';

const ROTULOS_DOCUMENTO: Rotulos = {
  file: 'Arquivo',
  tipo: 'Tipo',
  categoria: 'Pasta',
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

function formToRecord(fd: FormData): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== 'string') continue;
    rec[key] = value;
  }
  return rec;
}

export async function createDocumento(formData: FormData) {
  const meta = DocumentoMetaCreateSchema.safeParse(formToRecord(formData));
  if (!meta.success) {
    voltarComErro('/documentos/novo', meta.error, {
      rotulos: ROTULOS_DOCUMENTO,
      valores: formData,
    });
  }

  // Validação do arquivo, gravação, upload, webhook e evento: tudo em
  // `subirDocumento` (compartilhado com o "Anexar comprovante" do pagamento).
  const r = await subirDocumento(meta.data, formData.get('file'));
  if (!r.ok) voltarAoNovo(r.erro, formData, r.campo);

  revalidatePath('/documentos');
  revalidatePath('/painel');
  revalidatePath('/pendentes');
  revalidatePath(`/obras/${meta.data.obra_id}`);
  if (meta.data.pagamento_id) revalidatePath(`/pagamentos/${meta.data.pagamento_id}`);
  redirect(`/documentos/${r.documentoId}`);
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
      ...(rest.categoria !== undefined ? { categoria: rest.categoria } : {}),
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
