import 'server-only';
import { logger } from '@/lib/log';
import { downloadDocumentBytes } from '@/lib/storage/documents';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MIMES_PLANILHA, MIMES_WORD } from './office';

/**
 * Extração de texto dos arquivos do acervo.
 *
 * Roda no app, não no importador, porque o mesmo código serve o documento
 * que chega pelo grupo do WhatsApp. O texto vai para
 * `documentos.texto_extraido` e dali para o RAG (`lib/rag/indexador.ts`) e
 * para a conciliação com pagamentos (`lib/acervo/conciliar.ts`).
 *
 * Quatro caminhos, do mais barato ao mais caro:
 *   - PDF com camada de texto → `unpdf` (pdfjs), sem custo.
 *   - Planilha (xls/xlsx) e Word (docx) → `lib/acervo/office.ts`, sem custo.
 *   - PDF escaneado ou imagem → visão do modelo (`lib/acervo/visao.ts`), só
 *     com `IA_PROVIDER=openai`. Sem chave, fica sem texto — o mock não finge
 *     que leu.
 *   - Arquivo sem extensão (`application/octet-stream`) é farejado pela
 *     assinatura: se for PDF/JPEG/PNG por dentro, segue o caminho de cima.
 *
 * `texto_extraido_em` é marcado **sempre**, com ou sem texto e até quando o
 * download falha. É o que impede um arquivo corrompido de travar a fila para
 * sempre: a fila é `texto_extraido_em IS NULL`, e re-extrair é zerar a coluna.
 */

type Client = SupabaseClient<Database>;

const log = logger('acervo_extracao');

/**
 * Acima disto não se baixa na função: fica só o cabeçalho no RAG. É o teto do
 * bucket (50 MB no plano atual); a função da Vercel tem memória para isso e o
 * `unpdf` só olha a camada de texto. O que a visão aceita é decidido depois,
 * por `blocoDeMidia` (20 MB de imagem, 32 MB de PDF — limites da OpenAI).
 */
export const LIMITE_EXTRACAO_BYTES = 50 * 1024 * 1024;

/** Texto com menos que isto é "sem camada de texto" (PDF escaneado). */
const MINIMO_CHARS_PDF = 20;

/** Teto do que se guarda: o RAG corta em 12k, a conciliação lê o começo. */
const MAX_CHARS = 60_000;

const MIMES_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_PDF = 'application/pdf';
const MIME_GENERICO = 'application/octet-stream';

/** Assinaturas dos tipos que sabemos ler, para arquivo sem extensão. */
function farejarMime(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  )
    return MIME_PDF; // %PDF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'image/png';
  return null;
}

export function mimeLegivel(mime: string): boolean {
  return (
    mime === MIME_PDF ||
    MIMES_IMAGEM.has(mime) ||
    MIMES_PLANILHA.has(mime) ||
    MIMES_WORD.has(mime) ||
    mime === MIME_GENERICO
  );
}

export interface DepsExtracao {
  lerPdf: (bytes: Uint8Array) => Promise<string>;
  lerPlanilha: (bytes: Uint8Array) => Promise<string>;
  lerDocx: (bytes: Uint8Array) => Promise<string>;
  /** `null` quando não há modelo com visão configurado. */
  lerComVisao: ((bytes: Uint8Array, mime: string) => Promise<string | null>) | null;
  baixar: (storagePath: string) => Promise<Uint8Array | null>;
}

async function lerPdfComUnpdf(bytes: Uint8Array): Promise<string> {
  const { extractText } = await import('unpdf');
  const { text } = await extractText(bytes, { mergePages: true });
  return text;
}

export async function depsPadrao(): Promise<DepsExtracao> {
  const { visaoDisponivel, lerComVisao } = await import('./visao');
  const { lerPlanilha, lerDocx } = await import('./office');
  return {
    lerPdf: lerPdfComUnpdf,
    lerPlanilha,
    lerDocx,
    lerComVisao: visaoDisponivel() ? lerComVisao : null,
    baixar: downloadDocumentBytes,
  };
}

