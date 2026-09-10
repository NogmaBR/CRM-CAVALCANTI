/**
 * Isto é uma pergunta ao assistente, ou um lançamento?
 *
 * ## O custo de errar é assimétrico, de novo
 *
 * É a mesma lógica do parser de "SIM", e vale repetir porque a conclusão é a
 * mesma: **na dúvida, não é pergunta.**
 *
 * Tratar um lançamento como pergunta significa que o pagamento não é
 * registrado — a pessoa mandou "paguei 500 pro Zé" e recebeu de volta um
 * resumo de gastos. O dinheiro sai do caixa e não entra no sistema.
 *
 * Tratar uma pergunta como lançamento significa que ela cai no classificador,
 * vira `nao_identificado` e o gestor vê uma pendência boba no painel. Chato,
 * reversível, visível.
 *
 * Então o reconhecimento é estreito: só o que é inequivocamente pergunta.
 */

/** Começos que só aparecem em pergunta. */
const INTERROGATIVAS = [
  'quanto',
  'quantos',
  'quantas',
  'qual',
  'quais',
  'quando',
  'onde',
  'quem',
  'por que',
  'porque',
  'como',
  'o que',
  'me diz',
  'me fala',
  'sabe',
];

/**
 * Sinais de que a mensagem fala de dinheiro saindo.
 *
 * "R$", "500 reais", "1.200 conto" — se aparece, o risco de ser lançamento é
 * alto demais para arriscar, mesmo que a frase termine em "?".
 */
const CHEIRO_DE_LANCAMENTO =
  /(r\$|\breais\b|\bconto\b|\bpila\b|\bpaguei\b|\bpagamos\b|\bcomprei\b|\btransferi\b|\bpix\b)/iu;

/**
 * Pedido, não consulta.
 *
 * "me manda a nota?" termina em "?" e fala de nota, mas quem escreve isso quer
 * um arquivo, não um número. Responder com um resumo de gastos seria ignorar o
 * que foi pedido — e o assistente não sabe mandar arquivo.
 *
 * Ancorado no começo da frase de propósito: "quanto tempo pra mandar a nota?"
 * é consulta, e o verbo aparece no meio.
 */
const CHEIRO_DE_PEDIDO = /^(me\s+)?(manda|envia|encaminha|passa|preciso|pode\s+mandar)\b/iu;

/**
 * Minúsculas, sem acento, espaços colapsados.
 *
 * `p{M}` — a propriedade Unicode "marca" — em vez de uma faixa de códigos ou dos
 * caracteres literais: combinantes soltos num arquivo-fonte são invisíveis no
 * editor, grudam no caractere anterior ao copiar e colar, e o Biome os recusa
 * com razão. Escritos assim, dá para ler o que a regra faz.
 */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/gu, ' ').trim();
}

/**
 * `true` só quando é claramente uma pergunta sobre os dados.
 *
 * Curto demais também não passa: "?" sozinho, ou "e aí?", não são pergunta
 * sobre nada — vão para o fluxo normal e provavelmente viram
 * `nao_identificado`, que é o desfecho correto.
 */
export function ehPerguntaAoAssistente(texto: string | null | undefined): boolean {
  if (!texto) return false;

  const t = normalizar(texto);
  if (t.length < 8) return false;

  // Fala de dinheiro saindo: sai do caminho da pergunta, sempre.
  if (CHEIRO_DE_LANCAMENTO.test(t)) return false;

  // Pedido de arquivo ou de ação: também não é consulta.
  if (CHEIRO_DE_PEDIDO.test(t)) return false;

  const comecaComInterrogativa = INTERROGATIVAS.some(
    (p) => t.startsWith(`${p} `) || t.startsWith(`${p},`),
  );

  // Terminar em "?" é sinal forte, mas sozinho aceita coisas como
  // "manda a nota?" — que é pedido, não consulta. Exigir também um verbo ou
  // substantivo do domínio evita isso.
  const terminaComInterrogacao = t.endsWith('?');
  const falaDoDominio =
    /(obra|fornecedor|pagamento|pagamentos|gasto|gastos|gastei|orcamento|nota|notas|categoria|saldo|total)/u.test(
      t,
    );

  return comecaComInterrogativa || (terminaComInterrogacao && falaDoDominio);
}
