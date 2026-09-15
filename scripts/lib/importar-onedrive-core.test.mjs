import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  casarObra,
  categoriaDaPasta,
  ehLixo,
  localizarRaizDasObras,
  magicConfere,
  mimeDaExtensao,
  planejar,
  relatorio,
  tipoDoNome,
} from './importar-onedrive-core.mjs';

// Nomes fictícios: o repositório é público.
const OBRAS = [
  { id: 'o1', nome: 'Casa EJ', apelidos: [], onedrive_folder_id: 'PAGAMENTOS/E&J/' },
  { id: 'o2', nome: 'Garibaldi', apelidos: ['Gari'], onedrive_folder_id: 'PAGAMENTOS/Garibaldi/' },
  { id: 'o3', nome: 'G&C Aura Legano', apelidos: [], onedrive_folder_id: 'PAGAMENTOS/Garibaldi/' },
  { id: 'o4', nome: 'INOX Piratini', apelidos: [], onedrive_folder_id: 'PAGAMENTOS/INOX/' },
];

const arq = (caminhoRel, extra = {}) => ({
  caminhoRel,
  hash: `h:${caminhoRel}`,
  tamanho: 1000,
  mtime: '2026-09-01T00:00:00Z',
  magicOk: true,
  ...extra,
});

describe('categoriaDaPasta / tipoDoNome (mesmas grafias do app)', () => {
  it('reconhece as pastas do cliente', () => {
    assert.equal(categoriaDaPasta('NFs/Pagamentos'), 'nfs_pagamentos');
    assert.equal(categoriaDaPasta("NF's"), 'nfs_pagamentos');
    assert.equal(categoriaDaPasta('Documentação'), 'documentacao');
    assert.equal(categoriaDaPasta('Projeto Aprovado'), 'projeto_aprovado');
    assert.equal(categoriaDaPasta('Projeto'), 'projeto');
    assert.equal(categoriaDaPasta('Fotos'), 'fotos');
    assert.equal(categoriaDaPasta('Orçamentos'), 'orcamentos');
    assert.equal(categoriaDaPasta('Proposta'), 'proposta');
    assert.equal(categoriaDaPasta('Cronograma'), 'cronograma');
    assert.equal(categoriaDaPasta(''), 'outro');
  });
  it('tipo pelo nome', () => {
    assert.equal(tipoDoNome('NF 123.pdf'), 'nota_fiscal');
    assert.equal(tipoDoNome('comprovante pix.jpg'), 'comprovante');
    assert.equal(tipoDoNome('Contrato.pdf'), 'contrato');
    assert.equal(tipoDoNome('IMG_1.jpg'), 'outro');
  });
});

