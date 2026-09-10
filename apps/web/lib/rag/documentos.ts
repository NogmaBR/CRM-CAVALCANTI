import 'server-only';
import { createHash } from 'node:crypto';

/**
 * Como um registro do CRM vira texto indexável.
 *
 * ## O texto é escrito para ser encontrado, não para ser lido
 *
 * A busca compara o *significado* da pergunta com o do trecho. Então o texto
 * precisa conter as palavras que a pessoa usaria ao perguntar — e não a
 * abreviação que caberia numa tabela.
 *
 * Um pagamento vira "Pagamento de R$ 3.450,00 para o fornecedor Mathias Velho
 * na obra Garibaldi, em 10/01/2026, categoria Material, descrição Cimento
 * CP-II" e não "3450|mathias|garibaldi|2026-01-10". A segunda forma é menor e
 * casa com quase nada: ninguém pergunta em pipe.
 *
 * Pelo mesmo motivo as datas aparecem por extenso além do número — "janeiro de
 * 2026" é como a pergunta vem, e "2026-01-10" é como o banco guarda.
 */

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export interface DocumentoIndexavel {
  origem: 'pagamento' | 'obra' | 'fornecedor' | 'documento';
  origemId: string;
  obraId: string | null;
  titulo: string;
  conteudo: string;
  hash: string;
}

/**
 * Valor em reais, com espaço **normal**.
 *
 * `toLocaleString` devolve "R$ 3.450,00" — com espaço não separável entre
 * o símbolo e o número. Quem digita a pergunta no WhatsApp usa espaço comum, e
 * os dois são caracteres diferentes.
 *
 * Para o embedding a diferença provavelmente se dilui na tokenização; para
 * qualquer comparação de texto, não. Normalizar aqui custa nada e evita uma
 * classe inteira de "está lá mas não encontra".
 */
function moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /gu, ' ');
}

/** "10/01/2026 (janeiro de 2026)" — o número e a forma como se pergunta. */
function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  const m = Number(mes);
  if (!ano || !mes || !dia || Number.isNaN(m) || m < 1 || m > 12) return iso;
  return `${dia}/${mes}/${ano} (${MESES[m - 1]} de ${ano})`;
}

function hashDe(conteudo: string): string {
  return createHash('sha256').update(conteudo, 'utf8').digest('hex').slice(0, 32);
}

export interface PagamentoParaIndexar {
  id: string;
  valor: number;
  data_pagamento: string;
  descricao: string | null;
  observacoes: string | null;
  status_pagto: string;
  origem: string;
  obra: { id: string; nome: string } | null;
  fornecedor: { nome: string } | null;
  categoria: { nome: string } | null;
}

export function pagamentoParaDocumento(p: PagamentoParaIndexar): DocumentoIndexavel {
  const partes = [
    `Pagamento de ${moeda(p.valor)}`,
    p.fornecedor ? `para o fornecedor ${p.fornecedor.nome}` : 'sem fornecedor identificado',
    p.obra ? `na obra ${p.obra.nome}` : null,
    `em ${dataPorExtenso(p.data_pagamento)}`,
    p.categoria ? `categoria ${p.categoria.nome}` : null,
    p.descricao ? `descrição: ${p.descricao}` : null,
    `situação: ${p.status_pagto}`,
    p.origem === 'whatsapp' ? 'lançado pelo WhatsApp' : null,
    p.observacoes ? `observações: ${p.observacoes}` : null,
  ].filter(Boolean);

  const conteudo = `${partes.join(', ')}.`;

  const titulo = [
    p.descricao ?? 'Pagamento',
    p.fornecedor ? `— ${p.fornecedor.nome}` : null,
    p.obra ? `(${p.obra.nome})` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    origem: 'pagamento',
    origemId: p.id,
    obraId: p.obra?.id ?? null,
    titulo: titulo.slice(0, 200),
    conteudo,
    hash: hashDe(conteudo),
  };
}

export interface ObraParaIndexar {
  id: string;
  nome: string;
  cliente: string | null;
  tipo: string | null;
  status: string | null;
  orcamento: number | null;
  data_inicio: string | null;
  totalGasto: number;
  qtdPagamentos: number;
}

