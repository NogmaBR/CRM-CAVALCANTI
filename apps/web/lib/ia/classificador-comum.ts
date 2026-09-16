import { normalizarNome, resolverPorNome } from './resolver-nomes';
import 'server-only';
import { logger } from '@/lib/log';
import { validateFileMagicBytes } from '@/lib/schemas/documento';
import { hojeBR } from '@/lib/util/datas';
// `zod/v4`: o helper `zodOutputFormat` da Anthropic exige os tipos do Zod 4,
// e o schema é um só para os dois providers (o pacote 3.25 expõe os dois
// subpaths). O OpenAI recebe o JSON Schema equivalente, escrito à mão em
// `openai-classifier.ts` — e valida a resposta com este Zod.
import { z } from 'zod/v4';
import type { ClassifierInput, ClassifierOutput } from './classifier';

const log = logger('classificador');

/**
 * O que é comum aos classificadores reais (Anthropic e OpenAI): o prompt, o
 * schema da saída, o contexto em texto, a leitura da mídia e a barreira entre
 * "o que o modelo disse" e "o que vira linha no banco" (`montarSaida`).
 *
 * Trocar de provider é trocar só a chamada HTTP e a forma do bloco de mídia;
 * as regras do domínio moram aqui e são as mesmas.
 */

/** Formatos que as APIs aceitam como bloco de imagem/documento. */
export const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MIME_PDF = 'application/pdf';
/**
 * Limites das APIs, abaixo por margem. Anthropic: 5 MB/imagem, 32 MB/PDF.
 * OpenAI: 20 MB/imagem, 32 MB/PDF (e 100 páginas) — os renders do cliente
 * têm 5–7 MB por foto e ficavam de fora com o teto da Anthropic.
 */
export const MAX_BYTES_IMAGEM = 4.5 * 1024 * 1024;
export const MAX_BYTES_PDF = 20 * 1024 * 1024;
export const MAX_BYTES_IMAGEM_OPENAI = 19 * 1024 * 1024;
export const MAX_BYTES_PDF_OPENAI = 30 * 1024 * 1024;

/** Como o classificador obtém os bytes da mídia. Injetável para teste. */
export interface DepsClassificador {
  baixarMidia: (storagePath: string) => Promise<Uint8Array | null>;
}

export interface MidiaCarregada {
  bytes: Uint8Array;
  mime: string;
}

export function mimeSuportado(mime: string): boolean {
  return MIMES_IMAGEM.has(mime) || mime === MIME_PDF;
}

export const SaidaSchema = z.object({
  kind: z.enum([
    'pagamento_completo',
    'pagamento_parcial',
    'documento_apenas',
    'documento_obra',
    'registro_obra',
    'nao_identificado',
  ]),
  confidence: z.number().min(0).max(1),
  valor: z.number().nullable(),
  data_pagamento: z.string().nullable(),
  // Nomes, não ids: o modelo copia UUID mal (2026-09-16: leu "Mathias Velho"
  // e devolveu o UUID de Maximiliano). Quem resolve nome → id é o código.
  obra_nome: z.string().nullable(),
  fornecedor_nome: z.string().nullable(),
  categoria_nome: z.string().nullable(),
  tipo_documento: z.enum(['nota_fiscal', 'comprovante', 'contrato', 'outro']).nullable(),
  numero_nf: z.string().nullable(),
  descricao: z.string().nullable(),
  // Só para documento_obra: a pasta da obra em que o arquivo mora.
  categoria: z
    .enum([
      'documentacao',
      'nfs_pagamentos',
      'proposta',
      'projeto',
      'projeto_aprovado',
      'cronograma',
      'fotos',
      'orcamentos',
      'outro',
    ])
    .nullable(),
  // Só para registro_obra: uma linha para o diário.
  resumo: z.string().nullable(),
  raciocinio: z.string(),
  pergunta_confirmacao: z.string().nullable(),
});

export type Saida = z.infer<typeof SaidaSchema>;

