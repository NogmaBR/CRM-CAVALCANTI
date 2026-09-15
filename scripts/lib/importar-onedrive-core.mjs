/**
 * Núcleo puro do importador do OneDrive — sem rede, sem disco.
 *
 * Tudo que decide "o que fazer com cada arquivo" mora aqui para ser testável
 * com `node --test scripts/lib/`. O runner (`scripts/importar-onedrive.mjs`)
 * só lê a árvore, calcula hash, chama `planejar` e executa o plano por REST.
 *
 * As funções `normalizarNome`, `categoriaDaPasta` e `tipoDoNome` são cópia em
 * JS das de `apps/web/lib/acervo/categoria.ts` — o script roda com Node puro,
 * sem o toolchain do app. Mudou lá, muda aqui (os testes dos dois lados travam
 * as mesmas grafias).
 */

// ---------------------------------------------------------------------------
// Nomes
// ---------------------------------------------------------------------------

/** Sem acento, minúsculo, só letras/dígitos separados por um espaço. */
export function normalizarNome(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['\u2019]/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function contemPalavra(texto, termo) {
  return ` ${texto} `.includes(` ${termo} `);
}

const REGRAS_CATEGORIA = [
  ['projeto_aprovado', ['projeto aprovado', 'projetos aprovados', 'aprovado']],
  [
    'nfs_pagamentos',
    ['nfs', 'nf', 'nota', 'notas', 'pagamento', 'pagamentos', 'comprovante', 'comprovantes'],
  ],
  ['documentacao', ['documentacao', 'documentos', 'documento', 'contrato', 'contratos']],
  ['projeto', ['projeto', 'projetos']],
  ['fotos', ['foto', 'fotos', 'imagem', 'imagens']],
  ['orcamentos', ['orcamento', 'orcamentos']],
  ['proposta', ['proposta', 'propostas']],
  ['cronograma', ['cronograma', 'cronogramas']],
];

export function categoriaDaPasta(nome) {
  const n = normalizarNome(nome);
  if (!n) return 'outro';
  for (const [categoria, termos] of REGRAS_CATEGORIA) {
    if (termos.some((t) => contemPalavra(n, t))) return categoria;
  }
  return 'outro';
}

const REGRAS_TIPO = [
  ['nota_fiscal', ['nf', 'nfe', 'nfs', 'nfse', 'danfe', 'nota', 'notas']],
  [
    'comprovante',
    ['comprovante', 'comprovantes', 'pix', 'ted', 'doc', 'boleto', 'recibo', 'transferencia'],
  ],
  ['contrato', ['contrato', 'contratos', 'aditivo']],
];

export function tipoDoNome(nomeArquivo) {
  const n = normalizarNome(String(nomeArquivo).replace(/\.[a-z0-9]{2,5}$/iu, ''));
  for (const [tipo, termos] of REGRAS_TIPO) {
    if (termos.some((t) => contemPalavra(n, t))) return tipo;
  }
  return 'outro';
}

// ---------------------------------------------------------------------------
// Arquivos
// ---------------------------------------------------------------------------

const LIXO = new Set(['.ds_store', 'thumbs.db', 'desktop.ini', '.gitkeep']);

/** Arquivo de sistema, temporário do Office ou oculto: nunca sobe. */
export function ehLixo(nome) {
  const n = String(nome).toLowerCase();
  return LIXO.has(n) || n.startsWith('~$') || n.startsWith('._') || n.startsWith('.');
}

/** Só o que o CRM sabe guardar e abrir. Fora daqui vira "não suportado". */
export const MIME_POR_EXTENSAO = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
};

export function mimeDaExtensao(nome) {
  const m = String(nome).match(/\.([a-z0-9]{2,5})$/iu);
  if (!m) return null;
  return MIME_POR_EXTENSAO[m[1].toLowerCase()] ?? null;
}

/** Mesmo teto do download de mídia do WhatsApp (`LIMITE_MIDIA_BYTES`). */
export const LIMITE_BYTES = 20 * 1024 * 1024;

/**
 * Magic bytes dos tipos aceitos. XLSX/DOCX são ZIP (`PK`); XLS/DOC antigos são
 * OLE (`D0 CF 11 E0`). Conferir aqui é defesa em profundidade sobre a
 * extensão — um `.pdf` que é HTML não entra.
 */
