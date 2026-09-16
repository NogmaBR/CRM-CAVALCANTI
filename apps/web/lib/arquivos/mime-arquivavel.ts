/**
 * O que pode virar `documentos` a partir do WhatsApp.
 *
 * O cliente pediu que TUDO que a equipe mandar fique guardado (o importador do
 * OneDrive já aceita qualquer arquivo). A lista antiga era fechada — jpeg, png,
 * webp, pdf — e vídeo de canteiro, planilha ou Word passavam pelo download,
 * ficavam no Storage e nunca apareciam no acervo. Agora a regra é inversa:
 * entra tudo, menos o que é código executável (não há razão para um .exe no
 * grupo da obra, e ele nunca deve chegar a um clique de "Baixar").
 */
const BLOQUEADOS = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-dosexec',
  'application/x-executable',
  'application/x-sh',
  'application/x-shellscript',
  'application/x-bat',
  'application/x-msi',
  'application/vnd.microsoft.portable-executable',
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'text/html',
  'application/xhtml+xml',
  'application/java-archive',
  'application/vnd.android.package-archive',
]);

export function mimeArquivavel(mime: string | null | undefined): boolean {
  const m = String(mime ?? '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  if (!m || !m.includes('/')) return false;
  return !BLOQUEADOS.has(m);
}
