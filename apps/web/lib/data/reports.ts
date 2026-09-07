import 'server-only';
import type { Database } from '@nogma/db';
import { createClient } from '@/lib/supabase/server';

/**
 * Data layer para os 4 relatórios oficiais (Obra Completa · Mês ·
 * Fornecedor · Atividade). Cada função retorna a shape exata consumida
 * pelo template PDF e pelo generator CSV correspondente.
 *
 * Todas usam createClient() com RLS ativa — respeita permissão do
 * usuário chamador.
 */

type Pagamento = Database['public']['Tables']['pagamentos']['Row'];
type Documento = Database['public']['Tables']['documentos']['Row'];
type Obra = Database['public']['Tables']['obras']['Row'];
type Fornecedor = Database['public']['Tables']['fornecedores']['Row'];
type Categoria = Database['public']['Tables']['categorias']['Row'];

// ============================================================================
// Report 1: Obra Completa
// ============================================================================

export interface ObraCompletaData {
  obra: Obra;
  pagamentos: Array<
    Pagamento & { fornecedor_nome: string | null; categoria_nome: string | null }
  >;
  documentos: Array<Documento & { fornecedor_nome: string | null }>;
  totais: {
    valorTotalPago: number;
    quantidadePagamentos: number;
    valorPorCategoria: Record<string, number>; // categoria_nome → soma
    valorPorFornecedor: Record<string, number>;
    percentualOrcamento: number | null; // 0..1 ou null se orcamento null/0
  };
}

