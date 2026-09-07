'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { findApelidoConflict } from '@/lib/data/apelidos';

const ApelidoSchema = z.object({
  apelido: z
    .string()
    .min(2, 'Apelido deve ter ao menos 2 caracteres')
    .max(100, 'Apelido deve ter no máximo 100 caracteres')
    .trim(),
});

export async function adicionarApelido(formData: FormData) {
  const fornecedor_id = String(formData.get('fornecedor_id') ?? '').trim();
  const rawApelido = String(formData.get('apelido') ?? '');

  if (!fornecedor_id) {
    redirect(`/fornecedores?error=${encodeURIComponent('ID de fornecedor ausente.')}`);
  }

  const parsed = ApelidoSchema.safeParse({ apelido: rawApelido });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Apelido inválido';
    redirect(`/fornecedores/${fornecedor_id}?error=${encodeURIComponent(msg)}`);
  }

  const apelido = parsed.data.apelido;

  // Check conflict — apelido já usado por outro fornecedor?
  const conflict = await findApelidoConflict(apelido);
  if (conflict && conflict.fornecedor_id !== fornecedor_id) {
    redirect(
      `/fornecedores/${fornecedor_id}?error=${encodeURIComponent(
        'Apelido já usado por outro fornecedor',
      )}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from('fornecedor_apelidos').insert({
    fornecedor_id,
    apelido,
    criado_por_ia: false,
  });

  if (error) {
    const msg =
      error.code === '23505'
        ? 'Apelido já existe para este fornecedor'
        : `Erro ao adicionar apelido: ${error.message}`;
    redirect(`/fornecedores/${fornecedor_id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/fornecedores/${fornecedor_id}`);
  redirect(`/fornecedores/${fornecedor_id}?success=${encodeURIComponent('Apelido adicionado')}`);
}

export async function removerApelido(formData: FormData) {
  const fornecedor_id = String(formData.get('fornecedor_id') ?? '').trim();
  const apelido_id = String(formData.get('apelido_id') ?? '').trim();

  if (!fornecedor_id || !apelido_id) {
    redirect(`/fornecedores?error=${encodeURIComponent('Dados ausentes para remoção.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('fornecedor_apelidos')
    .delete()
    .eq('id', apelido_id);

  if (error) {
    redirect(
      `/fornecedores/${fornecedor_id}?error=${encodeURIComponent(
        `Erro ao remover apelido: ${error.message}`,
      )}`,
    );
  }

  revalidatePath(`/fornecedores/${fornecedor_id}`);
  redirect(`/fornecedores/${fornecedor_id}?success=${encodeURIComponent('Apelido removido')}`);
}
