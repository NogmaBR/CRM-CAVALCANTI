import type { DocCategoria } from '@/lib/status-labels';
import type { Database } from '@nogma/db';

/**
 * Pasta do cliente → categoria do CRM.
 *
 * A estrutura de pastas do OneDrive é escrita à mão pelo cliente e varia por
 * obra ("NFs/Pagamentos", "NF's", "Notas"…). Este módulo é puro e sem
 * `server-only` de propósito: o importador (`scripts/importar-onedrive.mjs`)
 * carrega a mesma tabela em JS, e o classificador do WhatsApp usa
 * `tipoDoNome` na legenda da foto. Mudou uma grafia aqui, mudou nos dois.
 */

type AnexoTipo = Database['public']['Enums']['anexo_tipo'];

/** Sem acento, minúsculo, só letras/dígitos separados por um espaço. */
export function normalizarNome(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      // Apóstrofo une ("NF's" → "nfs"); qualquer outra pontuação separa.
      .replace(/['\u2019]/gu, '')
      .replace(/[^a-z0-9]+/gu, ' ')
      .trim()
  );
}

/**
 * Ordem importa: "projeto aprovado" tem que ser testado antes de "projeto",
 * e "nota" antes de qualquer coisa que contenha "nf" solto. Cada entrada é
 * uma lista de palavras/frases que, presentes no nome normalizado, decidem.
 */
const REGRAS: Array<[DocCategoria, string[]]> = [
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

function contemPalavra(texto: string, termo: string): boolean {
  const palavras = ` ${texto} `;
  return palavras.includes(` ${termo} `);
}

export function categoriaDaPasta(nome: string): DocCategoria {
  const n = normalizarNome(nome);
  if (!n) return 'outro';
  for (const [categoria, termos] of REGRAS) {
    if (termos.some((t) => contemPalavra(n, t))) return categoria;
  }
  return 'outro';
}

const TIPOS: Array<[AnexoTipo, string[]]> = [
  ['nota_fiscal', ['nf', 'nfe', 'nfs', 'nfse', 'danfe', 'nota', 'notas']],
  [
    'comprovante',
    ['comprovante', 'comprovantes', 'pix', 'ted', 'doc', 'boleto', 'recibo', 'transferencia'],
  ],
  ['contrato', ['contrato', 'contratos', 'aditivo']],
];

/** Heurística pelo nome do arquivo. A conciliação refina depois com o conteúdo. */
export function tipoDoNome(nomeArquivo: string): AnexoTipo {
  const semExtensao = nomeArquivo.replace(/\.[a-z0-9]{2,5}$/iu, '');
  const n = normalizarNome(semExtensao);
  for (const [tipo, termos] of TIPOS) {
    if (termos.some((t) => contemPalavra(n, t))) return tipo;
  }
  return 'outro';
}
