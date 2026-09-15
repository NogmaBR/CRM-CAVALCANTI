import { describe, expect, it } from 'vitest';
import { categoriaDaPasta, normalizarNome, tipoDoNome } from './categoria';

/**
 * A estrutura de pastas é a do cliente, escrita à mão por ele. Os testes
 * travam as grafias que já apareceram no Drive e as variações óbvias — o
 * importador não pode mandar "NF's" para `outro` porque tem apóstrofo.
 */

describe('normalizarNome', () => {
  it('tira acento, caixa, pontuação e colapsa espaços', () => {
    expect(normalizarNome('  Documentação ')).toBe('documentacao');
    expect(normalizarNome("NF's / Pagamentos")).toBe('nfs pagamentos');
    expect(normalizarNome('Caminho do Meio E&J')).toBe('caminho do meio e j');
    expect(normalizarNome('INOX   Piratini')).toBe('inox piratini');
  });
});

describe('categoriaDaPasta', () => {
  const casos: Array<[string, string]> = [
    ['NFs/Pagamentos', 'nfs_pagamentos'],
    ["NF's", 'nfs_pagamentos'],
    ['NF', 'nfs_pagamentos'],
    ['Notas Fiscais', 'nfs_pagamentos'],
    ['Pagamentos', 'nfs_pagamentos'],
    ['Comprovantes', 'nfs_pagamentos'],
    ['Documentação', 'documentacao'],
    ['Documentacao', 'documentacao'],
    ['Documentos', 'documentacao'],
    ['Contratos', 'documentacao'],
    ['Projeto Aprovado', 'projeto_aprovado'],
    ['Projetos Aprovados', 'projeto_aprovado'],
    ['Projeto', 'projeto'],
    ['Projetos', 'projeto'],
    ['Fotos', 'fotos'],
    ['Imagens', 'fotos'],
    ['Orçamento', 'orcamentos'],
    ['Orçamentos', 'orcamentos'],
    ['Proposta', 'proposta'],
    ['Propostas', 'proposta'],
    ['Cronograma', 'cronograma'],
    ['Cronogramas', 'cronograma'],
    ['Financeiro', 'outro'],
    ['xyz', 'outro'],
    ['', 'outro'],
  ];

  for (const [pasta, esperado] of casos) {
    it(`"${pasta}" → ${esperado}`, () => {
      expect(categoriaDaPasta(pasta)).toBe(esperado);
    });
  }

  it('"projeto aprovado" vence "projeto" mesmo com ruído em volta', () => {
    expect(categoriaDaPasta('01 - Projeto aprovado (prefeitura)')).toBe('projeto_aprovado');
  });
});

describe('tipoDoNome', () => {
  it('reconhece nota, comprovante e contrato pelo nome do arquivo', () => {
    expect(tipoDoNome('NF 1234 Casa do Construtor.pdf')).toBe('nota_fiscal');
    expect(tipoDoNome('danfe-000123.pdf')).toBe('nota_fiscal');
    expect(tipoDoNome('Nota fiscal areia.jpg')).toBe('nota_fiscal');
    expect(tipoDoNome('comprovante pix.jpg')).toBe('comprovante');
    expect(tipoDoNome('TED fornecedor.pdf')).toBe('comprovante');
    expect(tipoDoNome('boleto pago.pdf')).toBe('comprovante');
    expect(tipoDoNome('Contrato de empreitada.pdf')).toBe('contrato');
  });

  it('cai em outro quando o nome não diz nada', () => {
    expect(tipoDoNome('IMG_20260910_101010.jpg')).toBe('outro');
    expect(tipoDoNome('planilha.xlsx')).toBe('outro');
  });

  it('não confunde "nfs" da pasta com número de NF no nome', () => {
    // "info" contém "nf" no meio — só palavra inteira conta.
    expect(tipoDoNome('informativo.pdf')).toBe('outro');
  });
});
