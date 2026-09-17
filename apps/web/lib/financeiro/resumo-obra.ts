/**
 * A conta de resultado de uma obra, sem banco. Usada pela página da obra
 * (`lib/data/recebimentos.ts`) e pelas ferramentas do agente.
 */

export interface ResumoFinanceiroDaObra {
  /** `obras.valor_contrato`; nulo enquanto ninguém informar. */
  contrato: number | null;
  /** Soma dos pagamentos que contam (`STATUS_QUE_CONTAM`). */
  gasto: number;
  /** Soma das parcelas recebidas do cliente da obra. */
  recebido: number;
  /** recebido − gasto: o caixa real da obra até agora. */
  resultado: number;
  /** contrato − gasto: o que sobra se nada mais for gasto. Nulo sem contrato. */
  margemPrevista: number | null;
  /** gasto / contrato, em %. Nulo sem contrato. */
  percentualGastoDoContrato: number | null;
}

/** Parte pura da conta, para a ferramenta do agente e para os testes. */
export function montarResumo(n: {
  contrato: number | null;
  gasto: number;
  recebido: number;
}): ResumoFinanceiroDaObra {
  const { contrato, gasto, recebido } = n;
  return {
    contrato,
    gasto,
    recebido,
    resultado: recebido - gasto,
    margemPrevista: contrato == null ? null : contrato - gasto,
    percentualGastoDoContrato:
      contrato == null || contrato <= 0 ? null : Math.round((gasto / contrato) * 1000) / 10,
  };
}
