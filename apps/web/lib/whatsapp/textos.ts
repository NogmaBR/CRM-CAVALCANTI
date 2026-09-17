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
}

/**
 * A pergunta de confirmação de um pagamento — cada dado em linha própria.
 * Substitui a frase livre do modelo: o que se pergunta é exatamente o que
 * vai ser gravado.
 */
export function perguntaDePagamento(d: DadosDoPagamento): string {
  const linhas = [
    d.deAnexo
      ? 'Li o comprovante. Vou *lançar este pagamento*:'
      : 'Entendi assim. Vou *lançar este pagamento*:',
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
    d.deAnexo ? 'Li o comprovante:' : 'Entendi assim:',
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
}): string {
  const linhas = [`✅ Lançado: *${valorLegivel(d.valor)}*`];
  if (d.obra) linhas.push(`Obra: *${d.obra}*`);
  if (d.fornecedor) linhas.push(`Fornecedor: ${d.fornecedor}`);
  linhas.push('', 'Para ver no painel: menu Pagamentos.');
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

/** "📁 Guardei na obra *Garibaldi*, pasta *Fotos*." */
export function respostaArquivado(obraNome: string, categoria: DocCategoria): string {
  const pasta = CATEGORIA_LABELS[categoria]?.rotulo ?? 'Outros';
  return [
    `📁 Guardei na obra *${obraNome}*, pasta *${pasta}*.`,
    'Para ver: menu Obras › a obra › Pastas.',
  ].join('\n');
}

/** "📝 Anotei no diário da obra *Garibaldi*." */
export function respostaRegistrado(obraNome: string): string {
  return [
    `📝 Anotei no diário da obra *${obraNome}*.`,
    'Para ver: menu Obras › a obra › Diário.',
  ].join('\n');
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
  acaoJaResolvida: 'Essa ação já foi resolvida. Se precisar, peça de novo.',
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
    'Não entendi o que fazer com essa mensagem.',
    '',
    'Para lançar um pagamento, mande assim:',
    '"paguei 1.200 de cimento pro Mathias na Garibaldi"',
    'Ou mande a foto da nota ou do comprovante.',
    '',
    'Para perguntar, pode escrever normal: "como está a obra Garibaldi?"',
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