export const INSTRUCOES = `Você organiza as mensagens que a equipe de uma construtora manda num grupo de WhatsApp: lançamentos financeiros, arquivos de obra e informações do dia a dia.

As mensagens são informais, ditadas ou digitadas no canteiro de obra. Exemplos reais do domínio:
- "paguei 1200 de areia pro Zé da obra do Recreio" (pagamento)
- "segue a nota do material" com uma foto anexada (pagamento: nota fiscal)
- foto do andamento da laje, com ou sem legenda (documento_obra, pasta fotos)
- PDF "Proposta comercial revisada" (documento_obra, pasta proposta)
- áudio "hoje a equipe terminou o contrapiso da Garibaldi, amanhã começa o reboco" (registro_obra)
- "bom dia" (nao_identificado)

Quando houver uma foto ou PDF anexado, ele costuma ser a nota fiscal, o comprovante de pagamento ou o contrato. Leia o documento: valor total, data, número da nota, nome do fornecedor e a obra (quando aparecer no endereço ou na descrição). O texto da mensagem, quando existir, complementa ou corrige o que está no documento.

Regras:
1. valor sempre em reais, como número. "1.200,50" -> 1200.5. "1200 conto" -> 1200. Nunca invente valor.
2. data_pagamento em YYYY-MM-DD. "ontem"/"hoje" resolvem contra a data informada no contexto. Sem data explícita, deixe null.
3. obra_nome, fornecedor_nome e categoria_nome são NOMES, nunca ids. Quando reconhecer um da lista do contexto, copie o nome exatamente como está na lista. Se a mensagem cita um fornecedor que não está na lista, escreva o nome como veio na mensagem. Se não cita, null. categoria_nome só quando a mensagem deixa claro em que conta o gasto cai (ex.: "cimento" → Estrutura ou Material; "reboco" → Reboco; "limpeza" → Limpeza); na dúvida, null.
4. kind — PAGAMENTO VENCE: se há valor e a mensagem trata de pagar/pagou/comprovante/nota, é pagamento, mesmo com anexo.
   - pagamento_completo: tem valor E obra identificada com segurança.
   - pagamento_parcial: fala de pagamento mas falta valor ou obra.
   - documento_apenas: é NF/comprovante de um pagamento, sem valor legível.
   - documento_obra: arquivo que NÃO é nota nem comprovante: foto do andamento, projeto, planta, proposta, orçamento de fornecedor (cotação, não pagamento), cronograma, contrato, alvará, laudo. Preencha categoria com a pasta: documentacao (contratos, alvarás, laudos, documentos oficiais), proposta, projeto, projeto_aprovado (aprovado na prefeitura), cronograma, orcamentos (cotações), fotos, outro.
   - registro_obra: informação do dia a dia da obra sem valor a lançar (andamento, equipe, problema, decisão, combinado com cliente ou fornecedor). Preencha resumo com uma linha de até 80 caracteres.
   - nao_identificado: saudação, conversa, ou nada operacional — SÓ para mensagem SEM anexo. Com foto, vídeo, PDF ou qualquer arquivo anexado, nunca: um arquivo mandado no grupo da obra sempre vale guardar. Foto ou vídeo de canteiro, parede, laje, equipe, material chegando = documento_obra com categoria fotos, mesmo que a legenda seja só o nome da obra ("inox") ou não exista. Planilha, Word ou arquivo de projeto sem pista = documento_obra com categoria outro (ou orcamentos/projeto/cronograma se a legenda disser).
   Obra: preencha obra_nome quando a mensagem menciona a obra por nome ou apelido. Se o contexto informar a obra do grupo e a mensagem não citar outra, use a do grupo.
5. confidence reflete o quanto você tem certeza da EXTRAÇÃO inteira, não de um campo. Abaixo de 0.85 o sistema pede confirmação humana — use isso a seu favor: na dúvida, seja conservador.
6. pergunta_confirmacao: uma frase curta, em português coloquial, que será enviada de volta no WhatsApp pedindo confirmação. Deve repetir os dados extraídos pra pessoa conferir e terminar pedindo SIM. Null quando kind = nao_identificado.
7. raciocinio: uma frase explicando a decisão, para o gestor que revisa no painel.
8. descricao: O QUE foi pago ou o que é o documento, em 1 a 5 palavras, como entraria numa planilha ("cimento", "areia para reboco", "M.O. pintura", "taxa de alvará"). Nunca repita a frase inteira, nem valor, fornecedor, obra ou data.
9. categoria_nome: escolha a conta do plano de contas quando o item deixa claro — material de estrutura, concreto, aço, madeira de caixaria, cimento e areia → Estrutura; reboco/argamassa → Reboco; tinta → Pintura; fio, disjuntor, eletricista → Elétrica; cano, registro, hidráulico → Hidráulica; entulho, caçamba, faxina → Limpeza; M.O. de empreiteiro → a etapa que ele executa. Só null quando não dá para saber.

Nunca invente dados que não estão na mensagem. Faltou informação, o campo é null.`;

