'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { mapDbError, mapDbErrorWithContext } from '@/lib/schemas/errors';
import { PagamentoCreateSchema, PagamentoUpdateSchema } from '@/lib/schemas/pagamento';

function formToRecord(fd: FormData): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== 'string') continue;
    rec[key] = value;
  }
  return rec;
}

export async function createPagamento(formData: FormData) {
  const parsed = PagamentoCreateSchema.safeParse(formToRecord(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos';
    redirect(`/pagamentos/novo?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const criadoPor = userData.user?.id ?? null;

  const { data, error } = await supabase
    .from('pagamentos')
    .insert({
      obra_id: parsed.data.obra_id,
      fornecedor_id: parsed.data.fornecedor_id ?? null,
      categoria_id: parsed.data.categoria_id ?? null,
      valor: parsed.data.valor,
      data_pagamento: parsed.data.data_pagamento,
      origem: parsed.data.origem,
      status_pagto: parsed.data.status_pagto,
      descricao: parsed.data.descricao ?? null,
      observacoes: parsed.data.observacoes ?? null,
      criado_por_user_id: criadoPor,
    })
    .select('id')
    .single();

  if (error) {
    redirect(
      `/pagamentos/novo?error=${encodeURIComponent(
        mapDbErrorWithContext(error, {
          '23503': 'Obra, fornecedor ou categoria referenciada não existe',
        }),
      )}`,
    );
  }

  revalidatePath('/pagamentos');
  revalidatePath('/painel');
  revalidatePath(`/obras/${parsed.data.obra_id}`);
  redirect(`/pagamentos/${data.id}`);
}

export async function updatePagamento(formData: FormData) {
  const raw = formToRecord(formData);
  const parsed = PagamentoUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos';
    const id = typeof raw.id === 'string' ? raw.id : '';
    redirect(`/pagamentos/${id}/editar?error=${encodeURIComponent(msg)}`);
  }

  const { id, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('pagamentos')
    .update({
      ...(rest.obra_id !== undefined ? { obra_id: rest.obra_id } : {}),
      ...(rest.fornecedor_id !== undefined ? { fornecedor_id: rest.fornecedor_id ?? null } : {}),
      ...(rest.categoria_id !== undefined ? { categoria_id: rest.categoria_id ?? null } : {}),
      ...(rest.valor !== undefined ? { valor: rest.valor } : {}),
      ...(rest.data_pagamento !== undefined ? { data_pagamento: rest.data_pagamento } : {}),
      ...(rest.origem !== undefined ? { origem: rest.origem } : {}),
      ...(rest.status_pagto !== undefined ? { status_pagto: rest.status_pagto } : {}),
      ...(rest.descricao !== undefined ? { descricao: rest.descricao ?? null } : {}),
      ...(rest.observacoes !== undefined ? { observacoes: rest.observacoes ?? null } : {}),
    })
    .eq('id', id);

  if (error) {
    redirect(
      `/pagamentos/${id}/editar?error=${encodeURIComponent(
        mapDbErrorWithContext(error, {
          '23503': 'Obra, fornecedor ou categoria referenciada não existe',
        }),
      )}`,
    );
  }

  revalidatePath('/pagamentos');
  revalidatePath(`/pagamentos/${id}`);
  revalidatePath('/painel');
  redirect(`/pagamentos/${id}`);
}

export async function archivePagamento(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/pagamentos?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const { error } = await supabase
    .from('pagamentos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) redirect(`/pagamentos/${id}?error=${encodeURIComponent(mapDbError(error))}`);
  revalidatePath('/pagamentos');
  revalidatePath(`/pagamentos/${id}`);
  revalidatePath('/painel');
  redirect(`/pagamentos/${id}`);
}

export async function restorePagamento(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/pagamentos?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const { error } = await supabase
    .from('pagamentos')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) redirect(`/pagamentos/${id}?error=${encodeURIComponent(mapDbError(error))}`);
  revalidatePath('/pagamentos');
  revalidatePath(`/pagamentos/${id}`);
  revalidatePath('/painel');
  redirect(`/pagamentos/${id}`);
}
