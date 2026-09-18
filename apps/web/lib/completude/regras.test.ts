import { describe, expect, it } from 'vitest';
import {
  avaliarDocumento,
  avaliarFornecedor,
  avaliarObra,
  avaliarPagamento,
  fraseDoNivel,
  lerFiltroDeSituacao,
  nivelDasFaltas,
  passaNoFiltro,
  resumirNiveis,
  rotuloCurto,
} from './regras';
import type { Falta } from './regras';

const falta = (gravidade: Falta['gravidade'], chave: string = gravidade): Falta => ({
  chave,
  gravidade,
  texto: chave,
  curto: chave,
});

describe('nivelDasFaltas', () => {
  it('nenhuma falta é completo', () => {
    expect(nivelDasFaltas([])).toBe('completo');
  });
  it('uma crítica é vermelho', () => {
    expect(nivelDasFaltas([falta('critica')])).toBe('critico');
  });
  it('uma importante é amarelo; duas são vermelho', () => {
    expect(nivelDasFaltas([falta('importante')])).toBe('parcial');
    expect(nivelDasFaltas([falta('importante', 'a'), falta('importante', 'b')])).toBe('critico');
  });
  it('leves nunca deixam vermelho', () => {
    expect(nivelDasFaltas([falta('leve', 'a'), falta('leve', 'b'), falta('leve', 'c')])).toBe(
      'parcial',
    );
  });
});

describe('avaliarPagamento', () => {
  const completo = {
    id: 'p1',
    status_pagto: 'confirmado' as const,
    fornecedor_id: 'f',
    categoria_id: 'c',
    descricao: 'Cimento',
  };

  it('pagamento com tudo é verde, 6 de 6', () => {
    const c = avaliarPagamento(completo, { temDocumento: true });
    expect(c.nivel).toBe('completo');
    expect(c.itensOk).toBe(6);
    expect(c.itensTotal).toBe(6);
    expect(rotuloCurto(c)).toBe('Completo');
    expect(fraseDoNivel(c)).toBe('Tudo completo');
  });

  it('sem comprovante é crítico, com link para anexar', () => {
    const c = avaliarPagamento(completo, { temDocumento: false });
    expect(c.nivel).toBe('critico');
    expect(c.faltas.map((f) => f.chave)).toEqual(['comprovante']);
    expect(c.faltas[0]?.acao?.href).toBe('/documentos/novo?pagamento_id=p1');
    expect(rotuloCurto(c)).toBe('Sem comprovante');
  });

  it('recusado não precisa de comprovante', () => {
    const c = avaliarPagamento({ ...completo, status_pagto: 'recusado' }, { temDocumento: false });
    expect(c.faltas.map((f) => f.chave)).toEqual([]);
    expect(c.nivel).toBe('completo');
  });

  it('aguardando aprovação é amarelo; junto com sem fornecedor vira vermelho', () => {
    const a = avaliarPagamento({ ...completo, status_pagto: 'aguardando' }, { temDocumento: true });
    expect(a.nivel).toBe('parcial');
    expect(a.faltas.map((f) => f.chave)).toEqual(['aprovacao']);
    const b = avaliarPagamento(
      { ...completo, status_pagto: 'aguardando', fornecedor_id: null },
      { temDocumento: true },
    );
    expect(b.nivel).toBe('critico');
    expect(rotuloCurto(b)).toBe('Faltam 2');
  });

  it('só a descrição faltando é amarelo e conta 5 de 6', () => {
    const c = avaliarPagamento({ ...completo, descricao: '  ' }, { temDocumento: true });
    expect(c.nivel).toBe('parcial');
    expect(c.itensOk).toBe(5);
  });

  it('ordena crítica antes de importante antes de leve', () => {
    const c = avaliarPagamento(
      { ...completo, fornecedor_id: null, descricao: null },
      { temDocumento: false },
    );
    expect(c.faltas.map((f) => f.gravidade)).toEqual(['critica', 'importante', 'leve']);
  });
});

