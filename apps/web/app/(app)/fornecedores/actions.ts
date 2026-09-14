'use server';

import { mapDbErrorWithContext } from '@/lib/schemas/errors';
import { FornecedorCreateSchema, FornecedorUpdateSchema } from '@/lib/schemas/fornecedor';
import { erroDeEscrita } from '@/lib/supabase/escrita';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type Rotulos, voltarComErro } from '../_shared/form-erros';

const ROTULOS_FORNECEDOR: Rotulos = {
  nome: 'Nome',
  razao_social: 'Razão social',
  documento: 'Documento',
  categoria_id: 'Categoria',
  telefone: 'Telefone',
  email: 'E-mail',
  ativo: 'Fornecedor ativo',
};

function formToRecord(fd: FormData): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== 'string') continue;
    rec[key] = value;
  }
  return rec;
}

/** Extrai documento + tipo do objeto validado (Zod transform devolve union) */
function extractDoc(doc: unknown): {
  documento: string | null;
  documento_tipo: 'cpf' | 'cnpj' | null;
} {
  if (doc && typeof doc === 'object' && 'documento' in doc && 'documento_tipo' in doc) {
    const d = doc as { documento: string; documento_tipo: 'cpf' | 'cnpj' };
    return { documento: d.documento, documento_tipo: d.documento_tipo };
  }
  return { documento: null, documento_tipo: null };
}

export async function createFornecedor(formData: FormData) {
  const parsed = FornecedorCreateSchema.safeParse(formToRecord(formData));
  if (!parsed.success) {
    voltarComErro('/fornecedores/novo', parsed.error, {
      rotulos: ROTULOS_FORNECEDOR,
      valores: formData,
    });
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
    voltarComErro(
      '/fornecedores/novo',
      mapDbErrorWithContext(error, { '23505': 'Já existe fornecedor com este CNPJ/CPF' }),
      { valores: formData, campo: error.code === '23505' ? 'documento' : undefined },
    );
  }

  revalidatePath('/fornecedores');
  revalidatePath('/painel');
  redirect(`/fornecedores/${data.id}`);
}

export async function updateFornecedor(formData: FormData) {
  const raw = formToRecord(formData);
  const parsed = FornecedorUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const id = typeof raw.id === 'string' ? raw.id : '';
    voltarComErro(`/fornecedores/${id}/editar`, parsed.error, {
      rotulos: ROTULOS_FORNECEDOR,
      valores: formData,
    });
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
    voltarComErro(
      `/fornecedores/${id}/editar`,
      mapDbErrorWithContext(error, { '23505': 'Já existe outro fornecedor com este CNPJ/CPF' }),
      { valores: formData, campo: error.code === '23505' ? 'documento' : undefined },
    );
  }

  revalidatePath('/fornecedores');
  revalidatePath('/fornecedores/duplicatas');
  revalidatePath(`/fornecedores/${id}`);
  redirect(`/fornecedores/${id}`);
}

export async function archiveFornecedor(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/fornecedores?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from('fornecedores')
      .update({ ativo: false, deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id'),
  );

  if (erro) redirect(`/fornecedores/${id}?error=${encodeURIComponent(erro)}`);
  revalidatePath('/fornecedores');
  revalidatePath('/fornecedores/duplicatas');
  revalidatePath(`/fornecedores/${id}`);
  redirect(`/fornecedores/${id}`);
}

export async function restoreFornecedor(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/fornecedores?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from('fornecedores')
      .update({ ativo: true, deleted_at: null })
      .eq('id', id)
      .select('id'),
  );

  if (erro) redirect(`/fornecedores/${id}?error=${encodeURIComponent(erro)}`);
  revalidatePath('/fornecedores');
  revalidatePath('/fornecedores/duplicatas');
  revalidatePath(`/fornecedores/${id}`);
  redirect(`/fornecedores/${id}`);
}
