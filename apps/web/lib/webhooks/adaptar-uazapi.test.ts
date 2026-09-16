import { UazapiInboundSchema, destinoDaResposta } from '@/lib/schemas/uazapi';
import { describe, expect, it } from 'vitest';
import { adaptarPayloadUazapi } from './adaptar-uazapi';

/**
 * O provider real (UAZAPI v2) manda `{ event, instance, message: {...} }`, com
 * o remetente em `sender`, o chat em `chatid` e o tipo em `messageType`. As
 * fixtures do projeto usam a forma canônica plana. O adaptador traduz uma na
 * outra ANTES do Zod, e não pode quebrar as fixtures que já passavam.
 *
 * Escrito pela documentação, sem credencial para conferir com um payload real
 * — o `formaDoPayload` loga a forma quando o Zod recusa, e é por ele que se
 * ajusta isto no primeiro contato.
 */

const V2_GRUPO = {
  event: 'messages',
  instance: 'cavalcanti',
  message: {
    messageid: '3EB0ABCDEF1234567890',
    chatid: '120363012345678901@g.us',
    sender: '5551981944829@s.whatsapp.net',
    senderName: 'Fernando',
    isGroup: true,
    fromMe: false,
    messageType: 'ImageMessage',
    messageTimestamp: 1788800100,
    text: 'NF do cimento',
    mediaType: 'image',
    mimetype: 'image/jpeg',
    fileName: 'nf.jpg',
    fileURL: 'https://media.example.com/x.jpg',
  },
};

describe('adaptarPayloadUazapi — v2 → canônico', () => {
  it('mensagem de grupo: from é o participante, chatId é o grupo', () => {
    const p = UazapiInboundSchema.parse(adaptarPayloadUazapi(V2_GRUPO));
    expect(p.id).toBe('3EB0ABCDEF1234567890');
    expect(p.type).toBe('image');
    expect(p.from).toBe('5551981944829@s.whatsapp.net');
    expect(p.chatId).toBe('120363012345678901@g.us');
    expect(p.isGroup).toBe(true);
    expect(p.senderName).toBe('Fernando');
    expect(p.text).toBe('NF do cimento');
    expect(p.media).toMatchObject({
      url: 'https://media.example.com/x.jpg',
      mimetype: 'image/jpeg',
      filename: 'nf.jpg',
    });
    expect(p.timestamp).toBe(1788800100);
    expect(destinoDaResposta(p)).toBe('120363012345678901@g.us');
  });

  it('mensagem privada: chatId é o próprio remetente e a resposta vai para ele', () => {
    const p = UazapiInboundSchema.parse(
      adaptarPayloadUazapi({
        event: 'messages',
        message: {
          messageid: 'M1',
          chatid: '5551981944829@s.whatsapp.net',
          sender: '5551981944829@s.whatsapp.net',
          isGroup: false,
          messageType: 'Conversation',
          messageTimestamp: 1788800100,
          text: 'sim',
        },
      }),
    );
    expect(p.type).toBe('text');
    expect(p.isGroup).toBe(false);
    expect(destinoDaResposta(p)).toBe('5551981944829@s.whatsapp.net');
  });

  it('mapeia os tipos do provider', () => {
    const tipo = (messageType: string, extra: Record<string, unknown> = {}) =>
      UazapiInboundSchema.parse(
        adaptarPayloadUazapi({
          message: {
            messageid: 'x',
            chatid: '5551999@s.whatsapp.net',
            sender: '5551999@s.whatsapp.net',
            messageType,
            ...extra,
          },
        }),
      ).type;
    expect(tipo('Conversation')).toBe('text');
    expect(tipo('ExtendedTextMessage')).toBe('text');
    expect(tipo('ImageMessage')).toBe('image');
    expect(tipo('DocumentMessage')).toBe('document');
    expect(tipo('DocumentWithCaptionMessage')).toBe('document');
    expect(tipo('AudioMessage')).toBe('audio');
    expect(tipo('VideoMessage')).toBe('video');
    expect(tipo('StickerMessage')).toBe('sticker');
    expect(tipo('LocationMessage')).toBe('location');
    // Desconhecido com mediaType cai no mediaType; sem nada, texto.
    expect(tipo('Esquisito', { mediaType: 'ptt' })).toBe('audio');
    expect(tipo('Esquisito')).toBe('text');
  });

  it('eco do que o CRM enviou pela API (fromMe + wasSentByApi) é descartado', () => {
    expect(
      adaptarPayloadUazapi({
        ...V2_GRUPO,
        message: { ...V2_GRUPO.message, fromMe: true, wasSentByApi: true },
      }),
    ).toBeNull();
  });

  it('fromMe sem dizer se foi pela API também é descartado (laço custa mais que uma foto)', () => {
    expect(
      adaptarPayloadUazapi({ ...V2_GRUPO, message: { ...V2_GRUPO.message, fromMe: true } }),
    ).toBeNull();
  });

  it('o dono do número mandando pelo celular (fromMe, wasSentByApi false) passa como remetente', () => {
    const p = UazapiInboundSchema.parse(
      adaptarPayloadUazapi({
        ...V2_GRUPO,
        owner: '5551999990000',
        message: {
          ...V2_GRUPO.message,
          fromMe: true,
          wasSentByApi: false,
          sender: '5551999990000@s.whatsapp.net',
        },
      }),
    );
    expect(p.from).toBe('5551999990000@s.whatsapp.net');
    expect(p.chatId).toBe('120363012345678901@g.us');
  });

  it('participante identificado por LID: sender_pn (telefone) é o from', () => {
    const p = UazapiInboundSchema.parse(
      adaptarPayloadUazapi({
        ...V2_GRUPO,
        message: {
          ...V2_GRUPO.message,
          sender: '123456789012345@lid',
          sender_pn: '5551981944829@s.whatsapp.net',
        },
      }),
    );
    expect(p.from).toBe('5551981944829@s.whatsapp.net');
  });

  it('evento que não é mensagem é descartado', () => {
    expect(adaptarPayloadUazapi({ event: 'connection', instance: 'x', status: 'open' })).toBeNull();
  });

  it('forma canônica (fixtures) passa intacta', () => {
    const canonico = {
      id: '3EB0IMG1234567890ABCDEF',
      type: 'image',
      timestamp: 1788800100,
      from: '5511987654321',
      text: 'NF do cimento — obra Beta',
      media: { url: 'https://x/y.jpg', mimetype: 'image/jpeg' },
    };
    expect(adaptarPayloadUazapi(canonico)).toBe(canonico);
    const p = UazapiInboundSchema.parse(canonico);
    expect(p.chatId).toBeUndefined();
    expect(destinoDaResposta(p)).toBe('5511987654321');
  });

  it('timestamp em ms vira segundos; ausente vira agora', () => {
    const p = UazapiInboundSchema.parse(
      adaptarPayloadUazapi({
        message: {
          messageid: 'x',
          chatid: '5551999@s.whatsapp.net',
          sender: '5551999@s.whatsapp.net',
          messageType: 'Conversation',
          messageTimestamp: 1788800100123,
        },
      }),
    );
    expect(p.timestamp).toBe(1788800100);
  });
});
