/**
 * Núcleo puro de `scripts/lancar-pagamentos-do-acervo.mjs`: transforma as
 * planilhas "Controle Financeiro" do cliente (uma por obra, no acervo) em
 * lançamentos de `pagamentos`, e casa cada nota/comprovante do acervo com o
 * lançamento correspondente. Sem rede, sem banco — tudo testável.
 *
 * A planilha do cliente tem uma aba com o extrato da obra:
 *
 *   ITEM | ETAPA | DATA | FORNECEDOR | DESCRIÇÃO | VALOR | PAGAMENTO | ADM | OBS
 *
 * - ETAPA é a conta do plano de contas dele (ADMINISTRAÇÃO, ESTRUTURA, REBOCO…),
 *   e vira `categorias.nome` — o CRM passa a falar a língua do cliente.
 * - PAGAMENTO é `OK`, `CO` (caixa de obra), `EM ABERTO` ou vazio. Só
 *   `EM ABERTO` é pendente; o resto está pago.
 * - ADM é a taxa de administração calculada sobre o item (não é pagamento).
 * - Linhas numeradas sem VALOR (ex.: "ADM - jan/26" em obra onde a taxa é
 *   medida por mês) não são lançamentos: ficam no relatório, não no banco.
 *
 * As notas do acervo têm nome `AA.MM.DD - Descrição - Fornecedor.ext`: a data
 * e o fornecedor do nome, mais a obra da pasta, identificam a linha da
 * planilha. Quando sobra mais de uma candidata, desempata pela descrição;
 * se ainda sobrar, não liga — o gestor resolve em `/pendentes`.
 */

import { normalizarNome } from './importar-onedrive-core.mjs';

// ---------------------------------------------------------------------------
// Fornecedores: a mesma pessoa aparece com grafias diferentes entre obras.
// A chave é o nome normalizado; a tabela mapeia grafias para o nome canônico.
// ---------------------------------------------------------------------------

const ALIAS_FORNECEDOR = new Map([
  ['ferragem mathias velho', 'Mathias Velho'],
  ['mathias velho', 'Mathias Velho'],
  ['md solucoes', 'MD Soluções Hidráulicas'],
  ['md solucoes hidraulicas', 'MD Soluções Hidráulicas'],
  ['az entulho', 'Az Entulho'],
  ['azentulho', 'Az Entulho'],
  ['cigame', 'CIGAME'],
  ['eng fernando', 'Fernando Cavalcanti'],
  ['fernando cavalcanti', 'Fernando Cavalcanti'],
]);

export function chaveFornecedor(nome) {
  const n = normalizarNome(nome);
  const canonico = ALIAS_FORNECEDOR.get(n);
  return canonico ? normalizarNome(canonico) : n;
}

export function nomeCanonicoFornecedor(nome) {
  const n = normalizarNome(nome);
  return ALIAS_FORNECEDOR.get(n) ?? String(nome).replace(/\s+/gu, ' ').trim();
}

// ---------------------------------------------------------------------------
// Categorias: ETAPA da planilha → nome de categoria no CRM.
// Quatro contas já existiam com outro nome; as demais entram como o cliente
// escreve, em caixa normal.
// ---------------------------------------------------------------------------

const CATEGORIA_POR_ETAPA = new Map([
  ['instalacoes eletricas', 'Elétrica'],
  ['instalacoes hidrossanitarias', 'Hidráulica'],
  ['limpeza', 'Limpeza'],
  ['outros', 'Outros'],
  ['administracao', 'Administração'],
  ['projeto', 'Projeto'],
  ['terraplanagem', 'Terraplanagem'],
  ['servicos iniciais', 'Serviços iniciais'],
  ['estrutura vigas pilares e lajes', 'Estrutura (vigas, pilares e lajes)'],
  ['alvenaria', 'Alvenaria'],
  ['impermeabilizacao', 'Impermeabilização'],
  ['reboco', 'Reboco'],
  ['cobertura', 'Cobertura'],
  ['revestimentos', 'Revestimentos'],
  ['gesso', 'Gesso'],
  ['pintura', 'Pintura'],
  ['vestiario', 'Vestiário'],
  ['ar condicionado', 'Ar condicionado'],
  ['esquadrias', 'Esquadrias'],
]);

/** Plano de contas padrão do cliente (aba "Resumo"), para existir inteiro no CRM. */
export const PLANO_DE_CONTAS = [...new Set(CATEGORIA_POR_ETAPA.values())];

