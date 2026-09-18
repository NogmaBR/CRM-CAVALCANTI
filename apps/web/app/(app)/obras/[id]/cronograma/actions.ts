'use server';

import { gastoPorCategoriaDaObra } from '@/lib/data/cronograma';
import { mapDbErrorWithContext } from '@/lib/schemas/errors';
import { EtapaCreateSchema, MedicaoSchema, OrcamentoEtapaSchema } from '@/lib/schemas/etapa';
import { erroDeEscrita } from '@/lib/supabase/escrita';
import { createClient } from '@/lib/supabase/server';
import { hojeBR } from '@/lib/util/datas';
import { pareceUuid } from '@/lib/util/uuid';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type Rotulos, voltarComErro } from '../../../_shared/form-erros';

/**
 * Cronograma físico (etapas com % concluído) e orçamento por etapa da obra.
 *
 * Mesmo padrão dos recebimentos: Zod → `voltarComErro` com o formulário
 * preservado → escrita conferindo linhas afetadas → `revalidatePath` →
 * `redirect` com a mensagem de sucesso.
 */

const ROTULOS: Rotulos = {
  nome: 'Nome da etapa',
  peso: 'Peso',
  percentual_concluido: '% concluído',
  categoria_id: 'Etapa do plano de contas',
  data_prevista: 'Data prevista',
  medido_em: 'Medido em',
  valor: 'Valor orçado',
};

function formToRecord(fd: FormData): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string') rec[k] = v;
  }
  return rec;
}

function paginaDaObra(obraId: string): string {
  return pareceUuid(obraId) ? `/obras/${obraId}#cronograma` : '/obras';
}

function sucesso(obraId: string, msg: string): never {
  revalidatePath(`/obras/${obraId}`);
  revalidatePath('/painel');
  revalidatePath('/obras');
  redirect(`/obras/${obraId}?success=${encodeURIComponent(msg)}#cronograma`);
}

const ERROS_DB = {
  '23503': 'A obra ou a etapa do plano de contas não existe mais.',
  '23505': 'Já existe uma etapa com esse nome nesta obra.',
  '42P01': 'O cronograma ainda não está ativo: falta aplicar a migration 20260918150000.',
};

export async function criarEtapa(formData: FormData) {
  const raw = formToRecord(formData);
  const obraId = typeof raw.obra_id === 'string' ? raw.obra_id : '';
  const parsed = EtapaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    voltarComErro(paginaDaObra(obraId), parsed.error, { rotulos: ROTULOS, valores: formData });
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Ordem = última + 1, para a etapa nova ir para o fim da lista.
  const { data: ultima } = await supabase
    .from('etapas_obra')
    .select('ordem')
    .eq('obra_id', parsed.data.obra_id)
    .is('deleted_at', null)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('etapas_obra').insert({
    obra_id: parsed.data.obra_id,
    nome: parsed.data.nome,
    peso: parsed.data.peso ?? 1,
    percentual_concluido: parsed.data.percentual_concluido ?? 0,
    categoria_id: parsed.data.categoria_id ?? null,
    data_prevista: parsed.data.data_prevista ?? null,
    ordem: (ultima?.ordem ?? 0) + 1,
    medido_em: parsed.data.percentual_concluido ? hojeBR() : null,
    origem: 'manual',
    criado_por_user_id: userData.user?.id ?? null,
  });
  if (error) {
    voltarComErro(paginaDaObra(obraId), mapDbErrorWithContext(error, ERROS_DB), {
      valores: formData,
    });
  }
  sucesso(obraId, `Etapa "${parsed.data.nome}" criada.`);
}

/**
 * Cria uma etapa por categoria do plano de contas que já tem gasto nesta
 * obra (ou todas, se a obra ainda não tem pagamento) — em vez de digitar
 * doze nomes. Cada etapa nasce em 0% e apontando para a categoria.
 */
