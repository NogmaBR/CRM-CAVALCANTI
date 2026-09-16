/**
 * Nome legível para o arquivo que chegou pelo WhatsApp.
 *
 * O provider manda foto e áudio sem nome; guardar `midia.jpeg` deixa a pasta
 * Fotos da obra com dezenas de arquivos iguais (aconteceu nos testes de
 * 16/09). O nome passa a dizer quando, o que e quem:
 * `2026-09-16_14h32_foto_tarsis-barreto.jpeg`. Documento com nome declarado
 * (`Orcamento eletrica.pdf`) mantém o nome, só sanitizado.
 *
 * Puro: a hora entra por parâmetro (`quando`) para o teste ser determinístico.
 */

const PALAVRA_POR_TIPO: Record<string, string> = {
  image: 'foto',
  sticker: 'figurinha',
  video: 'video',
  audio: 'audio',
  document: 'documento',
};

const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'video/quicktime': 'mov',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'application/zip': 'zip',
};

export function sanitizarNomeDeArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w.\-]+/gu, '_')
    .replace(/_+/gu, '_')
    .replace(/^[._]+|_+$/gu, '') // `../x` não vira caminho
    .slice(0, 200);
}

export function slugDeNome(nome: string | null | undefined): string {
  const s = String(nome ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 40);
  return s || 'equipe';
}

export function extensaoDoMime(mime: string | null | undefined): string {
  const base = String(mime ?? '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  if (!base) return 'bin';
  const conhecida = EXTENSAO_POR_MIME[base];
  if (conhecida) return conhecida;
  const sub = base.split('/')[1]?.replace(/^x-/u, '').replace(/[^\w]/gu, '');
  return sub || 'bin';
}

/** `2026-09-16T17:32:10Z` em Brasília → `2026-09-16_14h32`. */
function carimbo(quando: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(quando);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}_${get('hour')}h${get('minute')}`;
}

export function nomeArquivoDaMidia(args: {
  /** Tipo do provider (`image`, `document`, `audio`, `video`, `sticker`). */
  tipo: string;
  mime: string | null | undefined;
  /** Nome que veio no payload (documentos costumam ter). */
  nomeDeclarado?: string | null;
  /** Quem mandou (nome do autorizado). */
  remetente?: string | null;
  quando: Date;
}): string {
  const declarado = args.nomeDeclarado?.trim();
  if (declarado) {
    const limpo = sanitizarNomeDeArquivo(declarado);
    if (limpo && limpo !== '.') return limpo;
  }
  const palavra = PALAVRA_POR_TIPO[args.tipo] ?? 'arquivo';
  return `${carimbo(args.quando)}_${palavra}_${slugDeNome(args.remetente)}.${extensaoDoMime(args.mime)}`;
}
