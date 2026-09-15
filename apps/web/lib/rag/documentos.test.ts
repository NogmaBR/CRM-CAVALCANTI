import { describe, expect, it } from 'vitest';
import {
  dividirEmTrechos,
  documentoParaDocumento,
  fornecedorParaDocumento,
  obraParaDocumento,
  pagamentoParaDocumento,
  registroParaDocumento,
} from './documentos';

/**
 * O texto indexado é escrito para ser ENCONTRADO, não para ser lido.
 *
 * A busca compara o significado da pergunta com o do trecho. Se o texto não
 * contém as palavras que a pessoa usaria — o nome da obra, o mês por extenso,
 * o valor em reais — a pergunta não casa com nada e o assistente diz "não
 * encontrei" sobre um dado que está no banco.
 */

const PAGAMENTO = {
  id: 'p1',
  valor: 3450,
  data_pagamento: '2026-01-10',
  descricao: 'Cimento CP-II',
  observacoes: null,
  status_pagto: 'confirmado',
  origem: 'whatsapp',
  obra: { id: 'o1', nome: 'Garibaldi' },
  fornecedor: { nome: 'Mathias Velho' },
  categoria: { nome: 'Material' },
};

describe('pagamento vira texto buscável', () => {
  const doc = pagamentoParaDocumento(PAGAMENTO);

  it('traz o valor no formato que se pergunta', () => {
    expect(doc.conteudo).toContain('R$ 3.450,00');
  });

  it('traz o mês por extenso, além da data numérica', () => {
    expect(doc.conteudo).toContain('10/01/2026');
    expect(doc.conteudo).toContain('janeiro de 2026');
  });

  it('nomeia obra, fornecedor e categoria', () => {
    expect(doc.conteudo).toContain('Garibaldi');
    expect(doc.conteudo).toContain('Mathias Velho');
    expect(doc.conteudo).toContain('Material');
  });

  it('guarda a obra para a busca poder filtrar', () => {
    expect(doc.obraId).toBe('o1');
    expect(doc.origem).toBe('pagamento');
    expect(doc.origemId).toBe('p1');
  });

  /**
   * O hash é o que impede reindexar o que não mudou. Se ele variasse a cada
   * chamada, toda rodada gastaria embedding para tudo.
   */
  it('hash é estável para o mesmo conteúdo', () => {
    expect(pagamentoParaDocumento(PAGAMENTO).hash).toBe(doc.hash);
  });

  it('hash muda quando o conteúdo muda', () => {
    const outro = pagamentoParaDocumento({ ...PAGAMENTO, valor: 3451 });
    expect(outro.hash).not.toBe(doc.hash);
  });

  it('aguenta pagamento sem fornecedor e sem categoria', () => {
    const doc2 = pagamentoParaDocumento({ ...PAGAMENTO, fornecedor: null, categoria: null });
    expect(doc2.conteudo).toContain('sem fornecedor identificado');
    expect(doc2.conteudo).not.toContain('undefined');
    expect(doc2.conteudo).not.toContain('null');
  });
});

describe('obra vira resumo com os agregados prontos', () => {
  const doc = obraParaDocumento({
    id: 'o1',
    nome: 'Garibaldi',
    cliente: 'Roberto Garibaldi',
    tipo: 'nova',
    status: 'ativa',
    orcamento: 450000,
    data_inicio: '2025-11-10',
    totalGasto: 27540,
    qtdPagamentos: 11,
  });

  /**
   * O agregado entra no texto de propósito: "quanto já gastei na Garibaldi" é
   * a pergunta real, e sem o total pronto a soma ficaria por conta do modelo —
   * que é onde a conta erra.
   */
  it('traz total gasto, saldo e percentual já calculados', () => {
    expect(doc.conteudo).toContain('R$ 27.540,00');
    expect(doc.conteudo).toContain('R$ 422.460,00');
    expect(doc.conteudo).toContain('6% do orçamento');
  });

  it('não quebra em obra sem orçamento', () => {
    const semOrcamento = obraParaDocumento({
      id: 'o2',
      nome: 'Sem Orçamento',
      cliente: null,
      tipo: null,
      status: 'ativa',
      orcamento: null,
      data_inicio: null,
      totalGasto: 100,
      qtdPagamentos: 1,
    });
    expect(semOrcamento.conteudo).toContain('sem orçamento definido');
    expect(semOrcamento.conteudo).not.toContain('NaN');
  });
});

describe('fornecedor', () => {
  const doc = fornecedorParaDocumento({
    id: 'f1',
    nome: 'Mathias Velho',
    razao_social: 'Mathias Velho Material de Construcao',
    categoria: { nome: 'Material' },
    totalPago: 52530,
    qtdPagamentos: 13,
    obras: ['Garibaldi', 'INOX Piratini'],
  });

  it('soma o que recebeu e lista as obras', () => {
    expect(doc.conteudo).toContain('R$ 52.530,00');
    expect(doc.conteudo).toContain('13 pagamento(s)');
    expect(doc.conteudo).toContain('Garibaldi, INOX Piratini');
  });

  /**
   * Fornecedor atende várias obras, então não pertence a nenhuma: fica sem
   * `obraId` para aparecer em busca sem filtro. "Quanto paguei pro Mathias"
   * não é pergunta sobre uma obra só.
   */
  it('não pertence a uma obra', () => {
    expect(doc.obraId).toBeNull();
  });
});