function obraDoGrupo(input: ClassifierInput) {
  return input.contexto.grupoObraId
    ? input.contexto.obrasAtivas.find((o) => o.id === input.contexto.grupoObraId)
    : undefined;
}

/** O contexto em texto que vai junto com a mensagem (e com a mídia). */
export function montarContextoTexto(input: ClassifierInput): string {
  const hoje = hojeBR();
  return [
    `Data de hoje: ${hoje}`,
    '',
    'Obras ativas (copie o nome exato; entre parênteses, como a equipe chama):',
    ...(input.contexto.obrasAtivas.length > 0
      ? input.contexto.obrasAtivas.map(
          (o) => `- ${o.nome}${o.apelidos?.length ? ` (${o.apelidos.join(', ')})` : ''}`,
        )
      : ['- (nenhuma obra ativa cadastrada)']),
    '',
    'Fornecedores conhecidos (copie o nome exato):',
    ...(input.contexto.fornecedoresConhecidos.length > 0
      ? input.contexto.fornecedoresConhecidos.map((f) => `- ${f.nome}`)
      : ['- (nenhum fornecedor cadastrado)']),
    '',
    'Categorias (plano de contas; copie o nome exato):',
    ...(input.contexto.categorias?.length
      ? input.contexto.categorias.map((c) => `- ${c.nome}`)
      : ['- (nenhuma categoria cadastrada)']),
    '',
    `Telefone do remetente: ${input.telefone}`,
    obraDoGrupo(input)
      ? `Obra do grupo de origem (default quando a mensagem não cita outra): ${obraDoGrupo(input)?.nome}`
      : 'Mensagem sem grupo dedicado a uma obra.',
    input.midiaMime ? `Anexo recebido, tipo: ${input.midiaMime}` : 'Sem anexo.',
    '',
    'Mensagem:',
    input.texto?.trim() || '(sem texto — só anexo)',
  ].join('\n');
}

/**
 * Relê a mídia do Storage quando o formato é um que as APIs entendem. Qualquer
 * falha vira aviso no log e o modelo segue só com o texto — nunca derruba a
 * classificação por causa do anexo.
 */
export async function carregarMidia(
  input: ClassifierInput,
  deps: DepsClassificador,
): Promise<MidiaCarregada | null> {
  const mime = input.midiaMime?.split(';')[0]?.trim().toLowerCase() ?? null;
  if (!input.midiaStoragePath || !mime || !mimeSuportado(mime)) return null;
  try {
    const bytes = await deps.baixarMidia(input.midiaStoragePath);
    if (!bytes) {
      log.aviso('midia_nao_lida', { storage_path: input.midiaStoragePath });
      return null;
    }
    // O mime é o que o provider declarou; a assinatura é o que garante que
    // os bytes são o que dizem ser (mesma regra dos uploads do painel).
    const assinatura = validateFileMagicBytes(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      mime,
    );
    if (!assinatura.ok) {
      log.aviso('midia_assinatura_invalida', { storage_path: input.midiaStoragePath, mime });
      return null;
    }
    return { bytes, mime };
  } catch (err) {
    log.aviso('midia_nao_lida', { storage_path: input.midiaStoragePath, err });
    return null;
  }
}

/**
 * Converte a saída do modelo no contrato interno, descartando IDs que não
 * existem no contexto enviado.
 *
 * Exportada para teste: é a barreira entre "o que o modelo disse" e "o que
 * vira linha no banco", e é a parte que dá pra verificar sem chamar a API.
 */
