'use server';

import { mapDbErrorWithContext } from '@/lib/schemas/errors';
import { RecebimentoCreateSchema } from '@/lib/schemas/recebimento';
import { erroDeEscrita } from '@/lib/supabase/escrita';
import { createClient } from '@/lib/supabase/server';
import { pareceUuid } from '@/lib/util/uuid';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type Rotulos, voltarComErro } from '../../../_shared/form-erros';

/**
 * Parcelas recebidas do cliente da obra — o lado "entra" do caixa.
 *
 * Duas ações só: criar e arquivar. Editar é arquivar e lançar de novo, como
 * o resto do financeiro: uma parcela errada some do total e a certa entra
 * com auditoria própria.
 */

const ROTULOS: Rotulos = {
  obra_id: 'Obra',
  valor: 'Valor',
  data_recebimento: 'Data do recebimento',
  descricao: 'Descrição',
  observacoes: 'Observações',
};

function formToRecord(fd: FormData): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string') rec[k] = v;
  }
  return rec;
}

function paginaDaObra(obraId: string): string {
  return pareceUuid(obraId) ? `/obras/${obraId}` : '/obras';
}

export async function criarRecebimento(formData: FormData) {
  const raw = formToRecord(formData);
  const obraId = typeof raw.obra_id === 'string' ? raw.obra_id : '';
  const parsed = RecebimentoCreateSchema.safeParse(raw);
  if (!parsed.success) {
    voltarComErro(paginaDaObra(obraId), parsed.error, { rotulos: ROTULOS, valores: formData });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from('recebimentos').insert({
    obra_id: parsed.data.obra_id,
    valor: parsed.data.valor,
    data_recebimento: parsed.data.data_recebimento,
    descricao: parsed.data.descricao ?? null,
    observacoes: parsed.data.observacoes ?? null,
    origem: 'manual',
    criado_por_user_id: userData.user?.id ?? null,
  });

  if (error) {
    voltarComErro(
      paginaDaObra(obraId),
      mapDbErrorWithContext(error, { '23503': 'A obra não existe mais.' }),
      { valores: formData },
    );
  }

  revalidatePath(`/obras/${obraId}`);
  revalidatePath('/painel');
  redirect(`/obras/${obraId}?success=${encodeURIComponent('Recebimento registrado.')}`);
}

export async function arquivarRecebimento(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  const obraId = String(formData.get('obra_id') ?? '').trim();
  if (!pareceUuid(id)) redirect(`${paginaDaObra(obraId)}?error=ID%20inv%C3%A1lido`);

  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from('recebimentos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id'),
  );
  if (erro) redirect(`${paginaDaObra(obraId)}?error=${encodeURIComponent(erro)}`);

  revalidatePath(`/obras/${obraId}`);
  revalidatePath('/painel');
  redirect(`/obras/${obraId}?success=${encodeURIComponent('Recebimento arquivado.')}`);
}
