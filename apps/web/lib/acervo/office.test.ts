import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { lerDocx, lerPlanilha } from './office';

/**
 * Bytes de verdade, gerados aqui mesmo: uma pasta com duas abas (uma vazia)
 * e um docx mínimo montado à mão. O que se testa é o formato do texto que
 * vai para o RAG — abas como cabeçalho, células com ` | `, vazios fora.
 */

function planilha(): Uint8Array {
  const pasta = utils.book_new();
  utils.book_append_sheet(
    pasta,
    utils.aoa_to_sheet([
      ['Item', 'Fornecedor', 'Valor'],
      ['Cimento', 'Cassol', 1234.5],
      [],
      ['Areia', '', 200],
    ]),
    'Controle',
  );
  utils.book_append_sheet(pasta, utils.aoa_to_sheet([[]]), 'Vazia');
  return new Uint8Array(write(pasta, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

async function docx(paragrafos: string[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  const corpo = paragrafos.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('');
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'uint8array' });
}

describe('lerPlanilha', () => {
  it('uma linha por linha, células com " | ", aba como cabeçalho, vazios fora', async () => {
    const texto = await lerPlanilha(planilha());
    expect(texto).toContain('## Controle');
    expect(texto).toContain('Item | Fornecedor | Valor');
    expect(texto).toContain('Cimento | Cassol | 1234.5');
    expect(texto).toContain('Areia | 200');
    expect(texto).not.toContain('## Vazia');
    expect(texto.split('\n').filter((l) => l.trim() === '')).toHaveLength(0);
  });

  it('bytes que não são planilha lançam (o chamador trata)', async () => {
    await expect(lerPlanilha(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
});

describe('lerDocx', () => {
  it('devolve o texto dos parágrafos', async () => {
    const texto = await lerDocx(await docx(['Proposta de administração', 'Valor: R$ 10.000,00']));
    expect(texto).toBe('Proposta de administração\n\nValor: R$ 10.000,00');
  });
});
