'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { mapDbErrorWithContext } from '@/lib/schemas/errors';
import type { DadosExtraidos } from '@/lib/data/pendentes';

export async function confirmarPendencia(formData: FormData) {
  const confirmacao_id = String(formData.get('confirmacao_id') ?? '').trim();
  if (!confirmacao_id) {
    redirect(`/pendentes?error=${encodeURIComponent('ID de confirmação ausente.')}`);
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  // Fetch confirmacao + mensagem
  const { data: confirmacao, error: errConf } = await supabase
    .from('confirmacoes_pendentes')
    .select('id, mensagem_id, resolvida')
    .eq('id', confirmacao_id)
    .maybeSingle();

  if (errConf || !confirmacao) {
    redirect(`/pendentes?error=${encodeURIComponent('Confirmação não encontrada.')}`);
  }

  if (confirmacao.resolvida) {
    redirect(`/pendentes?error=${encodeURIComponent('Esta pendência já foi resolvida.')}`);
  }

  const { data: mensagem, error: errMsg } = await supabase
    .from('mensagens_whats')
    .select('id, status, dados_extraidos, pagamento_id')
    .eq('id', confirmacao.mensagem_id)
    .maybeSingle();

  if (errMsg || !mensagem) {
    redirect(`/pendentes?error=${encodeURIComponent('Mensagem não encontrada.')}`);
  }

  if (mensagem.status === 'confirmada') {
    redirect(`/pendentes?error=${encodeURIComponent('Esta pendência já foi resolvida.')}`);
  }

  const de = mensagem.dados_extraidos as DadosExtraidos | null;

  // Validate required fields for payment creation
  if (!de?.valor || !de?.obra_id) {
    redirect(
      `/pendentes?error=${encodeURIComponent(
        'Faltam dados obrigatórios (valor e obra). Use a mensagem original em /whatsapp para editar manualmente.',
      )}`,
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);

  // INSERT pagamento
  const { data: novoPagamento, error: errInsert } = await supabase
    .from('pagamentos')
    .insert({
      obra_id: de.obra_id,
      fornecedor_id: de.fornecedor_id ?? null,
      valor: de.valor,
      data_pagamento: de.data_pagamento ?? hoje,
      origem: 'whatsapp',
      status_pagto: 'confirmado',
      descricao: de.descricao ?? null,
      criado_via_msg_id: mensagem.id,
      criado_por_user_id: userId,
    })
    .select('id')
    .single();

  if (errInsert || !novoPagamento) {
    redirect(
      `/pendentes?error=${encodeURIComponent(
        mapDbErrorWithContext(errInsert, {
          '23503': 'Obra ou fornecedor referenciado não existe.',
          '23502': 'Campo obrigatório ausente ao criar pagamento.',
        }),
      )}`,
    );
  }

  // Update mensagem
  await supabase
    .from('mensagens_whats')
    .update({ status: 'confirmada', pagamento_id: novoPagamento.id })
    .eq('id', mensagem.id);

  // Update confirmacao
  await supabase
    .from('confirmacoes_pendentes')
    .update({
      resolvida: true,
      respondida_em: new Date().toISOString(),
      resposta_bruta: 'confirmado via painel',
    })
    .eq('id', confirmacao_id);

  revalidatePath('/pendentes');
  revalidatePath('/pagamentos');
  revalidatePath('/painel');

  redirect(`/pendentes?success=${encodeURIComponent('Pagamento criado com sucesso.')}`);
}

export async function rejeitarPendencia(formData: FormData) {
  const confirmacao_id = String(formData.get('confirmacao_id') ?? '').trim();
  const mensagem_id = String(formData.get('mensagem_id') ?? '').trim();

  if (!confirmacao_id || !mensagem_id) {
    redirect(`/pendentes?error=${encodeURIComponent('Dados ausentes para rejeição.')}`);
  }

  const supabase = await createClient();

  await supabase
    .from('mensagens_whats')
    .update({ status: 'erro', erro_msg: 'Rejeitada pelo gestor no painel' })
    .eq('id', mensagem_id);

  await supabase
    .from('confirmacoes_pendentes')
    .update({
      resolvida: true,
      respondida_em: new Date().toISOString(),
      resposta_bruta: 'rejeitado via painel',
    })
    .eq('id', confirmacao_id);

  revalidatePath('/pendentes');

  redirect(`/pendentes?success=${encodeURIComponent('Pendência rejeitada.')}`);
}
