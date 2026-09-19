import type { DocCategoria } from '@/lib/status-labels';
import { CATEGORIA_LABELS } from '@/lib/status-labels';
import type { Opcao } from './escolha';

/**
 * Todo texto fixo que o agente manda no WhatsApp, num lugar só.
 *
 * Quem lê é um senhor, no celular, muitas vezes no canteiro. As regras (as
 * mesmas do bloco COMO ESCREVER do prompt do assistente, e o teste
 * `textos.test.ts` afirma cada uma):
 *
 *   - uma informação por linha; frases de até 14 palavras;
 *   - o nome da coisa junto do número ("Obra: Garibaldi", "Valor: R$ …"),
 *     nunca o número solto;
 *   - valor acima de R$ 10 mil ganha o por extenso curto entre parênteses:
 *     "R$ 134.231,05 (134 mil)" — para conferir de ouvido;
 *   - termina SEMPRE com o que fazer em seguida ("Responda SIM…");
 *   - nada de jargão de sistema (id, null, pendência técnica, classificador).
 *
 * Puro: sem banco, sem rede. É o que permite testar cada frase.
 */

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "850 mil", "1,2 milhões", "12,5 mil" — para conferir de ouvido. */
export function porExtensoCurto(n: number): string | null {
  if (n >= 1_000_000) {
    const m = Math.round((n / 1_000_000) * 10) / 10;
    return `${m.toLocaleString('pt-BR')} ${m === 1 ? 'milhão' : 'milhões'}`;
  }
  if (n >= 10_000) {
    const k = Math.round((n / 1_000) * 10) / 10;
    return `${k.toLocaleString('pt-BR')} mil`;
  }
  return null;
}

/** "R$ 134.231,05 (134 mil)" ou só "R$ 1.200,00". */
export function valorLegivel(n: number): string {
  const extenso = porExtensoCurto(n);
  return extenso ? `${brl(n)} (${extenso})` : brl(n);
}

/** `2026-09-16` → `16/09/2026`. Outra coisa volta como veio. */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** "1) Aguirre\n2) Garibaldi" */
export function listaNumerada(opcoes: readonly Opcao[]): string {
  return opcoes.map((o) => `${o.n}) ${o.nome}`).join('\n');
}

const RODAPE_SIM = 'Responda *SIM* para lançar, ou *NÃO* para cancelar.';
const RODAPE_NUMERO = 'Responda só o *número* da obra, ou *NÃO* para cancelar.';

// ---------------------------------------------------------------------------
// Pagamento
// ---------------------------------------------------------------------------

export interface DadosDoPagamento {
  valor: number;
  obra?: string | null;
  fornecedor?: string | null;
  descricao?: string | null;
  data?: string | null;
  categoria?: string | null;
  /** Veio de foto/PDF (nota, comprovante)? Muda a primeira linha. */
  deAnexo?: boolean;
  /** Veio de áudio transcrito? "Ouvi o áudio" — a pessoa sabe que foi ouvida. */
  deAudio?: boolean;
}

/**
 * A primeira linha diz o que o agente fez de verdade: leu um arquivo, ouviu
 * um áudio ou entendeu um texto. "Li o comprovante" em cima de uma mensagem
 * de texto foi apontado na reunião de 18/09 como o tipo de frase que tira a
 * confiança — a pessoa sabe que não mandou comprovante nenhum.
 */
function comoEntendi(d: Pick<DadosDoPagamento, 'deAnexo' | 'deAudio'>): string {
  if (d.deAnexo) return 'Li o comprovante.';
  if (d.deAudio) return 'Ouvi o áudio.';
  return 'Entendi assim.';
}

/**
 * A pergunta de confirmação de um pagamento — cada dado em linha própria.
 * Substitui a frase livre do modelo: o que se pergunta é exatamente o que
 * vai ser gravado.
 */
export function perguntaDePagamento(d: DadosDoPagamento): string {
  const linhas = [
    `${comoEntendi(d)} Vou *lançar este pagamento*:`,
    '',
    `• Valor: *${valorLegivel(d.valor)}*`,
    `• Obra: *${d.obra ?? 'não informada'}*`,
    `• Fornecedor: ${d.fornecedor ?? 'não informado'}`,
  ];
  if (d.descricao) linhas.push(`• O que foi: ${d.descricao}`);
  if (d.categoria) linhas.push(`• Etapa: ${d.categoria}`);
  linhas.push(`• Data: ${d.data ? dataBR(d.data) : 'hoje'}`);
  linhas.push(
    '',
    'Se algo estiver errado, responda NÃO e mande de novo com o dado certo.',
    RODAPE_SIM,
  );
  return linhas.join('\n');
}

/** Pagamento com valor e sem obra: pergunta a obra numerada; o número lança. */
export function perguntaDePagamentoSemObra(
  d: Omit<DadosDoPagamento, 'obra'>,
  opcoes: readonly Opcao[],
): string {
  const linhas = [
    comoEntendi(d).replace(/\.$/u, ':'),
    '',
    `• Valor: *${valorLegivel(d.valor)}*`,
    `• Fornecedor: ${d.fornecedor ?? 'não informado'}`,
  ];
  if (d.descricao) linhas.push(`• O que foi: ${d.descricao}`);
  linhas.push(`• Data: ${d.data ? dataBR(d.data) : 'hoje'}`);
  linhas.push('', '*De qual obra é este pagamento?*', listaNumerada(opcoes), '', RODAPE_NUMERO);
  return linhas.join('\n');
}