/**
 * Texto de um arquivo, ou `null` quando não há como ler. Exportada para
 * teste: a orquestração é o que importa aqui, não o pdfjs.
 */
export async function extrairTextoDe(
  bytes: Uint8Array,
  mime: string,
  deps: DepsExtracao,
): Promise<string | null> {
  let tipo = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (tipo === MIME_GENERICO) {
    const farejado = farejarMime(bytes);
    if (!farejado) return null;
    tipo = farejado;
  }

  if (MIMES_PLANILHA.has(tipo) || MIMES_WORD.has(tipo)) {
    try {
      const texto = MIMES_PLANILHA.has(tipo)
        ? await deps.lerPlanilha(bytes)
        : await deps.lerDocx(bytes);
      return texto.trim().length > 0 ? texto.trim().slice(0, MAX_CHARS) : null;
    } catch (err) {
      log.aviso('office_nao_lido', { mime: tipo, err });
      return null;
    }
  }

  if (tipo === MIME_PDF) {
    let texto = '';
    try {
      texto = await deps.lerPdf(bytes);
    } catch (err) {
      log.aviso('pdf_nao_lido', { err });
    }
    if (texto.trim().length >= MINIMO_CHARS_PDF) return texto.trim().slice(0, MAX_CHARS);
    // Escaneado: só a visão enxerga.
    return deps.lerComVisao ? await deps.lerComVisao(bytes, tipo) : null;
  }

  if (MIMES_IMAGEM.has(tipo)) {
    return deps.lerComVisao ? await deps.lerComVisao(bytes, tipo) : null;
  }

  return null;
}

export interface ResultadoExtracao {
  processados: number;
  comTexto: number;
  semTexto: number;
  erros: number;
}

/**
 * Processa uma leva de documentos ainda não olhados.
 *
 * `limite` existe porque isto roda numa função com tempo limitado; o cron
 * chama em laço até esvaziar ou estourar o tempo (`/api/cron/acervo`).
 */
export async function extrairTextoPendentes(
  supabase: Client,
  opts: { limite?: number; deps?: DepsExtracao } = {},
): Promise<ResultadoExtracao> {
  const limite = opts.limite ?? 40;
  const deps = opts.deps ?? (await depsPadrao());

  const { data: pendentes, error } = await supabase
    .from('documentos')
    .select('id, mime_type, storage_path, tamanho_bytes')
    .is('deleted_at', null)
    .is('texto_extraido_em', null)
    .order('created_at', { ascending: true })
    .limit(limite);

  if (error) throw new Error(`Falha ao listar documentos pendentes: ${error.message}`);

  const resultado: ResultadoExtracao = { processados: 0, comTexto: 0, semTexto: 0, erros: 0 };

  for (const doc of pendentes ?? []) {
    resultado.processados += 1;
    let texto: string | null = null;
    let erro = false;

    const tamanho = Number(doc.tamanho_bytes ?? 0);
    const legivel = mimeLegivel(doc.mime_type);

    if (legivel && tamanho <= LIMITE_EXTRACAO_BYTES && doc.storage_path !== 'pending') {
      try {
        const bytes = await deps.baixar(doc.storage_path);
        if (!bytes) {
          erro = true;
          log.aviso('documento_nao_baixado', { documento_id: doc.id });
        } else {
          texto = await extrairTextoDe(bytes, doc.mime_type, deps);
        }
      } catch (err) {
        erro = true;
        log.erro('extracao_falhou', { documento_id: doc.id, err });
      }
    }

    const { error: erroUpd } = await supabase
      .from('documentos')
      .update({ texto_extraido: texto, texto_extraido_em: new Date().toISOString() })
      .eq('id', doc.id);
    if (erroUpd) {
      log.erro('documento_nao_marcado', { documento_id: doc.id, erro: erroUpd.message });
      erro = true;
    }

    if (erro) resultado.erros += 1;
    else if (texto) resultado.comTexto += 1;
    else resultado.semTexto += 1;
  }

  return resultado;
}
