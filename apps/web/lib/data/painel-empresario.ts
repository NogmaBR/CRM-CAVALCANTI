import 'server-only';
import {
  type Alerta,
  type DocumentoResumido,
  type EtapaDaObra,
  type LinhaCaixa,
  type LinhaFornecedor,
  type LinhaPorObra,
  type ObraResumida,
  type PagamentoResumido,
  type RecebimentoResumido,
  caixaMensal,
  etapasPorObra,
  gastoPorObra,
  matrizDeDocumentos,
  mensalPorObra,
  montarAlertas,
  ordenarObrasParaSeries,
  rankingDeFornecedores,
  somar,
  ultimosMeses,
} from '@/lib/financeiro/agregacoes';
import { logger } from '@/lib/log';
import { CATEGORIAS, CATEGORIA_LABELS, STATUS_QUE_CONTAM } from '@/lib/status-labels';
import { createClient } from '@/lib/supabase/server';
import { hojeBR } from '@/lib/util/datas';

/**
 * Dados do painel do empresário — uma função por aba, com a sessão do
 * usuário (RLS). Cada uma carrega só o que a aba mostra; as contas ficam em
 * `lib/financeiro/agregacoes.ts`, que é onde os testes estão.
 */

const log = logger('painel-empresario');

async function carregarBase() {
  const supabase = await createClient();
  const [obrasR, pagsR, recR, docsR] = await Promise.all([
    supabase
      .from('obras')
      .select('id, nome, valor_contrato, status')
      .is('deleted_at', null)
      .order('nome'),
    supabase
      .from('pagamentos')
      .select('id, obra_id, fornecedor_id, categoria_id, valor, data_pagamento')
      .in('status_pagto', [...STATUS_QUE_CONTAM])
      .is('deleted_at', null)
      .limit(5000),
    supabase
      .from('recebimentos')
      .select('obra_id, valor, data_recebimento')
      .is('deleted_at', null)
      .limit(5000),
    supabase
      .from('documentos')
      .select('obra_id, categoria, pagamento_id, created_at')
      .is('deleted_at', null)
      .limit(10000),
  ]);

  // Sem a migration 20260916230000 (valor_contrato, recebimentos) o painel
  // não pode ficar em branco: cai para as obras sem contrato e sem
  // recebimentos, com o motivo no log — é aviso, não erro silencioso.
  let linhasDeObras: Array<{
    id: string;
    nome: string;
    status: string | null;
    valor_contrato: number | string | null;
  }> = obrasR.data ?? [];
  if (obrasR.error) {
    log.erro('obras_falhou', { erro: obrasR.error.message });
    const semContrato = await supabase
      .from('obras')
      .select('id, nome, status')
      .is('deleted_at', null)
      .order('nome');
    linhasDeObras = (semContrato.data ?? []).map((o) => ({ ...o, valor_contrato: null }));
  }
  if (recR.error) log.erro('recebimentos_falhou', { erro: recR.error.message });
  if (pagsR.error) log.erro('pagamentos_falhou', { erro: pagsR.error.message });
  if (docsR.error) log.erro('documentos_falhou', { erro: docsR.error.message });

  const comDocumento = new Set((docsR.data ?? []).map((d) => d.pagamento_id).filter(Boolean));
  const obras: ObraResumida[] = linhasDeObras.map((o) => ({
    id: o.id,
    nome: o.nome,
    valor_contrato: o.valor_contrato == null ? null : Number(o.valor_contrato),
    status: o.status,
  }));
  const pagamentos: PagamentoResumido[] = (pagsR.data ?? []).map((p) => ({
    obra_id: p.obra_id,
    fornecedor_id: p.fornecedor_id,
    categoria_id: p.categoria_id,
    valor: Number(p.valor),
    data: p.data_pagamento ?? '',
    tem_documento: comDocumento.has(p.id),
  }));
  const recebimentos: RecebimentoResumido[] = (recR.data ?? []).map((r) => ({
    obra_id: r.obra_id,
    valor: Number(r.valor),
    data: r.data_recebimento,
  }));
  const documentos: DocumentoResumido[] = (docsR.data ?? []).map((d) => ({
    obra_id: d.obra_id,
    categoria: d.categoria,
    pagamento_id: d.pagamento_id,
    data: (d.created_at ?? '').slice(0, 10),
  }));
  return { supabase, obras, pagamentos, recebimentos, documentos };
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

export async function resultadoDasObras(): Promise<LinhaPorObra[]> {
  const b = await carregarBase();
  return gastoPorObra(
    b.obras.filter((o) => o.status === 'ativa'),
    b.pagamentos,
    b.recebimentos,
  );
}

// ---------------------------------------------------------------------------
// Por obra
// ---------------------------------------------------------------------------

export interface DadosPorObra {
  obras: string[];
  linhas: LinhaPorObra[];
  mensal: ReturnType<typeof mensalPorObra>;
  etapas: EtapaDaObra[];
  meses: string[];
}

export async function dadosPorObra(): Promise<DadosPorObra> {
  const b = await carregarBase();
  const { data: cats } = await b.supabase.from('categorias').select('id, nome');
  const ativas = ordenarObrasParaSeries(b.obras.filter((o) => o.status === 'ativa'));
  const meses = ultimosMeses(6, hojeBR());
  return {
    obras: ativas.map((o) => o.nome),
    linhas: gastoPorObra(ativas, b.pagamentos, b.recebimentos),
    mensal: mensalPorObra(ativas, b.pagamentos, meses),
    etapas: etapasPorObra(ativas, b.pagamentos, new Map((cats ?? []).map((c) => [c.id, c.nome]))),
    meses,
  };
}

// ---------------------------------------------------------------------------
// Fornecedores
// ---------------------------------------------------------------------------

export interface DadosFornecedores {
  ranking: LinhaFornecedor[];
  total: number;
  concentracaoTop3: number;
  incompletos: Array<{ id: string; nome: string; semTelefone: boolean; semDocumento: boolean }>;
  ano: number;
}

export async function dadosFornecedores(): Promise<DadosFornecedores> {
  const b = await carregarBase();
  const { data: forns } = await b.supabase
    .from('fornecedores')
    .select('id, nome, telefone, documento')
    .is('deleted_at', null)
    .order('nome');
  const ano = Number(hojeBR().slice(0, 4));
  const doAno = b.pagamentos.filter((p) => p.data.startsWith(String(ano)));
  const nomes = new Map((forns ?? []).map((f) => [f.id, f.nome]));
  const r = rankingDeFornecedores(doAno, nomes, 10);
  return {
    ranking: r.linhas,
    total: r.total,
    concentracaoTop3: r.concentracaoTop3,
    incompletos: (forns ?? [])
      .filter((f) => !f.telefone || !f.documento)
      .map((f) => ({
        id: f.id,
        nome: f.nome,
        semTelefone: !f.telefone,
        semDocumento: !f.documento,
      })),
    ano,
  };
}

// ---------------------------------------------------------------------------
// Caixa
// ---------------------------------------------------------------------------

export interface DadosCaixa {
  mensal: LinhaCaixa[];
  porObra: LinhaPorObra[];
  totais: { entrou: number; saiu: number; saldo: number; contratos: number; faltaReceber: number };
}

export async function dadosCaixa(): Promise<DadosCaixa> {
  const b = await carregarBase();
  const meses = ultimosMeses(12, hojeBR());
  const ativas = b.obras.filter((o) => o.status === 'ativa');
  const porObra = gastoPorObra(ativas, b.pagamentos, b.recebimentos);
  const entrou = somar(b.recebimentos.map((r) => r.valor));
  const saiu = somar(b.pagamentos.map((p) => p.valor));
  const contratos = somar(ativas.map((o) => o.valor_contrato ?? 0));
  const recebidoComContrato = somar(
    porObra.filter((l) => l.contrato != null).map((l) => l.recebido),
  );
  return {
    mensal: caixaMensal(b.pagamentos, b.recebimentos, meses),
    porObra,
    totais: {
      entrou,
      saiu,
      saldo: Math.round((entrou - saiu) * 100) / 100,
      contratos,
      faltaReceber: Math.max(0, Math.round((contratos - recebidoComContrato) * 100) / 100),
    },
  };
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export interface DadosDocumentos {
  pastas: Array<{ chave: string; rotulo: string }>;
  matriz: ReturnType<typeof matrizDeDocumentos>;
  totalDocumentos: number;
  pagamentosSemNota: { quantidade: number; total: number };
}

export async function dadosDocumentos(): Promise<DadosDocumentos> {
  const b = await carregarBase();
  const pastas = CATEGORIAS.map((c) => ({ chave: c, rotulo: CATEGORIA_LABELS[c].rotulo }));
  const semNota = b.pagamentos.filter((p) => !p.tem_documento);
  return {
    pastas,
    matriz: matrizDeDocumentos(
      b.obras.filter((o) => o.status === 'ativa'),
      b.documentos,
      pastas.map((p) => p.chave),
    ),
    totalDocumentos: b.documentos.length,
    pagamentosSemNota: { quantidade: semNota.length, total: somar(semNota.map((p) => p.valor)) },
  };
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export async function alertasDoEmpresario(): Promise<Alerta[]> {
  const b = await carregarBase();
  const hoje = hojeBR();
  const [fornsR, confR] = await Promise.all([
    b.supabase
      .from('fornecedores')
      .select('id, nome, telefone, documento')
      .is('deleted_at', null)
      .eq('ativo', true),
    b.supabase
      .from('confirmacoes_pendentes')
      .select('id', { count: 'exact', head: true })
      .eq('resolvida', false),
  ]);
  const [mesAnterior, mesAtual] = ultimosMeses(2, hoje);
  return montarAlertas({
    hoje,
    obras: b.obras,
    pagamentos: b.pagamentos,
    fornecedores: fornsR.data ?? [],
    documentos: b.documentos,
    confirmacoesAbertas: confR.count ?? 0,
    gastoMesAtual: somar(
      b.pagamentos.filter((p) => p.data.startsWith(mesAtual ?? '')).map((p) => p.valor),
    ),
    gastoMesAnterior: somar(
      b.pagamentos.filter((p) => p.data.startsWith(mesAnterior ?? '')).map((p) => p.valor),
    ),
  });
}
