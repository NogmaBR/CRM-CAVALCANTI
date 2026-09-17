/**
 * As contas do painel do empresário, sem banco.
 *
 * Tudo aqui recebe listas simples (pagamentos, recebimentos, documentos) e
 * devolve o que o gráfico ou a tabela mostra. É a parte que erra — e a que
 * se testa. O acesso ao Supabase fica em `lib/data/painel-empresario.ts`.
 *
 * Datas são strings `AAAA-MM-DD`; meses, `AAAA-MM`. Somas em centavos
 * inteiros para não acumular erro de ponto flutuante.
 */

export interface PagamentoResumido {
  obra_id: string | null;
  fornecedor_id: string | null;
  categoria_id: string | null;
  valor: number;
  data: string;
  tem_documento?: boolean;
}

export interface RecebimentoResumido {
  obra_id: string;
  valor: number;
  data: string;
}

export interface ObraResumida {
  id: string;
  nome: string;
  valor_contrato: number | null;
  status?: string | null;
}

const MESES_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

export function somar(valores: readonly number[]): number {
  return valores.reduce((acc, v) => acc + Math.round(v * 100), 0) / 100;
}

/** `2026-09` → "set/26". */
export function rotuloDoMes(mes: string): string {
  const [y, m] = mes.split('-');
  const i = Number(m) - 1;
  return `${MESES_PT[i] ?? m}/${(y ?? '').slice(2)}`;
}

