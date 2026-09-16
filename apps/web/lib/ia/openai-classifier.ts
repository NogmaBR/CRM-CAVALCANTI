import 'server-only';
import { logger } from '@/lib/log';
import { downloadDocumentBytes } from '@/lib/storage/documents';
import {
  type DepsClassificador,
  INSTRUCOES,
  type MidiaCarregada,
  SaidaSchema,
  carregarMidia,
  montarContextoTexto,
  montarSaida,
} from './classificador-comum';
import type { Classifier, ClassifierInput, ClassifierOutput } from './classifier';
import { type ParteDeConteudo, blocoDeMidia, chatCompletions, modeloOpenAI } from './openai';

const log = logger('classificador');

/**
 * Classificador via OpenAI (`IA_PROVIDER=openai`) — o padrão desde 2026-09-15.
 *
 * Mesmo prompt, mesmo schema e mesma barreira de saída do provider Anthropic
 * (`classificador-comum.ts`). O que é daqui: o Chat Completions com
 * `response_format: json_schema` estrito (a resposta ou é válida ou a API
 * recusa), a foto/PDF como `image_url`/`file`, e `reasoning_effort: low` —
 * roda dentro do webhook, latência importa mais que profundidade.
 */

const MAX_TOKENS = 2048;

/**
 * JSON Schema do `SaidaSchema`, à mão: o modo estrito exige `required` com
 * todos os campos e `additionalProperties: false`, e `null` como tipo — o
 * gerador do Zod produz `anyOf`, que também passa, mas isto é mais legível e
 * o teste garante que as chaves batem com o Zod.
 */
export const JSON_SCHEMA_SAIDA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: {
      type: 'string',
      enum: [
        'pagamento_completo',
        'pagamento_parcial',
        'documento_apenas',
        'documento_obra',
        'registro_obra',
        'nao_identificado',
      ],
    },
    confidence: { type: 'number' },
    valor: { type: ['number', 'null'] },
    data_pagamento: { type: ['string', 'null'] },
    obra_nome: { type: ['string', 'null'] },
    fornecedor_nome: { type: ['string', 'null'] },
    categoria_nome: { type: ['string', 'null'] },
    tipo_documento: {
      type: ['string', 'null'],
      enum: ['nota_fiscal', 'comprovante', 'contrato', 'outro', null],
    },
    numero_nf: { type: ['string', 'null'] },
    descricao: { type: ['string', 'null'] },
    categoria: {
      type: ['string', 'null'],
      enum: [
        'documentacao',
        'nfs_pagamentos',
        'proposta',
        'projeto',
        'projeto_aprovado',
        'cronograma',
        'fotos',
        'orcamentos',
        'outro',
        null,
      ],
    },
    resumo: { type: ['string', 'null'] },
    raciocinio: { type: 'string' },
    pergunta_confirmacao: { type: ['string', 'null'] },
  },
  required: [
    'kind',
    'confidence',
    'valor',
    'data_pagamento',
    'obra_nome',
    'fornecedor_nome',
    'categoria_nome',
    'tipo_documento',
    'numero_nf',
    'descricao',
    'categoria',
    'resumo',
    'raciocinio',
    'pergunta_confirmacao',
  ],
} as const;

/** Como o classificador chama o modelo. Injetável para teste. */
export interface DepsOpenAI extends DepsClassificador {
  chamar: typeof chatCompletions;
}

export class OpenAIClassifier implements Classifier {
  private readonly deps: DepsOpenAI;

  constructor(deps: Partial<DepsOpenAI> = {}) {
    if (!process.env.OPENAI_API_KEY && !deps.chamar) {
      throw new Error('IA_PROVIDER=openai exige OPENAI_API_KEY configurada.');
    }
    this.deps = {
      baixarMidia: deps.baixarMidia ?? downloadDocumentBytes,
      chamar: deps.chamar ?? chatCompletions,
    };
  }

  async classify(input: ClassifierInput): Promise<ClassifierOutput> {
    const contexto = montarContextoTexto(input);
    const midia = await carregarMidia(input, this.deps);

    let r = await this.deps.chamar(corpoDaChamada(montarConteudoOpenAI(contexto, midia)));

    // A API pode recusar o anexo (imagem corrompida, PDF fora do padrão).
    // Uma vez só com o texto: perder a foto é melhor que perder a mensagem.
    if (!r.ok && midia && r.status === 400) {
      log.aviso('midia_recusada_pela_api', { mime: midia.mime, status: r.status });
      r = await this.deps.chamar(corpoDaChamada(contexto));
    }
    if (!r.ok) {
      throw new Error(`OpenAI HTTP ${r.status}: ${r.detalhe}`);
    }

    const msg = r.resposta.choices[0]?.message;
    if (msg?.refusal || !msg?.content) {
      log.erro('sem_saida_estruturada', { refusal: msg?.refusal ?? null });
      return {
        kind: 'nao_identificado',
        confidence: 0,
        extracted: { raciocinio: 'Classificador não retornou saída estruturada válida.' },
      };
    }

    const parsed = SaidaSchema.safeParse(JSON.parse(msg.content));
    if (!parsed.success) {
      log.erro('saida_fora_do_schema', { erro: parsed.error.message.slice(0, 300) });
      return {
        kind: 'nao_identificado',
        confidence: 0,
        extracted: { raciocinio: 'Classificador devolveu saída fora do schema.' },
      };
    }
    return montarSaida(parsed.data, input);
  }
}

/**
 * Corpo do Chat Completions: instruções no system, mídia + contexto no user,
 * saída presa ao schema. Exportado para o teste e para a conciliação.
 */
export function corpoDaChamada(conteudo: string | ParteDeConteudo[]): Record<string, unknown> {
  return {
    model: modeloOpenAI(),
    messages: [
      { role: 'system', content: INSTRUCOES },
      { role: 'user', content: conteudo },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'classificacao', strict: true, schema: JSON_SCHEMA_SAIDA },
    },
    max_completion_tokens: MAX_TOKENS,
    reasoning_effort: 'low',
  };
}

/**
 * Mídia primeiro, contexto depois. Mídia grande demais vira aviso em texto,
 * para o modelo saber que havia um anexo que ele não viu.
 */
export function montarConteudoOpenAI(
  contexto: string,
  midia: MidiaCarregada | null,
): string | ParteDeConteudo[] {
  if (!midia) return contexto;
  const bloco = blocoDeMidia(midia);
  if (!bloco) {
    return `${contexto}\n\n(Havia um anexo ${midia.mime} de ${Math.round(midia.bytes.byteLength / 1024)} KB, grande demais para ser lido. Classifique só pelo texto.)`;
  }
  return [bloco, { type: 'text', text: contexto }];
}
