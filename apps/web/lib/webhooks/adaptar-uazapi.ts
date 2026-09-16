/**
 * Adapta o payload real do UAZAPI (v2) para a forma canônica que o Zod valida
 * (`UazapiInboundSchema`).
 *
 * ## Por que existe
 *
 * O schema canônico do projeto é plano (`id`, `type`, `from`, `text`, `media`)
 * e nasceu das fixtures antes de haver credencial. O provider real manda
 * `{ event, instance, message: { messageid, chatid, sender, isGroup,
 * messageType, text, fileURL, ... } }`. Traduzir aqui, antes do Zod, mantém
 * as fixtures e o resto do pipeline como estão.
 *
 * ## Grupo
 *
 * É aqui que `from` passa a ser o **participante** (`sender`) e `chatId` o
 * grupo (`chatid`). O resto do fluxo autoriza por `from` e responde para
 * `chatId` — sem o adaptador, uma mensagem de grupo seria autorizada pelo
 * id do grupo (nunca cadastrado) e ignorada.
 *
 * ## O dono do número também manda mensagem
 *
 * No grupo do cliente, o número da instância é o do próprio Cavalcanti — e
 * ele é quem mais manda foto de nota. Essas mensagens chegam com
 * `fromMe: true`. O que NÃO pode entrar é o eco do que o CRM mesmo enviou
 * pela API (`wasSentByApi: true`), senão a resposta "confirma?" vira
 * mensagem nova e o laço não acaba. Regra: `fromMe` só passa quando o
 * provider diz explicitamente `wasSentByApi: false`; sem o campo, descarta —
 * o custo de errar é um laço infinito.
 *
 * ## LID
 *
 * O WhatsApp passou a identificar participantes de grupo por LID
 * (`…@lid`) em vez do telefone. O provider resolve para `sender_pn` quando
 * consegue; é ele que serve para autorizar. Sem `sender_pn`, fica o `sender`
 * e a autorização por telefone não casa — o log mostra `from` terminando
 * em `@lid`.
 *
 * ## Conferir no primeiro contato real
 *
 * Escrito pela documentação pública do provider (OpenAPI de docs.uazapi.com,
 * schema `Message`). Se o Zod recusar, o webhook loga `formaDoPayload`
 * (chaves e tipos, nunca valores): é por ele que se ajusta este mapa.
 */

type Tipo = 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location';

const POR_MESSAGE_TYPE: Record<string, Tipo> = {
  conversation: 'text',
  extendedtextmessage: 'text',
  imagemessage: 'image',
  documentmessage: 'document',
  documentwithcaptionmessage: 'document',
  audiomessage: 'audio',
  pttmessage: 'audio',
  videomessage: 'video',
  stickermessage: 'sticker',
  locationmessage: 'location',
  livelocationmessage: 'location',
};

const POR_MEDIA_TYPE: Record<string, Tipo> = {
  image: 'image',
  document: 'document',
  audio: 'audio',
  ptt: 'audio',
  video: 'video',
  sticker: 'sticker',
  location: 'location',
};

function tipoDe(messageType: unknown, mediaType: unknown): Tipo {
  const mt = typeof messageType === 'string' ? messageType.toLowerCase() : '';
  if (POR_MESSAGE_TYPE[mt]) return POR_MESSAGE_TYPE[mt];
  const md = typeof mediaType === 'string' ? mediaType.toLowerCase() : '';
  if (POR_MEDIA_TYPE[md]) return POR_MEDIA_TYPE[md];
  return 'text';
}

function texto(m: Record<string, unknown>): string | undefined {
  for (const chave of ['text', 'caption', 'body', 'content']) {
    const v = m[chave];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

function timestamp(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v > 1e12 ? Math.floor(v / 1000) : v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n > 1e12 ? Math.floor(n / 1000) : n;
    const d = Date.parse(v);
    if (!Number.isNaN(d)) return Math.floor(d / 1000);
  }
  return Math.floor(Date.now() / 1000);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Devolve o payload canônico, o próprio `raw` quando já é canônico, ou `null`
 * quando o evento não é uma mensagem recebida (status de conexão, mensagem
 * enviada pela própria instância) e deve ser ignorado com 200.
 */
export function adaptarPayloadUazapi(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = raw as Record<string, unknown>;

  const m = r.message;
  if (!m || typeof m !== 'object') {
    // Sem `message`: ou é canônico (tem `id` e `from`) ou é outro evento.
    if (typeof r.id === 'string' && typeof r.from === 'string') return raw;
    if (typeof r.event === 'string') return null;
    return raw;
  }

  const msg = m as Record<string, unknown>;
  if (msg.fromMe === true && msg.wasSentByApi !== false) return null;

  const id =
    str(msg.messageid) ?? str(msg.id) ?? str(msg.key && (msg.key as Record<string, unknown>).id);
  const chatId = str(msg.chatid) ?? str(msg.chatId) ?? str(msg.remoteJid);
  const sender =
    str(msg.sender_pn) ??
    str(msg.sender) ??
    str(msg.participant) ??
    (msg.fromMe === true ? str(r.owner) : undefined) ??
    chatId;
  if (!id || !sender) return raw;

  const isGroup =
    typeof msg.isGroup === 'boolean' ? msg.isGroup : Boolean(chatId?.endsWith('@g.us'));
  const type = tipoDe(msg.messageType, msg.mediaType);

  const url = str(msg.fileURL) ?? str(msg.mediaUrl) ?? str(msg.url);
  const media =
    type === 'text' && !url
      ? undefined
      : {
          url,
          mimetype: str(msg.mimetype) ?? str(msg.mimeType),
          filename: str(msg.fileName) ?? str(msg.filename),
          size: typeof msg.fileLength === 'number' ? msg.fileLength : undefined,
        };

  return {
    id,
    type,
    timestamp: timestamp(msg.messageTimestamp ?? msg.timestamp),
    from: sender,
    chatId,
    isGroup,
    senderName: str(msg.senderName) ?? str(msg.pushName),
    text: texto(msg),
    media,
    raw,
  };
}