/**
 * A obra vira um resumo com os agregados já calculados.
 *
 * O agregado entra no texto de propósito: "quanto já gastei na Garibaldi" é
 * exatamente o tipo de pergunta que se faz, e sem isso a busca traria os
 * pagamentos um a um e a soma ficaria por conta do modelo — que é onde a
 * conta erra.
 */
export function obraParaDocumento(o: ObraParaIndexar): DocumentoIndexavel {
  const restante = o.orcamento != null ? o.orcamento - o.totalGasto : null;
  const percentual =
    o.orcamento != null && o.orcamento > 0 ? Math.round((o.totalGasto / o.orcamento) * 100) : null;

  const partes = [
    `Obra ${o.nome}`,
    o.cliente ? `do cliente ${o.cliente}` : null,
    o.tipo ? `tipo ${o.tipo}` : null,
    o.status ? `situação ${o.status}` : null,
    o.data_inicio ? `iniciada em ${dataPorExtenso(o.data_inicio)}` : null,
    o.orcamento != null ? `orçamento de ${moeda(o.orcamento)}` : 'sem orçamento definido',
    `total já gasto ${moeda(o.totalGasto)} em ${o.qtdPagamentos} pagamento(s)`,
    restante != null ? `saldo restante ${moeda(restante)}` : null,
    percentual != null ? `${percentual}% do orçamento consumido` : null,
  ].filter(Boolean);

  const conteudo = `${partes.join(', ')}.`;

  return {
    origem: 'obra',
    origemId: o.id,
    obraId: o.id,
    titulo: `Resumo da obra ${o.nome}`,
    conteudo,
    hash: hashDe(conteudo),
  };
}

export interface FornecedorParaIndexar {
  id: string;
  nome: string;
  razao_social: string | null;
  categoria: { nome: string } | null;
  totalPago: number;
  qtdPagamentos: number;
  obras: string[];
}

export function fornecedorParaDocumento(f: FornecedorParaIndexar): DocumentoIndexavel {
  const partes = [
    `Fornecedor ${f.nome}`,
    f.razao_social && f.razao_social !== f.nome ? `razão social ${f.razao_social}` : null,
    f.categoria ? `categoria ${f.categoria.nome}` : null,
    `recebeu ${moeda(f.totalPago)} em ${f.qtdPagamentos} pagamento(s)`,
    f.obras.length > 0 ? `atendeu as obras: ${f.obras.join(', ')}` : null,
  ].filter(Boolean);

  const conteudo = `${partes.join(', ')}.`;

  return {
    origem: 'fornecedor',
    origemId: f.id,
    // Fornecedor atende várias obras, então não pertence a nenhuma. Fica sem
    // `obra_id` e aparece em busca sem filtro — o que é o certo: "quanto paguei
    // para o Mathias" não é pergunta sobre uma obra só.
    obraId: null,
    titulo: `Fornecedor ${f.nome}`,
    conteudo,
    hash: hashDe(conteudo),
  };
}

/**
 * Divide um texto longo em trechos.
 *
 * Os documentos gerados acima cabem num trecho só — são frases, não relatórios.
 * A função existe para o dia em que o texto de uma nota fiscal entrar aqui, e
 * porque deixar a decisão de corte espalhada pelos indexadores seria pior.
 *
 * Corta por frase e não por número de caracteres: partir "R$ 3.450,00" ao meio
 * produz dois trechos que não significam nada.
 */
export function dividirEmTrechos(texto: string, maxCaracteres = 1200): string[] {
  const limpo = texto.trim();
  if (limpo.length <= maxCaracteres) return [limpo];

  const frases = limpo.split(/(?<=[.!?])\s+/u);
  const trechos: string[] = [];
  let atual = '';

  for (const frase of frases) {
    if (atual.length > 0 && atual.length + frase.length + 1 > maxCaracteres) {
      trechos.push(atual.trim());
      atual = '';
    }
    // Frase única maior que o teto: entra sozinha, cortada. Raro, mas cortar
    // é melhor que estourar o limite do modelo de embedding.
    atual = atual.length > 0 ? `${atual} ${frase}` : frase.slice(0, maxCaracteres);
  }

  if (atual.trim().length > 0) trechos.push(atual.trim());
  return trechos;
}
