import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { codificarValores, decodificarValores, mensagemDeErro } from './form-erros';

/**
 * Erro de validação sem perder o formulário.
 *  1. A mensagem sai com o rótulo humano e em português.
 *  2. Os valores digitados fazem a viagem de ida e volta pela URL.
 *  3. Senha, secret, token e arquivos nunca entram na URL.
 */
describe('form-erros', () => {
  it('mensagem com rótulo humano e tradução', () => {
    const r = z
      .object({ valor: z.number(), obra_id: z.string().uuid() })
      .safeParse({ obra_id: 'x' });
    if (r.success) throw new Error('deveria falhar');
    const { msg, campo } = mensagemDeErro(r.error, { valor: 'Valor', obra_id: 'Obra' });
    expect(campo).toBe('valor');
    expect(msg).toBe('Valor: obrigatório');
  });

  it('valores fazem ida e volta', () => {
    const fd = new FormData();
    fd.set('nome', 'Obra Álfa');
    fd.set('valor', '1.250,00');
    const v = codificarValores(fd);
    expect(v).toBeTruthy();
    expect(decodificarValores(v)).toEqual({ nome: 'Obra Álfa', valor: '1.250,00' });
  });

  it('senha, token e arquivo ficam de fora', () => {
    const fd = new FormData();
    fd.set('nome', 'x');
    fd.set('senha', '123');
    fd.set('webhook_secret', 'abc');
    fd.set('arquivo', new Blob(['a']), 'a.txt');
    expect(decodificarValores(codificarValores(fd))).toEqual({ nome: 'x' });
  });

  it('lixo na URL vira objeto vazio', () => {
    expect(decodificarValores('###')).toEqual({});
    expect(decodificarValores(undefined)).toEqual({});
  });
});
