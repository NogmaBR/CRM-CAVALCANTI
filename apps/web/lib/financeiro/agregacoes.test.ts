import { describe, expect, it } from 'vitest';
import {
  caixaMensal,
  etapasPorObra,
  fraseDoRitmo,
  gastoPorObra,
  matrizDeDocumentos,
  mensalPorObra,
  montarAlertas,
  ordenarObrasParaSeries,
  porExtensoCurto,
  rankingDeFornecedores,
  ritmoDaObra,
  rotuloDoMes,
  ultimosMeses,
} from './agregacoes';

const OBRAS = [
  { id: 'i', nome: 'INOX Piratini', valor_contrato: null, status: 'ativa' },
  { id: 'g', nome: 'Garibaldi', valor_contrato: 300000, status: 'ativa' },
];

const PAG = [
  {
    obra_id: 'g',
    fornecedor_id: 'f1',
    categoria_id: 'c1',
    valor: 100000,
    data: '2026-09-01',
    tem_documento: true,
  },
  {
    obra_id: 'g',
    fornecedor_id: 'f2',
    categoria_id: 'c2',
    valor: 20000.5,
    data: '2026-08-15',
    tem_documento: false,
  },
  {
    obra_id: 'i',
    fornecedor_id: 'f1',
    categoria_id: null,
    valor: 5000,
    data: '2026-09-02',
    tem_documento: false,
  },
];
const REC = [{ obra_id: 'g', valor: 150000, data: '2026-08-01' }];

describe('meses', () => {
  it('ultimosMeses atravessa o ano', () => {
    expect(ultimosMeses(3, '2026-01-15')).toEqual(['2025-11', '2025-12', '2026-01']);
    expect(rotuloDoMes('2026-09')).toBe('set/26');
  });
  it('a ordem das séries é alfabética, não por valor', () => {
    expect(ordenarObrasParaSeries(OBRAS).map((o) => o.nome)).toEqual([
      'Garibaldi',
      'INOX Piratini',
    ]);
  });
});

describe('por obra', () => {
  it('gasto, recebido, resultado e margem por obra', () => {
    const r = gastoPorObra(OBRAS, PAG, REC);
    expect(r[0]).toMatchObject({
      obra: 'Garibaldi',
      gasto: 120000.5,
      recebido: 150000,
      resultado: 29999.5,
      margem_prevista: 179999.5,
      pagamentos: 2,
    });
    expect(r[1]).toMatchObject({
      obra: 'INOX Piratini',
      gasto: 5000,
      contrato: null,
      margem_prevista: null,
      resultado: -5000,
    });
  });
  it('mensal empilhado: uma coluna por obra e o total', () => {
    const r = mensalPorObra(OBRAS, PAG, ['2026-08', '2026-09']);
    expect(r[0]).toMatchObject({
      label: 'ago/26',
      Garibaldi: 20000.5,
      'INOX Piratini': 0,
      total: 20000.5,
    });
    expect(r[1]).toMatchObject({ Garibaldi: 100000, 'INOX Piratini': 5000, total: 105000 });
  });
  it('etapas por obra com percentual', () => {
    const r = etapasPorObra(
      OBRAS,
      PAG,
      new Map([
        ['c1', 'Estrutura'],
        ['c2', 'Elétrica'],
      ]),
    );
    expect(r[0]?.etapas).toEqual([
      { etapa: 'Estrutura', total: 100000, pct: 83.3 },
      { etapa: 'Elétrica', total: 20000.5, pct: 16.7 },
    ]);
    expect(r[1]?.etapas[0]).toEqual({ etapa: 'Sem etapa', total: 5000, pct: 100 });
  });
});

describe('fornecedores e caixa', () => {
  it('ranking com percentual, último pagamento e concentração', () => {
    const r = rankingDeFornecedores(
      PAG,
      new Map([
        ['f1', 'Mathias'],
        ['f2', 'Max'],
      ]),
    );
    expect(r.total).toBe(125000.5);
    expect(r.linhas[0]).toMatchObject({
      fornecedor: 'Mathias',
      total: 105000,
      pagamentos: 2,
      pct: 84,
      ultimo: '2026-09-02',
    });
    expect(r.concentracaoTop3).toBe(100);
  });
  it('caixa mensal com acumulado', () => {
    const r = caixaMensal(PAG, REC, ['2026-08', '2026-09']);
    expect(r[0]).toMatchObject({
      entrou: 150000,
      saiu: 20000.5,
      saldo: 129999.5,
      acumulado: 129999.5,
    });
    expect(r[1]).toMatchObject({ entrou: 0, saiu: 105000, saldo: -105000, acumulado: 24999.5 });
  });
});

