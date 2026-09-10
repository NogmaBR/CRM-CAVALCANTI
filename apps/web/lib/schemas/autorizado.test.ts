import { describe, expect, it } from 'vitest';
import { AutorizadoCreateSchema, formatarTelefone, normalizarTelefoneCadastro } from './autorizado';

/**
 * Esta normalização é a fronteira de segurança do fluxo inbound: se o número
 * cadastrado não bater com o que o provider manda, o remetente legítimo é
 * tratado como não autorizado e a mensagem dele é silenciosamente descartada.
 * O sintoma na obra é "o WhatsApp parou de funcionar", sem erro nenhum.
 */

describe('normalizarTelefoneCadastro', () => {
  it('aceita as formas que uma pessoa realmente digita', () => {
    // Todas devem virar o mesmo dígito-a-dígito que `normalizeTelefone`
    // produz a partir do payload do UAZAPI.
    expect(normalizarTelefoneCadastro('(51) 99999-8888')).toBe('5551999998888');
    expect(normalizarTelefoneCadastro('51 99999-8888')).toBe('5551999998888');
    expect(normalizarTelefoneCadastro('51999998888')).toBe('5551999998888');
    expect(normalizarTelefoneCadastro('+55 51 99999-8888')).toBe('5551999998888');
    expect(normalizarTelefoneCadastro('5551999998888')).toBe('5551999998888');
  });

  it('preserva números fixos de 10 dígitos', () => {
    expect(normalizarTelefoneCadastro('(51) 3333-4444')).toBe('555133334444');
  });

  it('não inventa DDI em número que já é internacional', () => {
    expect(normalizarTelefoneCadastro('+351 912 345 678')).toBe('351912345678');
  });
});

describe('AutorizadoCreateSchema', () => {
  it('normaliza o telefone ao validar', () => {
    const r = AutorizadoCreateSchema.safeParse({
      nome: 'João da Silva',
      telefone_whats: '(51) 99999-8888',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.telefone_whats).toBe('5551999998888');
  });

  it('recusa telefone curto demais', () => {
    const r = AutorizadoCreateSchema.safeParse({ nome: 'Zé', telefone_whats: '99999' });
    expect(r.success).toBe(false);
  });

  it('recusa nome vazio', () => {
    const r = AutorizadoCreateSchema.safeParse({ nome: '', telefone_whats: '51999998888' });
    expect(r.success).toBe(false);
  });

  it('trata função na obra vazia como ausente', () => {
    const r = AutorizadoCreateSchema.safeParse({
      nome: 'João',
      telefone_whats: '51999998888',
      papel_obra: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.papel_obra).toBeUndefined();
  });
});

describe('formatarTelefone', () => {
  it('devolve o formato que a equipe reconhece', () => {
    expect(formatarTelefone('5551999998888')).toBe('+55 (51) 99999-8888');
    expect(formatarTelefone('555133334444')).toBe('+55 (51) 3333-4444');
  });

  it('vai e volta sem perder informação', () => {
    const original = '5551999998888';
    expect(normalizarTelefoneCadastro(formatarTelefone(original))).toBe(original);
  });
});