describe('avaliarObra', () => {
  const ctxOk = {
    hoje: '2026-09-18',
    gasto: 100_000,
    pagamentos: 10,
    pagamentosSemDocumento: 0,
    docsPorPasta: { documentacao: 3, fotos: 2, projeto: 1 },
  };
  const obraOk = {
    id: 'o1',
    status: 'ativa' as const,
    cliente: 'Carolina',
    tipo: 'nova',
    valor_contrato: 300_000,
    orcamento: 280_000,
    data_inicio: '2026-01-10',
    data_prevista_fim: '2026-12-20',
    endereco: { rua: 'Estrada Caminho do Meio', numero: '2259', cidade: 'Viamão' },
  };

  it('obra completa é verde, 14 de 14', () => {
    const c = avaliarObra(obraOk, ctxOk);
    expect(c.nivel).toBe('completo');
    expect(c.itensTotal).toBe(14);
    expect(c.itensOk).toBe(14);
  });

  it('etapas acima do orçado é importante e aponta para o cronograma', () => {
    const c = avaliarObra(obraOk, { ...ctxOk, etapasEstouradas: 2 });
    expect(c.nivel).toBe('parcial');
    expect(c.faltas[0]).toMatchObject({ chave: 'etapas_estouradas', curto: '2 acima do orçado' });
    expect(c.faltas[0]?.acao?.href).toBe('/obras/o1#cronograma');
  });

  it('sem contrato é crítico', () => {
    const c = avaliarObra({ ...obraOk, valor_contrato: null }, ctxOk);
    expect(c.nivel).toBe('critico');
    expect(c.faltas[0]?.chave).toBe('contrato');
  });

  it('prazo vencido com obra ativa é crítico; pausada não', () => {
    const vencida = { ...obraOk, data_prevista_fim: '2026-09-17' };
    expect(avaliarObra(vencida, ctxOk).faltas[0]?.chave).toBe('prazo_vencido');
    expect(avaliarObra(vencida, ctxOk).faltas[0]?.texto).toContain('17/09/2026');
    expect(
      avaliarObra({ ...vencida, status: 'pausada' }, ctxOk).faltas.map((f) => f.chave),
    ).toEqual([]);
  });

  it('gasto acima do contrato é crítico e diz quanto', () => {
    const c = avaliarObra(obraOk, { ...ctxOk, gasto: 350_000 });
    expect(c.faltas[0]?.chave).toBe('acima_do_contrato');
    expect(c.faltas[0]?.texto).toContain('50.000');
  });

  it('pagamentos sem comprovante é importante, com o número e o link filtrado', () => {
    const c = avaliarObra(obraOk, { ...ctxOk, pagamentosSemDocumento: 4 });
    expect(c.nivel).toBe('parcial');
    expect(c.faltas[0]?.curto).toBe('4 sem comprovante');
    expect(c.faltas[0]?.acao?.href).toBe('/pagamentos?obra_id=o1&situacao=pendente');
  });

  it('duas importantes (sem cliente e sem endereço) viram vermelho', () => {
    const c = avaliarObra({ ...obraOk, cliente: null, endereco: {} }, ctxOk);
    expect(c.nivel).toBe('critico');
    expect(c.faltas.map((f) => f.chave)).toEqual(['cliente', 'endereco']);
  });

  it('sem fotos, projeto e tipo é só amarelo (leves)', () => {
    const c = avaliarObra(
      { ...obraOk, tipo: null },
      { ...ctxOk, docsPorPasta: { documentacao: 1 } },
    );
    expect(c.nivel).toBe('parcial');
    expect(c.faltas.map((f) => f.chave)).toEqual(['fotos', 'projeto', 'tipo']);
  });

  it('obra concluída só cobra contrato e comprovantes', () => {
    const c = avaliarObra(
      { ...obraOk, status: 'concluida', cliente: null, data_prevista_fim: '2020-01-01' },
      { ...ctxOk, docsPorPasta: {}, pagamentosSemDocumento: 2 },
    );
    expect(c.itensTotal).toBe(2);
    expect(c.faltas.map((f) => f.chave)).toEqual(['comprovantes']);
  });
});