describe('documentos e alertas', () => {
  it('matriz obra × pasta com o máximo para a intensidade', () => {
    const r = matrizDeDocumentos(
      OBRAS,
      [
        { obra_id: 'g', categoria: 'fotos', data: '2026-09-01' },
        { obra_id: 'g', categoria: 'fotos', data: '2026-09-02' },
        { obra_id: 'g', categoria: null, data: '2026-09-02' },
      ],
      ['fotos', 'outro'],
    );
    expect(r.linhas[0]).toEqual({ obra: 'Garibaldi', porPasta: { fotos: 2, outro: 1 }, total: 3 });
    expect(r.maximo).toBe(2);
  });

  it('alertas na ordem de gravidade, com números e frases', () => {
    const a = montarAlertas({
      hoje: '2026-09-17',
      obras: OBRAS,
      pagamentos: PAG,
      fornecedores: [{ id: 'f1', nome: 'Mathias', telefone: null, documento: null }],
      documentos: [{ obra_id: 'g', categoria: 'fotos', data: '2026-09-10' }],
      confirmacoesAbertas: 2,
      gastoMesAtual: 105000,
      gastoMesAnterior: 20000.5,
    });
    expect(a.map((x) => x.chave)).toEqual([
      'sem_nota',
      'confirmacoes',
      'sem_contrato',
      'mes_acima',
      'fornecedor_sem_telefone',
      'sem_foto',
    ]);
    expect(a[0]?.numero).toBe(2); // 15/08 e 02/09 estão sem nota há mais de 7 dias
    expect(a[2]?.explicacao).toContain('INOX Piratini');
    expect(a[5]?.explicacao).toContain('INOX Piratini');
    expect(a[5]?.explicacao).not.toContain('Garibaldi');
  });

  it('porExtensoCurto', () => {
    expect(porExtensoCurto(134231)).toBe('134 mil');
    expect(porExtensoCurto(-5000)).toBe('−5 mil');
    expect(porExtensoCurto(1_250_000)).toBe('1,3 milhões');
    expect(porExtensoCurto(800)).toBe('800 reais');
  });
});

describe('ritmoDaObra', () => {
  it('sem datas devolve só o gasto em % e leitura nula', () => {
    const r = ritmoDaObra({
      hoje: '2026-09-18',
      data_inicio: null,
      data_prevista_fim: null,
      gasto: 50_000,
      contrato: 200_000,
    });
    expect(r.prazoPct).toBeNull();
    expect(r.gastoPct).toBe(25);
    expect(r.leitura).toBeNull();
    expect(fraseDoRitmo(r)).toContain('Sem data');
  });

  it('gasto na frente do prazo', () => {
    // 100 dias de obra, hoje é o dia 30 (30%); gastou 60% do contrato.
    const r = ritmoDaObra({
      hoje: '2026-01-31',
      data_inicio: '2026-01-01',
      data_prevista_fim: '2026-04-11',
      gasto: 120_000,
      contrato: 200_000,
    });
    expect(r.diasTotais).toBe(100);
    expect(r.diasDecorridos).toBe(30);
    expect(r.diasRestantes).toBe(70);
    expect(r.prazoPct).toBe(30);
    expect(r.leitura).toBe('na_frente');
    expect(fraseDoRitmo(r)).toContain('mais rápido que o tempo');
  });

  it('em dia e atrás', () => {
    const base = {
      hoje: '2026-01-31',
      data_inicio: '2026-01-01',
      data_prevista_fim: '2026-04-11',
      contrato: 200_000,
    };
    expect(ritmoDaObra({ ...base, gasto: 60_000 }).leitura).toBe('em_dia');
    expect(ritmoDaObra({ ...base, gasto: 10_000 }).leitura).toBe('atras');
  });

  it('prazo vencido', () => {
    const r = ritmoDaObra({
      hoje: '2026-09-18',
      data_inicio: '2026-01-01',
      data_prevista_fim: '2026-09-01',
      gasto: 10,
      contrato: 100,
    });
    expect(r.leitura).toBe('vencido');
    expect(r.diasRestantes).toBe(-17);
    expect(r.prazoPct).toBeGreaterThan(100);
    expect(r.diasDecorridos).toBe(r.diasTotais);
    expect(fraseDoRitmo(r)).toContain('venceu há 17 dias');
  });

  it('sem contrato mede só o prazo', () => {
    const r = ritmoDaObra({
      hoje: '2026-01-31',
      data_inicio: '2026-01-01',
      data_prevista_fim: '2026-04-11',
      gasto: 10,
      contrato: null,
    });
    expect(r.gastoPct).toBeNull();
    expect(r.leitura).toBeNull();
    expect(fraseDoRitmo(r)).toContain('Sem contrato');
  });
});

describe('montarAlertas — prazo e contrato', () => {
  const entrada = {
    hoje: '2026-09-18',
    obras: [
      {
        id: 'v',
        nome: 'Vencida',
        valor_contrato: 100_000,
        status: 'ativa',
        data_prevista_fim: '2026-09-01',
      },
      {
        id: 'e',
        nome: 'Estourada',
        valor_contrato: 50_000,
        status: 'ativa',
        data_prevista_fim: '2027-01-01',
      },
      {
        id: 'p',
        nome: 'Pausada',
        valor_contrato: 100_000,
        status: 'pausada',
        data_prevista_fim: '2026-01-01',
      },
    ],
    pagamentos: [
      {
        obra_id: 'e',
        fornecedor_id: null,
        categoria_id: null,
        valor: 60_000,
        data: '2026-09-10',
        tem_documento: true,
      },
    ],
    fornecedores: [],
    documentos: [],
    confirmacoesAbertas: 0,
    gastoMesAtual: 0,
    gastoMesAnterior: 0,
  };
  it('acusa prazo vencido só de obra ativa, e gasto acima do contrato', () => {
    const a = montarAlertas(entrada);
    const chaves = a.map((x) => x.chave);
    expect(chaves).toContain('prazo_vencido');
    expect(chaves).toContain('acima_do_contrato');
    expect(a.find((x) => x.chave === 'prazo_vencido')?.explicacao).toContain('Vencida');
    expect(a.find((x) => x.chave === 'prazo_vencido')?.explicacao).not.toContain('Pausada');
    expect(a.find((x) => x.chave === 'acima_do_contrato')?.explicacao).toContain('Estourada');
  });
});
