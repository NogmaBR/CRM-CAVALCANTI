import 'server-only';
import { logger } from '@/lib/log';
import { downloadDocumentBytes } from '@/lib/storage/documents';
import { hojeBR } from '@/lib/util/datas';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
// `zod/v4`, e não `zod`: o helper `zodOutputFormat` do SDK exige os tipos do
// Zod 4, e o resto do projeto está no Zod 3 (o pacote 3.25 expõe as duas APIs
// em subpaths separados). Importar de 'zod' aqui compila em erro de tipo.
import { z } from 'zod/v4';
import type { Classifier, ClassifierInput, ClassifierOutput } from './classifier';

const log = logger('classificador');

/**
 * Classificador de mensagens de WhatsApp usando Claude.
 *
 * Substitui o `MockClassifier` quando `IA_PROVIDER=anthropic`. Até aqui o
 * branch existia só como comentário em `classifier.ts` ("reservado — quando
 * as credenciais chegarem"), e a factory lançava erro pra qualquer provider
 * que não fosse `mock`. Ou seja: o CRM nunca classificou nada de verdade.
 *
 * ## Structured outputs, não parsing de texto
 *
 * A saída é presa a um schema Zod via `output_config.format`. Isso importa
 * porque o resultado vai direto pra `dados_extraidos`, que alimenta o INSERT
 * em `pagamentos` — um `valor` que volte como "R$ 1.500,00" em vez de número,
 * ou um `obra_id` inventado, viraria lançamento errado no financeiro do
 * cliente. Com schema, ou a resposta é válida ou falha explicitamente.
 *
 * ## A foto entra no prompt
 *
 * O núcleo do contrato é "manda a foto da nota, a IA extrai". Até a revisão
 * gstack de 2026-09-12 o classificador recebia só o texto: uma foto sem
 * legenda virava pendência sem valor e o "SIM" terminava em "o gestor vai
 * revisar" — a aprovação manual que o produto elimina. Agora a mídia gravada
 * pelo inbound é relida do Storage (não passa bytes pela fila) e entra como
 * bloco `image` ou `document`. Falha de download degrada para texto, com log.
 *
 * ## Por que os IDs entram no prompt
 *
 * O modelo não escolhe texto livre pra obra/fornecedor: ele recebe a lista de
 * obras ativas e fornecedores conhecidos com os UUIDs e devolve o UUID. Ainda
 * assim validamos a resposta contra as listas antes de usar (ver
 * `sanitizarIds`) — um UUID alucinado que passasse direto criaria pagamento
 * numa obra aleatória.
 */

const MODELO_PADRAO = 'claude-opus-5';

/** O classificador roda dentro do webhook; não pode demorar minutos. */
const MAX_TOKENS = 2048;

/** Formatos que a API aceita como bloco de imagem/documento. */
const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MIME_PDF = 'application/pdf';
/** Limites da API (5 MB por imagem, 32 MB por PDF); um pouco abaixo por margem. */
const MAX_BYTES_IMAGEM = 4.5 * 1024 * 1024;
const MAX_BYTES_PDF = 20 * 1024 * 1024;

/** Como o classificador obtém os bytes da mídia. Injetável para teste. */
export interface DepsClassificador {
  baixarMidia: (storagePath: string) => Promise<Uint8Array | null>;
}

const SaidaSchema = z.object({
  kind: z.enum(['pagamento_completo', 'pagamento_parcial', 'documento_apenas', 'nao_identificado']),
  confidence: z.number().min(0).max(1),
  valor: z.number().nullable(),
  data_pagamento: z.string().nullable(),
  obra_id: z.string().nullable(),
  fornecedor_id: z.string().nullable(),
  fornecedor_nome_novo: z.string().nullable(),
  tipo_documento: z.enum(['nota_fiscal', 'comprovante', 'contrato', 'outro']).nullable(),
  numero_nf: z.string().nullable(),
  descricao: z.string().nullable(),
  raciocinio: z.string(),
  pergunta_confirmacao: z.string().nullable(),
});

type Saida = z.infer<typeof SaidaSchema>;

