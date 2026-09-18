import { describe, expect, it } from 'vitest';
import { lerTelefones, montarResumoDiario, totalDePendencias } from './resumo-diario-texto';

const zero = { completo: 3, parcial: 0, critico: 0, total: 3 };

describe('montarResumoDiario', () => {
  it('tudo em dia é uma linha verde com o link do painel', () => {
    const t = montarResumoDiario({
      hoje: '2026-09-18',
      saude: { obras: zero, pagamentos: zero, fornecedores: zero, documentos: zero },
      alertas: [],
      appUrl: 'https://crm.exemplo',
    });
    expect(t).toContain('sexta, 18/09');
    expect(t).toContain('🟢 Tudo em dia');
    expect(t).toContain('https://crm.exemplo/painel');
    expect(t).not.toContain('pendência de cadastro');
  });

  it('lista só os tipos com pendência, com o número de graves, e os alertas por gravidade', () => {
    const t = montarResumoDiario({
      hoje: '2026-09-18',
      saude: {
        obras: { completo: 0, parcial: 1, critico: 3, total: 4 },
        pagamentos: { completo: 199, parcial: 1, critico: 53, total: 253 },
        fornecedores: zero,
        documentos: { completo: 320, parcial: 16, critico: 0, total: 336 },
      },
      alertas: [
        {
          chave: 'a',
          gravidade: 'alta',
          numero: 53,
          titulo: '53 pagamentos sem nota há mais de 7 dias',
          explicacao: '',
          href: '/',
          acao: '',
        },
        {
          chave: 'b',
          gravidade: 'media',
          numero: 4,
          titulo: '4 obras sem valor de contrato',
          explicacao: '',
          href: '/',
          acao: '',
        },
      ],
      appUrl: 'https://crm.exemplo',
    });
    expect(t).toContain('*74 itens com pendência de cadastro*');
    expect(t).toContain('• Pagamentos: 54 de 253 com pendência (53 graves)');
    expect(t).toContain('• Obras: 4 de 4 com pendência (3 graves)');
    expect(t).toContain('• Documentos: 16 de 336 com pendência');
    expect(t).not.toContain('Fornecedores');
    expect(t).toContain('⚠️ *Precisa de ação*\n• 53 pagamentos sem nota há mais de 7 dias');
    expect(t).toContain('🟡 *Vale olhar*\n• 4 obras sem valor de contrato');
    expect(t).toContain('/painel?aba=alertas');
  });

  it('totalDePendencias soma parcial e crítico dos quatro', () => {
    expect(
      totalDePendencias({
        obras: { completo: 0, parcial: 1, critico: 1, total: 2 },
        pagamentos: { completo: 0, parcial: 2, critico: 0, total: 2 },
        fornecedores: zero,
        documentos: zero,
      }),
    ).toBe(4);
  });
});

describe('lerTelefones', () => {
  it('aceita vírgula, ponto e vírgula e espaço; limpa máscara; descarta curto demais', () => {
    expect(lerTelefones('5573998489747, (55) 32 98806-8174; 123')).toEqual([
      '5573998489747',
      '5532988068174',
    ]);
    expect(lerTelefones('')).toEqual([]);
    expect(lerTelefones(null)).toEqual([]);
  });
});
