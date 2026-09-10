/**
 * Interpretação da resposta do cliente a uma pergunta de confirmação.
 *
 * Este é o elo que faltava no fluxo do briefing (§4, item "após OK/SIM,
 * insere automaticamente, sem aprovação manual"). Antes, quando o cliente
 * respondia "SIM" no WhatsApp, aquilo voltava pelo webhook como uma mensagem
 * nova e era reclassificada do zero — nada ligava a resposta à pendência
 * aberta, então a única forma de resolver continuava sendo o gestor clicar
 * no painel, que é exatamente o trabalho manual que o produto promete tirar.
 *
 * Função pura de propósito: é a peça com mais casos de borda de todo o fluxo
 * (acento, emoji, pontuação, caixa) e a única que dá pra testar sem banco.
 *
 * ## Regra de decisão
 *
 * Só respostas **inequívocas e curtas** disparam ação automática. "sim",
 * "ok", "👍" confirmam; "não", "cancela" recusam. Qualquer coisa além disso
 * — inclusive "não, o valor é 500" — retorna `outro` e cai no fluxo normal
 * de classificação, deixando a pendência aberta.
 *
 * Isso é deliberadamente conservador. O custo de errar pra cada lado não é
 * simétrico: tratar uma correção como "sim" grava um pagamento errado no
 * financeiro do cliente, enquanto tratar um "sim" como correção só faz o
 * gestor clicar no painel — que é o que ele já fazia hoje.
 */

export type Interpretacao = 'sim' | 'nao' | 'outro';

/** Máximo de palavras que ainda contam como "resposta curta". */
const MAX_PALAVRAS = 4;

const AFIRMATIVAS = new Set([
  'sim', 's', 'ss', 'sim sim',
  'ok', 'okay', 'okey', 'oks', 'blz', 'beleza',
  'isso', 'isso mesmo', 'e isso', 'e isso mesmo',
  'confirmo', 'confirmado', 'confirma', 'confirmar',
  'certo', 'ta certo', 'esta certo', 'correto', 'exato', 'exatamente',
  'perfeito', 'positivo', 'pode', 'pode lancar', 'pode sim', 'pode ser',
  'aprovado', 'aprovo', 'tudo certo', 'tudo ok', 'show',
  'yes', 'y',
]);

const NEGATIVAS = new Set([
  'nao', 'n', 'nn', 'nao nao',
  'negativo', 'cancela', 'cancelar', 'cancele', 'cancelado',
  'errado', 'ta errado', 'esta errado', 'nada disso',
  'esquece', 'esquecer', 'deixa', 'deixa pra la',
  'recuso', 'recusado', 'nao aprovo', 'nao confirmo',
  'no',
]);

/** Emojis que valem como resposta por si só. */
const EMOJI_SIM = ['👍', '👌', '✅', '☑️', '✔️', '🆗', '🙌'];
const EMOJI_NAO = ['👎', '❌', '🚫', '✖️'];

/**
 * Normaliza para comparação: minúsculas, sem acento, sem pontuação,
 * espaços colapsados.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[.,!?;:'"()[\]{}\-_/\\]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Remove emojis do texto, devolvendo o que sobrou e quais apareceram. */
function separarEmojis(texto: string): { semEmoji: string; emojis: string[] } {
  const emojis: string[] = [];
  for (const e of [...EMOJI_SIM, ...EMOJI_NAO]) {
    if (texto.includes(e)) emojis.push(e);
  }
  const semEmoji = [...EMOJI_SIM, ...EMOJI_NAO].reduce(
    (acc, e) => acc.split(e).join(' '),
    texto,
  );
  return { semEmoji, emojis };
}

export function interpretarResposta(texto: string | null | undefined): Interpretacao {
  if (!texto) return 'outro';

  const { semEmoji, emojis } = separarEmojis(texto);
  const normalizado = normalizar(semEmoji);

  // Só emoji, sem texto: o emoji decide.
  if (normalizado === '' && emojis.length > 0) {
    const temSim = emojis.some((e) => EMOJI_SIM.includes(e));
    const temNao = emojis.some((e) => EMOJI_NAO.includes(e));
    // 👍❌ junto é ambíguo — não age.
    if (temSim && temNao) return 'outro';
    return temSim ? 'sim' : 'nao';
  }

  if (normalizado === '') return 'outro';

  // Resposta longa é correção/contexto, não um "sim" ou "não" puro.
  const palavras = normalizado.split(' ');
  if (palavras.length > MAX_PALAVRAS) return 'outro';

  // Negativa antes de afirmativa: "nao confirmo" contém "confirmo", e a
  // intenção real é a negativa.
  if (NEGATIVAS.has(normalizado)) return 'nao';
  if (AFIRMATIVAS.has(normalizado)) return 'sim';

  // Emoji acompanhado de uma palavra curta que concorda com ele
  // ("ok 👍", "sim ✅") — o emoji reforça, não contradiz.
  if (emojis.length > 0) {
    const temSim = emojis.some((e) => EMOJI_SIM.includes(e));
    const temNao = emojis.some((e) => EMOJI_NAO.includes(e));
    if (temSim && !temNao && AFIRMATIVAS.has(normalizado)) return 'sim';
    if (temNao && !temSim && NEGATIVAS.has(normalizado)) return 'nao';
  }

  return 'outro';
}
