import 'server-only';

/**
 * Texto de planilhas (xls/xlsx) e documentos Word (docx) do acervo.
 *
 * O cliente guarda o controle financeiro de cada obra numa planilha e as
 * propostas/orçamentos em Word — é o conteúdo mais útil do Drive para o RAG
 * e para a conciliação, e o `unpdf` não lê nada disso. Duas bibliotecas
 * puras em JS (sem binário, rodam na Vercel): SheetJS (`xlsx`, do CDN
 * oficial — a versão do npm parou em 2022) e `mammoth`.
 *
 * A saída é texto plano, uma linha por linha da planilha, células separadas
 * por ` | `, com o nome da aba como cabeçalho. Células vazias são omitidas;
 * linhas vazias também. Não é CSV: é para gente (e modelo) ler.
 */

export const MIMES_PLANILHA = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
export const MIMES_WORD = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** Teto por planilha: além disto o resto fica de fora (o RAG corta antes). */
const MAX_LINHAS_POR_ABA = 2_000;

/** xlsx é um zip (`PK..`), xls é OLE2 (`D0 CF 11 E0`). Sem isso o SheetJS lê qualquer byte como CSV e devolve lixo. */
function parecePlanilha(b: Uint8Array): boolean {
  const zip = b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  const ole = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  return b.length >= 4 && (zip || ole);
}

export async function lerPlanilha(bytes: Uint8Array): Promise<string> {
  if (!parecePlanilha(bytes)) throw new Error('bytes não são xls nem xlsx');
  const { read, utils } = await import('xlsx');
  const pasta = read(bytes, { type: 'array', cellDates: true, dense: true });
  const partes: string[] = [];
  for (const nome of pasta.SheetNames) {
    const aba = pasta.Sheets[nome];
    if (!aba) continue;
    // `raw: false` devolve o texto formatado da célula (R$ 1.234,56, datas
    // como o usuário vê), que é o que faz sentido guardar como texto.
    const linhas = utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: false, defval: '' });
    const texto = linhas
      .slice(0, MAX_LINHAS_POR_ABA)
      .map((l) =>
        (Array.isArray(l) ? l : [])
          .map((c) => String(c ?? '').trim())
          .filter((c) => c.length > 0)
          .join(' | '),
      )
      .filter((l) => l.length > 0);
    if (texto.length === 0) continue;
    partes.push(`## ${nome}\n${texto.join('\n')}`);
  }
  return partes.join('\n\n');
}

export async function lerDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value.replace(/\n{3,}/g, '\n\n').trim();
}
