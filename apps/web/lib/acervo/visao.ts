import 'server-only';
import { blocoDeMidia, chatCompletions, modeloOpenAI, openaiDisponivel } from '@/lib/ia/openai';
import { logger } from '@/lib/log';
import { validateFileMagicBytes } from '@/lib/schemas/documento';

/**
 * Transcrição de imagem e PDF escaneado pelo modelo com visão (OpenAI).
 *
 * Só existe com `IA_PROVIDER=openai` + `OPENAI_API_KEY` — a mesma chave que
 * liga o classificador. Sem ela `visaoDisponivel()` é falso e a extração deixa
 * o documento sem texto, em vez de fingir.
 *
 * Mesma checagem de assinatura dos uploads: os bytes têm que ser o que o mime
 * diz antes de ir ao modelo. Provider Anthropic não tem visão aqui de
 * propósito — a decisão de 2026-09-15 é uma chave só.
 */

const log = logger('acervo_visao');

const MAX_TOKENS = 4096;

const INSTRUCOES = [
  'Você transcreve documentos de obra de uma construtora brasileira (notas fiscais, comprovantes, contratos, propostas, orçamentos, cronogramas, fotos de canteiro).',
  'Devolva SOMENTE o texto do documento, fiel e completo, na ordem em que aparece, sem comentários, sem cabeçalho seu, sem markdown.',
  'Mantenha valores, datas, números de nota, CNPJ e nomes exatamente como estão.',
  'Se for uma foto sem texto (ex.: canteiro de obra), descreva em uma frase o que se vê, começando com "Foto:".',
].join(' ');

export function visaoDisponivel(): boolean {
  return (process.env.IA_PROVIDER ?? 'mock') === 'openai' && openaiDisponivel();
}

export async function lerComVisao(bytes: Uint8Array, mime: string): Promise<string | null> {
  if (!openaiDisponivel()) return null;

  const assinatura = validateFileMagicBytes(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    mime,
  );
  if (!assinatura.ok) {
    log.aviso('assinatura_invalida', { mime });
    return null;
  }

  const bloco = blocoDeMidia({ bytes, mime }, 'documento');
  if (!bloco) {
    log.aviso('arquivo_grande_demais_para_visao', { mime, bytes: bytes.byteLength });
    return null;
  }

  const r = await chatCompletions({
    model: modeloOpenAI(),
    messages: [
      { role: 'system', content: INSTRUCOES },
      { role: 'user', content: [bloco, { type: 'text', text: 'Transcreva este documento.' }] },
    ],
    max_completion_tokens: MAX_TOKENS,
    reasoning_effort: 'low',
  });
  if (!r.ok) {
    log.aviso('visao_falhou', { mime, status: r.status });
    return null;
  }
  const texto = r.resposta.choices[0]?.message.content?.trim() ?? '';
  return texto.length > 0 ? texto : null;
}
