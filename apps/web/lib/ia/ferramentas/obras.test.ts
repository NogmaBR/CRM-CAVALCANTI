import { describe, expect, it } from 'vitest';
import {
  FERRAMENTAS_DE_OBRA,
  agregarPorCategoria,
  escolherObra,
  periodoValido,
  rankearFornecedores,
  somar,
} from './obras';

/**
 * A parte que erra numa ferramenta financeira é a conta, não a query. Estes
 * testes cobrem as funções puras — soma, agregação, escolha de obra — sem
 * banco, e afirmam os limites que o schema impõe ao modelo.
 */

const obras = [
  { id: '1', nome: 'Residencial Garibaldi', apelidos: ['garibaldi'], orcamento: 100_000 },
  { id: '2', nome: 'Garibaldi II', apelidos: null, orcamento: null },
  { id: '3', nome: 'Casa Recreio', apelidos: ['recreio', 'casa do zé'], orcamento: 50_000 },
];

describe('escolherObra', () => {
  it('casamento exato por apelido vence o parcial', () => {
    const r = escolherObra('Garibaldi', obras);
    expect(r.tipo).toBe('uma');
    if (r.tipo === 'uma') expect(r.obra.id).toBe('1');
  });

  it('parcial único resolve', () => {
    const r = escolherObra('recre', obras);
    expect(r.tipo).toBe('uma');
    if (r.tipo === 'uma') expect(r.obra.id).toBe('3');
  });

  it('ignora acento e caixa', () => {
    const r = escolherObra('CASA DO ZÉ', obras);
    expect(r.tipo).toBe('uma');
    if (r.tipo === 'uma') expect(r.obra.id).toBe('3');
  });

  it('ambíguo devolve as candidatas em vez de escolher', () => {
    const r = escolherObra('garibaldi i', obras);
    expect(r.tipo).toBe('ambigua');
    if (r.tipo === 'ambigua') expect(r.candidatas.map((o) => o.id)).toEqual(['1', '2']);
  });

  it('nada casa → nenhuma', () => {
    expect(escolherObra('praia', obras).tipo).toBe('nenhuma');
    expect(escolherObra('   ', obras).tipo).toBe('nenhuma');
  });
});

describe('somar', () => {
  it('soma em centavos, sem erro de ponto flutuante', () => {
    expect(somar([{ valor: 0.1 }, { valor: 0.2 }, { valor: '0.3' }])).toBe(0.6);
    expect(somar([])).toBe(0);
  });
});

describe('agregarPorCategoria', () => {
  it('agrupa, soma, conta e ordena por total', () => {
    const r = agregarPorCategoria([
      { valor: 100, categoria: 'Material' },
      { valor: 50, categoria: 'Frete' },
      { valor: 200, categoria: 'Material' },
      { valor: 10, categoria: null },
    ]);
    expect(r).toEqual([
      { categoria: 'Material', total: 300, quantidade: 2 },
      { categoria: 'Frete', total: 50, quantidade: 1 },
      { categoria: 'Sem categoria', total: 10, quantidade: 1 },
    ]);
  });
});

describe('rankearFornecedores', () => {
  it('respeita o limite e ordena por total', () => {
    const r = rankearFornecedores(
      [
        { valor: 10, fornecedor: 'A' },
        { valor: 90, fornecedor: 'B' },
        { valor: 50, fornecedor: 'C' },
      ],
      2,
    );
    expect(r.map((x) => x.fornecedor)).toEqual(['B', 'C']);
  });
});

describe('periodoValido', () => {
  it('aceita período normal', () => {
    expect(periodoValido('2026-09-01', '2026-09-30')).toBeNull();
  });
  it('recusa invertido e maior que dois anos', () => {
    expect(periodoValido('2026-09-30', '2026-09-01')).toMatch(/depois/u);
    expect(periodoValido('2020-01-01', '2026-09-01')).toMatch(/dois anos/u);
  });
});

describe('schemas das ferramentas', () => {
  it('toda ferramenta tem nome snake_case único e descrição', () => {
    const nomes = FERRAMENTAS_DE_OBRA.map((f) => f.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
    for (const f of FERRAMENTAS_DE_OBRA) {
      expect(f.nome).toMatch(/^[a-z_]+$/u);
      expect(f.descricao.length).toBeGreaterThan(40);
    }
  });

  it('limites não podem ser estourados pelo modelo', () => {
    const semDoc = FERRAMENTAS_DE_OBRA.find((f) => f.nome === 'pagamentos_sem_documento');
    expect(semDoc?.schema.safeParse({ limite: 500 }).success).toBe(false);
    expect(semDoc?.schema.safeParse({ dias_minimos: -1 }).success).toBe(false);
    expect(semDoc?.schema.safeParse({}).success).toBe(true);

    const periodo = FERRAMENTAS_DE_OBRA.find((f) => f.nome === 'gastos_por_periodo');
    expect(periodo?.schema.safeParse({ de: '01/09/2026', ate: '2026-09-30' }).success).toBe(false);
    expect(periodo?.schema.safeParse({ de: '2026-09-01', ate: '2026-09-30' }).success).toBe(true);

    const obra = FERRAMENTAS_DE_OBRA.find((f) => f.nome === 'gasto_por_obra');
    expect(obra?.schema.safeParse({ obra: 'x'.repeat(81) }).success).toBe(false);
    expect(obra?.schema.safeParse({ obra: 'G' }).success).toBe(false);
  });
});