describe('divisão em trechos', () => {
  it('texto curto fica inteiro', () => {
    expect(dividirEmTrechos('Uma frase curta.')).toEqual(['Uma frase curta.']);
  });

  it('corta por frase, não no meio de um valor', () => {
    const frase = 'Pagamento de R$ 1.234,56 para o fornecedor Alpha na obra Beta. ';
    const trechos = dividirEmTrechos(frase.repeat(30), 300);

    expect(trechos.length).toBeGreaterThan(1);
    for (const t of trechos) {
      // Nenhum trecho pode terminar no meio de "R$ 1.234,56".
      expect(t).not.toMatch(/R\$\s*[\d.]*,?\d?$/u);
    }
  });

  it('nenhum trecho passa muito do teto', () => {
    const trechos = dividirEmTrechos('Frase de tamanho médio aqui. '.repeat(100), 200);
    for (const t of trechos) {
      expect(t.length).toBeLessThanOrEqual(260);
    }
  });
});

describe('documento do acervo', () => {
  const base = {
    id: 'doc-1',
    nome_arquivo: 'NF 123.pdf',
    categoriaRotulo: 'NFs/Pagamentos',
    tipo: 'nota_fiscal',
    numero_nf: '123',
    origem: 'onedrive',
    caminho_origem: 'Garibaldi/NFs/NF 123.pdf',
    texto_extraido: 'NOTA FISCAL 123. Cimento CP-II 50 sacos. Total R$ 3.450,00.',
    obra: { id: 'obra-1', nome: 'Garibaldi' },
    fornecedor: null,
    pagamento: null,
  };

  it('título é obra › pasta › arquivo, e o conteúdo traz o texto extraído', () => {
    const doc = documentoParaDocumento(base);
    expect(doc.origem).toBe('documento');
    expect(doc.obraId).toBe('obra-1');
    expect(doc.titulo).toBe('Garibaldi › NFs/Pagamentos › NF 123.pdf');
    expect(doc.conteudo).toContain('na pasta NFs/Pagamentos da obra Garibaldi');
    expect(doc.conteudo).toContain('número da nota 123');
    expect(doc.conteudo).toContain('Cimento CP-II');
  });

  it('sem texto extraído ainda é encontrável pelo cabeçalho', () => {
    const doc = documentoParaDocumento({
      ...base,
      texto_extraido: null,
      numero_nf: null,
      tipo: 'outro',
    });
    expect(doc.conteudo).toContain('Arquivo "NF 123.pdf"');
    expect(doc.conteudo).toContain('sem texto extraível');
    expect(doc.conteudo).not.toContain('tipo outro');
  });

  it('corta texto longo e o hash muda com o conteúdo', () => {
    const longo = documentoParaDocumento({ ...base, texto_extraido: 'x'.repeat(50_000) });
    expect(longo.conteudo.length).toBeLessThan(13_000);
    expect(longo.hash).not.toBe(documentoParaDocumento(base).hash);
  });

  it('pagamento vinculado aparece por extenso', () => {
    const doc = documentoParaDocumento({
      ...base,
      pagamento: { valor: 3450, data_pagamento: '2026-01-10' },
    });
    expect(doc.conteudo).toContain('R$ 3.450,00');
    expect(doc.conteudo).toContain('janeiro de 2026');
  });
});

describe('registro do diário', () => {
  it('data por extenso, obra, autor e texto', () => {
    const doc = registroParaDocumento({
      id: 'reg-1',
      texto: 'Hoje a laje do segundo pavimento ficou pronta.',
      resumo: 'Laje do 2º pavimento concluída',
      data_registro: '2026-09-15',
      autor: 'Fernando',
      obra: { id: 'obra-1', nome: 'Garibaldi' },
    });
    expect(doc.origem).toBe('registro');
    expect(doc.titulo).toBe('Garibaldi › Diário › Laje do 2º pavimento concluída');
    expect(doc.conteudo).toBe(
      'Registro do diário da obra Garibaldi em 15/09/2026 (setembro de 2026) por Fernando: Hoje a laje do segundo pavimento ficou pronta.',
    );
  });

  it('sem resumo o título usa o começo do texto', () => {
    const doc = registroParaDocumento({
      id: 'reg-2',
      texto: 'Faltou areia, pedi mais 10 metros.',
      resumo: null,
      data_registro: '2026-09-15',
      autor: null,
      obra: null,
    });
    expect(doc.titulo).toBe('sem obra › Diário › Faltou areia, pedi mais 10 metros.');
    expect(doc.obraId).toBeNull();
  });
});
