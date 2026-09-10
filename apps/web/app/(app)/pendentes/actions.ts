'use server';

import { aplicarConfirmacao, recusarConfirmacao } from '@/lib/services/confirmacoes';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Ações do painel de pendências.
 *
 * A lógica de resolução não mora mais aqui: mora em `lib/services/confirmacoes`,
 * compartilhada com o webhook do WhatsApp. Antes desta mudança as duas rotas
 * eram implementações paralelas da mesma regra, e já tinham divergido — o
 * painel tinha guarda de idempotência contra pagamento duplicado e o webhook
 * não, então um "SIM" que chegasse junto com o clique do gestor criava dois
 * lançamentos do mesmo valor.
 *
 * O que sobra nestas funções é o que é de fato específico do painel: ler o
 * formulário, saber quem está logado e traduzir o resultado em redirect.
 */

const BASE_PATH = '/pendentes';

function comErro(msg: string): never {
  redirect(`${BASE_PATH}?error=${encodeURIComponent(msg)}`);
}

function revalidarTudo(): void {
  revalidatePath(BASE_PATH);
  revalidatePath('/pagamentos');
  revalidatePath('/painel');
  revalidatePath('/whatsapp');
}

export async function confirmarPendencia(formData: FormData) {
  const confirmacaoId = String(formData.get('confirmacao_id') ?? '').trim();
  if (!confirmacaoId) comErro('ID de confirmação ausente.');

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const resultado = await aplicarConfirmacao(supabase, {
    confirmacaoId,
    via: 'painel',
    respostaBruta: 'confirmado via painel',
    userId: userData.user?.id ?? null,
  });

  if (!resultado.ok) comErro(resultado.motivo);

  revalidarTudo();

  redirect(
    `${BASE_PATH}?success=${encodeURIComponent(
      resultado.jaEstavaResolvida
        ? 'Esta pendência já havia sido resolvida — nada foi duplicado.'
        : 'Pagamento criado com sucesso.',
    )}`,
  );
}

export async function rejeitarPendencia(formData: FormData) {
  const confirmacaoId = String(formData.get('confirmacao_id') ?? '').trim();
  if (!confirmacaoId) comErro('Dados ausentes para rejeição.');

  const supabase = await createClient();

  const resultado = await recusarConfirmacao(supabase, {
    confirmacaoId,
    via: 'painel',
    respostaBruta: 'rejeitado via painel',
    motivo: 'Recusada pelo gestor no painel',
  });

  if (!resultado.ok) comErro(resultado.motivo);

  revalidarTudo();

  redirect(
    `${BASE_PATH}?success=${encodeURIComponent(
      resultado.jaEstavaResolvida
        ? 'Esta pendência já havia sido resolvida.'
        : 'Pendência recusada.',
    )}`,
  );
}
