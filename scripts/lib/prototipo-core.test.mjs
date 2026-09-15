import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CNPJ_CAVALCANTI, cnpjPorFornecedor } from './prototipo-core.mjs';

// CNPJs fictícios: o repositório é público.
const CLIENTE = '11.111.111/0001-11';
const OCORRENCIAS = [
  { fornecedor: 'Ferragem A', cnpj: '22.222.222/0001-22', docs: 56 },
  { fornecedor: 'Ferragem A', cnpj: CLIENTE, docs: 31 },
  { fornecedor: 'Ferragem A', cnpj: CNPJ_CAVALCANTI, docs: 10 },
  { fornecedor: 'Elétrica B', cnpj: '33.333.333/0001-33', docs: 2 },
  { fornecedor: 'Elétrica B', cnpj: CLIENTE, docs: 2 },
  { fornecedor: 'Pedras C', cnpj: CLIENTE, docs: 1 },
  { fornecedor: 'Pedras C', cnpj: '44.444.444/0001-44', docs: 1 },
  { fornecedor: 'Empate D', cnpj: '55.555.555/0001-55', docs: 2 },
  { fornecedor: 'Empate D', cnpj: '66.666.666/0001-66', docs: 2 },
  { fornecedor: 'Só cliente E', cnpj: CLIENTE, docs: 3 },
];

describe('cnpjPorFornecedor', () => {
  const r = cnpjPorFornecedor(OCORRENCIAS);

  it('o CNPJ que aparece em 3+ fornecedores é destinatário, não emitente', () => {
    assert.deepEqual(r.compartilhados, [CLIENTE]);
    assert.equal(r.porFornecedor.get('Só cliente E'), undefined);
  });

  it('o mais frequente em 2+ notas vale; único candidato em 1 nota também', () => {
    assert.equal(r.porFornecedor.get('Ferragem A'), '22.222.222/0001-22');
    assert.equal(r.porFornecedor.get('Elétrica B'), '33.333.333/0001-33');
    assert.equal(r.porFornecedor.get('Pedras C'), '44.444.444/0001-44');
  });

  it('empate entre candidatos não decide', () => {
    assert.equal(r.porFornecedor.get('Empate D'), undefined);
  });

  it('o CNPJ da construtora nunca é atribuído a fornecedor', () => {
    const so = cnpjPorFornecedor([{ fornecedor: 'X', cnpj: CNPJ_CAVALCANTI, docs: 5 }]);
    assert.equal(so.porFornecedor.size, 0);
  });
});
