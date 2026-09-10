import 'server-only';
import { logger } from '@/lib/log';

const log = logger('uazapi');

/**
 * Cliente do UAZAPI — envio de mensagem e download de mídia.
 *
 * ## Por que isto existe no CRM
 *
 * O desenho original previa dois padrões (`docs/N8N-COMPLETO.md`): o CRM
 * mandando WhatsApp direto (Pattern A) ou o n8n fazendo isso (Pattern B). Na
 * prática nenhum dos dois estava de pé, e o Pattern B tem uma dependência
 * pesada — subir e manter uma instância n8n — pra uma necessidade que é
 * "mandar uma mensagem de texto".
 *
 * Com este módulo o fluxo completo (pergunta → resposta → lançamento) roda só
 * com o CRM e a credencial do UAZAPI. O n8n continua possível pra quem quiser
 * os workflows extras, mas deixa de ser pré-requisito do que foi contratado.
 *
 * ## Comportamento sem credencial
 *
 * Sem `UAZAPI_BASE_URL`/`UAZAPI_TOKEN` as funções não lançam: retornam
 * `{ ok: false, motivo: 'nao_configurado' }` e registram no log. A escolha é
 * proposital — hoje o projeto não tem essas credenciais, e um throw aqui
 * derrubaria o webhook inteiro (fazendo o UAZAPI retentar em loop) por causa
 * de um envio que é secundário ao registro da mensagem. O dado é gravado do
 * mesmo jeito; só a resposta automática fica em silêncio até a conta existir.
 */

export type ResultadoEnvio =
  | { ok: true; msgId: string | null }
  | { ok: false; motivo: 'nao_configurado' | 'http' | 'excecao'; detalhe?: string };

interface ConfigUazapi {
  baseUrl: string;
  token: string;
}

/** Timeout curto: estamos dentro do handler do webhook, que precisa responder rápido. */
const TIMEOUT_MS = 8_000;

/** Teto do download de mídia. Vercel serverless tem memória limitada e o
 *  provider pode apontar pra um arquivo arbitrariamente grande. */
export const LIMITE_MIDIA_BYTES = 20 * 1024 * 1024;

function config(): ConfigUazapi | null {
  const baseUrl = process.env.UAZAPI_BASE_URL?.replace(/\/+$/u, '');
  const token = process.env.UAZAPI_TOKEN;
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

/** `true` quando o envio de WhatsApp está realmente disponível. */
export function whatsappConfigurado(): boolean {
  return config() !== null;
}

/**
 * Envia uma mensagem de texto.
 *
 * `telefone` deve vir só com dígitos (o mesmo formato que `normalizeTelefone`
 * grava em `mensagens_whats.telefone_from`).
 */
export async function enviarTexto(telefone: string, texto: string): Promise<ResultadoEnvio> {
  const cfg = config();
  if (!cfg) {
    log.aviso('envio_ignorado_nao_configurado', {
      telefone,
      dica: 'UAZAPI_BASE_URL/UAZAPI_TOKEN ausentes: a mensagem foi processada, mas nenhuma resposta saiu.',
    });
    return { ok: false, motivo: 'nao_configurado' };
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: cfg.token,
      },
      body: JSON.stringify({ number: telefone, text: texto }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const corpo = await res.text().catch(() => '');
      log.erro('envio_falhou', { telefone, status: res.status, corpo: corpo.slice(0, 300) });
      return { ok: false, motivo: 'http', detalhe: `HTTP ${res.status}` };
    }

    // O id da mensagem enviada permite correlacionar a pergunta com a
    // resposta em `confirmacoes_pendentes.msg_id_pergunta_uazapi`.
    const json = (await res.json().catch(() => null)) as { id?: string; messageid?: string } | null;
    return { ok: true, msgId: json?.id ?? json?.messageid ?? null };
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : String(err);
    log.erro('envio_excecao', { telefone, detalhe });
    return { ok: false, motivo: 'excecao', detalhe };
  }
}

export type ResultadoMidia =
  | { ok: true; bytes: Uint8Array; mime: string }
  | { ok: false; motivo: 'sem_url' | 'http' | 'grande_demais' | 'excecao'; detalhe?: string };

/**
 * Baixa a mídia de uma mensagem a partir da URL que o provider mandou.
 *
 * Essa URL expira — por isso o download acontece durante o processamento do
 * webhook, e não sob demanda quando alguém abre a tela. Era exatamente a nota
 * "não fazemos download, a URL do UAZAPI expira" que ficou pendente em
 * `classify-and-persist`.
 */
export async function baixarMidia(url: string | null | undefined): Promise<ResultadoMidia> {
  if (!url) return { ok: false, motivo: 'sem_url' };

  const cfg = config();

  try {
    const res = await fetch(url, {
      headers: cfg ? { token: cfg.token } : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS * 2),
    });

    if (!res.ok) {
      return { ok: false, motivo: 'http', detalhe: `HTTP ${res.status}` };
    }

    // Checa o Content-Length antes de bufferizar, quando o provider informa.
    const tamanhoDeclarado = Number(res.headers.get('content-length') ?? '0');
    if (tamanhoDeclarado > LIMITE_MIDIA_BYTES) {
      return { ok: false, motivo: 'grande_demais', detalhe: `${tamanhoDeclarado} bytes` };
    }

    const buffer = new Uint8Array(await res.arrayBuffer());
    // Segunda checagem: sem Content-Length, só descobrimos o tamanho aqui.
    if (buffer.byteLength > LIMITE_MIDIA_BYTES) {
      return { ok: false, motivo: 'grande_demais', detalhe: `${buffer.byteLength} bytes` };
    }

    return {
      ok: true,
      bytes: buffer,
      mime: res.headers.get('content-type') ?? 'application/octet-stream',
    };
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : String(err);
    log.erro('download_midia_excecao', { detalhe });
    return { ok: false, motivo: 'excecao', detalhe };
  }
}