describe('avaliarFornecedor', () => {
  const ok = {
    id: 'f1',
    documento: '12345678000100',
    telefone: '5551999999999',
    categoria_id: 'c',
    email: 'a@b.com',
    razao_social: 'Fulano ME',
  };
  it('completo', () => {
    expect(avaliarFornecedor(ok).nivel).toBe('completo');
  });
  it('sem telefone é amarelo; sem telefone e sem CNPJ é vermelho', () => {
    expect(avaliarFornecedor({ ...ok, telefone: null }).nivel).toBe('parcial');
    expect(avaliarFornecedor({ ...ok, telefone: null, documento: '' }).nivel).toBe('critico');
  });
  it('só os leves é amarelo com 2 de 5', () => {
    const c = avaliarFornecedor({ ...ok, categoria_id: null, email: null, razao_social: null });
    expect(c.nivel).toBe('parcial');
    expect(c.itensOk).toBe(2);
    expect(rotuloCurto(c)).toBe('Faltam 3');
  });
});

describe('avaliarDocumento', () => {
  it('nota fiscal completa', () => {
    const c = avaliarDocumento({
      id: 'd',
      tipo: 'nota_fiscal',
      obra_id: 'o',
      pagamento_id: 'p',
      fornecedor_id: 'f',
      numero_nf: '123',
    });
    expect(c.nivel).toBe('completo');
    expect(c.itensTotal).toBe(4);
  });
  it('comprovante sem pagamento é importante; foto sem pagamento não é falta', () => {
    const base = {
      id: 'd',
      obra_id: 'o',
      pagamento_id: null,
      fornecedor_id: null,
      numero_nf: null,
    };
    expect(avaliarDocumento({ ...base, tipo: 'comprovante' }).faltas.map((f) => f.chave)).toEqual([
      'pagamento',
    ]);
    expect(avaliarDocumento({ ...base, tipo: 'outro' }).nivel).toBe('completo');
  });
  it('sem obra e sem pagamento (nota) é vermelho', () => {
    const c = avaliarDocumento({
      id: 'd',
      tipo: 'nota_fiscal',
      obra_id: null,
      pagamento_id: null,
      fornecedor_id: null,
      numero_nf: null,
    });
    expect(c.nivel).toBe('critico');
    expect(c.faltas.map((f) => f.chave)).toEqual(['obra', 'pagamento', 'fornecedor', 'numero_nf']);
  });
});

describe('resumo e filtro', () => {
  it('resumirNiveis conta cada nível', () => {
    expect(
      resumirNiveis([{ nivel: 'completo' }, { nivel: 'critico' }, { nivel: 'critico' }]),
    ).toEqual({ completo: 1, parcial: 0, critico: 2, total: 3 });
  });
  it('lerFiltroDeSituacao aceita só os valores conhecidos', () => {
    expect(lerFiltroDeSituacao('pendente')).toBe('pendente');
    expect(lerFiltroDeSituacao('qualquer')).toBe('');
    expect(lerFiltroDeSituacao(undefined)).toBe('');
  });
  it('passaNoFiltro: pendente = tudo que não é completo', () => {
    expect(passaNoFiltro({ nivel: 'parcial' }, 'pendente')).toBe(true);
    expect(passaNoFiltro({ nivel: 'completo' }, 'pendente')).toBe(false);
    expect(passaNoFiltro({ nivel: 'parcial' }, 'critico')).toBe(false);
    expect(passaNoFiltro({ nivel: 'critico' }, '')).toBe(true);
  });
});
