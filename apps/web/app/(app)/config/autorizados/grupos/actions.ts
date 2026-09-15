'use server';

import { mapDbErrorWithContext } from '@/lib/schemas/errors';
import { GrupoCreateSchema, GrupoUpdateSchema } from '@/lib/schemas/grupo';
import { erroDeEscrita } from '@/lib/supabase/escrita';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type Rotulos, voltarComErro } from '../../../_shared/form-erros';

/**
 * Grupos de WhatsApp em que o agente age. Lista fechada, como os números:
 * grupo fora daqui é ignorado em silêncio.
 */

const BASE_PATH = '/config/autorizados/grupos';

const ROTULOS: Rotulos = {
  chat_id: 'Id do grupo',
  nome: 'Nome',
  obra_id: 'Obra dedicada',
  ativo: 'Ativo',
};

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

export async function criarGrupo(formData: FormData) {
  await assertAdmin();

  const parsed = GrupoCreateSchema.safeParse({
    chat_id: String(formData.get('chat_id') ?? ''),
    nome: String(formData.get('nome') ?? ''),
    obra_id: String(formData.get('obra_id') ?? ''),
    ativo: true,
  });
  if (!parsed.success) {
    voltarComErro(BASE_PATH, parsed.error, { rotulos: ROTULOS, valores: formData });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('whatsapp_grupos').insert({
    chat_id: parsed.data.chat_id,
    nome: parsed.data.nome,
    obra_id: parsed.data.obra_id ?? null,
    ativo: true,
  });
  if (error) {
    voltarComErro(
      BASE_PATH,
      mapDbErrorWithContext(error, { '23505': 'Esse grupo já está cadastrado' }),
      { valores: formData, campo: error.code === '23505' ? 'chat_id' : undefined },
    );
  }

  revalidatePath(BASE_PATH);
  redirect(
    `${BASE_PATH}?success=${encodeURIComponent('Grupo cadastrado. O agente já responde nele.')}`,
  );
}

/** Troca a obra dedicada (ou tira). */
export async function atualizarObraDoGrupo(formData: FormData) {
  await assertAdmin();

  const parsed = GrupoUpdateSchema.safeParse({
    id: String(formData.get('id') ?? '').trim(),
    obra_id: String(formData.get('obra_id') ?? ''),
  });
  if (!parsed.success) {
    voltarComErro(BASE_PATH, parsed.error, { rotulos: ROTULOS });
  }

  const supabase = await createClient();
  const r = await supabase
    .from('whatsapp_grupos')
    .update({ obra_id: parsed.data.obra_id ?? null })
    .eq('id', parsed.data.id)
    .select('id');
  const erro = erroDeEscrita(r);
  if (erro) redirect(`${BASE_PATH}?error=${encodeURIComponent(erro)}`);

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Obra do grupo atualizada')}`);
}

export async function alternarAtivoGrupo(formData: FormData) {
  await assertAdmin();

  const id = String(formData.get('id') ?? '').trim();
  const ativar = String(formData.get('ativar') ?? '') === 'true';
  if (!id) redirect(`${BASE_PATH}?error=${encodeURIComponent('ID inválido')}`);

  const supabase = await createClient();
  const r = await supabase
    .from('whatsapp_grupos')
    .update({ ativo: ativar })
    .eq('id', id)
    .select('id');
  const erro = erroDeEscrita(r);
  if (erro) redirect(`${BASE_PATH}?error=${encodeURIComponent(erro)}`);

  revalidatePath(BASE_PATH);
  redirect(
    `${BASE_PATH}?success=${encodeURIComponent(
      ativar ? 'Grupo reativado' : 'Grupo desativado — mensagens dele passam a ser ignoradas',
    )}`,
  );
}
