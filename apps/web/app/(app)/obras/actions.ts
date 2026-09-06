'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ObraCreateSchema, ObraUpdateSchema } from '@/lib/schemas/obra';
import { mapDbError } from '@/lib/schemas/errors';

function formToRecord(fd: FormData): Record<string, unknown> {
  // Extrai endereco.<field> em objeto aninhado; resto raso.
  const rec: Record<string, unknown> = {};
  const endereco: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== 'string') continue;
    if (key.startsWith('endereco.')) {
      const field = key.slice('endereco.'.length);
      if (value.trim() !== '') endereco[field] = value;
    } else {
      rec[key] = value;
    }
  }
  if (Object.keys(endereco).length > 0) rec.endereco = endereco;
  return rec;
}

export async function createObra(formData: FormData) {
  const parsed = ObraCreateSchema.safeParse(formToRecord(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos';
    redirect(`/obras/novo?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('obras')
    .insert({
      nome: parsed.data.nome,
      cliente: parsed.data.cliente ?? null,
      tipo: parsed.data.tipo ?? null,
      status: parsed.data.status,
      orcamento: parsed.data.orcamento ?? null,
      data_inicio: parsed.data.data_inicio ?? null,
      data_prevista_fim: parsed.data.data_prevista_fim ?? null,
      endereco: parsed.data.endereco ?? null,
      apelidos: parsed.data.apelidos && parsed.data.apelidos.length > 0 ? parsed.data.apelidos : null,
      observacoes: parsed.data.observacoes ?? null,
    })
    .select('id')
    .single();

  if (error) {
    redirect(`/obras/novo?error=${encodeURIComponent(mapDbError(error))}`);
  }

  revalidatePath('/obras');
  revalidatePath('/painel');
  redirect(`/obras/${data.id}`);
}

export async function updateObra(formData: FormData) {
  const raw = formToRecord(formData);
  const parsed = ObraUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos';
    const id = typeof raw.id === 'string' ? raw.id : '';
    redirect(`/obras/${id}/editar?error=${encodeURIComponent(msg)}`);
  }

  const { id, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('obras')
    .update({
      ...(rest.nome !== undefined ? { nome: rest.nome } : {}),
      ...(rest.cliente !== undefined ? { cliente: rest.cliente || null } : {}),
      ...(rest.tipo !== undefined ? { tipo: rest.tipo ?? null } : {}),
      ...(rest.status !== undefined ? { status: rest.status } : {}),
      ...(rest.orcamento !== undefined ? { orcamento: rest.orcamento ?? null } : {}),
      ...(rest.data_inicio !== undefined ? { data_inicio: rest.data_inicio || null } : {}),
      ...(rest.data_prevista_fim !== undefined
        ? { data_prevista_fim: rest.data_prevista_fim || null }
        : {}),
      ...(rest.endereco !== undefined ? { endereco: rest.endereco ?? null } : {}),
      ...(rest.apelidos !== undefined
        ? { apelidos: rest.apelidos.length > 0 ? rest.apelidos : null }
        : {}),
      ...(rest.observacoes !== undefined ? { observacoes: rest.observacoes || null } : {}),
    })
    .eq('id', id);

  if (error) {
    redirect(`/obras/${id}/editar?error=${encodeURIComponent(mapDbError(error))}`);
  }

  revalidatePath('/obras');
  revalidatePath(`/obras/${id}`);
  redirect(`/obras/${id}`);
}

export async function archiveObra(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/obras?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const { error } = await supabase
    .from('obras')
    .update({ status: 'arquivada', deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) redirect(`/obras/${id}?error=${encodeURIComponent(mapDbError(error))}`);
  revalidatePath('/obras');
  revalidatePath(`/obras/${id}`);
  redirect(`/obras/${id}`);
}

export async function restoreObra(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/obras?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const { error } = await supabase
    .from('obras')
    .update({ status: 'ativa', deleted_at: null })
    .eq('id', id);

  if (error) redirect(`/obras/${id}?error=${encodeURIComponent(mapDbError(error))}`);
  revalidatePath('/obras');
  revalidatePath(`/obras/${id}`);
  redirect(`/obras/${id}`);
}