export async function getObraCompletaData(obraId: string): Promise<ObraCompletaData | null> {
  const supabase = await createClient();

  const { data: obra, error: obraErr } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .maybeSingle();
  if (obraErr || !obra) return null;

  const [pagRes, docRes] = await Promise.all([
    supabase
      .from('pagamentos')
      .select('*')
      .eq('obra_id', obraId)
      .is('deleted_at', null)
      .order('data_pagamento', { ascending: false }),
    supabase
      .from('documentos')
      .select('*')
      .eq('obra_id', obraId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  const pagamentos = pagRes.data ?? [];
  const documentos = docRes.data ?? [];

  const fornIds = new Set<string>();
  const catIds = new Set<string>();
  for (const p of pagamentos) {
    if (p.fornecedor_id) fornIds.add(p.fornecedor_id);
    if (p.categoria_id) catIds.add(p.categoria_id);
  }
  for (const d of documentos) if (d.fornecedor_id) fornIds.add(d.fornecedor_id);

  const [fornRes, catRes] = await Promise.all([
    fornIds.size > 0
      ? supabase.from('fornecedores').select('id, nome').in('id', [...fornIds])
      : Promise.resolve({ data: [] as Array<Pick<Fornecedor, 'id' | 'nome'>>, error: null }),
    catIds.size > 0
      ? supabase.from('categorias').select('id, nome').in('id', [...catIds])
      : Promise.resolve({ data: [] as Array<Pick<Categoria, 'id' | 'nome'>>, error: null }),
  ]);

  const fornMap = new Map((fornRes.data ?? []).map((f) => [f.id, f.nome]));
  const catMap = new Map((catRes.data ?? []).map((c) => [c.id, c.nome]));

  const valorPorCategoria: Record<string, number> = {};
  const valorPorFornecedor: Record<string, number> = {};
  let valorTotalPago = 0;

  const pagamentosEnriched = pagamentos.map((p) => {
    const v = Number(p.valor);
    valorTotalPago += v;
    const catNome = p.categoria_id ? (catMap.get(p.categoria_id) ?? 'Sem categoria') : 'Sem categoria';
    valorPorCategoria[catNome] = (valorPorCategoria[catNome] ?? 0) + v;
    const fornNome = p.fornecedor_id ? (fornMap.get(p.fornecedor_id) ?? 'Fornecedor desconhecido') : 'Sem fornecedor';
    valorPorFornecedor[fornNome] = (valorPorFornecedor[fornNome] ?? 0) + v;
    return {
      ...p,
      fornecedor_nome: p.fornecedor_id ? (fornMap.get(p.fornecedor_id) ?? null) : null,
      categoria_nome: p.categoria_id ? (catMap.get(p.categoria_id) ?? null) : null,
    };
  });

  const documentosEnriched = documentos.map((d) => ({
    ...d,
    fornecedor_nome: d.fornecedor_id ? (fornMap.get(d.fornecedor_id) ?? null) : null,
  }));

  const orcamento = obra.orcamento != null ? Number(obra.orcamento) : null;
  const percentualOrcamento = orcamento && orcamento > 0 ? valorTotalPago / orcamento : null;

  return {
    obra,
    pagamentos: pagamentosEnriched,
    documentos: documentosEnriched,
    totais: {
      valorTotalPago,
      quantidadePagamentos: pagamentos.length,
      valorPorCategoria,
      valorPorFornecedor,
      percentualOrcamento,
    },
  };
}

// ============================================================================
// Report 2: Mês (fechamento mensal consolidado)
// ============================================================================

export interface MesData {
  ano: number;
  mes: number; // 1..12
  pagamentos: Array<
    Pagamento & { obra_nome: string | null; fornecedor_nome: string | null; categoria_nome: string | null }
  >;
  totais: {
    valorTotal: number;
    quantidade: number;
    porObra: Array<{ obra_id: string; obra_nome: string; total: number; count: number }>;
    porCategoria: Array<{ categoria_nome: string; total: number; count: number }>;
    porOrigem: Record<'manual' | 'whatsapp' | 'importado', number>;
  };
}

export async function getMesData(ano: number, mes: number): Promise<MesData> {
  const supabase = await createClient();

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const proxMes = mes === 12 ? { y: ano + 1, m: 1 } : { y: ano, m: mes + 1 };
  const fim = `${proxMes.y}-${String(proxMes.m).padStart(2, '0')}-01`;

  const { data: pagamentos } = await supabase
    .from('pagamentos')
    .select('*')
    .gte('data_pagamento', inicio)
    .lt('data_pagamento', fim)
    .is('deleted_at', null)
    .order('data_pagamento', { ascending: true });

  const pags = pagamentos ?? [];

  const obraIds = [...new Set(pags.map((p) => p.obra_id).filter(Boolean))];
  const fornIds = [...new Set(pags.map((p) => p.fornecedor_id).filter((v): v is string => !!v))];
  const catIds = [...new Set(pags.map((p) => p.categoria_id).filter((v): v is string => !!v))];

  const [obrasRes, fornsRes, catsRes] = await Promise.all([
    obraIds.length > 0
      ? supabase.from('obras').select('id, nome').in('id', obraIds)
      : Promise.resolve({ data: [] as Array<Pick<Obra, 'id' | 'nome'>>, error: null }),
    fornIds.length > 0
      ? supabase.from('fornecedores').select('id, nome').in('id', fornIds)
      : Promise.resolve({ data: [] as Array<Pick<Fornecedor, 'id' | 'nome'>>, error: null }),
    catIds.length > 0
      ? supabase.from('categorias').select('id, nome').in('id', catIds)
      : Promise.resolve({ data: [] as Array<Pick<Categoria, 'id' | 'nome'>>, error: null }),
  ]);

  const obraMap = new Map((obrasRes.data ?? []).map((o) => [o.id, o.nome]));
  const fornMap = new Map((fornsRes.data ?? []).map((f) => [f.id, f.nome]));
  const catMap = new Map((catsRes.data ?? []).map((c) => [c.id, c.nome]));

  const pagamentosEnriched = pags.map((p) => ({
    ...p,
    obra_nome: obraMap.get(p.obra_id) ?? null,
    fornecedor_nome: p.fornecedor_id ? (fornMap.get(p.fornecedor_id) ?? null) : null,
    categoria_nome: p.categoria_id ? (catMap.get(p.categoria_id) ?? null) : null,
  }));

  const porObraMap = new Map<string, { obra_nome: string; total: number; count: number }>();
  const porCategoriaMap = new Map<string, { total: number; count: number }>();
  const porOrigem: Record<'manual' | 'whatsapp' | 'importado', number> = {
    manual: 0,
    whatsapp: 0,
    importado: 0,
  };
  let valorTotal = 0;

  for (const p of pags) {
    const v = Number(p.valor);
    valorTotal += v;
    porOrigem[p.origem] = (porOrigem[p.origem] ?? 0) + v;

    const obraKey = p.obra_id;
    const obraCurrent = porObraMap.get(obraKey);
    const obraNome = obraMap.get(obraKey) ?? 'Obra desconhecida';
    porObraMap.set(obraKey, {
      obra_nome: obraNome,
      total: (obraCurrent?.total ?? 0) + v,
      count: (obraCurrent?.count ?? 0) + 1,
    });

    const catNome = p.categoria_id ? (catMap.get(p.categoria_id) ?? 'Sem categoria') : 'Sem categoria';
    const catCurrent = porCategoriaMap.get(catNome);
    porCategoriaMap.set(catNome, {
      total: (catCurrent?.total ?? 0) + v,
      count: (catCurrent?.count ?? 0) + 1,
    });
  }

  const porObra = [...porObraMap.entries()]
    .map(([id, x]) => ({ obra_id: id, ...x }))
    .sort((a, b) => b.total - a.total);
  const porCategoria = [...porCategoriaMap.entries()]
    .map(([nome, x]) => ({ categoria_nome: nome, ...x }))
    .sort((a, b) => b.total - a.total);

  return {
    ano,
    mes,
    pagamentos: pagamentosEnriched,
    totais: { valorTotal, quantidade: pags.length, porObra, porCategoria, porOrigem },
  };
}

// ============================================================================
// Report 3: Fornecedor
// ============================================================================

export interface FornecedorData {
  fornecedor: Fornecedor;
  pagamentos: Array<Pagamento & { obra_nome: string | null; categoria_nome: string | null }>;
  totais: {
    valorTotal: number;
    quantidade: number;
    ticketMedio: number;
    primeiraCompra: string | null;
    ultimaCompra: string | null;
    porObra: Array<{ obra_nome: string; total: number; count: number }>;
  };
  filtros: { from: string | null; to: string | null };
}

export async function getFornecedorData(
  fornecedorId: string,
  from?: string | null,
  to?: string | null,
): Promise<FornecedorData | null> {
  const supabase = await createClient();

  const { data: fornecedor } = await supabase
    .from('fornecedores')
    .select('*')
    .eq('id', fornecedorId)
    .maybeSingle();
  if (!fornecedor) return null;

  let query = supabase
    .from('pagamentos')
    .select('*')
    .eq('fornecedor_id', fornecedorId)
    .is('deleted_at', null)
    .order('data_pagamento', { ascending: false });
  if (from) query = query.gte('data_pagamento', from);
  if (to) query = query.lte('data_pagamento', to);

  const { data: pags } = await query;
  const pagamentos = pags ?? [];

  const obraIds = [...new Set(pagamentos.map((p) => p.obra_id).filter(Boolean))];
  const catIds = [...new Set(pagamentos.map((p) => p.categoria_id).filter((v): v is string => !!v))];

  const [obrasRes, catsRes] = await Promise.all([
    obraIds.length > 0
      ? supabase.from('obras').select('id, nome').in('id', obraIds)
      : Promise.resolve({ data: [] as Array<Pick<Obra, 'id' | 'nome'>>, error: null }),
    catIds.length > 0
      ? supabase.from('categorias').select('id, nome').in('id', catIds)
      : Promise.resolve({ data: [] as Array<Pick<Categoria, 'id' | 'nome'>>, error: null }),
  ]);
  const obraMap = new Map((obrasRes.data ?? []).map((o) => [o.id, o.nome]));
  const catMap = new Map((catsRes.data ?? []).map((c) => [c.id, c.nome]));

  const pagamentosEnriched = pagamentos.map((p) => ({
    ...p,
    obra_nome: obraMap.get(p.obra_id) ?? null,
    categoria_nome: p.categoria_id ? (catMap.get(p.categoria_id) ?? null) : null,
  }));

  const valorTotal = pagamentos.reduce((acc, p) => acc + Number(p.valor), 0);
  const quantidade = pagamentos.length;
  const ticketMedio = quantidade > 0 ? valorTotal / quantidade : 0;

  const dates = pagamentos.map((p) => p.data_pagamento).sort();
  const primeiraCompra = dates[0] ?? null;
  const ultimaCompra = dates[dates.length - 1] ?? null;

  const porObraMap = new Map<string, { obra_nome: string; total: number; count: number }>();
  for (const p of pagamentos) {
    const key = p.obra_id;
    const nome = obraMap.get(key) ?? 'Obra desconhecida';
    const cur = porObraMap.get(key);
    porObraMap.set(key, {
      obra_nome: nome,
      total: (cur?.total ?? 0) + Number(p.valor),
      count: (cur?.count ?? 0) + 1,
    });
  }
  const porObra = [...porObraMap.values()].sort((a, b) => b.total - a.total);

  return {
    fornecedor,
    pagamentos: pagamentosEnriched,
    totais: { valorTotal, quantidade, ticketMedio, primeiraCompra, ultimaCompra, porObra },
    filtros: { from: from ?? null, to: to ?? null },
  };
}

// ============================================================================
// Report 4: Atividade (pagamentos + documentos criados no período)
// ============================================================================

export type AtividadeItem =
  | {
      tipo: 'pagamento';
      id: string;
      created_at: string;
      valor: number;
      obra_nome: string | null;
      fornecedor_nome: string | null;
      descricao: string | null;
      origem: 'manual' | 'whatsapp' | 'importado';
    }
  | {
      tipo: 'documento';
      id: string;
      created_at: string;
      nome_arquivo: string;
      obra_nome: string | null;
      fornecedor_nome: string | null;
      tipo_doc: string;
    };

export interface AtividadeData {
  from: string;
  to: string;
  items: AtividadeItem[];
  totais: {
    pagamentosCount: number;
    pagamentosValor: number;
    documentosCount: number;
  };
}

export async function getAtividadeData(from: string, to: string): Promise<AtividadeData> {
  const supabase = await createClient();

  const [pagRes, docRes] = await Promise.all([
    supabase
      .from('pagamentos')
      .select('id, created_at, valor, obra_id, fornecedor_id, descricao, origem')
      .gte('created_at', `${from}T00:00:00.000Z`)
      .lte('created_at', `${to}T23:59:59.999Z`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('documentos')
      .select('id, created_at, nome_arquivo, obra_id, fornecedor_id, tipo')
      .gte('created_at', `${from}T00:00:00.000Z`)
      .lte('created_at', `${to}T23:59:59.999Z`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  const pags = pagRes.data ?? [];
  const docs = docRes.data ?? [];

  const obraIds = [
    ...new Set([...pags.map((p) => p.obra_id), ...docs.map((d) => d.obra_id)].filter((v): v is string => !!v)),
  ];
  const fornIds = [
    ...new Set([
      ...pags.map((p) => p.fornecedor_id),
      ...docs.map((d) => d.fornecedor_id),
    ].filter((v): v is string => !!v)),
  ];

  const [obrasRes, fornsRes] = await Promise.all([
    obraIds.length > 0
      ? supabase.from('obras').select('id, nome').in('id', obraIds)
      : Promise.resolve({ data: [] as Array<Pick<Obra, 'id' | 'nome'>>, error: null }),
    fornIds.length > 0
      ? supabase.from('fornecedores').select('id, nome').in('id', fornIds)
      : Promise.resolve({ data: [] as Array<Pick<Fornecedor, 'id' | 'nome'>>, error: null }),
  ]);
  const obraMap = new Map((obrasRes.data ?? []).map((o) => [o.id, o.nome]));
  const fornMap = new Map((fornsRes.data ?? []).map((f) => [f.id, f.nome]));

  const items: AtividadeItem[] = [
    ...pags.map(
      (p): AtividadeItem => ({
        tipo: 'pagamento' as const,
        id: p.id,
        created_at: p.created_at ?? '',
        valor: Number(p.valor),
        obra_nome: obraMap.get(p.obra_id) ?? null,
        fornecedor_nome: p.fornecedor_id ? (fornMap.get(p.fornecedor_id) ?? null) : null,
        descricao: p.descricao,
        origem: p.origem,
      }),
    ),
    ...docs.map(
      (d): AtividadeItem => ({
        tipo: 'documento' as const,
        id: d.id,
        created_at: d.created_at ?? '',
        nome_arquivo: d.nome_arquivo,
        obra_nome: d.obra_id ? (obraMap.get(d.obra_id) ?? null) : null,
        fornecedor_nome: d.fornecedor_id ? (fornMap.get(d.fornecedor_id) ?? null) : null,
        tipo_doc: d.tipo,
      }),
    ),
  ].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

  const pagamentosValor = pags.reduce((acc, p) => acc + Number(p.valor), 0);

  return {
    from,
    to,
    items,
    totais: {
      pagamentosCount: pags.length,
      pagamentosValor,
      documentosCount: docs.length,
    },
  };
}
