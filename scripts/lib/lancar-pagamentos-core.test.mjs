import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  casarNota,
  categoriaDaEtapa,
  chaveFornecedor,
  fornecedorParece,
  lerExtrato,
  lerNomeDaNota,
  localizarExtrato,
  nomeCanonicoFornecedor,
  observacoesDe,
  serialExcelParaData,
  statusDoPagamento,
} from './lancar-pagamentos-core.mjs';

// Valores e nomes fictícios: o repositório é público.
const CAB = [
  'ITEM',
  'ETAPA',
  'DATA',
  'FORNECEDOR',
  'DESCRIÇÃO',
  'VALOR',
  'PAGAMENTO',
  'ADM',
  'OBS',
];
const ABAS = {
  Resumo: [['PERCENTUAL POR CONTA'], [], ['ITEM', 'CONTA', 'VALOR'], [1, 'ADMINISTRAÇÃO', 100]],
  Detalhado: [
    [],
    CAB,
    [null, null, null, null, null, null, null, null, null, null, 'CAIXA DE OBRA - CO'],
    [1, 'LIMPEZA', '2026-01-14', 'Alex', 'Limpeza do canteiro', 1100, 'CO', 110, null],
    [
      2,
      'ADMINISTRAÇÃO',
      '2026-01-31',
      'Fernando Cavalcanti',
      'ADM - jan/26',
      null,
      null,
      null,
      null,
    ],
    [3, 'LIMPEZA', '2026-02-06', 'Az Entulho', 'Entulho', 600, 'CO', 60, 'caçamba'],
    [
      4,
      'ESTRUTURA (VIGAS, PILARES E LAJES)',
      '2026-03-05',
      'Ferragem Mathias Velho',
      'Aço CA-50',
      2493.47,
      'OK',
      374.02,
      null,
    ],
    [
      5,
      'ESTRUTURA (VIGAS, PILARES E LAJES)',
      '2026-03-05',
      'Ferragem Mathias Velho',
      'Arame recozido',
      89.91,
      'OK',
      13.49,
      null,
    ],
    [
      6,
      'REBOCO',
      '2026-04-10',
      'Maximiliano',
      'M.O. reboco - medição',
      1500,
      'EM ABERTO',
      225,
      null,
    ],
    [7, null, '2026-04-12', 'Vizinho', 'Luz do vizinho', 100, null, 15, null],
    [8, null, null, null, null, null, null, 0, null],
    [null, null, null, 'TOTAL ', null, 5883.38, '-', 797.51, null],
    [null, null, null, null, 'Mês', 'CC', 'Custo Obra', 'ADM Medido', 'CUSTO TOTAL MENSAL'],
    [null, null, null, null, '2026-01-01', 1100, 1100, 110, 1210],
  ],
};

