import 'server-only';
import { logger } from '@/lib/log';
import {
  MAX_BYTES_IMAGEM,
  MAX_BYTES_PDF,
  MIME_PDF,
  type MidiaCarregada,
} from './classificador-comum';

/**
 * O que é comum a tudo que fala com a OpenAI neste projeto: chave, modelo,
 * chamada ao Chat Completions e o bloco de mídia (imagem ou PDF).
 *
 * ## Por que OpenAI, e por que estes modelos
 *
 * Decisão do usuário em 2026-09-15: toda a IA passa a ser OpenAI (a conta tem
 * tráfego gratuito diário — 250 mil tokens/dia em gpt-5.x/gpt-4.1/gpt-4o, e
 * 2,5 milhões/dia nas variantes mini/nano). O classificador roda em toda
 * mensagem do grupo, com foto: fica no `gpt-5.4-mini` (faixa de 2,5 M, visão,
 * saída estruturada, raciocínio ajustável). Testado em 2026-09-15: leu o valor
 * de um PDF e classificou texto, imagem e PDF com `json_schema` estrito.
 *
 * ## Sem SDK
 *
 * `fetch` direto, como a transcrição e os embeddings já faziam. Uma dependência
 * a menos no bundle da função, e o contrato HTTP é pequeno.
 */

const log = logger('openai');

export const MODELO_PADRAO = 'gpt-5.4-mini';
export const TIMEOUT_MS = 55_000;

export function openaiDisponivel(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function modeloOpenAI(): string {
  return process.env.IA_MODEL ?? MODELO_PADRAO;
}

/** gpt-5.x e o-series aceitam `reasoning_effort`; gpt-4.x/4o não. */
export function aceitaRaciocinio(modelo: string): boolean {
  return /^(gpt-5|o[1-9])/u.test(modelo);
}

export type ParteDeConteudo =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface MensagemChat {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ParteDeConteudo[] | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface RespostaChat {
  choices: Array<{
    message: {
      content: string | null;
      refusal?: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export type ResultadoChat =
  | { ok: true; resposta: RespostaChat }
  | { ok: false; status: number; detalhe: string };

/**
 * Uma chamada ao Chat Completions. Não lança: devolve `{ ok: false }` com o
 * status, para quem chama decidir (o classificador refaz sem o anexo num 400;
 * o assistente cai no texto fixo).
 */
export async function chatCompletions(
  corpo: Record<string, unknown>,
  opts: { timeoutMs?: number } = {},
): Promise<ResultadoChat> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, status: 0, detalhe: 'OPENAI_API_KEY ausente' };

  const modelo = String(corpo.model ?? modeloOpenAI());
  const body: Record<string, unknown> = { ...corpo, model: modelo };
  if (!aceitaRaciocinio(modelo)) delete body.reasoning_effort;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
    });
    if (!r.ok) {
      const texto = await r.text().catch(() => '');
      log.aviso('chat_http', { status: r.status, modelo, corpo: texto.slice(0, 300) });
      return { ok: false, status: r.status, detalhe: texto.slice(0, 300) };
    }
    return { ok: true, resposta: (await r.json()) as RespostaChat };
  } catch (err) {
    log.aviso('chat_excecao', { modelo, err });
    return { ok: false, status: 0, detalhe: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Bloco de mídia no formato da OpenAI: imagem como `image_url` (data URI) e
 * PDF como `file`. Mídia acima do limite vira `null` — quem chama avisa no
 * texto que havia um anexo que não foi lido.
 */
export function blocoDeMidia(midia: MidiaCarregada, nomeArquivo = 'anexo'): ParteDeConteudo | null {
  const ehPdf = midia.mime === MIME_PDF;
  const limite = ehPdf ? MAX_BYTES_PDF : MAX_BYTES_IMAGEM;
  if (midia.bytes.byteLength > limite) return null;

  const data = Buffer.from(midia.bytes).toString('base64');
  if (ehPdf) {
    return {
      type: 'file',
      file: {
        filename: nomeArquivo.endsWith('.pdf') ? nomeArquivo : `${nomeArquivo}.pdf`,
        file_data: `data:application/pdf;base64,${data}`,
      },
    };
  }
  return {
    type: 'image_url',
    image_url: { url: `data:${midia.mime};base64,${data}`, detail: 'auto' },
  };
}
