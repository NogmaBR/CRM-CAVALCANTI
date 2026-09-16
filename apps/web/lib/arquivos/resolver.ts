/**
 * De onde vem o arquivo que a tela quer mostrar.
 *
 * Três tabelas guardam caminho no Storage: `documentos` (o acervo), `mensagens_whats`
 * (mídia que chegou pelo WhatsApp e ainda não virou documento — a foto da nota
 * enquanto a pendência está aberta) e `registros_obra` (o áudio do diário). A rota
 * `/api/arquivos/<origem>/<id>` fala com as três pela mesma porta; este módulo é a
 * parte pura: dado a origem e a linha (já lida com a sessão do usuário, logo já
 * filtrada pela RLS), diz qual objeto abrir e com que nome.
 */

export const ORIGENS = ['documento', 'mensagem', 'registro'] as const;
export type OrigemArquivo = (typeof ORIGENS)[number];

export function ehOrigem(valor: string): valor is OrigemArquivo {
  return (ORIGENS as readonly string[]).includes(valor);
}

export interface ArquivoResolvido {
  /** Caminho no bucket `documents`. */
  path: string;
  /** MIME sem parâmetros (`image/jpeg`), ou `application/octet-stream`. */
  mime: string;
  /** Nome sugerido para download. */
  nome: string;
}

interface LinhaDocumento {
  storage_path: string | null;
  mime_type: string | null;
  nome_arquivo: string | null;
}
interface LinhaComMidia {
  midia_storage_path: string | null;
  midia_mime: string | null;
}

/** Só as colunas que a rota precisa selecionar, por origem. */
export const COLUNAS: Record<OrigemArquivo, string> = {
  documento: 'id, storage_path, mime_type, nome_arquivo',
  mensagem: 'id, midia_storage_path, midia_mime',
  registro: 'id, midia_storage_path, midia_mime',
};

export function limparMime(mime: string | null | undefined): string {
  const base = String(mime ?? '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  return base || 'application/octet-stream';
}

function nomeDoCaminho(path: string, mime: string): string {
  const ultimo = path.split('/').pop();
  if (ultimo) return ultimo;
  const ext = mime.split('/')[1]?.replace(/[^\w]/gu, '') || 'bin';
  return `arquivo.${ext}`;
}

/**
 * `null` quando não há arquivo para mostrar: linha inexistente (ou invisível
 * pela RLS — para a rota é a mesma coisa), caminho vazio, ou upload que ficou
 * em `pending` e nunca terminou.
 */
export function resolverArquivo(origem: OrigemArquivo, linha: unknown): ArquivoResolvido | null {
  if (!linha || typeof linha !== 'object') return null;

  if (origem === 'documento') {
    const d = linha as LinhaDocumento;
    if (!d.storage_path || d.storage_path === 'pending') return null;
    const mime = limparMime(d.mime_type);
    return { path: d.storage_path, mime, nome: d.nome_arquivo?.trim() || nomeDoCaminho(d.storage_path, mime) };
  }

  const m = linha as LinhaComMidia;
  if (!m.midia_storage_path) return null;
  const mime = limparMime(m.midia_mime);
  return { path: m.midia_storage_path, mime, nome: nomeDoCaminho(m.midia_storage_path, mime) };
}

/** Onde a miniatura de um arquivo fica guardada no bucket. */
export function caminhoDaMiniatura(origem: OrigemArquivo, id: string): string {
  return `miniaturas/${origem}/${id}.jpg`;
}
