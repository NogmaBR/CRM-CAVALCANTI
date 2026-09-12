import 'server-only';
import { STATUS_QUE_CONTAM } from '@/lib/status-labels';
import { createClient } from '@/lib/supabase/server';
import { hojeBR } from '@/lib/util/datas';
import type { Database } from '@nogma/db';

/**
 * Data layer para o Painel (Fase 17).
 * Substitui dados MOCK por queries reais agregadas.
 *
 * Padrão: server-side com createClient (RLS ativa). Batched — no máximo
 * 4 queries em paralelo por page load. Cache none (fresh no cada F5).
 */

type Pagamento = Database['public']['Tables']['pagamentos']['Row'];

export interface KpiCard {
  label: string;
  value: string;
  raw_value: number;
  caption: string;
  trend8m: number[]; // últimos 8 meses (o mais antigo primeiro)
  delta_pct: number | null; // % vs mês anterior (null se dados insuficientes)
  direction: 'up' | 'down' | 'flat';
}

export interface KpisResumo {
  obras_ativas: KpiCard;
  gasto_mes: KpiCard;
  gasto_total: KpiCard;
  pendencias: KpiCard;
}

export interface SerieMensalPoint {
  mes: string; // "2026-09"
  label: string; // "Set/26"
  total: number;
  count: number;
}

export interface CategoriaGasto {
  nome: string;
  cor: string | null;
  total: number;
  count: number;
}

export interface AtividadeItem {
  id: string;
  tipo: 'pagamento' | 'documento' | 'mensagem';
  titulo: string;
  meta: string;
  timestamp: string; // ISO
  href: string | null;
}

// ============================================================================
// Helpers de data
// ============================================================================

function mesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mesLabel(mesKey: string): string {
  const [y, m] = mesKey.split('-');
  if (!y || !m) return mesKey;
  const meses = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const idx = Number(m) - 1;
  const yy = y.slice(-2);
  return `${meses[idx] ?? m}/${yy}`;
}

