import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyHmacSignature, signHmac } from './hmac';

const SECRET = 'test-secret-nao-usar-em-producao';
const BODY = '{"id":"msg-1","from":"5511999999999","text":"Paguei 500 reais"}';

describe('signHmac', () => {
  it('gera hex de 64 chars (SHA-256)', () => {
    const sig = signHmac(BODY, SECRET);
    expect(sig).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('é determinístico para o mesmo par body+secret', () => {
    expect(signHmac(BODY, SECRET)).toBe(signHmac(BODY, SECRET));
  });

  it('muda se o body mudar em um único byte', () => {
    expect(signHmac(BODY, SECRET)).not.toBe(signHmac(`${BODY} `, SECRET));
  });

  it('muda se o secret mudar', () => {
    expect(signHmac(BODY, SECRET)).not.toBe(signHmac(BODY, `${SECRET}x`));
  });
});

describe('verifyHmacSignature — caminho feliz', () => {
  it('aceita assinatura gerada por signHmac', () => {
    expect(verifyHmacSignature(BODY, signHmac(BODY, SECRET), SECRET)).toBe(true);
  });

  it('aceita prefixo `sha256=` (convenção de vários providers)', () => {
    expect(verifyHmacSignature(BODY, `sha256=${signHmac(BODY, SECRET)}`, SECRET)).toBe(true);
  });

  it('aceita assinatura em maiúsculas', () => {
    expect(verifyHmacSignature(BODY, signHmac(BODY, SECRET).toUpperCase(), SECRET)).toBe(true);
  });

  it('aceita assinatura com espaços em volta', () => {
    expect(verifyHmacSignature(BODY, `  ${signHmac(BODY, SECRET)}  `, SECRET)).toBe(true);
  });

  it('assina corretamente body com acentos e emoji (UTF-8)', () => {
    const utf8 = '{"text":"Comprei cimento pra obra São João 🏗️ — R$ 1.500,00"}';
    expect(verifyHmacSignature(utf8, signHmac(utf8, SECRET), SECRET)).toBe(true);
  });

  it('assina corretamente body vazio', () => {
    expect(verifyHmacSignature('', signHmac('', SECRET), SECRET)).toBe(true);
  });
});

describe('verifyHmacSignature — rejeições (segurança)', () => {
  it('rejeita assinatura ausente', () => {
    expect(verifyHmacSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyHmacSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyHmacSignature(BODY, '', SECRET)).toBe(false);
  });

  it('rejeita quando o secret está vazio (env não configurada)', () => {
    expect(verifyHmacSignature(BODY, signHmac(BODY, SECRET), '')).toBe(false);
  });

  it('rejeita assinatura de outro secret', () => {
    expect(verifyHmacSignature(BODY, signHmac(BODY, 'secret-do-atacante'), SECRET)).toBe(false);
  });

  it('rejeita body adulterado — o ponto central da proteção', () => {
    const sigOriginal = signHmac(BODY, SECRET);
    const bodyAdulterado = BODY.replace('500', '50000');
    expect(verifyHmacSignature(bodyAdulterado, sigOriginal, SECRET)).toBe(false);
  });

  it('rejeita hex de tamanho errado (não-SHA256)', () => {
    expect(verifyHmacSignature(BODY, 'abc123', SECRET)).toBe(false);
    expect(verifyHmacSignature(BODY, 'a'.repeat(63), SECRET)).toBe(false);
    expect(verifyHmacSignature(BODY, 'a'.repeat(65), SECRET)).toBe(false);
  });

  it('rejeita string não-hex do mesmo tamanho', () => {
    expect(verifyHmacSignature(BODY, 'z'.repeat(64), SECRET)).toBe(false);
  });

  it('rejeita assinatura em base64 (formato de outro provider)', () => {
    const b64 = createHmac('sha256', SECRET).update(BODY, 'utf8').digest('base64');
    expect(verifyHmacSignature(BODY, b64, SECRET)).toBe(false);
  });

  it('não explode com entrada hostil', () => {
    for (const hostil of ['../../etc/passwd', '\0\0', '%s%s%s', '{}', 'sha256=']) {
      expect(() => verifyHmacSignature(BODY, hostil, SECRET)).not.toThrow();
      expect(verifyHmacSignature(BODY, hostil, SECRET)).toBe(false);
    }
  });
});
