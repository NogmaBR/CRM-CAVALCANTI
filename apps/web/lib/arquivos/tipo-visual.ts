/**
 * Como um arquivo se mostra na tela, pelo MIME.
 *
 * `imagem` abre inline e tem miniatura; `pdf` vai num `<iframe>`; `video` e
 * `audio` usam o player do navegador; `outro` (planilha, Word, DWG…) é ícone +
 * botão de baixar — não há como pré-visualizar no navegador sem serviço externo.
 */
export type TipoVisual = 'imagem' | 'pdf' | 'video' | 'audio' | 'outro';

/** Só o que o navegador desenha num `<img>`. `image/vnd.dwg`, TIFF e HEIC não. */
const IMAGENS_DO_NAVEGADOR = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
]);

export function tipoVisual(mime: string | null | undefined): TipoVisual {
  const m = String(mime ?? '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  if (!m) return 'outro';
  if (m === 'application/pdf') return 'pdf';
  if (IMAGENS_DO_NAVEGADOR.has(m)) return 'imagem';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'outro';
}

/** Rótulo curto para o ícone/legenda de um arquivo sem pré-visualização. */
export function rotuloDoMime(mime: string | null | undefined): string {
  const m = String(mime ?? '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  if (!m || m === 'application/octet-stream') return 'Arquivo';
  if (m.includes('spreadsheet') || m.includes('excel') || m === 'text/csv') return 'Planilha';
  if (m.includes('wordprocessing') || m === 'application/msword') return 'Word';
  if (m.includes('presentation') || m.includes('powerpoint')) return 'Apresentação';
  if (m.includes('dwg') || m.includes('dxf') || m.includes('acad')) return 'Projeto CAD';
  if (m === 'application/zip' || m.includes('compressed') || m.includes('rar')) return 'Compactado';
  if (m.startsWith('text/')) return 'Texto';
  const tipo = tipoVisual(m);
  if (tipo === 'imagem') return 'Imagem';
  if (tipo === 'pdf') return 'PDF';
  if (tipo === 'video') return 'Vídeo';
  if (tipo === 'audio') return 'Áudio';
  return 'Arquivo';
}

/** URL da rota que entrega o arquivo. `origem` e `id` como em `/api/arquivos/[origem]/[id]`. */
export function urlDoArquivo(
  origem: 'documento' | 'mensagem' | 'registro',
  id: string,
  modo: 'abrir' | 'baixar' | 'miniatura' = 'abrir',
): string {
  const base = `/api/arquivos/${origem}/${id}`;
  if (modo === 'baixar') return `${base}?baixar=1`;
  if (modo === 'miniatura') return `${base}?miniatura=1`;
  return base;
}
