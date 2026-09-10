'use server';

import { mapDbError } from '@/lib/schemas/errors';
import { ObraCreateSchema, ObraUpdateSchema } from '@/lib/schemas/obra';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function formToRecord(fd: FormData): Record<string, unknown> {
  // Extrai endereco.<field> em objeto aninhado; resto raso.
  const rec: Record<string, unknown> = {};
  const endereco: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== 'string') continue;
    if (key.startsWith('endereco.')) {
      const field = key.slice('endereco.'.length);
      if (value.trim() !== '') endereco[field] = value;
    } else {
      rec[key] = value;
    }
  }
  if (Object.keys(endereco).length > 0) rec.endereco = endereco;
  return rec;
}

export async function createObra(formData: FormData) {
  const parsed = ObraCreateSchema.safeParse(formToRecord(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos';
    redirect(`/obras/novo?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('obras')
    .insert({
      nome: parsed.data.nome,
      cliente: parsed.data.cliente ?? null,
      tipo: parsed.data.tipo ?? null,
      status: parsed.data.status,
      orcamento: parsed.data.orcamento ?? null,
      data_inicio: parsed.data.data_inicio ?? null,
      data_prevista_fim: parsed.data.data_prevista_fim ?? null,
      endereco: parsed.data.endereco ?? null,
      apelidos:
        parsed.data.apelidos && parsed.data.apelidos.length > 0 ? parsed.data.apelidos : null,
      observacoes: parsed.data.observacoes ?? null,
    })
    .select('id')
    .single();

  if (error) {
    redirect(`/obras/novo?error=${encodeURIComponent(mapDbError(error))}`);
  }

  revalidatePath('/obras');
  revalidatePath('/painel');
  redirect(`/obras/${data.id}`);
}

export async function updateObra(formData: FormData) {
  const raw = formToRecord(formData);
  const parsed = ObraUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dados inválidos';
    const id = typeof raw.id === 'string' ? raw.id : '';
    redirect(`/obras/${id}/editar?error=${encodeURIComponent(msg)}`);
  }

  const { id, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('obras')
    .update({
      ...(rest.nome !== undefined ? { nome: rest.nome } : {}),
      ...(rest.cliente !== undefined ? { cliente: rest.cliente || null } : {}),
      ...(rest.tipo !== undefined ? { tipo: rest.tipo ?? null } : {}),
      ...(rest.status !== undefined ? { status: rest.status } : {}),
      ...(rest.orcamento !== undefined ? { orcamento: rest.orcamento ?? null } : {}),
      ...(rest.data_inicio !== undefined ? { data_inicio: rest.data_inicio || null } : {}),
      ...(rest.data_prevista_fim !== undefined
        ? { data_prevista_fim: rest.data_prevista_fim || null }
        : {}),
      ...(rest.endereco !== undefined ? { endereco: rest.endereco ?? null } : {}),
      ...(rest.apelidos !== undefined
        ? { apelidos: rest.apelidos.length > 0 ? rest.apelidos : null }
        : {}),
      ...(rest.observacoes !== undefined ? { observacoes: rest.observacoes || null } : {}),
    })
    .eq('id', id);

  if (error) {
    redirect(`/obras/${id}/editar?error=${encodeURIComponent(mapDbError(error))}`);
  }

  revalidatePath('/obras');
  revalidatePath(`/obras/${id}`);
  redirect(`/obras/${id}`);
}

export async function archiveObra(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/obras?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const { error } = await supabase
    .from('obras')
    .update({ status: 'arquivada', deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) redirect(`/obras/${id}?error=${encodeURIComponent(mapDbError(error))}`);
  revalidatePath('/obras');
  revalidatePath(`/obras/${id}`);
  redirect(`/obras/${id}`);
}

export async function bulkArchiveObras(formData: FormData) {
  const idsRaw = formData.get('ids');
  if (typeof idsRaw !== 'string') redirect('/obras?error=IDs%20ausentes');

  let ids: string[];
  try {
    ids = JSON.parse(idsRaw);
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) throw new Error();
  } catch {
    redirect('/obras?error=IDs%20inv%C3%A1lidos');
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('obras')
    .update({ deleted_at: now, status: 'arquivada' })
    .in('id', ids)
    .is('deleted_at', null)
    .select('id');

  if (error) redirect(`/obras?error=${encodeURIComponent(mapDbError(error))}`);

  const count = data?.length ?? 0;
  revalidatePath('/obras');
  revalidatePath('/painel');
  redirect(`/obras?success=${encodeURIComponent(`${count} obra(s) arquivada(s)`)}`);
}

export async function restoreObra(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) redirect('/obras?error=ID%20inv%C3%A1lido');

  const supabase = await createClient();
  const { error } = await supabase
    .from('obras')
    .update({ status: 'ativa', deleted_at: null })
    .eq('id', id);

  if (error) redirect(`/obras/${id}?error=${encodeURIComponent(mapDbError(error))}`);
  revalidatePath('/obras');
  revalidatePath(`/obras/${id}`);
  redirect(`/obras/${id}`);
}

// ---------------------------------------------------------------------------
// Planilha compartilhada
// ---------------------------------------------------------------------------

/**
 * Gera um link read-only da planilha da obra.
 *
 * O token é a credencial inteira — não há login do outro lado — então usa
 * `randomBytes` (CSPRNG), não `Math.random`. Foram 32 bytes porque o link
 * circula por WhatsApp e pode acabar em lugares que não controlamos; o custo
 * de um token maior é zero e o de um adivinhável é a planilha financeira do
 * cliente vazando.
 *
 * A RLS de `obra_compartilhamentos` restringe o INSERT a admin/gestor; se o
 * papel não permitir, o erro volta do banco em vez de ser checado aqui.
 */
export async function gerarLinkPlanilha(formData: FormData) {
  const obraId = String(formData.get('obra_id') ?? '').trim();
  const descricao = String(formData.get('descricao') ?? '').trim();

  if (!obraId) {
    redirect(`/obras?error=${encodeURIComponent('Obra não informada.')}`);
  }

  const { randomBytes } = await import('node:crypto');
  const token = randomBytes(32).toString('hex');

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from('obra_compartilhamentos').insert({
    obra_id: obraId,
    token,
    descricao: descricao || null,
    criado_por_user_id: userData.user?.id ?? null,
  });

  if (error) {
    redirect(`/obras/${obraId}?error=${encodeURIComponent(mapDbError(error))}`);
  }

  revalidatePath(`/obras/${obraId}`);
  redirect(`/obras/${obraId}?success=${encodeURIComponent('Link da planilha gerado.')}`);
}

/**
 * Revoga um link.
 *
 * Soft: o registro fica, com a data da revogação. Apagar responderia mal a
 * "quem teve acesso a essa obra em março?", que é uma pergunta que aparece.
 */
export async function revogarLinkPlanilha(formData: FormData) {
  const obraId = String(formData.get('obra_id') ?? '').trim();
  const linkId = String(formData.get('link_id') ?? '').trim();

  if (!obraId || !linkId) {
    redirect(`/obras?error=${encodeURIComponent('Dados incompletos para revogar o link.')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('obra_compartilhamentos')
    .update({ revogado_em: new Date().toISOString() })
    .eq('id', linkId)
    .is('revogado_em', null); // idempotente: revogar duas vezes não é erro

  if (error) {
    redirect(`/obras/${obraId}?error=${encodeURIComponent(mapDbError(error))}`);
  }

  revalidatePath(`/obras/${obraId}`);
  redirect(`/obras/${obraId}?success=${encodeURIComponent('Link revogado — não abre mais.')}`);
}