export function categoriaDaEtapa(etapa) {
  const n = normalizarNome(etapa);
  if (!n) return 'Outros';
  const conhecida = CATEGORIA_POR_ETAPA.get(n);
  if (conhecida) return conhecida;
  const limpo = String(etapa).replace(/\s+/gu, ' ').trim();
  return limpo.charAt(0).toUpperCase() + limpo.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Planilha → lançamentos
// ---------------------------------------------------------------------------

const CABECALHO = [
  'item',
  'etapa',
  'data',
  'fornecedor',
  'descricao',
  'valor',
  'pagamento',
  'adm',
  'obs',
];

function ehCabecalho(linha) {
  const c = (linha ?? []).slice(0, 6).map((x) => normalizarNome(x));
  return c[0] === 'item' && c[2] === 'data' && c[5] === 'valor';
}

/** Aba certa = a que tem o cabeçalho do extrato. `abas` = { nome: linhas[][] }. */
export function localizarExtrato(abas) {
  for (const [nome, linhas] of Object.entries(abas)) {
    const i = linhas.findIndex(ehCabecalho);
    if (i >= 0) return { aba: nome, cabecalhoEm: i, linhas };
  }
  return null;
}

/** Serial do Excel (dias desde 1899-12-30, sistema 1900) → `YYYY-MM-DD`, sem fuso. */
export function serialExcelParaData(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial) || serial < 1) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** `data` pode ser serial do Excel, Date, `YYYY-MM-DD` ou `dd/mm/aa`. */
function dataIso(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return serialExcelParaData(v);
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/u);
  if (br) {
    const ano = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return null;
}

function numero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  const s = String(v).replace(/[R$\s]/gu, '');
  if (!s) return null;
  // "1.234,56" (pt-BR) ou "1,234.56" (en)
  const ptbr = /^-?\d{1,3}(\.\d{3})*(,\d+)?$/u.test(s) || /^-?\d+(,\d+)$/u.test(s);
  const n = Number(ptbr ? s.replace(/\./gu, '').replace(',', '.') : s.replace(/,/gu, ''));
  return Number.isFinite(n) ? n : null;
}

export function statusDoPagamento(coluna) {
  const n = normalizarNome(coluna);
  if (n === 'em aberto' || n === 'pendente' || n === 'aberto') return 'aguardando';
  return 'confirmado';
}

/**
 * Lê o extrato e devolve `{ lancamentos, ignoradas }`. Cada lançamento traz
 * o que o banco precisa mais a origem (arquivo + item) para idempotência.
 */
export function lerExtrato(abas, arquivo) {
  const ext = localizarExtrato(abas);
  if (!ext)
    return { lancamentos: [], ignoradas: [], erro: 'sem aba com cabeçalho ITEM/DATA/VALOR' };
  const lancamentos = [];
  const ignoradas = [];
  for (const linha of ext.linhas.slice(ext.cabecalhoEm + 1)) {
    const l = Object.fromEntries(CABECALHO.map((c, i) => [c, linha?.[i] ?? null]));
    const item = numero(l.item);
    if (item == null) continue; // totais, "Resumo ADM", linhas em branco
    const valor = numero(l.valor);
    const data = dataIso(l.data);
    const fornecedor = String(l.fornecedor ?? '')
      .replace(/\s+/gu, ' ')
      .trim();
    const descricao = String(l.descricao ?? '')
      .replace(/\s+/gu, ' ')
      .trim();
    if (!data && !fornecedor && !descricao && valor == null) continue; // linha numerada vazia
    if (valor == null || valor === 0 || !data) {
      ignoradas.push({
        item,
        data,
        fornecedor,
        descricao,
        valor,
        motivo: valor == null || valor === 0 ? 'sem valor' : 'sem data',
      });
      continue;
    }
    const adm = numero(l.adm);
    lancamentos.push({
      chave: `planilha: ${arquivo} item ${item}`,
      item,
      etapa: String(l.etapa ?? '').trim(),
      categoria: categoriaDaEtapa(l.etapa),
      data,
      fornecedor: fornecedor ? nomeCanonicoFornecedor(fornecedor) : null,
      descricao: descricao || (fornecedor ? `Pagamento a ${fornecedor}` : 'Lançamento da planilha'),
      valor: Math.round(valor * 100) / 100,
      status: statusDoPagamento(l.pagamento),
      pagamento: String(l.pagamento ?? '').trim() || null,
      adm: adm == null ? null : Math.round(adm * 100) / 100,
      obs: String(l.obs ?? '').trim() || null,
    });
  }
  return { lancamentos, ignoradas, aba: ext.aba };
}

/** Texto de `pagamentos.observacoes`: a origem primeiro (é a chave de idempotência). */
export function observacoesDe(l) {
  const partes = [l.chave];
  if (l.pagamento) partes.push(`pagamento: ${l.pagamento}`);
  if (l.adm != null) partes.push(`adm: ${l.adm.toFixed(2)}`);
  if (l.etapa && l.etapa !== l.categoria) partes.push(`etapa: ${l.etapa}`);
  if (l.obs) partes.push(`obs: ${l.obs}`);
  return partes.join(' | ');
}

// ---------------------------------------------------------------------------
// Notas do acervo → lançamento
// ---------------------------------------------------------------------------