describe('localizarExtrato / lerExtrato', () => {
  it('acha a aba pelo cabeçalho, não pela posição', () => {
    const ext = localizarExtrato(ABAS);
    assert.equal(ext.aba, 'Detalhado');
    assert.equal(ext.cabecalhoEm, 1);
  });

  it('cada linha numerada com data e valor vira lançamento; o resto é ignorado com motivo', () => {
    const { lancamentos, ignoradas } = lerExtrato(ABAS, 'Obra - Controle Financeiro.xls');
    assert.equal(lancamentos.length, 6);
    assert.deepEqual(
      ignoradas.map((i) => [i.item, i.motivo]),
      [[2, 'sem valor']],
    );
    const [l1] = lancamentos;
    assert.equal(l1.chave, 'planilha: Obra - Controle Financeiro.xls item 1');
    assert.equal(l1.data, '2026-01-14');
    assert.equal(l1.valor, 1100);
    assert.equal(l1.categoria, 'Limpeza');
    assert.equal(l1.status, 'confirmado');
    assert.equal(l1.adm, 110);
  });

  it('EM ABERTO fica aguardando; vazio e CO/OK ficam confirmado', () => {
    const { lancamentos } = lerExtrato(ABAS, 'x.xls');
    assert.equal(lancamentos.find((l) => l.item === 6).status, 'aguardando');
    assert.equal(lancamentos.find((l) => l.item === 7).status, 'confirmado');
    assert.equal(statusDoPagamento('em aberto'), 'aguardando');
    assert.equal(statusDoPagamento(null), 'confirmado');
  });

  it('linha sem etapa cai em Outros; fornecedor é canonizado', () => {
    const { lancamentos } = lerExtrato(ABAS, 'x.xls');
    const l7 = lancamentos.find((l) => l.item === 7);
    assert.equal(l7.categoria, 'Outros');
    assert.equal(lancamentos.find((l) => l.item === 4).fornecedor, 'Mathias Velho');
  });

  it('aceita data como Date, ISO e dd/mm/aa; valor em pt-BR e em número', () => {
    const abas = {
      A: [
        CAB,
        [1, 'REBOCO', new Date(Date.UTC(2026, 3, 10)), 'X', 'a', '1.234,56', 'OK', null, null],
        [2, 'REBOCO', '10/04/26', 'X', 'b', 99.9, 'OK', null, null],
      ],
    };
    const { lancamentos } = lerExtrato(abas, 'a.xls');
    assert.deepEqual(
      lancamentos.map((l) => [l.data, l.valor]),
      [
        ['2026-04-10', 1234.56],
        ['2026-04-10', 99.9],
      ],
    );
  });

  it('serial do Excel vira data sem depender do fuso', () => {
    assert.equal(serialExcelParaData(45699), '2025-02-11');
    assert.equal(serialExcelParaData(46022), '2025-12-31');
    assert.equal(serialExcelParaData(0), null);
    const { lancamentos } = lerExtrato(
      { A: [CAB, [1, 'REBOCO', 45699, 'X', 'a', 10, 'OK', null, null]] },
      'a',
    );
    assert.equal(lancamentos[0].data, '2025-02-11');
  });

  it('planilha sem extrato devolve erro em vez de lançamentos vazios silenciosos', () => {
    assert.match(lerExtrato({ Medidas: [['a', 'b']] }, 'x').erro, /sem aba/u);
  });

  it('observacoes começa pela chave de idempotência', () => {
    const { lancamentos } = lerExtrato(ABAS, 'x.xls');
    const o = observacoesDe(lancamentos.find((l) => l.item === 3));
    assert.equal(
      o,
      'planilha: x.xls item 3 | pagamento: CO | adm: 60.00 | etapa: LIMPEZA | obs: caçamba',
    );
  });
});

describe('fornecedores e categorias', () => {
  it('grafias da mesma pessoa têm a mesma chave', () => {
    assert.equal(chaveFornecedor('Ferragem Mathias Velho'), chaveFornecedor('MATHIAS VELHO '));
    assert.equal(chaveFornecedor('MD Soluções'), chaveFornecedor('MD Solucoes hidraulicas'));
    assert.equal(nomeCanonicoFornecedor('Eng. Fernando'), 'Fernando Cavalcanti');
    assert.equal(nomeCanonicoFornecedor('  NG   Pedras '), 'NG Pedras');
  });

  it('etapa conhecida vai para a categoria certa; desconhecida vira caixa normal', () => {
    assert.equal(categoriaDaEtapa('INSTALAÇÕES ELÉTRICAS'), 'Elétrica');
    assert.equal(categoriaDaEtapa('INSTALAÇÕES HIDROSSANITÁRIAS'), 'Hidráulica');
    assert.equal(categoriaDaEtapa('VESTIARIO'), 'Vestiário');
    assert.equal(categoriaDaEtapa('DEMOLIÇÃO INTERNA'), 'Demolição interna');
    assert.equal(categoriaDaEtapa(''), 'Outros');
  });
});