const INSTRUCOES = `Você extrai lançamentos financeiros de mensagens que a equipe de uma construtora manda por WhatsApp.

As mensagens são informais, ditadas ou digitadas no canteiro de obra. Exemplos reais do domínio:
- "paguei 1200 de areia pro Zé da obra do Recreio"
- "segue a nota do material" (com uma foto anexada)
- "bom dia" (não é lançamento)

Quando houver uma foto ou PDF anexado, ele costuma ser a nota fiscal, o comprovante de pagamento ou o contrato. Leia o documento: valor total, data, número da nota, nome do fornecedor e a obra (quando aparecer no endereço ou na descrição). O texto da mensagem, quando existir, complementa ou corrige o que está no documento.

Regras:
1. valor sempre em reais, como número. "1.200,50" -> 1200.5. "1200 conto" -> 1200. Nunca invente valor.
2. data_pagamento em YYYY-MM-DD. "ontem"/"hoje" resolvem contra a data informada no contexto. Sem data explícita, deixe null.
3. obra_id e fornecedor_id DEVEM ser um dos UUIDs listados no contexto. Se o nome citado não bate com nenhum da lista, deixe o id null — e, no caso de fornecedor, escreva o nome citado em fornecedor_nome_novo.
4. kind:
   - pagamento_completo: tem valor E obra identificada com segurança.
   - pagamento_parcial: fala de pagamento mas falta valor ou obra.
   - documento_apenas: é NF/comprovante/contrato sem contexto de pagamento.
   - nao_identificado: saudação, conversa, ou nada operacional.
5. confidence reflete o quanto você tem certeza da EXTRAÇÃO inteira, não de um campo. Abaixo de 0.85 o sistema pede confirmação humana — use isso a seu favor: na dúvida, seja conservador.
6. pergunta_confirmacao: uma frase curta, em português coloquial, que será enviada de volta no WhatsApp pedindo confirmação. Deve repetir os dados extraídos pra pessoa conferir e terminar pedindo SIM. Null quando kind = nao_identificado.
7. raciocinio: uma frase explicando a decisão, para o gestor que revisa no painel.

Nunca invente dados que não estão na mensagem. Faltou informação, o campo é null.`;

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
    const hoje = hojeBR();

    const contexto = [
      `Data de hoje: ${hoje}`,
      '',
      'Obras ativas (use o UUID exato):',
      ...(input.contexto.obrasAtivas.length > 0
        ? input.contexto.obrasAtivas.map((o) => `- ${o.id} — ${o.nome}`)
        : ['- (nenhuma obra ativa cadastrada)']),
      '',
      'Fornecedores conhecidos (use o UUID exato):',
      ...(input.contexto.fornecedoresConhecidos.length > 0
        ? input.contexto.fornecedoresConhecidos.map((f) => `- ${f.id} — ${f.nome}`)
        : ['- (nenhum fornecedor cadastrado)']),
      '',
      `Telefone do remetente: ${input.telefone}`,
      input.midiaMime ? `Anexo recebido, tipo: ${input.midiaMime}` : 'Sem anexo.',
      '',
      'Mensagem:',
      input.texto?.trim() || '(sem texto — só anexo)',
    ].join('\n');

    const midia = await this.carregarMidia(input);
    const conteudo = montarConteudo(contexto, midia);

    const resposta = await this.client.messages.parse({
      model: this.modelo,
      max_tokens: MAX_TOKENS,
      system: INSTRUCOES,
      // Adaptive thinking: a extração é curta, mas casar "obra do Recreio" com
      // a obra certa entre várias parecidas é exatamente onde o raciocínio
      // paga o custo. `effort: low` mantém a latência compatível com o webhook.
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'low',
        format: zodOutputFormat(SaidaSchema),
      },
      messages: [{ role: 'user', content: conteudo }],
    });

    const saida = resposta.parsed_output;
    if (!saida) {
      // Sem saída válida não há como distinguir "não é lançamento" de "o
      // modelo falhou" — devolvemos confiança zero pra cair em revisão humana.
      log.erro('sem_parsed_output', { stop_reason: resposta.stop_reason });
      return {
        kind: 'nao_identificado',
        confidence: 0,
        extracted: { raciocinio: 'Classificador não retornou saída estruturada válida.' },
      };
    }

    return montarSaida(saida, input);
  }

  /**
   * Relê a mídia do Storage quando o formato é um que a API entende. Qualquer
   * falha vira aviso no log e o modelo segue só com o texto — nunca derruba
   * a classificação por causa do anexo.
   */
  private async carregarMidia(input: ClassifierInput): Promise<MidiaCarregada | null> {
    const mime = input.midiaMime?.split(';')[0]?.trim().toLowerCase() ?? null;
    if (!input.midiaStoragePath || !mime || !mimeSuportado(mime)) return null;
    try {
      const bytes = await this.deps.baixarMidia(input.midiaStoragePath);
      if (!bytes) {
        log.aviso('midia_nao_lida', { storage_path: input.midiaStoragePath });
        return null;
      }
      return { bytes, mime };
    } catch (err) {
      log.aviso('midia_nao_lida', { storage_path: input.midiaStoragePath, err });
      return null;
    }
  }
}

