import { ehPerguntaAoAssistente } from './pergunta';

/**
 * Para onde vai uma mensagem que não é resposta a pendência nem comando fixo:
 * ao **assistente** (pergunta, ação, conversa) ou ao **classificador**
 * (lançamento — o caminho de sempre).
 *
 * Três camadas, na ordem em que erram:
 *
 *   1. Código puro, vence sempre. Mídia → classificador. Cheiro de dinheiro
 *      saindo (R$, paguei, pix…) com um número → classificador. Pergunta
 *      inequívoca (`ehPerguntaAoAssistente`) → assistente. Curta demais →
 *      classificador.
 *   2. Padrão de ação (puro): verbo de cadastro + substantivo do CRM ("cria a
 *      obra", "cadastra o fornecedor", "o contrato da X é") → assistente.
 *   3. O modelo, só no que sobrou (`lib/ia/intencao.ts`). `pergunta`, `acao`
 *      e `conversa` → assistente; `lancamento` e `nenhuma` → classificador.
 *      Sem modelo, ou com falha, a camada não existe e vale o de hoje.
 *
 * A assimetria é a mesma de sempre: perder um lançamento custa dinheiro;
 * responder uma pergunta como pendência só custa um clique no painel. Por
 * isso tudo que cheira a lançamento **nunca** chega ao modelo.
 */

export type Destino = 'assistente' | 'classificador' | 'saudacao';

export interface EntradaDoRoteador {
  texto: string | null | undefined;
  temMidia: boolean;
}

export interface DepsRoteador {
  /** Camada 3. Ausente = sem modelo. */
  classificarIntencao?: (
    texto: string,
  ) => Promise<'pergunta' | 'acao' | 'lancamento' | 'conversa' | 'nenhuma'>;
}

export type Motivo =
  | 'saudacao'
  | 'midia'
  | 'cheiro_de_lancamento'
  | 'curta'
  | 'pergunta_inequivoca'
  | 'padrao_de_acao'
  | 'modelo'
  | 'sem_modelo'
  | 'modelo_falhou';

export interface Decisao {
  destino: Destino;
  motivo: Motivo;
  intencao?: 'pergunta' | 'acao' | 'lancamento' | 'conversa' | 'nenhuma';
}

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/gu, ' ').trim();
}

/** Igual ao de `pergunta.ts`: fala de dinheiro saindo. */
const CHEIRO_DE_LANCAMENTO =
  /(r\$|\breais\b|\bconto\b|\bpila\b|\bpaguei\b|\bpagamos\b|\bpagou\b|\bcomprei\b|\bcompramos\b|\btransferi\b|\bpix\b|\bboleto\b|\bnota fiscal\b|\bnf\b)/iu;

const TEM_NUMERO = /\d/u;

/** Saudação/agradecimento curto: resposta fixa, sem modelo e sem pendência. */
const SAUDACOES = new Set([
  'oi',
  'oie',
  'oii',
  'ola',
  'ola!',
  'opa',
  'e ai',
  'eai',
  'salve',
  'bom dia',
  'boa tarde',
  'boa noite',
  'valeu',
  'obrigado',
  'obrigada',
  'brigado',
  'vlw',
  'ok',
  'okay',
  'beleza',
  'blz',
  'show',
  'top',
  'oi tudo bem',
  'oi bom dia',
  'bom dia pessoal',
  'boa tarde pessoal',
  'boa noite pessoal',
  'teste',
  'testando',
]);

export function ehSaudacao(texto: string): boolean {
  const t = normalizar(texto)
    .replace(/[!?.,]+$/u, '')
    .trim();
  return SAUDACOES.has(t);
}

/**
 * Verbo de cadastro no começo (com ou sem vocativo/"aí"/"por favor"), seguido,
 * em até 6 palavras, de um substantivo do CRM.
 */
const VERBOS_DE_ACAO =
  '(cria|criar|cadastra|cadastrar|adiciona|adicionar|abre|abrir|registra|registrar|anota|anotar|arquiva|arquivar|encerra|encerrar|fecha|fechar|define|definir|coloca|colocar|bota|botar|inclui|incluir)';