export async function criarEtapasDoPlano(formData: FormData) {
  const obraId = String(formData.get('obra_id') ?? '').trim();
  if (!pareceUuid(obraId)) redirect('/obras?error=ID%20inv%C3%A1lido');
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const [gasto, catsR, existentesR] = await Promise.all([
    gastoPorCategoriaDaObra(obraId, supabase),
    supabase.from('categorias').select('id, nome').is('deleted_at', null).order('nome'),
    supabase
      .from('etapas_obra')
      .select('categoria_id, nome')
      .eq('obra_id', obraId)
      .is('deleted_at', null),
  ]);
  const categorias = catsR.data ?? [];
  const comGasto = categorias.filter((c) => (gasto.get(c.id) ?? 0) > 0);
  const base = comGasto.length > 0 ? comGasto : categorias;
  const jaTem = new Set((existentesR.data ?? []).map((e) => e.categoria_id));
  const nomesExistentes = new Set((existentesR.data ?? []).map((e) => e.nome.trim().toLowerCase()));
  const novas = base.filter(
    (c) => !jaTem.has(c.id) && !nomesExistentes.has(c.nome.trim().toLowerCase()),
  );
  if (novas.length === 0) {
    redirect(
      `/obras/${obraId}?error=${encodeURIComponent('Todas as etapas do plano de contas já existem nesta obra.')}#cronograma`,
    );
  }
  const { error } = await supabase.from('etapas_obra').insert(
    novas.map((c, i) => ({
      obra_id: obraId,
      nome: c.nome,
      categoria_id: c.id,
      ordem: (existentesR.data?.length ?? 0) + i + 1,
      peso: 1,
      percentual_concluido: 0,
      origem: 'manual' as const,
      criado_por_user_id: userData.user?.id ?? null,
    })),
  );
  if (error) {
    redirect(
      `/obras/${obraId}?error=${encodeURIComponent(mapDbErrorWithContext(error, ERROS_DB))}#cronograma`,
    );
  }
  sucesso(
    obraId,
    `${novas.length} ${novas.length === 1 ? 'etapa criada' : 'etapas criadas'} a partir do plano de contas.`,
  );
}

export async function medirEtapa(formData: FormData) {
  const raw = formToRecord(formData);
  const obraId = typeof raw.obra_id === 'string' ? raw.obra_id : '';
  const parsed = MedicaoSchema.safeParse(raw);
  if (!parsed.success) {
    voltarComErro(paginaDaObra(obraId), parsed.error, {
      rotulos: ROTULOS,
      valores: formData,
      campo: `percentual_${typeof raw.id === 'string' ? raw.id : ''}`,
    });
  }
  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from('etapas_obra')
      .update({
        percentual_concluido: parsed.data.percentual_concluido,
        medido_em: parsed.data.medido_em ?? hojeBR(),
      })
      .eq('id', parsed.data.id)
      .eq('obra_id', parsed.data.obra_id)
      .is('deleted_at', null)
      .select('id, nome'),
  );
  if (erro) redirect(`/obras/${obraId}?error=${encodeURIComponent(erro)}#cronograma`);
  sucesso(obraId, `Medição registrada: ${parsed.data.percentual_concluido}%.`);
}

export async function arquivarEtapa(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  const obraId = String(formData.get('obra_id') ?? '').trim();
  if (!pareceUuid(id)) redirect(`${paginaDaObra(obraId)}`);
  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from('etapas_obra')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id'),
  );
  if (erro) redirect(`/obras/${obraId}?error=${encodeURIComponent(erro)}#cronograma`);
  sucesso(obraId, 'Etapa removida do cronograma.');
}

/** Upsert: uma linha viva por (obra, categoria). */
export async function salvarOrcamentoEtapa(formData: FormData) {
  const raw = formToRecord(formData);
  const obraId = typeof raw.obra_id === 'string' ? raw.obra_id : '';
  const parsed = OrcamentoEtapaSchema.safeParse(raw);
  if (!parsed.success) {
    voltarComErro(paginaDaObra(obraId), parsed.error, {
      rotulos: ROTULOS,
      valores: formData,
      campo: 'valor',
    });
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: existente } = await supabase
    .from('orcamentos_etapa')
    .select('id')
    .eq('obra_id', parsed.data.obra_id)
    .eq('categoria_id', parsed.data.categoria_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (existente) {
    const erro = erroDeEscrita(
      await supabase
        .from('orcamentos_etapa')
        .update({ valor: parsed.data.valor })
        .eq('id', existente.id)
        .select('id'),
    );
    if (erro) redirect(`/obras/${obraId}?error=${encodeURIComponent(erro)}#cronograma`);
  } else {
    const { error } = await supabase.from('orcamentos_etapa').insert({
      obra_id: parsed.data.obra_id,
      categoria_id: parsed.data.categoria_id,
      valor: parsed.data.valor,
      criado_por_user_id: userData.user?.id ?? null,
    });
    if (error) {
      voltarComErro(paginaDaObra(obraId), mapDbErrorWithContext(error, ERROS_DB), {
        valores: formData,
      });
    }
  }
  sucesso(obraId, 'Orçado da etapa salvo.');
}

export async function arquivarOrcamentoEtapa(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  const obraId = String(formData.get('obra_id') ?? '').trim();
  if (!pareceUuid(id)) redirect(`${paginaDaObra(obraId)}`);
  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from('orcamentos_etapa')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id'),
  );
  if (erro) redirect(`/obras/${obraId}?error=${encodeURIComponent(erro)}#cronograma`);
  sucesso(obraId, 'Orçado removido.');
}
