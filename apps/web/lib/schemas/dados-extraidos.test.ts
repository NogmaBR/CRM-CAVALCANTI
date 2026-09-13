import { describe, expect, it } from 'vitest';
import { lerDadosExtraidos, temDadosParaLancar } from './dados-extraidos';

const OBRA = '11111111-1111-4111-8111-111111111111';

/**
 * O JSONB que o "SIM" lê vem do classificador OU de edição à mão no painel.
 *
 * O que precisa ser verdade:
 *  1. Saída válida passa inteira.
 *  2. Campo inválido some, o resto fica — e sem valor/obra não se lança.
 *  3. Chave desconhecida é descartada sem erro.
 *  4. Não-objeto vira null.
 */
describe('lerDadosExtraidos', () => {
  it('saída válida passa inteira', () => {
    const d = lerDadosExtraidos({ valor: 1250, obra_id: OBRA, data_pagamento: '2026-09-12' });
    expect(d).toEqual({ valor: 1250, obra_id: OBRA, data_pagamento: '2026-09-12' });
    expect(temDadosParaLancar(d)).toBe(true);
  });

  it('valor como texto ou negativo some; sem valor não se lança', () => {
    const texto = lerDadosExtraidos({ valor: '1.200', obra_id: OBRA });
    expect(texto).toEqual({ obra_id: OBRA });
    expect(temDadosParaLancar(texto)).toBe(false);

    const negativo = lerDadosExtraidos({ valor: -5, obra_id: OBRA });
    expect(negativo?.valor).toBeUndefined();
  });

  it('obra_id que não é uuid e data fora do formato somem', () => {
    const d = lerDadosExtraidos({ valor: 10, obra_id: 'obra-alpha', data_pagamento: '12/09/2026' });
    expect(d).toEqual({ valor: 10 });
  });

  it('chave desconhecida é descartada, não é erro', () => {
    const d = lerDadosExtraidos({ valor: 10, obra_id: OBRA, campo_novo: 'x' });
    expect(d).toEqual({ valor: 10, obra_id: OBRA });
  });

  it('não-objeto vira null', () => {
    expect(lerDadosExtraidos(null)).toBeNull();
    expect(lerDadosExtraidos('texto')).toBeNull();
    expect(lerDadosExtraidos([1])).toBeNull();
    expect(temDadosParaLancar(null)).toBe(false);
  });
});