interface MidiaCarregada {
  bytes: Uint8Array;
  mime: string;
}

function mimeSuportado(mime: string): boolean {
  return MIMES_IMAGEM.has(mime) || mime === MIME_PDF;
}

/**
 * Monta o conteúdo da mensagem: a mídia primeiro (imagem ou PDF em base64),
 * depois o contexto em texto. Mídia grande demais para a API entra como
 * aviso em texto, para o modelo saber que havia um anexo que ele não viu.
 *
 * Exportada para teste: é a parte da visão que dá para verificar sem rede.
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

/**
 * Converte a saída do modelo no contrato interno, descartando IDs que não
 * existem no contexto enviado.
 *
 * Exportada para teste: é a barreira entre "o que o modelo disse" e "o que
 * vira linha no banco", e é a parte que dá pra verificar sem chamar a API.
 */
export function montarSaida(saida: Saida, input: ClassifierInput): ClassifierOutput {
  const obrasValidas = new Set(input.contexto.obrasAtivas.map((o) => o.id));
  const fornecedoresValidos = new Set(input.contexto.fornecedoresConhecidos.map((f) => f.id));

  const obraId = saida.obra_id && obrasValidas.has(saida.obra_id) ? saida.obra_id : undefined;
  const fornecedorId =
    saida.fornecedor_id && fornecedoresValidos.has(saida.fornecedor_id)
      ? saida.fornecedor_id
      : undefined;

  const alucinouId =
    (saida.obra_id != null && obraId === undefined) ||
    (saida.fornecedor_id != null && fornecedorId === undefined);

  const extracted: ClassifierOutput['extracted'] = {
    raciocinio: alucinouId
      ? `${saida.raciocinio} [aviso: o classificador citou um id inexistente, que foi descartado]`
      : saida.raciocinio,
  };

  if (saida.valor != null && saida.valor > 0) extracted.valor = saida.valor;
  if (saida.data_pagamento && /^\d{4}-\d{2}-\d{2}$/u.test(saida.data_pagamento)) {
    extracted.data_pagamento = saida.data_pagamento;
  }
  if (obraId) extracted.obra_id = obraId;
  if (fornecedorId) extracted.fornecedor_id = fornecedorId;
  else if (saida.fornecedor_nome_novo) extracted.fornecedor_nome_novo = saida.fornecedor_nome_novo;
  if (saida.tipo_documento) extracted.tipo_documento = saida.tipo_documento;
  if (saida.numero_nf) extracted.numero_nf = saida.numero_nf;
  if (saida.descricao) extracted.descricao = saida.descricao;

  // Um id descartado significa que a extração é menos confiável do que o
  // modelo achou. Rebaixamos abaixo do limiar de auto-aprovação em vez de
  // confiar no número que veio junto com o erro.
  const confidence = alucinouId ? Math.min(saida.confidence, 0.5) : saida.confidence;

  // Coerência: sem valor ou sem obra não existe "pagamento completo",
  // independente do que o modelo tenha rotulado.
  const kind =
    saida.kind === 'pagamento_completo' && (extracted.valor == null || extracted.obra_id == null)
      ? 'pagamento_parcial'
      : saida.kind;

  return {
    kind,
    confidence,
    extracted,
    ...(saida.pergunta_confirmacao ? { perguntaConfirmacao: saida.pergunta_confirmacao } : {}),
  };
}