describe('arquivos', () => {
  it('lixo e tipos', () => {
    assert.equal(ehLixo('.DS_Store'), true);
    assert.equal(ehLixo('Thumbs.db'), true);
    assert.equal(ehLixo('~$planilha.xlsx'), true);
    assert.equal(ehLixo('nota.pdf'), false);
    assert.equal(mimeDaExtensao('a.PDF'), 'application/pdf');
    assert.equal(mimeDaExtensao('a.jpeg'), 'image/jpeg');
    assert.equal(mimeDaExtensao('a.dwg'), null);
    assert.equal(mimeDaExtensao('semextensao'), null);
  });
  it('magic bytes', () => {
    assert.equal(magicConfere('application/pdf', Buffer.from('%PDF-1.4')), true);
    assert.equal(magicConfere('application/pdf', Buffer.from('<html>')), false);
    assert.equal(magicConfere('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])), true);
    assert.equal(magicConfere('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47])), true);
    assert.equal(
      magicConfere(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        Buffer.from('PK\x03\x04'),
      ),
      true,
    );
  });
});

describe('casarObra', () => {
  it('por exceção explícita', () => {
    assert.equal(casarObra('Caminho do meio E&J', OBRAS)?.id, 'o1');
    assert.equal(casarObra('Inox Piratini', OBRAS)?.id, 'o4');
  });
  it('por nome, apelido e pasta cadastrada', () => {
    assert.equal(casarObra('garibaldi', OBRAS, {})?.id, 'o2');
    assert.equal(casarObra('Gari', OBRAS, {})?.id, 'o2');
    assert.equal(casarObra('INOX', OBRAS, {})?.id, 'o4');
  });
  it('nome exato vence apelido; ambíguo dentro da mesma camada → null', () => {
    const obras = [
      { id: 'a', nome: 'X', apelidos: ['dup'] },
      { id: 'b', nome: 'dup', apelidos: [] },
      { id: 'c', nome: 'Y', apelidos: ['dois'] },
      { id: 'd', nome: 'Z', apelidos: ['dois'] },
    ];
    assert.equal(casarObra('dup', obras, {})?.id, 'b');
    assert.equal(casarObra('dois', obras, {}), null);
    // Em produção: 'Garibaldi' é nome de o2 e pasta antiga de o3 → o2.
    assert.equal(casarObra('Garibaldi', OBRAS, {})?.id, 'o2');
  });
  it('desconhecida → null', () => {
    assert.equal(casarObra('Aguirre', OBRAS), null);
  });
});

describe('localizarRaizDasObras', () => {
  it('acha a pasta _OBRAS ATIVAS_ em qualquer nível', () => {
    assert.equal(
      localizarRaizDasObras(['Cavalcanti Construções/_OBRAS ATIVAS_/Garibaldi/Fotos/a.jpg']),
      'Cavalcanti Construções/_OBRAS ATIVAS_',
    );
    assert.equal(localizarRaizDasObras(['_OBRAS ATIVAS_/Garibaldi/a.jpg']), '_OBRAS ATIVAS_');
    assert.equal(localizarRaizDasObras(['Garibaldi/a.jpg']), '');
  });
});

describe('planejar', () => {
  it('cria com obra, categoria e tipo; ignora lixo, tipo estranho e raiz', () => {
    const plano = planejar({
      arquivos: [
        arq('Garibaldi/NFs/NF 10.pdf'),
        arq('Garibaldi/Fotos/IMG_1.jpg'),
        arq('Garibaldi/solto.pdf'),
        arq('Garibaldi/Fotos/.DS_Store'),
        arq('Garibaldi/Projeto/planta.dwg'),
        arq('leiame.txt'),
        arq('Garibaldi/NFs/falso.pdf', { magicOk: false }),
        arq('Garibaldi/NFs/enorme.pdf', { tamanho: 21 * 1024 * 1024 }),
      ],
      obras: OBRAS,
      documentosExistentes: [],
    });
    assert.equal(plano.criar.length, 3);
    const nf = plano.criar.find((c) => c.nome === 'NF 10.pdf');
    assert.deepEqual(
      { obraId: nf.obraId, categoria: nf.categoria, tipo: nf.tipo, mime: nf.mime },
      { obraId: 'o2', categoria: 'nfs_pagamentos', tipo: 'nota_fiscal', mime: 'application/pdf' },
    );
    assert.equal(plano.criar.find((c) => c.nome === 'IMG_1.jpg').categoria, 'fotos');
    assert.equal(plano.criar.find((c) => c.nome === 'solto.pdf').categoria, 'outro');
    assert.deepEqual(plano.ignorar.map((i) => i.motivo).sort(), [
      'conteudo_nao_confere',
      'fora_de_obra',
      'grande',
      'lixo',
      'tipo_nao_suportado',
    ]);
  });

  it('pasta sem obra: ignora sem --criar-obras, cria com', () => {
    const arquivos = [arq('Aguirre/Fotos/a.jpg')];
    const sem = planejar({ arquivos, obras: OBRAS, documentosExistentes: [] });
    assert.equal(sem.criar.length, 0);
    assert.deepEqual(sem.obrasNaoCasadas, ['Aguirre']);

    const com = planejar({ arquivos, obras: OBRAS, documentosExistentes: [], criarObras: true });
    assert.equal(com.criar.length, 1);
    assert.equal(com.criar[0].obraId, null);
    assert.equal(com.criar[0].obraNome, 'Aguirre');
    assert.deepEqual(com.obrasNovas, ['Aguirre']);
  });

  it('mesmo hash no mesmo caminho = inalterado; mesmo hash em caminho novo = atualizar', () => {
    const existentes = [
      {
        id: 'd1',
        hash_sha256: 'h:Garibaldi/NFs/NF 10.pdf',
        caminho_origem: 'Garibaldi/NFs/NF 10.pdf',
        obra_id: 'o2',
      },
      {
        id: 'd2',
        hash_sha256: 'h:velho',
        caminho_origem: 'Garibaldi/NFs/velho.pdf',
        obra_id: 'o2',
      },
    ];
    const plano = planejar({
      arquivos: [
        arq('Garibaldi/NFs/NF 10.pdf'),
        arq('Garibaldi/Docs/movido.pdf', { hash: 'h:velho' }),
      ],
      obras: OBRAS,
      documentosExistentes: existentes,
    });
    assert.equal(plano.inalterados, 1);
    assert.equal(plano.criar.length, 0);
    assert.equal(plano.atualizar.length, 1);
    assert.equal(plano.atualizar[0].id, 'd2');
    assert.equal(plano.atualizar[0].caminho, 'Garibaldi/Docs/movido.pdf');
    assert.equal(plano.apagar.length, 0);
  });

  it('mesmo caminho com hash novo = substituído (apaga o antigo, cria o novo)', () => {
    const plano = planejar({
      arquivos: [arq('Garibaldi/NFs/NF 10.pdf', { hash: 'h:v2' })],
      obras: OBRAS,
      documentosExistentes: [
        { id: 'd1', hash_sha256: 'h:v1', caminho_origem: 'Garibaldi/NFs/NF 10.pdf', obra_id: 'o2' },
      ],
    });
    assert.equal(plano.criar.length, 1);
    assert.deepEqual(plano.apagar, [
      { id: 'd1', caminho: 'Garibaldi/NFs/NF 10.pdf', motivo: 'substituido' },
    ]);
  });

  it('removido do Drive só apaga em obra varrida', () => {
    const plano = planejar({
      arquivos: [arq('Garibaldi/NFs/NF 10.pdf')],
      obras: OBRAS,
      documentosExistentes: [
        {
          id: 'd1',
          hash_sha256: 'h:Garibaldi/NFs/NF 10.pdf',
          caminho_origem: 'Garibaldi/NFs/NF 10.pdf',
          obra_id: 'o2',
        },
        {
          id: 'd2',
          hash_sha256: 'h:sumiu',
          caminho_origem: 'Garibaldi/NFs/sumiu.pdf',
          obra_id: 'o2',
        },
        {
          id: 'd3',
          hash_sha256: 'h:outra',
          caminho_origem: 'Inox Piratini/NFs/fica.pdf',
          obra_id: 'o4',
        },
      ],
    });
    assert.deepEqual(plano.apagar, [
      { id: 'd2', caminho: 'Garibaldi/NFs/sumiu.pdf', motivo: 'removido' },
    ]);
  });

  it('relatório agrupa por obra e categoria e lista pendências', () => {
    const plano = planejar({
      arquivos: [
        arq('Garibaldi/NFs/NF 10.pdf'),
        arq('Garibaldi/Fotos/a.jpg'),
        arq('Aguirre/x.pdf'),
      ],
      obras: OBRAS,
      documentosExistentes: [],
    });
    const txt = relatorio(plano);
    assert.match(txt, /Garibaldi/u);
    assert.match(txt, /nfs_pagamentos\s+1/u);
    assert.match(txt, /fotos\s+1/u);
    assert.match(txt, /pastas sem obra.*Aguirre/u);
  });
});
