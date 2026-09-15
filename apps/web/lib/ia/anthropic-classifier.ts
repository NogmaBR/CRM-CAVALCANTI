import 'server-only';
import { logger } from '@/lib/log';
import { downloadDocumentBytes } from '@/lib/storage/documents';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import {
  type DepsClassificador,
  INSTRUCOES,
  MAX_BYTES_IMAGEM,
  MAX_BYTES_PDF,
  MIME_PDF,
  type MidiaCarregada,
  SaidaSchema,
  carregarMidia,
  montarContextoTexto,
  montarSaida,
} from './classificador-comum';
import type { Classifier, ClassifierInput, ClassifierOutput } from './classifier';

const log = logger('classificador');

/**
 * Classificador via Claude (`IA_PROVIDER=anthropic`). Mantido como provider
 * alternativo; o padrão do projeto é o OpenAI (`openai-classifier.ts`) desde
 * 2026-09-15. Prompt, schema e regras moram em `classificador-comum.ts`.
 */

const MODELO_PADRAO = 'claude-opus-5';
const MAX_TOKENS = 2048;

export type { DepsClassificador } from './classificador-comum';
export { montarSaida } from './classificador-comum';

export class AnthropicClassifier implements Classifier {
  private readonly client: Anthropic;
  private readonly modelo: string;
  private readonly deps: DepsClassificador;

  constructor(deps: Partial<DepsClassificador> = {}) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('IA_PROVIDER=anthropic exige ANTHROPIC_API_KEY configurada.');
    }
    this.client = new Anthropic({ apiKey });
    this.modelo = process.env.IA_MODEL ?? MODELO_PADRAO;
    this.deps = { baixarMidia: deps.baixarMidia ?? downloadDocumentBytes };
  }

  async classify(input: ClassifierInput): Promise<ClassifierOutput> {
    const contexto = montarContextoTexto(input);
    const midia = await carregarMidia(input, this.deps);
    const conteudo = montarConteudo(contexto, midia);

    const resposta = await this.chamar(conteudo).catch(async (err: unknown) => {
      // A API pode recusar o anexo mesmo com assinatura válida. Tenta uma vez
      // só com o texto: perder a foto é melhor que perder a mensagem inteira.
      if (midia && err instanceof Anthropic.BadRequestError) {
        log.aviso('midia_recusada_pela_api', { mime: midia.mime, status: err.status });
        return this.chamar(contexto);
      }
      throw err;
    });

    const saida = resposta.parsed_output;
    if (!saida) {
      log.erro('sem_parsed_output', { stop_reason: resposta.stop_reason });
      return {
        kind: 'nao_identificado',
        confidence: 0,
        extracted: { raciocinio: 'Classificador não retornou saída estruturada válida.' },
      };
    }
    return montarSaida(saida, input);
  }

  private chamar(conteudo: string | ContentBlockParam[]) {
    return this.client.messages.parse({
      model: this.modelo,
      max_tokens: MAX_TOKENS,
      system: INSTRUCOES,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: zodOutputFormat(SaidaSchema) },
      messages: [{ role: 'user', content: conteudo }],
    });
  }
}

/**
 * Bloco de mídia no formato da Anthropic (imagem ou PDF em base64) seguido do
 * contexto. Mídia grande demais entra como aviso em texto. Exportada para
 * teste e reaproveitada pela visão do acervo.
 */
export function montarConteudo(
  contexto: string,
  midia: MidiaCarregada | null,
): string | ContentBlockParam[] {
  if (!midia) return contexto;

  const ehPdf = midia.mime === MIME_PDF;
  const limite = ehPdf ? MAX_BYTES_PDF : MAX_BYTES_IMAGEM;
  if (midia.bytes.byteLength > limite) {
    return `${contexto}\n\n(Havia um anexo ${midia.mime} de ${Math.round(midia.bytes.byteLength / 1024)} KB, grande demais para ser lido. Classifique só pelo texto.)`;
  }

  const data = Buffer.from(midia.bytes).toString('base64');
  const bloco: ContentBlockParam = ehPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : {
        type: 'image',
        source: {
          type: 'base64',
          media_type: midia.mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data,
        },
      };
  return [bloco, { type: 'text', text: contexto }];
}
