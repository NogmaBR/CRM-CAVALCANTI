'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CategoriaCreateSchema, CategoriaUpdateSchema } from '@/lib/schemas/categoria';
import { mapDbErrorWithContext } from '@/lib/schemas/errors';

const BASE_PATH = '/config/categorias';

const DUPLICATE_NAME_MSG = 'Já existe uma categoria com esse nome';

/** Garante que o caller é admin. Redireciona com ?error= se não for. */
async function assertAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Sessão expirada. Faça login novamente.')}`);
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();
  if (profile?.papel !== 'admin') {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Acesso restrito a administradores.')}`);
  }
  return user.id;
}

export async function criarCategoria(formData: FormData) {
  await assertAdmin();

  const raw = {
    nome: String(formData.get('nome') ?? '').trim(),
    cor: String(formData.get('cor') ?? '').trim() || undefined,
    icone: String(formData.get('icone') ?? '').trim() || undefined,
  };

  const parsed = CategoriaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.message ?? 'Dados inválidos';
    redirect(`${BASE_PATH}/nova?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('categorias').insert({
    nome: parsed.data.nome,
    cor: parsed.data.cor ?? null,
    icone: parsed.data.icone ?? null,
  });

  if (error) {
    const msg = mapDbErrorWithContext(error, { '23505': DUPLICATE_NAME_MSG });
    redirect(`${BASE_PATH}/nova?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(BASE_PATH);
  revalidatePath('/pagamentos');
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Categoria criada')}`);
}

export async function atualizarCategoria(formData: FormData) {
  await assertAdmin();

  const raw = {
    id: String(formData.get('id') ?? '').trim(),
    nome: String(formData.get('nome') ?? '').trim() || undefined,
    cor: String(formData.get('cor') ?? '').trim() || undefined,
    icone: String(formData.get('icone') ?? '').trim() || undefined,
  };

  const parsed = CategoriaUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.message ?? 'Dados inválidos';
    redirect(`${BASE_PATH}/${raw.id}/editar?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('categorias')
    .update({
      nome: parsed.data.nome,
      cor: parsed.data.cor ?? null,
      icone: parsed.data.icone ?? null,
    })
    .eq('id', parsed.data.id);

  if (error) {
    const msg = mapDbErrorWithContext(error, { '23505': DUPLICATE_NAME_MSG });
    redirect(`${BASE_PATH}/${parsed.data.id}/editar?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(BASE_PATH);
  revalidatePath('/pagamentos');
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Categoria atualizada')}`);
}

export async function arquivarCategoria(formData: FormData) {
  await assertAdmin();

  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('ID inválido')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('categorias')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null); // idempotency guard: only archive if not already archived

  if (error) {
    const msg = mapDbErrorWithContext(error, {});
    redirect(`${BASE_PATH}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(BASE_PATH);
  revalidatePath('/pagamentos');
  redirect(`${BASE_PATH}?status=archived&success=${encodeURIComponent('Categoria arquivada')}`);
}

export async function restaurarCategoria(formData: FormData) {
  await assertAdmin();

  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('ID inválido')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('categorias')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) {
    const msg = mapDbErrorWithContext(error, {});
    redirect(`${BASE_PATH}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(BASE_PATH);
  revalidatePath('/pagamentos');
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Categoria restaurada')}`);
}
