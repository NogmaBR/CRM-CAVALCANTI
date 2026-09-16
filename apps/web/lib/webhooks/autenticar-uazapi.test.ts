import { describe, expect, it } from 'vitest';
import { autenticarWebhookUazapi } from './autenticar-uazapi';
import { signHmac } from './hmac';

const ENV = { hmacSecret: 'segredo-hmac', uazapiToken: 'token-da-instancia' };

describe('autenticarWebhookUazapi', () => {
  it('HMAC válido autentica, mesmo sem token no corpo', () => {
    const body = JSON.stringify({ event: 'messages' });
    const r = autenticarWebhookUazapi(
      body,
      JSON.parse(body),
      { signature: signHmac(body, ENV.hmacSecret) },
      ENV,
    );
    expect(r).toBe('hmac');
  });

  it('token da instância no corpo autentica (é como o UAZAPI vem, sem assinatura)', () => {
    const body = JSON.stringify({
      EventType: 'messages',
      token: 'token-da-instancia',
      message: {},
    });
    expect(autenticarWebhookUazapi(body, JSON.parse(body), { signature: null }, ENV)).toBe('token');
  });

  it('token errado, vazio, ou de outro tipo não autentica', () => {
    for (const token of ['outro', '', 42, null, undefined]) {
      const body = JSON.stringify({ token });
      expect(autenticarWebhookUazapi(body, JSON.parse(body), { signature: null }, ENV)).toBeNull();
    }
  });

  it('sem UAZAPI_TOKEN no ambiente, o corpo não prova nada', () => {
    const body = JSON.stringify({ token: 'token-da-instancia' });
    expect(
      autenticarWebhookUazapi(
        body,
        JSON.parse(body),
        { signature: null },
        { ...ENV, uazapiToken: undefined },
      ),
    ).toBeNull();
  });

  it('HMAC inválido não é salvo por token errado', () => {
    const body = JSON.stringify({ token: 'errado' });
    expect(
      autenticarWebhookUazapi(body, JSON.parse(body), { signature: 'a'.repeat(64) }, ENV),
    ).toBeNull();
  });
});
