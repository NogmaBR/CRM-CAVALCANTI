'use server';

import { emitir } from '@/lib/events/bus';
import { mapDbErrorWithContext } from '@/lib/schemas/errors';
import { PagamentoCreateSchema, PagamentoUpdateSchema } from '@/lib/schemas/pagamento';
import { dispatchEvento } from '@/lib/services/dispatch-webhook';
import { erroDeEscrita } from '@/lib/supabase/escrita';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type Rotulos, voltarComErro } from '../_shared/form-erros';

/** `name` do input → como o campo se chama para quem lê o erro. */
const ROTULOS: Rotulos = {
  obra_id: 'Obra',
  fornecedor_id: 'Fornecedor',
  categoria_id: 'Categoria',
  valor: 'Valor',
  data_pagamento: 'Data do pagamento',
  origem: 'Origem',
  status_pagto: 'Status',
  descricao: 'Descrição',
  observacoes: 'Observações',
};

const CONTEXTO_FK = { '23503': 'Obra, fornecedor ou categoria referenciada não existe' };

function formToRecord(fd: FormData): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== 'string') continue;
    rec[key] = value;
  }
  return rec;
}

export async function createPagamento(formData: FormData) {
  const parsed = PagamentoCreateSchema.safeParse(formToRecord(formData));
  // Erro de validação volta com o campo apontado e tudo que foi digitado
  // (QA gstack, ISSUE-006): antes a tela reabria vazia com "valor: Required".
  if (!parsed.success) {
    voltarComErro('/pagamentos/novo', parsed.error, { rotulos: ROTULOS, valores: formData });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const criadoPor = userData.user?.id ?? null;

  const { data, error } = await supabase
    .from('pagamentos')
    .insert({
      obra_id: parsed.data.obra_id,
      fornecedor_id: parsed.data.fornecedor_id ?? null,
      categoria_id: parsed.data.categoria_id ?? null,
      valor: parsed.data.valor,
      data_pagamento: parsed.data.data_pagamento,
      origem: parsed.data.origem,
      status_pagto: parsed.data.status_pagto,
      descricao: parsed.data.descricao ?? null,
      observacoes: parsed.data.observacoes ?? null,
      criado_por_user_id: criadoPor,
    })
    .select('id')
    .single();

  if (error) {
    voltarComErro('/pagamentos/novo', mapDbErrorWithContext(error, CONTEXTO_FK), {
      valores: formData,
    });
  }

  // Nota: automação de e-mail "pagamento aguardando" removida — fora do
  // escopo contratado (briefing de alinhamento 16/09).

  // Dispatch webhook outbound (fase n8n) — best-effort, não bloqueia UX
  try {
    await dispatchEvento('pagamento_created', {
      id: data.id,
      obra_id: parsed.data.obra_id,
      fornecedor_id: parsed.data.fornecedor_id ?? null,
      valor: parsed.data.valor,
      data_pagamento: parsed.data.data_pagamento,
      origem: parsed.data.origem,
      status_pagto: parsed.data.status_pagto,
    });
  } catch {
    // Silencioso — webhook falhou mas pagamento tá OK
  }

  // Evento de domínio: o webhook acima avisa sistemas de fora; este avisa as
  // automações de dentro (ex.: orçamento em risco). `emitir` nunca lança e,
  // sem regra ligada, custa uma consulta.
  await emitir(
    'pagamento.criado',
    {
      pagamentoId: data.id,
      obraId: parsed.data.obra_id,
      fornecedorId: parsed.data.fornecedor_id ?? null,
      valor: parsed.data.valor,
      origem: parsed.data.origem,
    },
    { userId: criadoPor },
  );

  revalidatePath('/pagamentos');
  revalidatePath('/painel');
  revalidatePath(`/obras/${parsed.data.obra_id}`);
  redirect(`/pagamentos/${data.id}`);
}

export async function updatePagamento(formData: FormData) {
  const raw = formToRecord(formData);
  const parsed = PagamentoUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const id = typeof raw.id === 'string' ? raw.id : '';
    voltarComErro(`/pagamentos/${id}/editar`, parsed.error, {
      rotulos: ROTULOS,
      valores: formData,
    });
  }

  const { id, ...rest } = parsed.data;
  const supabase = await createClient();
  // `erroDeEscrita`: com RLS, papel sem permissão faz zero linhas sem erro.
  const resultado = await supabase
    .from('pagamentos')
    .update({
      ...(rest.obra_id !== undefined ? { obra_id: rest.obra_id } : {}),
      ...(rest.fornecedor_id !== undefined ? { fornecedor_id: rest.fornecedor_id ?? null } : {}),
      ...(rest.categoria_id !== undefined ? { categoria_id: rest.categoria_id ?? null } : {}),
      ...(rest.valor !== undefined ? { valor: rest.valor } : {}),
      ...(rest.data_pagamento !== undefined ? { data_pagamento: rest.data_pagamento } : {}),
      ...(rest.origem !== undefined ? { origem: rest.origem } : {}),
      ...(rest.status_pagto !== undefined ? { status_pagto: rest.status_pagto } : {}),
      ...(rest.descricao !== undefined ? { descricao: rest.descricao ?? null } : {}),
      ...(rest.observacoes !== undefined ? { observacoes: rest.observacoes ?? null } : {}),
    })
    .eq('id', id)
    .select('id');
  const erro = resultado.error
    ? mapDbErrorWithContext(resultado.error, CONTEXTO_FK)
    : erroDeEscrita(resultado);

  if (erro) {
    voltarComErro(`/pagamentos/${id}/editar`, erro, { valores: formData });
  }

  revalidatePath('/pagamentos');
  revalidatePath(`/pagamentos/${id}`);
  revalidatePath('/painel');
  redirect(`/pagamentos/${id}`);
}

export async function archivePagamento(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/pagamentos?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from('pagamentos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id'),
  );

  if (erro) redirect(`/pagamentos/${id}?error=${encodeURIComponent(erro)}`);
  revalidatePath('/pagamentos');
  revalidatePath(`/pagamentos/${id}`);
  revalidatePath('/painel');
  redirect(`/pagamentos/${id}`);
}

export async function restorePagamento(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/pagamentos?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase.from('pagamentos').update({ deleted_at: null }).eq('id', id).select('id'),
  );

  if (erro) redirect(`/pagamentos/${id}?error=${encodeURIComponent(erro)}`);
  revalidatePath('/pagamentos');
  revalidatePath(`/pagamentos/${id}`);
  revalidatePath('/painel');
  redirect(`/pagamentos/${id}`);
}
