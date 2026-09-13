import { describe, expect, it } from 'vitest';
import { formaDoPayload } from './forma-payload';

/** O log do primeiro contato descreve a forma do payload e nunca um valor. */
describe('formaDoPayload', () => {
  it('chaves e tipos, sem valores', () => {
    const forma = formaDoPayload({
      from: '5511999990000',
      media: { url: 'https://x/y.jpg', size: 12 },
      tags: ['a', 'b'],
      vazio: null,
    });
    expect(forma).toEqual({
      from: 'string',
      media: { url: 'string', size: 'number' },
      tags: 'array(2)',
      vazio: 'null',
    });
    expect(JSON.stringify(forma)).not.toContain('5511');
    expect(JSON.stringify(forma)).not.toContain('https');
  });

  it('para no segundo nível', () => {
    expect(formaDoPayload({ a: { b: { c: { d: 1 } } } })).toEqual({ a: { b: 'object' } });
  });
});