/** Os últimos `n` meses terminando no mês de `hoje` (AAAA-MM-DD), mais antigo primeiro. */
export function ultimosMeses(n: number, hoje: string): string[] {
  const [y, m] = hoje.split('-').map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC((y ?? 2026) as number, ((m ?? 1) as number) - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Ordem fixa das obras para a cor da série: alfabética pelo nome, não pelo ranking. */
export function ordenarObrasParaSeries<T extends { nome: string }>(obras: readonly T[]): T[] {
  return [...obras].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// ---------------------------------------------------------------------------
// Por obra
// ---------------------------------------------------------------------------

export interface LinhaPorObra {
  obra_id: string;
  obra: string;
  gasto: number;
  recebido: number;
  contrato: number | null;
  resultado: number;
  margem_prevista: number | null;
  pagamentos: number;
}

export function gastoPorObra(
  obras: readonly ObraResumida[],
  pagamentos: readonly PagamentoResumido[],
  recebimentos: readonly RecebimentoResumido[],
): LinhaPorObra[] {
  return ordenarObrasParaSeries(obras).map((o) => {
    const ps = pagamentos.filter((p) => p.obra_id === o.id);
    const gasto = somar(ps.map((p) => p.valor));
    const recebido = somar(recebimentos.filter((r) => r.obra_id === o.id).map((r) => r.valor));
    return {
      obra_id: o.id,
      obra: o.nome,
      gasto,
      recebido,
      contrato: o.valor_contrato,
      resultado: Math.round((recebido - gasto) * 100) / 100,
      margem_prevista:
        o.valor_contrato == null ? null : Math.round((o.valor_contrato - gasto) * 100) / 100,
      pagamentos: ps.length,
    };
  });
}

/** Uma linha por mês; uma coluna por obra (pelo nome), para barras empilhadas. */
export function mensalPorObra(
  obras: readonly ObraResumida[],
  pagamentos: readonly PagamentoResumido[],
  meses: readonly string[],
): Array<{ mes: string; label: string; total: number } & Record<string, number | string>> {
  const ordenadas = ordenarObrasParaSeries(obras);
  return meses.map((mes) => {
    const linha: Record<string, number | string> = { mes, label: rotuloDoMes(mes) };
    let total = 0;
    for (const o of ordenadas) {
      const v = somar(
        pagamentos.filter((p) => p.obra_id === o.id && p.data.startsWith(mes)).map((p) => p.valor),
      );
      linha[o.nome] = v;
      total += v;
    }
    linha.total = Math.round(total * 100) / 100;
    return linha as { mes: string; label: string; total: number } & Record<string, number | string>;
  });
}

export interface EtapaDaObra {
  obra: string;
  etapas: Array<{ etapa: string; total: number; pct: number }>;
  total: number;
}

export function etapasPorObra(
  obras: readonly ObraResumida[],
  pagamentos: readonly PagamentoResumido[],
  nomeDaCategoria: ReadonlyMap<string, string>,
  limite = 5,
): EtapaDaObra[] {
  return ordenarObrasParaSeries(obras).map((o) => {
    const ps = pagamentos.filter((p) => p.obra_id === o.id);
    const total = somar(ps.map((p) => p.valor));
    const mapa = new Map<string, number>();
    for (const p of ps) {
      const etapa = (p.categoria_id && nomeDaCategoria.get(p.categoria_id)) || 'Sem etapa';
      mapa.set(etapa, (mapa.get(etapa) ?? 0) + Math.round(p.valor * 100));
    }
    const etapas = [...mapa.entries()]
      .map(([etapa, cent]) => ({
        etapa,
        total: cent / 100,
        pct: total > 0 ? Math.round((cent / 100 / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limite);
    return { obra: o.nome, etapas, total };
  });
}

// ---------------------------------------------------------------------------
// Fornecedores
// ---------------------------------------------------------------------------

export interface LinhaFornecedor {
  fornecedor_id: string;
  fornecedor: string;
  total: number;
  pagamentos: number;
  pct: number;
  ultimo: string | null;
}

export function rankingDeFornecedores(
  pagamentos: readonly PagamentoResumido[],
  nomeDoFornecedor: ReadonlyMap<string, string>,
  limite = 10,
): { linhas: LinhaFornecedor[]; total: number; concentracaoTop3: number } {
  const total = somar(pagamentos.map((p) => p.valor));
  const mapa = new Map<string, { cent: number; n: number; ultimo: string | null }>();
  for (const p of pagamentos) {
    if (!p.fornecedor_id) continue;
    const cur = mapa.get(p.fornecedor_id) ?? { cent: 0, n: 0, ultimo: null };
    cur.cent += Math.round(p.valor * 100);
    cur.n += 1;
    if (!cur.ultimo || p.data > cur.ultimo) cur.ultimo = p.data;
    mapa.set(p.fornecedor_id, cur);
  }
  const todas = [...mapa.entries()]
    .map(([id, v]) => ({
      fornecedor_id: id,
      fornecedor: nomeDoFornecedor.get(id) ?? 'Fornecedor removido',
      total: v.cent / 100,
      pagamentos: v.n,
      pct: total > 0 ? Math.round((v.cent / 100 / total) * 1000) / 10 : 0,
      ultimo: v.ultimo,
    }))
    .sort((a, b) => b.total - a.total);
  const top3 = somar(todas.slice(0, 3).map((l) => l.total));
  return {
    linhas: todas.slice(0, limite),
    total,
    concentracaoTop3: total > 0 ? Math.round((top3 / total) * 1000) / 10 : 0,
  };
}

// ---------------------------------------------------------------------------
// Caixa
// ---------------------------------------------------------------------------

export interface LinhaCaixa {
  mes: string;
  label: string;
  entrou: number;
  saiu: number;
  saldo: number;
  acumulado: number;
}

export function caixaMensal(
  pagamentos: readonly PagamentoResumido[],
  recebimentos: readonly RecebimentoResumido[],
  meses: readonly string[],
): LinhaCaixa[] {
  let acumulado = 0;
  return meses.map((mes) => {
    const saiu = somar(pagamentos.filter((p) => p.data.startsWith(mes)).map((p) => p.valor));
    const entrou = somar(recebimentos.filter((r) => r.data.startsWith(mes)).map((r) => r.valor));
    const saldo = Math.round((entrou - saiu) * 100) / 100;
    acumulado = Math.round((acumulado + saldo) * 100) / 100;
    return { mes, label: rotuloDoMes(mes), entrou, saiu, saldo, acumulado };
  });
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export interface DocumentoResumido {
  obra_id: string | null;
  categoria: string | null;
  pagamento_id?: string | null;
  data: string;
}

export function matrizDeDocumentos(
  obras: readonly ObraResumida[],
  documentos: readonly DocumentoResumido[],
  pastas: readonly string[],
): {
  linhas: Array<{ obra: string; porPasta: Record<string, number>; total: number }>;
  maximo: number;
} {
  let maximo = 0;
  const linhas = ordenarObrasParaSeries(obras).map((o) => {
    const porPasta: Record<string, number> = {};
    let total = 0;
    for (const pasta of pastas) {
      const n = documentos.filter(
        (d) => d.obra_id === o.id && (d.categoria ?? 'outro') === pasta,
      ).length;
      porPasta[pasta] = n;
      total += n;
      if (n > maximo) maximo = n;
    }
    return { obra: o.nome, porPasta, total };
  });
  return { linhas, maximo };
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export interface Alerta {
  chave: string;
  gravidade: 'alta' | 'media' | 'baixa';
  numero: number;
  titulo: string;
  explicacao: string;
  href: string;
  acao: string;
}

export interface EntradaDeAlertas {
  hoje: string;
  obras: readonly ObraResumida[];
  pagamentos: readonly PagamentoResumido[];
  fornecedores: readonly {
    id: string;
    nome: string;
    telefone: string | null;
    documento: string | null;
  }[];
  documentos: readonly DocumentoResumido[];
  confirmacoesAbertas: number;
  gastoMesAtual: number;
  gastoMesAnterior: number;
}

function diasEntre(a: string, b: string): number {
  return Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function montarAlertas(e: EntradaDeAlertas): Alerta[] {
  const alertas: Alerta[] = [];

  const semNota = e.pagamentos.filter((p) => !p.tem_documento && diasEntre(p.data, e.hoje) > 7);
  if (semNota.length > 0) {
    alertas.push({
      chave: 'sem_nota',
      gravidade: 'alta',
      numero: semNota.length,
      titulo: `${semNota.length} ${semNota.length === 1 ? 'pagamento' : 'pagamentos'} sem nota há mais de 7 dias`,
      explicacao: `Somam ${brl(somar(semNota.map((p) => p.valor)))}. Sem a nota, não dá para comprovar o gasto.`,
      href: '/pendentes',
      acao: 'Ver quais',
    });
  }

  if (e.confirmacoesAbertas > 0) {
    alertas.push({
      chave: 'confirmacoes',
      gravidade: 'alta',
      numero: e.confirmacoesAbertas,
      titulo: `${e.confirmacoesAbertas} ${e.confirmacoesAbertas === 1 ? 'mensagem esperando' : 'mensagens esperando'} confirmação`,
      explicacao: 'Chegaram pelo WhatsApp e ninguém respondeu SIM ainda.',
      href: '/pendentes',
      acao: 'Confirmar',
    });
  }

  const semContrato = e.obras.filter((o) => o.valor_contrato == null);
  if (semContrato.length > 0) {
    alertas.push({
      chave: 'sem_contrato',
      gravidade: 'media',
      numero: semContrato.length,
      titulo: `${semContrato.length} ${semContrato.length === 1 ? 'obra' : 'obras'} sem valor de contrato`,
      explicacao: `${semContrato.map((o) => o.nome).join(', ')}. Sem o contrato, o painel não calcula o lucro.`,
      href: '/obras',
      acao: 'Informar',
    });
  }

  if (e.gastoMesAnterior > 0 && e.gastoMesAtual > e.gastoMesAnterior * 1.3) {
    const pct = Math.round(((e.gastoMesAtual - e.gastoMesAnterior) / e.gastoMesAnterior) * 100);
    alertas.push({
      chave: 'mes_acima',
      gravidade: 'media',
      numero: pct,
      titulo: `Este mês está ${pct}% acima do mês passado`,
      explicacao: `${brl(e.gastoMesAtual)} contra ${brl(e.gastoMesAnterior)}. Pode ser normal — vale olhar.`,
      href: '/painel?aba=por-obra',
      acao: 'Ver por obra',
    });
  }

  const semTelefone = e.fornecedores.filter((f) => !f.telefone);
  if (semTelefone.length > 0) {
    alertas.push({
      chave: 'fornecedor_sem_telefone',
      gravidade: 'baixa',
      numero: semTelefone.length,
      titulo: `${semTelefone.length} ${semTelefone.length === 1 ? 'fornecedor' : 'fornecedores'} sem telefone`,
      explicacao: 'A cobrança automática de nota só funciona para quem tem telefone.',
      href: '/fornecedores',
      acao: 'Completar',
    });
  }

  const semFotoRecente = e.obras.filter((o) => {
    if (o.status && o.status !== 'ativa') return false;
    const fotos = e.documentos.filter((d) => d.obra_id === o.id && d.categoria === 'fotos');
    const ultima = fotos
      .map((d) => d.data)
      .sort()
      .at(-1);
    return !ultima || diasEntre(ultima, e.hoje) > 30;
  });
  if (semFotoRecente.length > 0) {
    alertas.push({
      chave: 'sem_foto',
      gravidade: 'baixa',
      numero: semFotoRecente.length,
      titulo: `${semFotoRecente.length} ${semFotoRecente.length === 1 ? 'obra' : 'obras'} sem foto nova há 30 dias`,
      explicacao: `${semFotoRecente.map((o) => o.nome).join(', ')}. Peça uma foto no grupo para acompanhar o andamento.`,
      href: '/documentos?categoria=fotos',
      acao: 'Ver fotos',
    });
  }

  const ordem = { alta: 0, media: 1, baixa: 2 };
  return alertas.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
}

export function brl(n: number): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/** "134 mil", "1,2 milhões" — para a frase de leitura. */
export function porExtensoCurto(n: number): string {
  const abs = Math.abs(n);
  const sinal = n < 0 ? '−' : '';
  if (abs >= 1_000_000) {
    const m = Math.round((abs / 1_000_000) * 10) / 10;
    return `${sinal}${m.toLocaleString('pt-BR')} ${m === 1 ? 'milhão' : 'milhões'}`;
  }
  if (abs >= 1_000) return `${sinal}${Math.round(abs / 1_000).toLocaleString('pt-BR')} mil`;
  return `${sinal}${Math.round(abs).toLocaleString('pt-BR')} reais`;
}
