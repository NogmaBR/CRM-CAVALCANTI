/**
 * Núcleo puro de `scripts/arquivar-dados-do-prototipo.mjs`.
 *
 * O CNPJ de um fornecedor vem das notas fiscais dele no acervo. Uma DANFE
 * traz dois CNPJs: o do emitente (o fornecedor) e o do destinatário (o
 * cliente da obra, ou a própria construtora). O destinatário aparece nas
 * notas de VÁRIOS fornecedores; o emitente só nas de um. É esse o critério.
 */

export const CNPJ_CAVALCANTI = '30.647.314/0001-41';
export const RE_CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/gu;

/**
 * `ocorrencias` = [{ fornecedor, cnpj, docs }] (quantos documentos do
 * fornecedor têm aquele CNPJ). Devolve Map fornecedor → cnpj, só quando há
 * um candidato claro: o mais frequente, em 2+ notas ou único candidato.
 * CNPJs vistos em `minimoCompartilhado` ou mais fornecedores são de
 * destinatário e saem da conta.
 */
export function cnpjPorFornecedor(ocorrencias, opts = {}) {
  const minimoCompartilhado = opts.minimoCompartilhado ?? 3;
  const fornecedoresPorCnpj = new Map();
  for (const o of ocorrencias) {
    if (!fornecedoresPorCnpj.has(o.cnpj)) fornecedoresPorCnpj.set(o.cnpj, new Set());
    fornecedoresPorCnpj.get(o.cnpj).add(o.fornecedor);
  }
  const compartilhados = new Set(
    [...fornecedoresPorCnpj].filter(([, f]) => f.size >= minimoCompartilhado).map(([c]) => c),
  );
  compartilhados.add(CNPJ_CAVALCANTI);

  const porFornecedor = new Map();
  for (const o of ocorrencias) {
    if (compartilhados.has(o.cnpj)) continue;
    if (!porFornecedor.has(o.fornecedor)) porFornecedor.set(o.fornecedor, []);
    porFornecedor.get(o.fornecedor).push(o);
  }
  const resultado = new Map();
  for (const [f, cands] of porFornecedor) {
    cands.sort((a, b) => b.docs - a.docs);
    const [melhor, segundo] = cands;
    if (!melhor) continue;
    const claro = melhor.docs >= 2 ? !segundo || segundo.docs < melhor.docs : cands.length === 1;
    if (claro) resultado.set(f, melhor.cnpj);
  }
  return {
    porFornecedor: resultado,
    compartilhados: [...compartilhados].filter((c) => c !== CNPJ_CAVALCANTI),
  };
}
