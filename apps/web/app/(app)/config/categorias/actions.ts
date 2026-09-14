'use server';

import { CategoriaCreateSchema, CategoriaUpdateSchema } from '@/lib/schemas/categoria';
import { mapDbErrorWithContext } from '@/lib/schemas/errors';
import { erroDeEscrita } from '@/lib/supabase/escrita';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type Rotulos, voltarComErro } from '../../_shared/form-erros';

const BASE_PATH = '/config/categorias';

const DUPLICATE_NAME_MSG = 'Já existe uma categoria com esse nome';

const ROTULOS_CATEGORIA: Rotulos = { nome: 'Nome', cor: 'Cor', icone: 'Ícone' };

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
    voltarComErro(`${BASE_PATH}/nova`, parsed.error, {
      rotulos: ROTULOS_CATEGORIA,
      valores: formData,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('categorias').insert({
    nome: parsed.data.nome,
    cor: parsed.data.cor ?? null,
    icone: parsed.data.icone ?? null,
  });

  if (error) {
    voltarComErro(
      `${BASE_PATH}/nova`,
      mapDbErrorWithContext(error, { '23505': DUPLICATE_NAME_MSG }),
      {
        valores: formData,
        campo: error.code === '23505' ? 'nome' : undefined,
      },
    );
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
    voltarComErro(`${BASE_PATH}/${raw.id}/editar`, parsed.error, {
      rotulos: ROTULOS_CATEGORIA,
      valores: formData,
    });
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
    voltarComErro(
      `${BASE_PATH}/${parsed.data.id}/editar`,
      mapDbErrorWithContext(error, { '23505': DUPLICATE_NAME_MSG }),
      { valores: formData, campo: error.code === '23505' ? 'nome' : undefined },
    );
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
  const erro = erroDeEscrita(
    await supabase
      .from('categorias')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null) // idempotency guard: only archive if not already archived
      .select('id'),
  );

  if (erro) redirect(`${BASE_PATH}?error=${encodeURIComponent(erro)}`);

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
  const erro = erroDeEscrita(
    await supabase.from('categorias').update({ deleted_at: null }).eq('id', id).select('id'),
  );

  if (erro) redirect(`${BASE_PATH}?error=${encodeURIComponent(erro)}`);

  revalidatePath(BASE_PATH);
  revalidatePath('/pagamentos');
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Categoria restaurada')}`);
}