/** `26.03.10 - Limpeza (entrada) - Maximiliano.jpeg` → { data, descricao, fornecedor }. */
export function lerNomeDaNota(nome) {
  const semExt = String(nome).replace(/\.[A-Za-z0-9]{1,5}$/u, '');
  const m = semExt.match(/^(\d{2})\.(\d{2})\.(\d{2})\s+-\s+(.+)$/u);
  if (!m) return null;
  const data = `20${m[1]}-${m[2]}-${m[3]}`;
  const resto = m[4];
  const corte = resto.lastIndexOf(' - ');
  if (corte < 0) return { data, descricao: resto.trim(), fornecedor: null };
  return {
    data,
    descricao: resto.slice(0, corte).trim(),
    fornecedor: resto.slice(corte + 3).trim(),
  };
}

/**
 * "Max" ≈ "Maximiliano", "Silvio Bittencourt" ≈ "Silvio Andre Bittencourt",
 * "Engegraf" ≈ "Engegraf Plotagem": os tokens de um estão no outro, ou o
 * primeiro token de um é prefixo (3+ letras) do primeiro token do outro.
 */
export function fornecedorParece(a, b) {
  if (!a || !b) return false;
  const ta = normalizarNome(nomeCanonicoFornecedor(a)).split(' ').filter(Boolean);
  const tb = normalizarNome(nomeCanonicoFornecedor(b)).split(' ').filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return false;
  const subconjunto = (x, y) => x.every((t) => y.includes(t));
  if (subconjunto(ta, tb) || subconjunto(tb, ta)) return true;
  const [pa] = ta;
  const [pb] = tb;
  const menor = pa.length <= pb.length ? pa : pb;
  const maior = pa.length <= pb.length ? pb : pa;
  return menor.length >= 3 && maior.startsWith(menor);
}

function diasEntre(a, b) {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

function tokens(s) {
  return new Set(
    normalizarNome(s)
      .split(' ')
      .filter((t) => t.length > 2),
  );
}

function sobreposicao(a, b) {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let n = 0;
  for (const t of ta) if (tb.has(t)) n += 1;
  return n / Math.min(ta.size, tb.size);
}

/**
 * Escolhe o lançamento de uma nota entre os da mesma obra. Puro.
 * Critérios, do mais forte ao mais fraco: data igual (até 3 dias), mesmo
 * fornecedor, descrição parecida. Devolve `{ lancamento, motivo }` ou
 * `{ lancamento: null, motivo }`.
 */
export function casarNota(nota, lancamentosDaObra, opts = {}) {
  const janela = opts.janelaDias ?? 3;
  const nomeLido = lerNomeDaNota(nota.nome);
  if (!nomeLido) return { lancamento: null, motivo: 'nome fora do padrão' };

  let cands = lancamentosDaObra.filter((l) => diasEntre(l.data, nomeLido.data) <= janela);
  if (cands.length === 0) return { lancamento: null, motivo: 'sem lançamento na data' };

  // Valor lido do documento é prova, e veta: nota de R$ 9.800 não é o
  // lançamento de R$ 190 do mesmo dia, por mais que o nome combine.
  const temValor = typeof nota.valor === 'number';
  if (temValor) {
    cands = cands.filter((l) => Math.abs(l.valor - nota.valor) <= 0.011);
    if (cands.length === 0)
      return { lancamento: null, motivo: 'valor não bate com nenhum lançamento da data' };
  }

  if (nomeLido.fornecedor) {
    const chave = chaveFornecedor(nomeLido.fornecedor);
    const mesmo = cands.filter((l) => l.fornecedor && chaveFornecedor(l.fornecedor) === chave);
    const parecido =
      mesmo.length > 0
        ? mesmo
        : cands.filter((l) => fornecedorParece(l.fornecedor, nomeLido.fornecedor));
    if (parecido.length > 0) cands = parecido;
  }
  if (cands.length === 1)
    return {
      lancamento: cands[0],
      motivo: temValor ? 'data + valor + fornecedor' : 'data + fornecedor',
    };

  // Data exata antes de olhar descrição.
  const exatas = cands.filter((l) => l.data === nomeLido.data);
  if (exatas.length === 1) return { lancamento: exatas[0], motivo: 'data exata + fornecedor' };
  if (exatas.length > 1) cands = exatas;

  const pontuados = cands
    .map((l) => ({ l, p: sobreposicao(l.descricao, nomeLido.descricao) }))
    .sort((a, b) => b.p - a.p);
  const melhor = pontuados[0];
  const segundo = pontuados[1];
  if (melhor && melhor.p > 0 && (!segundo || segundo.p < melhor.p)) {
    return { lancamento: melhor.l, motivo: 'descrição' };
  }
  return { lancamento: null, motivo: `ambíguo (${cands.length} candidatos)` };
}