describe('notas do acervo', () => {
  it('lê data, descrição e fornecedor do nome do arquivo', () => {
    assert.deepEqual(lerNomeDaNota('26.03.10 - Limpeza (entrada) - Maximiliano.jpeg'), {
      data: '2026-03-10',
      descricao: 'Limpeza (entrada)',
      fornecedor: 'Maximiliano',
    });
    assert.deepEqual(lerNomeDaNota('26.08.26  - Material para platibanda - Mathias Velho.pdf'), {
      data: '2026-08-26',
      descricao: 'Material para platibanda',
      fornecedor: 'Mathias Velho',
    });
    assert.deepEqual(lerNomeDaNota('26.08.21 - Luz do vizinho.jpeg'), {
      data: '2026-08-21',
      descricao: 'Luz do vizinho',
      fornecedor: null,
    });
    assert.deepEqual(lerNomeDaNota('26.05.29 - Malhas - Gerdau'), {
      data: '2026-05-29',
      descricao: 'Malhas',
      fornecedor: 'Gerdau',
    });
    assert.equal(lerNomeDaNota('Unknown-1.pdf'), null);
  });

  const { lancamentos } = lerExtrato(ABAS, 'x.xls');

  it('data + fornecedor únicos casam direto', () => {
    const r = casarNota({ nome: '26.02.06 - Entulho - Az Entulho.pdf' }, lancamentos);
    assert.equal(r.lancamento.item, 3);
  });

  it('mesma data e fornecedor em duas linhas: a descrição desempata', () => {
    const r = casarNota({ nome: '26.03.05 - Aço - Mathias Velho.pdf' }, lancamentos);
    assert.equal(r.lancamento.item, 4);
    assert.equal(r.motivo, 'descrição');
  });

  it('sem pista na descrição, não chuta', () => {
    const r = casarNota({ nome: '26.03.05 - Nota - Mathias Velho.pdf' }, lancamentos);
    assert.equal(r.lancamento, null);
    assert.match(r.motivo, /ambíguo/u);
  });

  it('data próxima (até 3 dias) ainda casa; longe não', () => {
    assert.equal(
      casarNota({ nome: '26.01.16 - Limpeza - Alex.jpg' }, lancamentos).lancamento.item,
      1,
    );
    assert.equal(
      casarNota({ nome: '26.01.25 - Limpeza - Alex.jpg' }, lancamentos).lancamento,
      null,
    );
  });

  it('valor lido do documento desempata o que a descrição não desempata', () => {
    const r = casarNota({ nome: '26.03.05 - Nota - Mathias Velho.pdf', valor: 89.91 }, lancamentos);
    assert.equal(r.lancamento.item, 5);
    assert.equal(r.motivo, 'data + valor + fornecedor');
  });

  it('valor que não bate veta, mesmo com data e fornecedor certos', () => {
    const r = casarNota({ nome: '26.02.06 - Entulho - Az Entulho.pdf', valor: 9800 }, lancamentos);
    assert.equal(r.lancamento, null);
    assert.match(r.motivo, /valor não bate/u);
  });

  it('grafia parecida do fornecedor conta: apelido, nome do meio, prefixo', () => {
    assert.equal(fornecedorParece('Max', 'Maximiliano'), true);
    assert.equal(fornecedorParece('Silvio Bittencourt', 'Silvio Andre Bittencourt'), true);
    assert.equal(fornecedorParece('Engegraf Plotagem', 'Engegraf Equipamentos'), true);
    assert.equal(fornecedorParece('Alex', 'Altair'), false);
    assert.equal(fornecedorParece('Mathias Velho', 'Maximiliano'), false);
    const r = casarNota({ nome: '26.04.10 - Reboco - Max.jpeg' }, lancamentos);
    assert.equal(r.lancamento.item, 6);
  });

  it('nota sem fornecedor no nome usa só data (e descrição se precisar)', () => {
    assert.equal(
      casarNota({ nome: '26.04.12 - Luz do vizinho.jpeg' }, lancamentos).lancamento.item,
      7,
    );
  });
});
