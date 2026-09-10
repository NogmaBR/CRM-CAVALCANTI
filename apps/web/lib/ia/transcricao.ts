import 'server-only';
import { logger } from '@/lib/log';

const log = logger('transcricao');

/**
 * Transcrição de áudio recebido pelo WhatsApp.
 *
 * O briefing lista "cliente envia áudio, texto ou documento" como entrada do
 * fluxo, mas áudio era o único dos três que não tinha caminho nenhum: sem
 * transcrição, o classificador recebia `texto: null` e a mensagem caía direto
 * em `nao_identificado`. Na obra, áudio é justamente o formato mais usado —
 * quem está no canteiro fala, não digita.
 *
 * Provider escolhido por env (`IA_TRANSCRICAO_PROVIDER`):
 *   - `none` (default): não transcreve. O áudio é gravado e vira pendência
 *     pro gestor ouvir no painel — o comportamento de hoje, mas explícito.
 *   - `openai`: Whisper via API. É o provider da conta que o cliente já
 *     abriu; a Anthropic não oferece speech-to-text, então não há branch
 *     equivalente pra ela aqui.
 *
 * O default é `none` de propósito: sem chave configurada, o sistema não
 * falha nem gasta — só não transcreve, e diz isso no log.
 */

export type ResultadoTranscricao =
  | { ok: true; texto: string; provider: string }
  | { ok: false; motivo: 'desativado' | 'sem_chave' | 'http' | 'excecao'; detalhe?: string };

/** Áudios de WhatsApp são curtos; acima disso é quase certo não ser recado de obra. */
const LIMITE_AUDIO_BYTES = 25 * 1024 * 1024;

const TIMEOUT_MS = 30_000;

export function transcricaoAtiva(): boolean {
  return (process.env.IA_TRANSCRICAO_PROVIDER ?? 'none') !== 'none';
}

export async function transcreverAudio(
  bytes: Uint8Array,
  mime: string,
): Promise<ResultadoTranscricao> {
  const provider = process.env.IA_TRANSCRICAO_PROVIDER ?? 'none';

  if (provider === 'none') {
    return { ok: false, motivo: 'desativado' };
  }

  if (bytes.byteLength > LIMITE_AUDIO_BYTES) {
    return {
      ok: false,
      motivo: 'excecao',
      detalhe: `áudio de ${bytes.byteLength} bytes excede o limite de ${LIMITE_AUDIO_BYTES}`,
    };
  }

  if (provider === 'openai') return transcreverComOpenAI(bytes, mime);

  return {
    ok: false,
    motivo: 'excecao',
    detalhe: `IA_TRANSCRICAO_PROVIDER desconhecido: ${provider}. Suportados: none, openai`,
  };
}

/** Extensão que a API espera no nome do arquivo, derivada do MIME do provider. */
function extensaoPara(mime: string): string {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  const mapa: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
  };
  // WhatsApp manda ogg/opus na esmagadora maioria dos casos.
  return mapa[base] ?? 'ogg';
}

async function transcreverComOpenAI(
  bytes: Uint8Array,
  mime: string,
): Promise<ResultadoTranscricao> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) {
    log.aviso('sem_chave', {
      dica: 'IA_TRANSCRICAO_PROVIDER=openai mas OPENAI_API_KEY está vazia.',
    });
    return { ok: false, motivo: 'sem_chave' };
  }

  const modelo = process.env.OPENAI_TRANSCRICAO_MODEL ?? 'whisper-1';

  try {
    const form = new FormData();
    form.append(
      'file',
      new Blob([bytes as BlobPart], { type: mime }),
      `audio.${extensaoPara(mime)}`,
    );
    form.append('model', modelo);
    // Fixar o idioma melhora bastante a precisão em áudio de obra, que tem
    // ruído de fundo e vocabulário regional.
    form.append('language', 'pt');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const corpo = await res.text().catch(() => '');
      log.erro('http_falhou', { status: res.status, corpo: corpo.slice(0, 300) });
      return { ok: false, motivo: 'http', detalhe: `HTTP ${res.status}` };
    }

    const json = (await res.json()) as { text?: string };
    const texto = json.text?.trim();
    if (!texto) return { ok: false, motivo: 'excecao', detalhe: 'resposta sem campo text' };

    return { ok: true, texto, provider: `openai:${modelo}` };
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : String(err);
    log.erro('excecao', { detalhe });
    return { ok: false, motivo: 'excecao', detalhe };
  }
}
