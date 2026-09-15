import 'server-only';
import { montarConteudo } from '@/lib/ia/anthropic-classifier';
import { logger } from '@/lib/log';
import { validateFileMagicBytes } from '@/lib/schemas/documento';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Transcrição de imagem e PDF escaneado pelo modelo com visão.
 *
 * Só existe com `IA_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` — a mesma chave
 * que liga o classificador. Sem ela `visaoDisponivel()` é falso e a extração
 * deixa o documento sem texto, em vez de fingir.
 *
 * Reaproveita `montarConteudo` do classificador (bloco `image`/`document` em
 * base64, com os mesmos limites de tamanho) e a mesma checagem de assinatura
 * dos uploads: os bytes têm que ser o que o mime diz antes de ir ao modelo.
 */

const log = logger('acervo_visao');

const MODELO_PADRAO = 'claude-opus-5';
const MAX_TOKENS = 4096;

const INSTRUCOES = [
  'Você transcreve documentos de obra de uma construtora brasileira (notas fiscais, comprovantes, contratos, propostas, orçamentos, cronogramas, fotos de canteiro).',
  'Devolva SOMENTE o texto do documento, fiel e completo, na ordem em que aparece, sem comentários, sem cabeçalho seu, sem markdown.',
  'Mantenha valores, datas, números de nota, CNPJ e nomes exatamente como estão.',
  'Se for uma foto sem texto (ex.: canteiro de obra), descreva em uma frase o que se vê, começando com "Foto:".',
].join(' ');

export function visaoDisponivel(): boolean {
  return (
    (process.env.IA_PROVIDER ?? 'mock') === 'anthropic' && Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

export async function lerComVisao(bytes: Uint8Array, mime: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const assinatura = validateFileMagicBytes(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    mime,
  );
  if (!assinatura.ok) {
    log.aviso('assinatura_invalida', { mime });
    return null;
  }

  const conteudo = montarConteudo('Transcreva este documento.', { bytes, mime });
  if (typeof conteudo === 'string') {
    // `montarConteudo` devolve só texto quando o arquivo passa do limite da API.
    log.aviso('arquivo_grande_demais_para_visao', { mime, bytes: bytes.byteLength });
    return null;
  }

  const client = new Anthropic({ apiKey });
  try {
    const resposta = await client.messages.create({
      model: process.env.IA_MODEL ?? MODELO_PADRAO,
      max_tokens: MAX_TOKENS,
      system: INSTRUCOES,
      messages: [{ role: 'user', content: conteudo }],
    });
    const texto = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return texto.length > 0 ? texto : null;
  } catch (err) {
    log.aviso('visao_falhou', { mime, err });
    return null;
  }
}
