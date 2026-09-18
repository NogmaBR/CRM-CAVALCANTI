import 'server-only';
import {
  type LinhaOrcadoRealizado,
  avancoFisico,
  orcadoVsRealizado,
} from '@/lib/financeiro/cronograma';
import { logger } from '@/lib/log';
import { STATUS_QUE_CONTAM } from '@/lib/status-labels';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EtapaObra = Database['public']['Tables']['etapas_obra']['Row'];
export type OrcamentoEtapa = Database['public']['Tables']['orcamentos_etapa']['Row'];

type Client = SupabaseClient<Database>;
const log = logger('cronograma');

/**
 * Cronograma físico e orçamento por etapa de UMA obra.
 *
 * Sem a migration `20260918150000` as duas tabelas não existem: as funções
 * devolvem vazio com `tabela_ausente` no log, e a página da obra mostra o
 * estado vazio em vez de quebrar — mesmo padrão do painel.
 */

function tabelaAusente(error: { code?: string; message: string } | null): boolean {
  // 42P01 = relação inexistente (PostgREST devolve PGRST205 para tabela fora do cache).
  return !!error && (error.code === '42P01' || error.code === 'PGRST205');
}

export async function listEtapasDaObra(obraId: string, supabase?: Client): Promise<EtapaObra[]> {
  const db = supabase ?? (await createClient());
  const { data, error } = await db
    .from('etapas_obra')
    .select('*')
    .eq('obra_id', obraId)
    .is('deleted_at', null)
    .order('ordem')
    .order('nome');
  if (error) {
    if (tabelaAusente(error)) {
      log.aviso('tabela_ausente', { tabela: 'etapas_obra' });
      return [];
    }
    throw new Error(`Falha ao listar etapas: ${error.message}`);
  }
  return (data ?? []).map((e) => ({
    ...e,
    peso: Number(e.peso),
    percentual_concluido: Number(e.percentual_concluido),
  }));
}

export async function listOrcamentosDaObra(
  obraId: string,
  supabase?: Client,
): Promise<OrcamentoEtapa[]> {
  const db = supabase ?? (await createClient());
  const { data, error } = await db
    .from('orcamentos_etapa')
    .select('*')
    .eq('obra_id', obraId)
    .is('deleted_at', null);
  if (error) {
    if (tabelaAusente(error)) {
      log.aviso('tabela_ausente', { tabela: 'orcamentos_etapa' });
      return [];
    }
    throw new Error(`Falha ao listar orçamentos por etapa: ${error.message}`);
  }
  return (data ?? []).map((o) => ({ ...o, valor: Number(o.valor) }));
}

/** Gasto (que conta) por categoria, numa obra. Chave `''` = sem categoria. */
export async function gastoPorCategoriaDaObra(
  obraId: string,
  supabase?: Client,
): Promise<Map<string, number>> {
  const db = supabase ?? (await createClient());
  const { data, error } = await db
    .from('pagamentos')
    .select('categoria_id, valor')
    .eq('obra_id', obraId)
    .in('status_pagto', [...STATUS_QUE_CONTAM])
    .is('deleted_at', null)
    .limit(5000);
  if (error) throw new Error(`Falha ao somar por categoria: ${error.message}`);
  const mapa = new Map<string, number>();
  for (const p of data ?? []) {
    const k = p.categoria_id ?? '';
    mapa.set(k, Math.round(((mapa.get(k) ?? 0) + Number(p.valor)) * 100) / 100);
  }
  return mapa;
}

export interface ResumoDoCronograma {
  etapas: EtapaObra[];
  /** As linhas de orçado vivas (id por categoria, para o botão de remover). */
  orcamentos: OrcamentoEtapa[];
  /** 0–100 ponderado pelo peso; nulo sem etapas. */
  avancoFisico: number | null;
  orcado: {
    linhas: LinhaOrcadoRealizado[];
    totais: { orcado: number; realizado: number; estouradas: number };
  };
  /** Categorias vivas (id → nome), para os selects e para as linhas. */
  categorias: Array<{ id: string; nome: string; cor: string | null }>;
}

export async function resumoDoCronograma(
  obraId: string,
  supabase?: Client,
): Promise<ResumoDoCronograma> {
  const db = supabase ?? (await createClient());
  const [etapas, orcamentos, gasto, catsR] = await Promise.all([
    listEtapasDaObra(obraId, db),
    listOrcamentosDaObra(obraId, db),
    gastoPorCategoriaDaObra(obraId, db),
    db.from('categorias').select('id, nome, cor').is('deleted_at', null).order('nome'),
  ]);
  const categorias = catsR.data ?? [];
  const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
  // Gasto sem categoria não entra no orçado × realizado: não há o que orçar.
  gasto.delete('');
  return {
    etapas,
    orcamentos,
    avancoFisico: avancoFisico(etapas),
    orcado: orcadoVsRealizado(orcamentos, gasto, nomes),
    categorias,
  };
}

/** Etapas estouradas por obra (para o semáforo e para o painel), numa ida só. */
export async function etapasEstouradasPorObra(supabase?: Client): Promise<Map<string, number>> {
  const db = supabase ?? (await createClient());
  const [orcR, pagsR] = await Promise.all([
    db
      .from('orcamentos_etapa')
      .select('obra_id, categoria_id, valor')
      .is('deleted_at', null)
      .limit(5000),
    db
      .from('pagamentos')
      .select('obra_id, categoria_id, valor')
      .in('status_pagto', [...STATUS_QUE_CONTAM])
      .is('deleted_at', null)
      .not('categoria_id', 'is', null)
      .limit(5000),
  ]);
  const mapa = new Map<string, number>();
  if (orcR.error) {
    if (!tabelaAusente(orcR.error)) log.erro('orcamentos_falhou', { erro: orcR.error.message });
    return mapa;
  }
  if (pagsR.error) throw new Error(`Falha ao carregar pagamentos: ${pagsR.error.message}`);
  const gasto = new Map<string, number>();
  for (const p of pagsR.data ?? []) {
    const k = `${p.obra_id}|${p.categoria_id}`;
    gasto.set(k, (gasto.get(k) ?? 0) + Number(p.valor));
  }
  for (const o of orcR.data ?? []) {
    const g = gasto.get(`${o.obra_id}|${o.categoria_id}`) ?? 0;
    if (g > Number(o.valor)) mapa.set(o.obra_id, (mapa.get(o.obra_id) ?? 0) + 1);
  }
  return mapa;
}
