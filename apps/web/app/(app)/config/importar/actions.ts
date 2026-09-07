'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { previewImport, commitImport, type PreviewResult, type PreviewRow } from '@/lib/services/import-pagamentos';

/** Garante que o caller e admin. Retorna user_id ou redireciona. */
async function assertAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect(`/config/importar?error=${encodeURIComponent('Sessao expirada. Faca login novamente.')}`);
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();
  if (profile?.papel !== 'admin') {
    redirect(`/config/importar?error=${encodeURIComponent('Acesso restrito a administradores.')}`);
  }
  return user.id;
}

/**
 * Fase 1: recebe texto CSV, valida + faz matching. Zero writes.
 * Chamado diretamente do client component (server action com parametro string).
 */
export async function previewImportCsv(csvText: string): Promise<PreviewResult> {
  await assertAdmin();
  return previewImport(csvText);
}

/**
 * Fase 2: recebe rows ja validadas, faz batch insert em pagamentos.
 * Revalida /pagamentos e /painel apos sucesso.
 */
export async function commitImportCsv(
  previewRows: PreviewRow[],
): Promise<{ inserted: number; failed: number; errors: string[] }> {
  const userId = await assertAdmin();
  const result = await commitImport(previewRows, userId);
  revalidatePath('/pagamentos');
  revalidatePath('/painel');
  return result;
}
