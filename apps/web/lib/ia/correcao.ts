import { logger } from '@/lib/log';
import { type PatchDeCorrecao, extrairCorrecaoSimples } from '@/lib/whatsapp/correcao';
import { type ResultadoChat, chatCompletions, modeloOpenAI, openaiDisponivel } from './openai';
import { type Nomeado, resolverPorNome } from './resolver-nomes';

const log = logger('correcao');

/**
 * O que a pessoa quis corrigir numa pendência — pelo modelo, com saída
 * fechada, e com os NOMES resolvidos contra o cadastro pelo código.
 *
 * O caminho por padrões (`extrairCorrecaoSimples`) cobre o que se diz no
 * canteiro ("é na inox", "foi 350", "dia 15"). O modelo entra para o que a
 * regex não pega ("na verdade esse pagamento foi da obra do Aguirre, e o
 * pedreiro chama Gilvando") — mas nunca devolve id: devolve nomes, e é
 * `resolverPorNome` que decide, ambíguo = não mexe (lição do UUID trocado,
 * §8 do CLAUDE.md). O que o modelo não citou fica `null` e não entra no
 * patch: correção é parcial por desenho.
 *
 * Sem chave, ou com falha, vale o resultado dos padrões.
 */

export const VERSAO_PROMPT_CORRECAO = 1;

const SISTEMA = `A pessoa está CORRIGINDO os dados de um pagamento que um agente de WhatsApp acabou de repetir para ela confirmar. Extraia SÓ o que ela quer mudar. O que ela não mencionou é null.

Campos:
- obra_nome: o nome da obra certa, como ela escreveu (ou null). Se ela só disse que NÃO é a obra atual sem dizer qual, null.
- fornecedor_nome: o fornecedor certo, como ela escreveu (ou null).
- valor: o valor certo em reais, número (ou null). "1.200,50" → 1200.5.
- data: a data certa em AAAA-MM-DD, resolvendo "ontem"/"hoje"/"dia 15" contra a data informada (ou null).
- descricao: o que foi pago, em até 5 palavras, só se ela corrigiu isso (ou null).
- cancelar: true só se ela desistiu do lançamento ("esquece", "deixa pra lá", "cancela").

Responda só o JSON. Nunca invente um campo que ela não disse.`;

const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    obra_nome: { type: ['string', 'null'] },
    fornecedor_nome: { type: ['string', 'null'] },
    valor: { type: ['number', 'null'] },
    data: { type: ['string', 'null'] },
    descricao: { type: ['string', 'null'] },
    cancelar: { type: 'boolean' },
  },
  required: ['obra_nome', 'fornecedor_nome', 'valor', 'data', 'descricao', 'cancelar'],
} as const;

export interface ContextoDaCorrecao {
  obras: readonly Nomeado[];
  fornecedores: readonly Nomeado[];
  hoje: string;
  /** A pergunta que o agente fez — ajuda o modelo a saber o que está sendo corrigido. */
  perguntaEnviada?: string | null;
}

export interface DepsCorrecao {
  chat?: (corpo: Record<string, unknown>) => Promise<ResultadoChat>;
  disponivel?: () => boolean;
}

export function correcaoPorModeloDisponivel(deps: DepsCorrecao = {}): boolean {
  if (deps.chat) return true;
  if (deps.disponivel) return deps.disponivel();
  return (process.env.IA_PROVIDER ?? 'mock') === 'openai' && openaiDisponivel();
}

interface SaidaDoModelo {
  obra_nome: string | null;
  fornecedor_nome: string | null;
  valor: number | null;
  data: string | null;
  descricao: string | null;
  cancelar: boolean;
}

function lerSaida(conteudo: string | null | undefined): SaidaDoModelo | null {
  if (!conteudo) return null;
  try {
    const j = JSON.parse(conteudo) as Partial<SaidaDoModelo>;
    return {
      obra_nome: typeof j.obra_nome === 'string' ? j.obra_nome : null,
      fornecedor_nome: typeof j.fornecedor_nome === 'string' ? j.fornecedor_nome : null,
      valor:
        typeof j.valor === 'number' && Number.isFinite(j.valor) && j.valor > 0 ? j.valor : null,
      data: typeof j.data === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(j.data) ? j.data : null,
      descricao: typeof j.descricao === 'string' && j.descricao.trim() ? j.descricao.trim() : null,
      cancelar: j.cancelar === true,
    };
  } catch {
    return null;
  }
}

/** Saída do modelo → patch, com os nomes passando pelo cadastro. Puro; testável. */
export function patchDaSaida(saida: SaidaDoModelo, ctx: ContextoDaCorrecao): PatchDeCorrecao {
  const patch: PatchDeCorrecao = {};
  if (saida.cancelar) patch.cancelar = true;
  if (saida.obra_nome) {
    const obra = resolverPorNome(saida.obra_nome, ctx.obras);
    if (obra) patch.obra = { id: obra.id, nome: obra.nome };
  }
  if (saida.fornecedor_nome) {
    const f = resolverPorNome(saida.fornecedor_nome, ctx.fornecedores);
    if (f) patch.fornecedor = { id: f.id, nome: f.nome };
    else patch.fornecedorNomeNovo = saida.fornecedor_nome.slice(0, 200);
  }
  if (saida.valor != null) patch.valor = saida.valor;
  if (saida.data) patch.data = saida.data;
  if (saida.descricao) patch.descricao = saida.descricao.slice(0, 500);
  return patch;
}

/**
 * Padrões primeiro (baratos e previsíveis); o modelo completa o que faltou.
 * O que os padrões acharam vence o modelo no mesmo campo — "é na inox" nunca
 * vira outra obra porque o modelo achou que sim.
 */
export async function extrairCorrecao(
  texto: string,
  ctx: ContextoDaCorrecao,
  deps: DepsCorrecao = {},
): Promise<PatchDeCorrecao> {
  const simples = extrairCorrecaoSimples(texto, ctx);
  if (!correcaoPorModeloDisponivel(deps)) return simples;

  const chat = deps.chat ?? chatCompletions;
  const r = await chat({
    model: modeloOpenAI(),
    messages: [
      { role: 'system', content: SISTEMA },
      {
        role: 'user',
        content: [
          `Hoje é ${ctx.hoje}.`,
          ctx.perguntaEnviada ? `O agente perguntou:\n${ctx.perguntaEnviada}` : '',
          `A pessoa respondeu:\n${texto.slice(0, 1000)}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'correcao', strict: true, schema: JSON_SCHEMA },
    },
    max_completion_tokens: 300,
    reasoning_effort: 'low',
  }).catch((err: unknown) => {
    log.aviso('correcao_modelo_excecao', { err });
    return null;
  });
  if (!r || !r.ok) {
    log.aviso('correcao_modelo_falhou', { status: r && !r.ok ? r.status : null });
    return simples;
  }
  const saida = lerSaida(r.resposta.choices[0]?.message.content);
  if (!saida) return simples;
  const doModelo = patchDaSaida(saida, ctx);
  log.info('correcao', { versao: VERSAO_PROMPT_CORRECAO, campos: Object.keys(doModelo) });
  return { ...doModelo, ...simples };
}