const SUBSTANTIVOS_DO_CRM =
  '(obra|obras|fornecedor|fornecedores|contrato|recebimento|recebimentos|parcela|cliente)';
const PADRAO_DE_ACAO = new RegExp(
  `^(?:\\w+[,!]?\\s+){0,3}${VERBOS_DE_ACAO}\\b(?:\\s+\\S+){0,6}?\\s+(?:uma?\\s+|o\\s+|a\\s+|um\\s+nov[oa]\\s+|nov[oa]\\s+)?${SUBSTANTIVOS_DO_CRM}\\b`,
  'u',
);

/** "o contrato da garibaldi é 850 mil", "recebi 50 mil do cliente". */
const PADRAO_DE_INFORMACAO =
  /^(?:\w+[,!]?\s+){0,3}(?:o\s+)?(?:contrato|valor do contrato)\s+d[aeo]\s+.+\s+(?:e|eh|é|fica|ficou|vale)\s+\d|^(?:\w+[,!]?\s+){0,3}(?:recebi|recebemos|entrou|caiu)\s+/u;

/**
 * Medição de etapa: "laje 100%", "alvenaria da casa ej ta em 60%". Só a
 * forma com percentual — "a laje ficou pronta" continua sendo diário da
 * obra (registro), como antes; o modelo ainda pode levar ao assistente.
 * Percentual sem cheiro de dinheiro não é lançamento — é o cronograma.
 */
const PADRAO_DE_MEDICAO = /(?:^|\s)\d{1,3}\s?%(?:\s|$)/u;

export function pareceMedicao(texto: string): boolean {
  const t = normalizar(texto);
  return PADRAO_DE_MEDICAO.test(t) && !CHEIRO_DE_LANCAMENTO.test(t);
}

export function pareceAcao(texto: string): boolean {
  const t = normalizar(texto);
  return PADRAO_DE_ACAO.test(t) || PADRAO_DE_INFORMACAO.test(t) || pareceMedicao(texto);
}

export async function decidirDestino(
  entrada: EntradaDoRoteador,
  deps: DepsRoteador = {},
): Promise<Decisao> {
  // 1. Puro.
  if (entrada.temMidia) return { destino: 'classificador', motivo: 'midia' };
  const texto = entrada.texto?.trim() ?? '';
  const t = normalizar(texto);
  if (!t) return { destino: 'classificador', motivo: 'curta' };
  if (ehSaudacao(t)) return { destino: 'saudacao', motivo: 'saudacao' };

  // "recebi 50 mil" é entrada de dinheiro, não saída — a exceção ao cheiro.
  const cheira =
    CHEIRO_DE_LANCAMENTO.test(t) &&
    !/^(?:\w+[,!]?\s+){0,3}(?:recebi|recebemos|entrou|caiu)\b/u.test(t);
  if (cheira && TEM_NUMERO.test(t)) {
    return { destino: 'classificador', motivo: 'cheiro_de_lancamento' };
  }
  if (ehPerguntaAoAssistente(texto)) {
    return { destino: 'assistente', motivo: 'pergunta_inequivoca' };
  }

  // 2. Padrão de ação.
  if (pareceAcao(texto)) return { destino: 'assistente', motivo: 'padrao_de_acao' };

  // Curta demais para o modelo opinar ("ok", "beleza", "?"): fluxo de hoje.
  if (t.split(' ').length < 2 && t.length < 6) {
    return { destino: 'classificador', motivo: 'curta' };
  }

  // 3. Modelo.
  if (!deps.classificarIntencao) return { destino: 'classificador', motivo: 'sem_modelo' };
  try {
    const intencao = await deps.classificarIntencao(texto);
    const destino: Destino =
      intencao === 'pergunta' || intencao === 'acao' || intencao === 'conversa'
        ? 'assistente'
        : 'classificador';
    return { destino, motivo: 'modelo', intencao };
  } catch {
    return { destino: 'classificador', motivo: 'modelo_falhou' };
  }
}
