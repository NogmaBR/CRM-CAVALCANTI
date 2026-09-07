'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { mergeFornecedores } from '@/lib/services/merge-fornecedores';

const MergeSchema = z.object({
  keepId: z.string().uuid('keepId deve ser UUID válido'),
  dropId: z.string().uuid('dropId deve ser UUID válido'),
});

/** Garante que o caller é admin ou gestor. Redireciona com ?error= caso não seja. */
async function assertAdminOrGestor(): Promise<void> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect(
      `/fornecedores/duplicatas?error=${encodeURIComponent('Sessão expirada. Faça login novamente.')}`,
    );
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();
  if (!profile || !['admin', 'gestor'].includes(profile.papel)) {
    redirect(
      `/fornecedores/duplicatas?error=${encodeURIComponent(
        'Acesso restrito a administradores e gestores.',
      )}`,
    );
  }
}

export async function mergeFornecedoresAction(formData: FormData) {
  await assertAdminOrGestor();

  const raw = {
    keepId: String(formData.get('keepId') ?? '').trim(),
    dropId: String(formData.get('dropId') ?? '').trim(),
  };

  const parsed = MergeSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Dados inválidos';
    redirect(`/fornecedores/duplicatas?error=${encodeURIComponent(msg)}`);
  }

  const result = await mergeFornecedores({
    keepId: parsed.data.keepId,
    dropId: parsed.data.dropId,
  });

  if (!result.ok) {
    redirect(
      `/fornecedores/duplicatas?error=${encodeURIComponent(
        `Falha na fusão: ${result.error ?? 'Erro desconhecido'}`,
      )}`,
    );
  }

  revalidatePath('/fornecedores/duplicatas');
  revalidatePath('/fornecedores');

  const msg = `Fornecedores fundidos: ${result.pagamentos_movidos} pagamentos + ${result.documentos_movidos} documentos movidos`;
  redirect(`/fornecedores/duplicatas?success=${encodeURIComponent(msg)}`);
}
