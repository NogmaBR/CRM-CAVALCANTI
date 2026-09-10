'use server';

import { AutorizadoCreateSchema, AutorizadoUpdateSchema } from '@/lib/schemas/autorizado';
import { mapDbErrorWithContext } from '@/lib/schemas/errors';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const BASE_PATH = '/config/autorizados';

const DUPLICADO_MSG = 'Já existe um cadastro com esse telefone';

/** Garante que o caller é admin. Redireciona com ?error= se não for. */
async function assertAdmin(): Promise<void> {
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
}

export async function criarAutorizado(formData: FormData) {
  await assertAdmin();

  const parsed = AutorizadoCreateSchema.safeParse({
    nome: String(formData.get('nome') ?? '').trim(),
    telefone_whats: String(formData.get('telefone_whats') ?? '').trim(),
    papel_obra: String(formData.get('papel_obra') ?? '').trim() || undefined,
    ativo: formData.get('ativo') !== null,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dados inválidos';
    redirect(`${BASE_PATH}/novo?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('autorizados').insert({
    nome: parsed.data.nome,
    telefone_whats: parsed.data.telefone_whats,
    papel_obra: parsed.data.papel_obra ?? null,
    ativo: parsed.data.ativo ?? true,
  });

  if (error) {
    const msg = mapDbErrorWithContext(error, { '23505': DUPLICADO_MSG });
    redirect(`${BASE_PATH}/novo?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Número autorizado cadastrado')}`);
}

export async function atualizarAutorizado(formData: FormData) {
  await assertAdmin();

  const id = String(formData.get('id') ?? '').trim();
  const parsed = AutorizadoUpdateSchema.safeParse({
    id,
    nome: String(formData.get('nome') ?? '').trim() || undefined,
    telefone_whats: String(formData.get('telefone_whats') ?? '').trim() || undefined,
    papel_obra: String(formData.get('papel_obra') ?? '').trim() || undefined,
    ativo: formData.get('ativo') !== null,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dados inválidos';
    redirect(`${BASE_PATH}/${id}/editar?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('autorizados')
    .update({
      nome: parsed.data.nome,
      telefone_whats: parsed.data.telefone_whats,
      papel_obra: parsed.data.papel_obra ?? null,
      ativo: parsed.data.ativo ?? true,
    })
    .eq('id', parsed.data.id);

  if (error) {
    const msg = mapDbErrorWithContext(error, { '23505': DUPLICADO_MSG });
    redirect(`${BASE_PATH}/${parsed.data.id}/editar?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Cadastro atualizado')}`);
}

/**
 * Liga/desliga o acesso sem apagar o histórico.
 *
 * Desativar é a operação que se quer no dia a dia — o pedreiro saiu da obra,
 * o número não deve mais lançar pagamento, mas os lançamentos que ele já fez
 * continuam apontando pra ele na auditoria.
 */
export async function alternarAtivoAutorizado(formData: FormData) {
  await assertAdmin();

  const id = String(formData.get('id') ?? '').trim();
  const ativar = String(formData.get('ativar') ?? '') === 'true';
  if (!id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('ID inválido')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('autorizados').update({ ativo: ativar }).eq('id', id);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(mapDbErrorWithContext(error, {}))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(
    `${BASE_PATH}?success=${encodeURIComponent(
      ativar ? 'Número reativado' : 'Número desativado — não poderá mais lançar pagamentos',
    )}`,
  );
}
