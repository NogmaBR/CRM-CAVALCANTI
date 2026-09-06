'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FornecedorCreateSchema, FornecedorUpdateSchema } from '@/lib/schemas/fornecedor';

function formToRecord(fd: FormData): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== 'string') continue;
    rec[key] = value;
  }
  return rec;
}

/** Extrai documento + tipo do objeto validado (Zod transform devolve union) */
function extractDoc(doc: unknown): { documento: string | null; documento_tipo: 'cpf' | 'cnpj' | null } {
  if (doc && typeof doc === 'object' && 'documento' in doc && 'documento_tipo' in doc) {
    const d = doc as { documento: string; documento_tipo: 'cpf' | 'cnpj' };
    return { documento: d.documento, documento_tipo: d.documento_tipo };
  }
  return { documento: null, documento_tipo: null };
}

export async function createFornecedor(formData: FormData) {
  const parsed = FornecedorCreateSchema.safeParse(formToRecord(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos';
    redirect(`/fornecedores/novo?error=${encodeURIComponent(msg)}`);
  }

  const { documento, documento_tipo } = extractDoc(parsed.data.documento);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fornecedores')
    .insert({
      nome: parsed.data.nome,
      razao_social: parsed.data.razao_social ?? null,
      documento,
      documento_tipo,
      categoria_id: parsed.data.categoria_id ?? null,
      telefone: parsed.data.telefone ?? null,
      email: parsed.data.email ?? null,
      origem: 'manual',
      ativo: parsed.data.ativo ?? true,
    })
    .select('id')
    .single();

  if (error) {
    const isDup = error.code === '23505';
    const msg = isDup ? 'Já existe fornecedor com este CNPJ/CPF' : error.message;
    redirect(`/fornecedores/novo?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath('/fornecedores');
  revalidatePath('/painel');
  redirect(`/fornecedores/${data.id}`);
}

export async function updateFornecedor(formData: FormData) {
  const raw = formToRecord(formData);
  const parsed = FornecedorUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos';
    const id = typeof raw.id === 'string' ? raw.id : '';
    redirect(`/fornecedores/${id}/editar?error=${encodeURIComponent(msg)}`);
  }

  const { id, ...rest } = parsed.data;
  const { documento, documento_tipo } = extractDoc(rest.documento);
  const hasDocInForm = 'documento' in raw;

  const supabase = await createClient();
  const { error } = await supabase
    .from('fornecedores')
    .update({
      ...(rest.nome !== undefined ? { nome: rest.nome } : {}),
      ...(rest.razao_social !== undefined ? { razao_social: rest.razao_social || null } : {}),
      ...(hasDocInForm ? { documento, documento_tipo } : {}),
      ...(rest.categoria_id !== undefined ? { categoria_id: rest.categoria_id ?? null } : {}),
      ...(rest.telefone !== undefined ? { telefone: rest.telefone || null } : {}),
      ...(rest.email !== undefined ? { email: rest.email ?? null } : {}),
      ...(rest.ativo !== undefined ? { ativo: rest.ativo } : {}),
    })
    .eq('id', id);

  if (error) {
    const isDup = error.code === '23505';
    const msg = isDup ? 'Já existe outro fornecedor com este CNPJ/CPF' : error.message;
    redirect(`/fornecedores/${id}/editar?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath('/fornecedores');
  revalidatePath(`/fornecedores/${id}`);
  redirect(`/fornecedores/${id}`);
}

export async function archiveFornecedor(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/fornecedores?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const { error } = await supabase
    .from('fornecedores')
    .update({ ativo: false, deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) redirect(`/fornecedores/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/fornecedores');
  revalidatePath(`/fornecedores/${id}`);
  redirect(`/fornecedores/${id}`);
}

export async function restoreFornecedor(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/fornecedores?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const { error } = await supabase
    .from('fornecedores')
    .update({ ativo: true, deleted_at: null })
    .eq('id', id);

  if (error) redirect(`/fornecedores/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/fornecedores');
  revalidatePath(`/fornecedores/${id}`);
  redirect(`/fornecedores/${id}`);
}
