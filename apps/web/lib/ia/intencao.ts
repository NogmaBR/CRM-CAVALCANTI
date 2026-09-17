import { logger } from '@/lib/log';
import { type ResultadoChat, chatCompletions, modeloOpenAI, openaiDisponivel } from './openai';

const log = logger('intencao');

/**
 * O que a pessoa quis com uma mensagem de texto — decidido pelo modelo, mas
 * só depois que o código já descartou o que o código decide sozinho.
 *
 * Isto NÃO substitui as travas de `lib/whatsapp/roteador.ts`: mídia e
 * "cheiro de dinheiro" nunca chegam aqui. O modelo separa o que sobrou —
 * pergunta, pedido de ação, conversa — do que ainda pode ser um lançamento
 * escrito de um jeito que a regex não pegou ("mandei 300 pro zé ontem").
 *
 * Saída fechada (`json_schema` estrito): qualquer coisa fora das cinco
 * palavras vira `nenhuma`, que é o comportamento de hoje (classificador).
 */

export type Intencao = 'pergunta' | 'acao' | 'lancamento' | 'conversa' | 'nenhuma';

export const INTENCOES: readonly Intencao[] = [
  'pergunta',
  'acao',
  'lancamento',
  'conversa',
  'nenhuma',
];

export const VERSAO_PROMPT_INTENCAO = 1;

const SISTEMA = `Você classifica UMA mensagem de WhatsApp enviada ao agente de um CRM de obras (construção civil). Responda só o JSON.

Categorias:
- "pergunta": quer saber algo que está no sistema — gastos, lucro, obras, fornecedores, pagamentos, notas, documentos, andamento, recebimentos. Ex.: "velho, quanto tô lucrando no garibaldi", "tem projeto aprovado da casa ej", "quem mais recebeu esse mês".
- "acao": pede para o sistema FAZER um cadastro: criar obra, cadastrar fornecedor, informar valor do contrato, registrar recebimento do cliente, arquivar obra. Ex.: "cria aí uma obra chamada sítio", "o contrato da garibaldi é 850 mil", "recebi 50 mil do cliente da inox", "arquiva a wrb".
- "lancamento": relata um PAGAMENTO feito a fornecedor/serviço/material (dinheiro que SAIU), mesmo sem valor claro. Ex.: "mandei 300 pro zé ontem", "paguei o pedreiro", "comprei cimento na garibaldi".
- "conversa": saudação, agradecimento, teste, mensagem social sem pedido. Ex.: "bom dia", "valeu", "ok obrigado", "testando".
- "nenhuma": não dá para saber, ou é outra coisa (ex.: texto de encaminhamento, piada, assunto pessoal).

Na dúvida entre "lancamento" e outra, responda "lancamento".`;

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { intencao: { type: 'string', enum: [...INTENCOES] } },
  required: ['intencao'],
} as const;

export interface DepsIntencao {
  /** Substitui a chamada HTTP (testes). */
  chat?: (corpo: Record<string, unknown>) => Promise<ResultadoChat>;
  disponivel?: () => boolean;
}

export function intencaoDisponivel(deps: DepsIntencao = {}): boolean {
  if (deps.chat) return true;
  if (deps.disponivel) return deps.disponivel();
  return (process.env.IA_PROVIDER ?? 'mock') === 'openai' && openaiDisponivel();
}

/** Lê a resposta do modelo; qualquer coisa fora do contrato é `nenhuma`. */
export function lerIntencao(conteudo: string | null | undefined): Intencao {
  if (!conteudo) return 'nenhuma';
  try {
    const j = JSON.parse(conteudo) as { intencao?: unknown };
    return INTENCOES.includes(j.intencao as Intencao) ? (j.intencao as Intencao) : 'nenhuma';
  } catch {
    return 'nenhuma';
  }
}

export async function classificarIntencao(
  texto: string,
  deps: DepsIntencao = {},
): Promise<Intencao> {
  if (!intencaoDisponivel(deps)) return 'nenhuma';
  const chat = deps.chat ?? chatCompletions;
  const r = await chat({
    model: modeloOpenAI(),
    messages: [
      { role: 'system', content: SISTEMA },
      { role: 'user', content: texto.slice(0, 1000) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'intencao', strict: true, schema: JSON_SCHEMA },
    },
    // gpt-5.x conta o raciocínio no teto de saída: 30 não bastaria.
    max_completion_tokens: 200,
    reasoning_effort: 'low',
  });
  if (!r.ok) {
    log.aviso('intencao_falhou', { status: r.status });
    return 'nenhuma';
  }
  const intencao = lerIntencao(r.resposta.choices[0]?.message.content);
  log.info('intencao', { intencao, versao: VERSAO_PROMPT_INTENCAO });
  return intencao;
}