/** Depois do SIM: o que foi gravado e onde ver. */
export function respostaPagamentoLancado(d: {
  valor: number;
  obra?: string | null;
  fornecedor?: string | null;
  /** Link direto para o pagamento no painel; sem ele, o caminho pelo menu. */
  link?: string | null;
  /** Quem confirmou, quando não foi quem mandou (grupo). */
  confirmadoPor?: string | null;
}): string {
  const linhas = [
    `✅ Lançado: *${valorLegivel(d.valor)}*${d.confirmadoPor ? ` (confirmado por ${d.confirmadoPor})` : ''}`,
  ];
  if (d.obra) linhas.push(`Obra: *${d.obra}*`);
  if (d.fornecedor) linhas.push(`Fornecedor: ${d.fornecedor}`);
  linhas.push('', d.link ? `Ver no painel: ${d.link}` : 'Para ver no painel: menu Pagamentos.');
  return linhas.join('\n');
}

// ---------------------------------------------------------------------------
// Documento e diário
// ---------------------------------------------------------------------------

export function perguntaDeObraParaArquivo(
  tipo: 'documento' | 'registro',
  opcoes: readonly Opcao[],
): string {
  const cabeca =
    tipo === 'documento'
      ? 'Recebi o arquivo. *De qual obra ele é?*'
      : 'Anotei. *Em qual obra eu guardo esta anotação?*';
  return [cabeca, '', listaNumerada(opcoes), '', RODAPE_NUMERO].join('\n');
}

/**
 * "📁 Guardei na obra *Casa EJ*, pasta *Fotos*." — ou "Guardei 5 arquivos"
 * quando veio um lote. Com link direto quando o chamador tem o id.
 */
export function respostaArquivado(
  obraNome: string,
  categoria: DocCategoria,
  opts: { link?: string | null; quantidade?: number } = {},
): string {
  const pasta = CATEGORIA_LABELS[categoria]?.rotulo ?? 'Outros';
  const oQue = opts.quantidade && opts.quantidade > 1 ? `${opts.quantidade} arquivos ` : '';
  return [
    `📁 Guardei ${oQue}na obra *${obraNome}*, pasta *${pasta}*.`,
    opts.link ? `Ver: ${opts.link}` : 'Para ver: menu Obras › a obra › Pastas.',
  ].join('\n');
}