export function montarSaida(saida: Saida, input: ClassifierInput): ClassifierOutput {
  // Nome → id é aqui, determinístico. Obra citada que não casa com nenhuma
  // ativa fica sem id (o fluxo pergunta); fornecedor citado que não casa
  // vira `fornecedor_nome_novo` (o "SIM" cria o cadastro).
  const obra = resolverPorNome(saida.obra_nome, input.contexto.obrasAtivas);
  const fornecedor = resolverPorNome(saida.fornecedor_nome, input.contexto.fornecedoresConhecidos);
  const categoria = resolverPorNome(saida.categoria_nome, input.contexto.categorias ?? []);
  const obraId = obra?.id;
  const fornecedorId = fornecedor?.id;

  const obraNaoCasou = Boolean(normalizarNome(saida.obra_nome)) && obraId === undefined;

  const extracted: ClassifierOutput['extracted'] = {
    raciocinio: obraNaoCasou
      ? `${saida.raciocinio} [aviso: a obra citada ("${saida.obra_nome}") não casou com nenhuma obra ativa]`
      : saida.raciocinio,
  };

  if (saida.valor != null && saida.valor > 0) extracted.valor = saida.valor;
  if (saida.data_pagamento && /^\d{4}-\d{2}-\d{2}$/u.test(saida.data_pagamento)) {
    extracted.data_pagamento = saida.data_pagamento;
  }
  if (obraId) extracted.obra_id = obraId;
  if (fornecedorId) extracted.fornecedor_id = fornecedorId;
  else if (normalizarNome(saida.fornecedor_nome)) {
    extracted.fornecedor_nome_novo = String(saida.fornecedor_nome).trim().slice(0, 200);
  }
  if (categoria) extracted.categoria_id = categoria.id;
  if (saida.tipo_documento) extracted.tipo_documento = saida.tipo_documento;
  if (saida.numero_nf) extracted.numero_nf = saida.numero_nf;
  if (saida.descricao) extracted.descricao = saida.descricao;
  if (saida.kind === 'documento_obra') extracted.categoria = saida.categoria ?? 'outro';
  if (saida.kind === 'registro_obra' && saida.resumo) extracted.resumo = saida.resumo.slice(0, 80);
  // Sem obra citada, a do grupo vale — o modelo às vezes deixa null mesmo com
  // o contexto dizendo qual é.
  if (!extracted.obra_id && input.contexto.grupoObraId) {
    const doGrupo = input.contexto.obrasAtivas.find((o) => o.id === input.contexto.grupoObraId);
    if (doGrupo) extracted.obra_id = doGrupo.id;
  }

  // Obra citada que não casou: a extração é menos confiável do que o modelo
  // achou. Abaixo do limiar de auto-aprovação, em vez de confiar no número.
  const confidence = obraNaoCasou ? Math.min(saida.confidence, 0.5) : saida.confidence;

  // Coerência: sem valor ou sem obra não existe "pagamento completo",
  // independente do que o modelo tenha rotulado.
  let kind: Saida['kind'] =
    saida.kind === 'pagamento_completo' && (extracted.valor == null || extracted.obra_id == null)
      ? 'pagamento_parcial'
      : saida.kind;

  // Anexo nunca é "nada": foto de canteiro com legenda "inox" voltou como
  // nao_identificado no teste 4 de 16/09 e sumiu em silêncio. Um arquivo
  // mandado no grupo da obra sempre vale guardar — vira documento_obra, na
  // pasta fotos (imagem) ou outro (PDF), como o mock já fazia.
  const mimeAnexo = input.midiaMime?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (kind === 'nao_identificado' && mimeAnexo) {
    kind = 'documento_obra';
    // Foto e vídeo de canteiro vão para a pasta Fotos; o resto para Outro.
    extracted.categoria =
      mimeAnexo.startsWith('image/') || mimeAnexo.startsWith('video/') ? 'fotos' : 'outro';
    if (!extracted.tipo_documento) extracted.tipo_documento = 'outro';
    extracted.raciocinio =
      `${extracted.raciocinio ?? ''} [anexo sem classificação vira documento da obra]`.trim();
  }

  return {
    kind,
    confidence,
    extracted,
    ...(saida.pergunta_confirmacao ? { perguntaConfirmacao: saida.pergunta_confirmacao } : {}),
  };
}