export function magicConfere(mime, primeirosBytes) {
  const b = primeirosBytes;
  if (!b || b.length < 4) return false;
  switch (mime) {
    case 'application/pdf':
      return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case 'image/webp':
      return (
        b.length >= 12 &&
        b[0] === 0x52 &&
        b[1] === 0x49 &&
        b[2] === 0x46 &&
        b[3] === 0x46 &&
        b[8] === 0x57 &&
        b[9] === 0x45 &&
        b[10] === 0x42 &&
        b[11] === 0x50
      );
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return b[0] === 0x50 && b[1] === 0x4b; // PK
    case 'application/vnd.ms-excel':
    case 'application/msword':
      return b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Obras
// ---------------------------------------------------------------------------

/**
 * Pastas do Drive cujo nome não bate com o cadastro por heurística nenhuma.
 * Chave: nome da pasta normalizado. Valor: `obras.nome` exato.
 */
export const EXCECOES_OBRA = {
  'caminho do meio e j': 'Casa EJ',
  'caminho do meio': 'Casa EJ',
  'e j': 'Casa EJ',
  'inox piratini': 'INOX Piratini',
  inox: 'INOX Piratini',
  'k c': 'Casas Rotterdam',
  wrb: 'WRB House',
  'nsiy 4 sobrados': 'NSIY 4 Sobrados',
  'nsiy 7 casas': 'NSIY 7 Casas',
  faihome: 'FAIHome',
  'reservas do lago': 'Reservas do Lago',
  'g c aura legano': 'G&C Aura Legano',
  'aura legano': 'G&C Aura Legano',
};

/**
 * Casa a pasta com uma obra: exceção explícita → nome exato → apelido →
 * último segmento do `onedrive_folder_id`. Só devolve quando há UMA
 * candidata; duas obras casando é `null` e vai para o relatório.
 */
export function casarObra(pasta, obras, excecoes = EXCECOES_OBRA) {
  const alvo = normalizarNome(pasta);
  if (!alvo) return null;

  const porExcecao = excecoes[alvo];
  if (porExcecao) {
    const o = obras.find((x) => x.nome === porExcecao);
    if (o) return o;
  }

  // Em camadas: nome exato vence apelido, que vence a pasta cadastrada. Em
  // produção "Garibaldi" é o nome de uma obra E a pasta antiga de outra
  // (`G&C Aura Legano` aponta para `PAGAMENTOS/Garibaldi/`) — sem camadas
  // seria ambíguo e a obra certa ficaria sem acervo.
  const camadas = [
    (o) => normalizarNome(o.nome) === alvo,
    (o) => (o.apelidos ?? []).some((a) => normalizarNome(a) === alvo),
    (o) => {
      const pasta = String(o.onedrive_folder_id ?? '')
        .split('/')
        .filter(Boolean)
        .pop();
      return pasta ? normalizarNome(pasta) === alvo : false;
    },
  ];
  for (const casa of camadas) {
    const candidatas = obras.filter(casa);
    if (candidatas.length === 1) return candidatas[0];
    if (candidatas.length > 1) return null; // ambíguo dentro da camada
  }
  return null;
}

/**
 * Descobre, na lista de caminhos relativos, o prefixo que contém as pastas de
 * obra: a pasta chamada `_OBRAS ATIVAS_` (qualquer grafia). Sem ela, a raiz
 * dada é a própria raiz das obras.
 */
export function localizarRaizDasObras(caminhos) {
  for (const c of caminhos) {
    const partes = c.split('/');
    const i = partes.findIndex((p) => normalizarNome(p) === 'obras ativas');
    if (i >= 0) return partes.slice(0, i + 1).join('/');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Plano
// ---------------------------------------------------------------------------

/**
 * @param {object} args
 * @param {Array<{caminhoRel:string, hash:string, tamanho:number, mtime:string, magicOk:boolean}>} args.arquivos
 *   caminho relativo à raiz das obras, com `/`.
 * @param {Array<{id:string, nome:string, apelidos?:string[], onedrive_folder_id?:string|null}>} args.obras
 * @param {Array<{id:string, hash_sha256:string|null, caminho_origem:string|null, obra_id:string|null}>} args.documentosExistentes
 *   só `origem = 'onedrive'` e vivos.
 * @param {boolean} [args.criarObras]
 */
export function planejar({ arquivos, obras, documentosExistentes, criarObras = false }) {
  const plano = {
    criar: [],
    atualizar: [],
    apagar: [],
    ignorar: [],
    inalterados: 0,
    obrasNovas: [],
    obrasNaoCasadas: [],
  };

  const porHash = new Map();
  const porCaminho = new Map();
  for (const d of documentosExistentes) {
    if (d.hash_sha256) porHash.set(d.hash_sha256, d);
    if (d.caminho_origem) porCaminho.set(d.caminho_origem, d);
  }

  const obrasVarridas = new Set();
  const caminhosVistos = new Set();
  const obrasNovasSet = new Set();
  const naoCasadasSet = new Set();

  for (const arq of arquivos) {
    const partes = arq.caminhoRel.split('/').filter(Boolean);
    const nome = partes[partes.length - 1];

    if (partes.length < 2) {
      plano.ignorar.push({ caminho: arq.caminhoRel, motivo: 'fora_de_obra' });
      continue;
    }
    if (ehLixo(nome)) {
      plano.ignorar.push({ caminho: arq.caminhoRel, motivo: 'lixo' });
      continue;
    }
    const mime = mimeDaExtensao(nome);
    if (!mime) {
      plano.ignorar.push({ caminho: arq.caminhoRel, motivo: 'tipo_nao_suportado' });
      continue;
    }
    if (arq.magicOk === false) {
      plano.ignorar.push({ caminho: arq.caminhoRel, motivo: 'conteudo_nao_confere' });
      continue;
    }
    if (arq.tamanho > LIMITE_BYTES) {
      plano.ignorar.push({ caminho: arq.caminhoRel, motivo: 'grande' });
      continue;
    }

    const pastaObra = partes[0];
    const subpasta = partes.length >= 3 ? partes[1] : '';
    const obra = casarObra(pastaObra, obras);
    let obraId = obra?.id ?? null;
    let obraNome = obra?.nome ?? null;

    if (!obra) {
      if (!criarObras) {
        naoCasadasSet.add(pastaObra);
        plano.ignorar.push({ caminho: arq.caminhoRel, motivo: 'obra_nao_casada' });
        continue;
      }
      obrasNovasSet.add(pastaObra);
      obraNome = pastaObra;
      obraId = null; // o runner cria a obra e preenche
    }

    if (obraId) obrasVarridas.add(obraId);
    caminhosVistos.add(arq.caminhoRel);

    const item = {
      caminho: arq.caminhoRel,
      nome,
      mime,
      tamanho: arq.tamanho,
      hash: arq.hash,
      mtime: arq.mtime,
      obraId,
      obraNome,
      categoria: categoriaDaPasta(subpasta),
      tipo: tipoDoNome(nome),
    };

    const mesmoHash = porHash.get(arq.hash);
    if (mesmoHash) {
      if (mesmoHash.caminho_origem !== arq.caminhoRel) {
        // Movido ou renomeado no Drive: mesmo documento, caminho novo. O
        // caminho antigo conta como visto para não virar "removido" abaixo.
        if (mesmoHash.caminho_origem) caminhosVistos.add(mesmoHash.caminho_origem);
        plano.atualizar.push({ id: mesmoHash.id, ...item });
      } else {
        plano.inalterados += 1;
      }
      continue;
    }

    const mesmoCaminho = porCaminho.get(arq.caminhoRel);
    if (mesmoCaminho) {
      // Substituído no Drive: o antigo sai, o novo entra.
      plano.apagar.push({ id: mesmoCaminho.id, caminho: arq.caminhoRel, motivo: 'substituido' });
    }
    plano.criar.push(item);
  }

  // Removidos do Drive: só em obras que estavam no ZIP. Um ZIP parcial não
  // apaga o acervo das outras.
  for (const d of documentosExistentes) {
    if (!d.obra_id || !obrasVarridas.has(d.obra_id)) continue;
    if (!d.caminho_origem || caminhosVistos.has(d.caminho_origem)) continue;
    if (plano.apagar.some((a) => a.id === d.id)) continue;
    plano.apagar.push({ id: d.id, caminho: d.caminho_origem, motivo: 'removido' });
  }

  plano.obrasNovas = [...obrasNovasSet];
  plano.obrasNaoCasadas = [...naoCasadasSet];
  return plano;
}

/** Relatório em texto, por obra e categoria. Nunca imprime credencial. */
export function relatorio(plano) {
  const linhas = [];
  const porObra = new Map();
  for (const item of [...plano.criar, ...plano.atualizar]) {
    const chave = item.obraNome ?? '(sem obra)';
    const m = porObra.get(chave) ?? new Map();
    m.set(item.categoria, (m.get(item.categoria) ?? 0) + 1);
    porObra.set(chave, m);
  }
  for (const [obra, cats] of [...porObra.entries()].sort()) {
    linhas.push(`  ${obra}`);
    for (const [cat, n] of [...cats.entries()].sort()) linhas.push(`    ${cat.padEnd(18)} ${n}`);
  }
  const motivos = new Map();
  for (const i of plano.ignorar) motivos.set(i.motivo, (motivos.get(i.motivo) ?? 0) + 1);

  linhas.push('');
  linhas.push(
    `  criar: ${plano.criar.length}  atualizar: ${plano.atualizar.length}  apagar: ${plano.apagar.length}  inalterados: ${plano.inalterados}`,
  );
  if (motivos.size) {
    linhas.push(`  ignorados: ${[...motivos.entries()].map(([m, n]) => `${m}=${n}`).join(', ')}`);
  }
  if (plano.obrasNovas.length) linhas.push(`  obras a criar: ${plano.obrasNovas.join(', ')}`);
  if (plano.obrasNaoCasadas.length) {
    linhas.push(
      `  pastas sem obra (use --criar-obras ou cadastre): ${plano.obrasNaoCasadas.join(', ')}`,
    );
  }
  return linhas.join('\n');
}