/** "📝 Anotei no diário da obra *Casa EJ*." */
export function respostaRegistrado(obraNome: string, opts: { link?: string | null } = {}): string {
  return [
    `📝 Anotei no diário da obra *${obraNome}*.`,
    opts.link ? `Ver: ${opts.link}` : 'Para ver: menu Obras › a obra › Diário.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Corrigir, desfazer, mover, anexar
// ---------------------------------------------------------------------------

/**
 * "Troquei a obra para INOX Piratini." + a pergunta remontada. A pessoa vê o
 * que mudou em uma linha e confirma de novo — correção nunca grava sozinha.
 */
export function respostaCorrigida(
  mudancas: readonly string[],
  perguntaNova: string | null,
): string {
  const lista =
    mudancas.length === 1
      ? mudancas[0]
      : `${mudancas.slice(0, -1).join(', ')} e ${mudancas.at(-1)}`;
  const cabeca = `Troquei ${lista}.`;
  if (!perguntaNova) {
    return [cabeca, 'Confere? Responda *SIM* para lançar, ou *NÃO* para cancelar.'].join('\n');
  }
  // A pergunta já começa com "Li o comprovante./Entendi assim." — tira essa
  // primeira linha, o "Troquei…" ocupa o lugar dela.
  const corpo = perguntaNova.split('\n').slice(1).join('\n');
  return [cabeca, corpo].join('\n');
}

/** "↩️ Desfeito: o pagamento de R$ 1.200,00 na obra Garibaldi." */
export function respostaDesfeito(oQue: string, depois: string | null): string {
  const linhas = [`↩️ Desfeito: ${oQue}.`];
  if (depois) linhas.push(depois);
  return linhas.join('\n');
}

/** "📁 Movi para a obra *INOX Piratini*, pasta *Fotos*." */
export function respostaMovido(obraNome: string, pasta: string): string {
  return `📁 Movi para a obra *${obraNome}*, pasta *${pasta}*.`;
}

/** "📎 Anexei ao pagamento de R$ 1.200,00 (Garibaldi)." */
export function respostaAnexado(d: {
  valor: number;
  obra?: string | null;
  link?: string | null;
}): string {
  const linhas = [
    `📎 Anexei ao pagamento de *${valorLegivel(d.valor)}*${d.obra ? ` (${d.obra})` : ''}.`,
  ];
  linhas.push(d.link ? `Ver: ${d.link}` : 'O pagamento agora tem comprovante.');
  return linhas.join('\n');
}

/**
 * Duas ou mais perguntas abertas e um "sim" solto: qual delas? Cada item com
 * o que identifica o pagamento; o número escolhe, TODOS pega todas.
 */
export interface PendenciaResumida {
  n: number;
  valor?: number | null;
  fornecedor?: string | null;
  obra?: string | null;
  descricao?: string | null;
}
export function perguntaQualPendencia(
  itens: readonly PendenciaResumida[],
  interpretacao: 'sim' | 'nao',
): string {
  const verbo = interpretacao === 'sim' ? 'confirmar' : 'cancelar';
  const linhas = [`Tenho ${itens.length} perguntas abertas. *Qual delas você quer ${verbo}?*`, ''];
  for (const i of itens) {
    const partes = [
      i.valor != null ? valorLegivel(i.valor) : null,
      i.fornecedor,
      i.obra,
      i.descricao,
    ]
      .filter(Boolean)
      .join(' · ');
    linhas.push(`${i.n}) ${partes || 'sem dados'}`);
  }
  linhas.push('', `Responda o *número*, ou *TODOS* para ${verbo} todas.`);
  return linhas.join('\n');
}

// ---------------------------------------------------------------------------
// Respostas fixas
// ---------------------------------------------------------------------------

export const RESPOSTAS = {
  confirmado: '✅ Lançado. Obrigado!\nPara ver no painel: menu Pagamentos.',
  confirmadoSemPagamento: [
    'Recebi o seu SIM, mas faltou um dado para lançar sozinho.',
    'Ficou guardado para o gestor completar no painel.',
    'Se quiser, mande de novo com o valor e a obra.',
  ].join('\n'),
  recusado: [
    'Ok, cancelei. Nada foi lançado.',
    'Para lançar certo, mande de novo com o dado correto.',
  ].join('\n'),
  faltaObra: [
    'Falta dizer a obra.',
    'Responda só o *número* dela na lista acima, ou *NÃO* para cancelar.',
  ].join('\n'),
  obraRecusada: 'Ok, não guardei. Se quiser, o gestor pode guardar pelo painel.',
  acaoCancelada: 'Ok, cancelei. Nada foi gravado.',
  acaoJaResolvida: [
    'Esse pedido já tinha sido feito antes — não fiz de novo.',
    'Se quiser mudar alguma coisa, me diga o quê.',
  ].join('\n'),
  correcaoSemDado: [
    'Entendi que algo está errado. O que eu troco?',
    'Diga a obra, o valor, o fornecedor ou a data certa.',
    'Ou responda *NÃO* para cancelar.',
  ].join('\n'),
  correcaoQualObra: 'Qual é a obra certa? Responda o *número* dela na lista acima.',
  correcaoDeAcao: [
    'Para mudar um cadastro, responda *NÃO* e peça de novo com o dado certo.',
    'Ex.: "cria a obra Sítio do Pedro, cliente Pedro Alves".',
  ].join('\n'),
  moverQualObra: 'Para qual obra eu mudo? Diga o nome dela.',
  jaDesfeito: 'Isso já tinha sido desfeito. Nada mudou.',
  desfazerSemAlvo: [
    'Não achei o que desfazer.',
    'Responda em cima da mensagem que quer desfazer (segure e toque em Responder).',
  ].join('\n'),
  dicaAnexar: 'Quando tiver a nota, mande em cima desta mensagem que eu anexo.',
  falhaTemporaria: [
    'Não consegui processar agora. A mensagem ficou guardada.',
    'Tente de novo daqui a alguns minutos, ou peça ao gestor pelo painel.',
  ].join('\n'),
  saudacao: [
    'Oi! Estou aqui. 👋',
    'Mande a foto da nota ou o valor de um pagamento.',
    'Ou pergunte: "como está a obra Garibaldi?"',
    'Para ver tudo que eu faço, mande: ajuda',
  ].join(String.fromCharCode(10)),
  naoEntendi: [
    'Não entendi essa.',
    'Gasto? Diga o valor e a obra, ou mande a foto da nota.',
    'Dúvida? Pergunte normal. Para ver tudo que faço, mande: ajuda',
  ].join('\n'),
} as const;

export const AJUDA_TEXTO = [
  '*O que eu faço por você aqui no WhatsApp:*',
  '',
  '1) *Lançar pagamento*: mande a foto da nota, ou escreva',
  '   "paguei 1.200 de cimento pro Mathias na Garibaldi".',
  '2) *Guardar arquivo*: mande foto, projeto ou PDF da obra.',
  '3) *Anotar no diário*: mande um áudio contando o que aconteceu.',
  '4) *Perguntar*: "como está a obra Garibaldi?", "quanto gastei em setembro?",',
  '   "quem mais recebeu?", "tem projeto aprovado da Casa EJ?".',
  '5) *Cadastrar*: "cria a obra X", "o contrato da X é 850 mil",',
  '   "recebi 50 mil do cliente da X", "cadastra o fornecedor Y".',
  '',
  'Antes de gravar, eu repito o que entendi e espero o seu *SIM*.',
].join('\n');
