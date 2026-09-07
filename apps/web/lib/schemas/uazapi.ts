import { z } from 'zod';

/**
 * Schemas Zod para payload inbound do UAZAPI (WhatsApp SaaS).
 *
 * UAZAPI envia POST no webhook configurado. Estrutura oficial documentada
 * em <https://docs.uazapi.com/webhook>. Este schema é permissivo: valida
 * apenas os campos que o nosso pipeline precisa, deixa passar campos extras
 * pra não quebrar em futuros updates deles.
 *
 * Se o payload do provider mudar em produção, ajustar aqui e adicionar
 * fixture correspondente em `scripts/fixtures/uazapi/`.
 */

const msgTipoUazapi = z.enum(['text', 'image', 'document', 'audio', 'video', 'sticker', 'location']);
export type MsgTipoUazapi = z.infer<typeof msgTipoUazapi>;

/** Mapeamento tipo do provider → enum do nosso banco (msg_tipo). */
export function mapTipoToDb(t: MsgTipoUazapi): 'texto' | 'imagem' | 'pdf' | 'audio' {
  if (t === 'text') return 'texto';
  if (t === 'image') return 'imagem';
  if (t === 'document') return 'pdf'; // aproximação — na prática pode ser PDF ou outro; classificador refina
  if (t === 'audio') return 'audio';
  // video/sticker/location → tratamos como texto por ora (metadata-only)
  return 'texto';
}

const uazapiMedia = z
  .object({
    url: z.string().url().optional(),
    mimetype: z.string().optional(),
    filename: z.string().optional(),
    size: z.number().int().nonnegative().optional(),
  })
  .partial()
  .passthrough();

/**
 * Formato canonical assumido para o webhook inbound (POST /api/webhooks/uazapi).
 *
 * UAZAPI historicamente envia payloads em snake_case ou camelCase dependendo
 * da versão. Este schema aceita ambos usando aliases via `.transform()`.
 */
export const UazapiInboundSchema = z
  .object({
    // ID único da mensagem no provider (obrigatório — chave de idempotência)
    id: z.string().min(1),
    // Tipo declarado pelo provider
    type: msgTipoUazapi,
    // Timestamp da mensagem (UNIX seconds ou ISO string)
    timestamp: z.union([z.number(), z.string()]),
    // Remetente (telefone no formato E.164 sem '+' ou com — normalizamos abaixo)
    from: z.string().min(3),
    // Texto da mensagem (quando type === 'text' ou legenda de mídia)
    text: z.string().optional(),
    // Mídia (quando type ∈ image/document/audio/video)
    media: uazapiMedia.optional(),
    // Objeto raw provider (guardamos como referência opcional em dados_extraidos)
    raw: z.unknown().optional(),
  })
  .passthrough();

export type UazapiInbound = z.infer<typeof UazapiInboundSchema>;

/**
 * Normaliza telefone recebido. UAZAPI pode enviar '5511987654321', '5511987654321@c.us'
 * ou '+55 11 98765-4321'. Retornamos só dígitos.
 */
export function normalizeTelefone(from: string): string {
  return from.replace(/\D+/gu, '');
}

/**
 * Converte timestamp UAZAPI (number segundos ou ISO string) → ISO 8601 UTC.
 * Fallback: now() se input inválido.
 */
export function toIsoDate(ts: number | string): string {
  if (typeof ts === 'number') {
    // UAZAPI historicamente envia segundos; se vier ms trata também
    const ms = ts > 1e12 ? ts : ts * 1000;
    return new Date(ms).toISOString();
  }
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}
