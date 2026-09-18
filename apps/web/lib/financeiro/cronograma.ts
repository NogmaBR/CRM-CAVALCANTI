/**
 * Cronograma físico e orçamento por etapa — as contas, sem banco.
 *
 * Três números resumem uma obra: quanto dela está FEITA (medição física),
 * quanto do CONTRATO já saiu (financeiro) e quanto do PRAZO passou (tempo).
 * Aqui ficam as contas do primeiro e do orçado × realizado por etapa; o
 * financeiro e o tempo estão em `agregacoes.ts` (`ritmoDaObra`).
 */

export interface EtapaResumida {
  peso: number;
  percentual_concluido: number;
}

/** Avanço físico: média dos percentuais ponderada pelo peso. Nulo sem etapas. */
export function avancoFisico(etapas: readonly EtapaResumida[]): number | null {
  const vivas = etapas.filter((e) => e.peso > 0);
  if (vivas.length === 0) return null;
  const pesoTotal = vivas.reduce((a, e) => a + e.peso, 0);
  const soma = vivas.reduce((a, e) => a + e.peso * Math.min(100, Math.max(0, e.percentual_concluido)), 0);
  return Math.round((soma / pesoTotal) * 10) / 10;
}

export type LeituraDoTripe = 'obra_na_frente' | 'em_linha' | 'dinheiro_na_frente';

/**
 * Compara o físico com o financeiro. Dez pontos de folga para não gritar
 * por uma medição que atrasou uma semana.
 */
export function compararFisicoComFinanceiro(
  fisicoPct: number | null,
  financeiroPct: number | null,
): LeituraDoTripe | null {
  if (fisicoPct == null || financeiroPct == null) return null;
  const dif = fisicoPct - financeiroPct;
  if (dif >= 10) return 'obra_na_frente';
  if (dif <= -10) return 'dinheiro_na_frente';
  return 'em_linha';
}

/** A frase do tripé físico × financeiro × prazo, pronta para a tela. */
export function fraseDoTripe(e: {
  fisicoPct: number | null;
  financeiroPct: number | null;
  prazoPct: number | null;
}): string {
  if (e.fisicoPct == null) {
    return 'Sem medição ainda. Cadastre as etapas e informe o % concluído de cada uma (ou mande no grupo: "laje 100%").';
  }
  const fisico = `${Math.round(e.fisicoPct)}% da obra executada`;
  const partes = [fisico];
  if (e.financeiroPct != null) partes.push(`${Math.round(e.financeiroPct)}% do contrato gasto`);
  if (e.prazoPct != null) partes.push(`${Math.min(100, Math.round(e.prazoPct))}% do prazo usado`);
  const leitura = compararFisicoComFinanceiro(e.fisicoPct, e.financeiroPct);
  const fecho =
    leitura === 'obra_na_frente'
      ? 'A obra avança mais rápido que o dinheiro sai — bom sinal.'
      : leitura === 'dinheiro_na_frente'
        ? 'O dinheiro está saindo mais rápido que a obra avança — vale conferir o orçado por etapa.'
        : leitura === 'em_linha'
          ? 'Execução e gasto andam juntos.'
          : 'Informe o contrato para comparar com o gasto.';
  return `${partes.join(', ')}. ${fecho}`;
}

// ---------------------------------------------------------------------------
// Orçado × realizado por etapa (categoria)
// ---------------------------------------------------------------------------

export interface OrcamentoResumido {
  categoria_id: string;
  valor: number;
}

export type SituacaoDaEtapa = 'ok' | 'atencao' | 'estourado' | 'sem_orcado';

export interface LinhaOrcadoRealizado {
  categoria_id: string;
  categoria: string;
  orcado: number | null;
  realizado: number;
  /** orçado − realizado; negativo quando estourou. Nulo sem orçado. */
  saldo: number | null;
  /** realizado / orçado em %. Nulo sem orçado. */
  pct: number | null;
  situacao: SituacaoDaEtapa;
}

/** Acima de 90% do orçado é atenção; acima de 100% estourou. */
export function situacaoDaEtapa(orcado: number | null, realizado: number): SituacaoDaEtapa {
  if (orcado == null || orcado <= 0) return 'sem_orcado';
  if (realizado > orcado) return 'estourado';
  if (realizado >= orcado * 0.9) return 'atencao';
  return 'ok';
}

/**
 * Uma linha por categoria que tem orçado OU gasto. Ordem: estouradas
 * primeiro, depois por orçado (maior em cima), depois as sem orçado por
 * gasto. Valores em centavos inteiros no meio da conta.
 */
export function orcadoVsRealizado(
  orcamentos: readonly OrcamentoResumido[],
  gastoPorCategoria: ReadonlyMap<string, number>,
  nomes: ReadonlyMap<string, string>,
): { linhas: LinhaOrcadoRealizado[]; totais: { orcado: number; realizado: number; estouradas: number } } {
  const ids = new Set<string>([
    ...orcamentos.map((o) => o.categoria_id),
    ...gastoPorCategoria.keys(),
  ]);
  const orcadoDe = new Map(orcamentos.map((o) => [o.categoria_id, o.valor]));
  const linhas: LinhaOrcadoRealizado[] = [...ids].map((id) => {
    const orcado = orcadoDe.get(id) ?? null;
    const realizado = Math.round((gastoPorCategoria.get(id) ?? 0) * 100) / 100;
    const situacao = situacaoDaEtapa(orcado, realizado);
    return {
      categoria_id: id,
      categoria: nomes.get(id) ?? 'Sem etapa',
      orcado,
      realizado,
      saldo: orcado == null ? null : Math.round((orcado - realizado) * 100) / 100,
      pct: orcado == null || orcado <= 0 ? null : Math.round((realizado / orcado) * 1000) / 10,
      situacao,
    };
  });
  const ordem: Record<SituacaoDaEtapa, number> = { estourado: 0, atencao: 1, ok: 1, sem_orcado: 2 };
  linhas.sort((a, b) => {
    const d = ordem[a.situacao] - ordem[b.situacao];
    if (d !== 0) return d;
    return (b.orcado ?? b.realizado) - (a.orcado ?? a.realizado);
  });
  return {
    linhas,
    totais: {
      orcado: Math.round(orcamentos.reduce((a, o) => a + o.valor * 100, 0)) / 100,
      realizado: Math.round(linhas.reduce((a, l) => a + l.realizado * 100, 0)) / 100,
      estouradas: linhas.filter((l) => l.situacao === 'estourado').length,
    },
  };
}
