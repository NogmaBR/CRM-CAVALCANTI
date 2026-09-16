import 'server-only';
import { logger } from '@/lib/log';

const log = logger('arquivos.miniatura');

/** Lado maior da miniatura. Cabe em grade de 3–6 colunas e em retina de cartão. */
export const LARGURA_MINIATURA = 480;

/**
 * Miniatura JPEG de uma imagem, para grades e listas. Os renders do cliente
 * têm 5–7 MB; sem isso a lista de fotos de uma obra baixaria dezenas de MB.
 *
 * Só imagem. PDF e vídeo não têm miniatura aqui (exigiriam renderizar página
 * ou quadro) — a tela mostra ícone. `null` quando o `sharp` não entende os
 * bytes (arquivo corrompido, formato exótico): quem chama mostra o original.
 *
 * `sharp` entra por import dinâmico: é módulo nativo e só a rota de arquivo
 * precisa dele.
 */
export async function gerarMiniatura(bytes: Uint8Array, mime: string): Promise<Buffer | null> {
  if (!mime.startsWith('image/')) return null;
  try {
    const { default: sharp } = await import('sharp');
    return await sharp(bytes, { failOn: 'none' })
      .rotate() // respeita a orientação EXIF da foto de celular
      .resize({ width: LARGURA_MINIATURA, height: LARGURA_MINIATURA, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    log.aviso('miniatura_falhou', { mime, err });
    return null;
  }
}