function lastNMeses(n: number): string[] {
  // Mês civil de Brasília: o runtime da Vercel é UTC, e às 21h do último
  // dia do mês o "gasto no mês" já mostrava o mês seguinte.
  const [anoBR, mesBR] = hojeBR().split('-').map(Number) as [number, number];
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(anoBR, mesBR - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function timeAgoPtBr(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.floor((now - then) / 1000);
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ============================================================================
// KPIs principais com trends 8 meses
// ============================================================================

export async function getKpisResumo(): Promise<KpisResumo> {
  const supabase = await createClient();
  const meses = lastNMeses(8);
  const mesAtual = meses[meses.length - 1]!;
  const mesAnterior = meses[meses.length - 2]!;

  // 4 queries em paralelo
  const [obrasR, pagsR, msgsR, pagsTodosR] = await Promise.all([
    supabase.from('obras').select('id, created_at, deleted_at'),
    supabase
      .from('pagamentos')
      .select('valor, data_pagamento, status_pagto, created_at')
      .in('status_pagto', [...STATUS_QUE_CONTAM])
      .is('deleted_at', null),
    supabase
      .from('mensagens_whats')
      .select('id, status, recebida_em')
      .in('status', ['recebida', 'classificada']),
    supabase
      .from('pagamentos')
      .select('valor')
      .in('status_pagto', [...STATUS_QUE_CONTAM])
      .is('deleted_at', null),
  ]);

  const obras = obrasR.data ?? [];
  const pags = pagsR.data ?? [];
  const msgs = msgsR.data ?? [];

  // Obras: contagem ativa por mês (created_at <= fim_mes AND (deleted_at IS NULL OR deleted_at > fim_mes))
  const obrasAtivas = obras.filter((o) => !o.deleted_at).length;
  const obrasTrend = meses.map((mkey) => {
    const [y, m] = mkey.split('-').map(Number);
    const fimMes = new Date(y!, m!, 0, 23, 59, 59); // último dia
    return obras.filter((o) => {
      const created = o.created_at ? new Date(o.created_at) : null;
      const deleted = o.deleted_at ? new Date(o.deleted_at) : null;
      if (!created) return false;
      if (created > fimMes) return false;
      if (deleted && deleted <= fimMes) return false;
      return true;
    }).length;
  });

  // Gasto mensal
  const gastoPorMes = new Map<string, { total: number; count: number }>();
  for (const p of pags) {
    if (!p.data_pagamento) continue;
    const key = p.data_pagamento.slice(0, 7);
    const cur = gastoPorMes.get(key);
    gastoPorMes.set(key, {
      total: (cur?.total ?? 0) + Number(p.valor),
      count: (cur?.count ?? 0) + 1,
    });
  }
  const gastoMesAtual = gastoPorMes.get(mesAtual) ?? { total: 0, count: 0 };
  const gastoMesAnterior = gastoPorMes.get(mesAnterior) ?? { total: 0, count: 0 };
  const gastoTrend = meses.map((m) => gastoPorMes.get(m)?.total ?? 0);

  // Total acumulado ao longo dos meses (running sum)
  const totalTrend: number[] = [];
  let running = 0;
  for (const m of meses) {
    running += gastoPorMes.get(m)?.total ?? 0;
    totalTrend.push(running);
  }
  const gastoTotal = (pagsTodosR.data ?? []).reduce((acc, p) => acc + Number(p.valor), 0);

  // Pendências: mensagens recebidas nas últimas 8 semanas (proxy pra trend)
  const pendenciasAtual = msgs.length;
  const pendenciasTrend = meses.map((mkey) => {
    const [y, m] = mkey.split('-').map(Number);
    const inicioMes = new Date(y!, m! - 1, 1);
    const fimMes = new Date(y!, m!, 0, 23, 59, 59);
    return msgs.filter((mg) => {
      if (!mg.recebida_em) return false;
      const t = new Date(mg.recebida_em);
      return t >= inicioMes && t <= fimMes;
    }).length;
  });

  const brl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const pctDelta = (
    atual: number,
    anterior: number,
  ): { pct: number | null; dir: 'up' | 'down' | 'flat' } => {
    if (anterior === 0) return { pct: null, dir: atual > 0 ? 'up' : 'flat' };
    const pct = ((atual - anterior) / anterior) * 100;
    if (Math.abs(pct) < 0.5) return { pct, dir: 'flat' };
    return { pct, dir: pct > 0 ? 'up' : 'down' };
  };

  const gastoDelta = pctDelta(gastoMesAtual.total, gastoMesAnterior.total);

  return {
    obras_ativas: {
      label: 'Obras ativas',
      value: String(obrasAtivas),
      raw_value: obrasAtivas,
      caption: 'não arquivadas',
      trend8m: obrasTrend,
      delta_pct: null,
      direction: 'flat',
    },
    gasto_mes: {
      label: 'Gasto no mês',
      value: brl(gastoMesAtual.total),
      raw_value: gastoMesAtual.total,
      caption: `${gastoMesAtual.count} pagamento${gastoMesAtual.count === 1 ? '' : 's'} confirmado${gastoMesAtual.count === 1 ? '' : 's'}`,
      trend8m: gastoTrend,
      delta_pct: gastoDelta.pct,
      direction: gastoDelta.dir,
    },
    gasto_total: {
      label: 'Total acumulado',
      value: brl(gastoTotal),
      raw_value: gastoTotal,
      caption: 'todas as obras · histórico',
      trend8m: totalTrend,
      delta_pct: null,
      direction: 'up',
    },
    pendencias: {
      label: 'Pendências WhatsApp',
      value: String(pendenciasAtual),
      raw_value: pendenciasAtual,
      caption: 'aguardando classificação',
      trend8m: pendenciasTrend,
      delta_pct: null,
      direction: pendenciasAtual > 0 ? 'down' : 'flat',
    },
  };
}

// ============================================================================
// Série mensal (12 meses) — bar chart
// ============================================================================

export async function getSerieMensal(nMeses = 12): Promise<SerieMensalPoint[]> {
  const supabase = await createClient();
  const meses = lastNMeses(nMeses);
  const inicio = `${meses[0]}-01`;

  const { data } = await supabase
    .from('pagamentos')
    .select('valor, data_pagamento')
    .in('status_pagto', [...STATUS_QUE_CONTAM])
    .is('deleted_at', null)
    .gte('data_pagamento', inicio)
    .order('data_pagamento');

  const byMes = new Map<string, { total: number; count: number }>();
  for (const p of data ?? []) {
    const key = (p.data_pagamento ?? '').slice(0, 7);
    if (!key) continue;
    const cur = byMes.get(key);
    byMes.set(key, {
      total: (cur?.total ?? 0) + Number(p.valor),
      count: (cur?.count ?? 0) + 1,
    });
  }

  return meses.map((m) => ({
    mes: m,
    label: mesLabel(m),
    total: byMes.get(m)?.total ?? 0,
    count: byMes.get(m)?.count ?? 0,
  }));
}

// ============================================================================
// Gasto por categoria — donut (top N + others)
// ============================================================================

export async function getGastoPorCategoria(topN = 5): Promise<CategoriaGasto[]> {
  const supabase = await createClient();
  const meses = lastNMeses(3); // últimos 3 meses
  const inicio = `${meses[0]}-01`;

  const [pagsR, catsR] = await Promise.all([
    supabase
      .from('pagamentos')
      .select('valor, categoria_id')
      .in('status_pagto', [...STATUS_QUE_CONTAM])
      .is('deleted_at', null)
      .gte('data_pagamento', inicio),
    supabase.from('categorias').select('id, nome, cor').is('deleted_at', null),
  ]);

  const catMap = new Map((catsR.data ?? []).map((c) => [c.id, { nome: c.nome, cor: c.cor }]));

  const stats = new Map<string, CategoriaGasto>();
  for (const p of pagsR.data ?? []) {
    const meta = p.categoria_id ? catMap.get(p.categoria_id) : null;
    const nome = meta?.nome ?? 'Sem categoria';
    const cor = meta?.cor ?? '#A1A1A1';
    const cur = stats.get(nome);
    stats.set(nome, {
      nome,
      cor,
      total: (cur?.total ?? 0) + Number(p.valor),
      count: (cur?.count ?? 0) + 1,
    });
  }

  const sorted = [...stats.values()].sort((a, b) => b.total - a.total);
  if (sorted.length <= topN) return sorted;

  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const outros: CategoriaGasto = {
    nome: 'Outros',
    cor: '#565B5B',
    total: rest.reduce((acc, x) => acc + x.total, 0),
    count: rest.reduce((acc, x) => acc + x.count, 0),
  };
  return [...top, outros];
}

// ============================================================================
// Atividade recente — pagamentos + documentos + mensagens (últimas 48h)
// ============================================================================

export async function getAtividadeRecente(limit = 10): Promise<AtividadeItem[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [pagsR, docsR, msgsR] = await Promise.all([
    supabase
      .from('pagamentos')
      .select('id, valor, obra_id, fornecedor_id, created_at, origem')
      .is('deleted_at', null)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('documentos')
      .select('id, nome_arquivo, obra_id, tipo, created_at')
      .is('deleted_at', null)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('mensagens_whats')
      .select('id, autorizado_id, status, recebida_em, tipo, pagamento_id, documento_id')
      .gte('recebida_em', cutoff)
      .order('recebida_em', { ascending: false })
      .limit(limit),
  ]);

  const pags = pagsR.data ?? [];
  const docs = docsR.data ?? [];
  const msgs = msgsR.data ?? [];

  const obraIds = [
    ...new Set(
      [...pags.map((p) => p.obra_id), ...docs.map((d) => d.obra_id)].filter(
        (v): v is string => !!v,
      ),
    ),
  ];
  const fornIds = [...new Set(pags.map((p) => p.fornecedor_id).filter((v): v is string => !!v))];
  const autorizadoIds = [
    ...new Set(msgs.map((m) => m.autorizado_id).filter((v): v is string => !!v)),
  ];

  const [obrasR, fornsR, autorizadosR] = await Promise.all([
    obraIds.length > 0
      ? supabase.from('obras').select('id, nome').in('id', obraIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome: string }>, error: null }),
    fornIds.length > 0
      ? supabase.from('fornecedores').select('id, nome').in('id', fornIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome: string }>, error: null }),
    autorizadoIds.length > 0
      ? supabase.from('autorizados').select('id, nome').in('id', autorizadoIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nome: string }>, error: null }),
  ]);
  const obraMap = new Map((obrasR.data ?? []).map((o) => [o.id, o.nome]));
  const fornMap = new Map((fornsR.data ?? []).map((f) => [f.id, f.nome]));
  const autorizadoMap = new Map((autorizadosR.data ?? []).map((a) => [a.id, a.nome]));

  // Descreve a AÇÃO DO AGENTE sobre a mensagem, não a mensagem bruta —
  // o gestor não deve ver "de quem veio o WhatsApp", e sim o que o
  // agente fez com ele (briefing de alinhamento 16/09).
  const AGENTE_ACAO: Record<string, string> = {
    recebida: 'Mensagem recebida, aguardando classificação',
    processando: 'Classificando mensagem recebida',
    classificada: 'Mensagem classificada, aguardando confirmação',
    confirmada: 'Registro confirmado a partir do WhatsApp',
    erro: 'Falha ao processar mensagem do WhatsApp',
  };

  const brl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const items: AtividadeItem[] = [
    ...pags.map(
      (p): AtividadeItem => ({
        id: `pag-${p.id}`,
        tipo: 'pagamento',
        titulo: `Pagamento ${brl(Number(p.valor))} · ${p.origem}`,
        meta: `${obraMap.get(p.obra_id) ?? '(obra)'}${p.fornecedor_id ? ` · ${fornMap.get(p.fornecedor_id) ?? ''}` : ''}`,
        timestamp: p.created_at ?? new Date().toISOString(),
        href: `/pagamentos/${p.id}`,
      }),
    ),
    ...docs.map(
      (d): AtividadeItem => ({
        id: `doc-${d.id}`,
        tipo: 'documento',
        titulo: `Documento anexado: ${d.nome_arquivo}`,
        meta: `${obraMap.get(d.obra_id ?? '') ?? '(obra)'} · ${d.tipo}`,
        timestamp: d.created_at ?? new Date().toISOString(),
        href: `/documentos/${d.id}`,
      }),
    ),
    ...msgs.map((m): AtividadeItem => {
      const quem = m.autorizado_id ? autorizadoMap.get(m.autorizado_id) : null;
      const meta = quem ? `via ${quem}` : 'via WhatsApp';
      const href = m.pagamento_id
        ? `/pagamentos/${m.pagamento_id}`
        : m.documento_id
          ? `/documentos/${m.documento_id}`
          : '/whatsapp';
      return {
        id: `msg-${m.id}`,
        tipo: 'mensagem',
        titulo: AGENTE_ACAO[m.status] ?? 'Mensagem processada pelo agente',
        meta,
        timestamp: m.recebida_em ?? new Date().toISOString(),
        href,
      };
    }),
  ]
    .sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))
    .slice(0, limit);

  return items;
}

/** Helper de export pra format de tempo relativo pt-BR. */
export function relativeTime(iso: string): string {
  return timeAgoPtBr(iso);
}
