import { describe, expect, it } from 'vitest';
import { avaliarWebhook, urlDoWebhook } from './diagnostico';

const URL_ = 'https://crm-cavalcanti.vercel.app/api/webhooks/uazapi';

describe('avaliarWebhook', () => {
  it('configuração certa: tudo verde', () => {
    const r = avaliarWebhook(
      [{ url: URL_, enabled: true, events: ['messages'], excludeMessages: ['wasSentByApi'] }],
      URL_,
    );
    expect(r.every((c) => c.ok)).toBe(true);
    expect(r.map((c) => c.item)).toEqual([
      'URL',
      'Habilitado',
      'Evento "messages"',
      'Filtro "wasSentByApi"',
      'Grupos',
      'Mensagens do dono do número',
      'URL sem sufixos',
    ]);
  });

  it('a tela do provider sugere excluir isGroupYes — isso mataria o grupo, e a checagem acusa', () => {
    const r = avaliarWebhook(
      [{ url: URL_, events: ['messages'], excludeMessages: ['wasSentByApi', 'isGroupYes'] }],
      URL_,
    );
    expect(r.find((c) => c.item === 'Grupos')?.ok).toBe(false);
  });

  it('URL apontando para outro lugar é o único item, com o que está configurado', () => {
    const r = avaliarWebhook(
      [{ url: 'https://webhook.exemplo.com/x', events: ['messages'] }],
      URL_,
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.ok).toBe(false);
    expect(r[0]?.detalhe).toContain('webhook.exemplo.com');
  });

  it('barra final e maiúsculas na URL não contam como diferença', () => {
    const r = avaliarWebhook([{ url: `${URL_.toUpperCase()}/`, events: ['messages'] }], URL_);
    expect(r[0]?.ok).toBe(true);
  });

  it('sem "messages", com sufixos na URL, desabilitado: cada um acusa', () => {
    const r = avaliarWebhook(
      [
        {
          url: URL_,
          enabled: false,
          events: ['connection'],
          addUrlEvents: true,
          excludeMessages: [],
        },
      ],
      URL_,
    );
    const por = Object.fromEntries(r.map((c) => [c.item, c.ok]));
    expect(por.Habilitado).toBe(false);
    expect(por['Evento "messages"']).toBe(false);
    expect(por['URL sem sufixos']).toBe(false);
    expect(por['Filtro "wasSentByApi"']).toBe(false);
  });

  it('provider inalcançável vira uma linha vermelha, não exceção', () => {
    expect(avaliarWebhook(null, URL_)).toEqual([expect.objectContaining({ ok: false })]);
  });

  it('urlDoWebhook usa a URL do app sem barra dupla', () => {
    expect(urlDoWebhook('https://crm-cavalcanti.vercel.app/')).toBe(URL_);
  });
});
