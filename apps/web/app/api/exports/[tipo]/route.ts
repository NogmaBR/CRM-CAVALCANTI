import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { ReactElement } from 'react';
import { z } from 'zod';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import {
  getObraCompletaData,
  getMesData,
  getFornecedorData,
  getAtividadeData,
} from '@/lib/data/reports';
import {
  obraCompletaToCsv,
  mesToCsv,
  fornecedorToCsv,
  atividadeToCsv,
} from '@/lib/reports/csv';
import { renderObraCompletaPdf } from '@/lib/reports/pdf/obra-completa';
import { renderMesPdf } from '@/lib/reports/pdf/mes';
import { renderFornecedorPdf } from '@/lib/reports/pdf/fornecedor';
import { renderAtividadePdf } from '@/lib/reports/pdf/atividade';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Slugify: lowercase, strip diacritics, replace non-alphanum with hyphen
// ---------------------------------------------------------------------------
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// ---------------------------------------------------------------------------
// YYYYMMDD stamp for filenames
// ---------------------------------------------------------------------------
function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// ---------------------------------------------------------------------------
// Wrap renderToBuffer: the render* helpers return ReactElement<unknown>
// (inferred generic from JSX). renderToBuffer requires ReactElement<DocumentProps>.
// The root element is always <Document> from @react-pdf/renderer, so the cast
// is safe — we just bridge the missing generic annotation.
//
// BodyInit accepts BufferSource = ArrayBufferView<ArrayBuffer> | ArrayBuffer.
// renderToBuffer returns Buffer (extends Uint8Array<ArrayBufferLike>).
// Uint8Array<ArrayBufferLike> ≠ ArrayBufferView<ArrayBuffer> under strict DOM
// types, so we copy into a plain ArrayBuffer to satisfy NextResponse's BodyInit.
// ---------------------------------------------------------------------------
async function pdfToArrayBuffer(element: ReactElement): Promise<ArrayBuffer> {
  const nodeBuf = await renderToBuffer(element as ReactElement<DocumentProps>);
  // Copy into a standalone ArrayBuffer (Buffer.buffer may be a shared pool slice)
  const ab = new ArrayBuffer(nodeBuf.byteLength);
  new Uint8Array(ab).set(nodeBuf);
  return ab;
}

// csvToArrayBuffer: TextEncoder returns Uint8Array<ArrayBuffer> — we still
// copy to avoid the shared-buffer issue and to have a clean ArrayBuffer.
function csvToArrayBuffer(csvStr: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(csvStr);
  const ab = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(ab).set(encoded);
  return ab;
}

// ---------------------------------------------------------------------------
// Build Content-Disposition header value (RFC 5987 extended param)
// ---------------------------------------------------------------------------
function contentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`;
}

// ---------------------------------------------------------------------------
// Zod schemas for each tipo's query params
// ---------------------------------------------------------------------------
const uuidSchema = z.string().uuid({ message: 'deve ser um UUID válido' });
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'deve estar no formato YYYY-MM-DD' });

const schemas = {
  'obra-completa': z.object({
    obra_id: uuidSchema,
  }),
  mes: z.object({
    ano: z.coerce.number().int().min(2000).max(2100),
    mes: z.coerce.number().int().min(1).max(12),
  }),
  fornecedor: z.object({
    fornecedor_id: uuidSchema,
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  }),
  atividade: z.object({
    from: dateSchema,
    to: dateSchema,
  }),
} as const;

type TipoKey = keyof typeof schemas;
const TIPOS = Object.keys(schemas) as TipoKey[];

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ tipo: string }> },
) {
  // -- Auth ------------------------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  }

  // -- Validate tipo ---------------------------------------------------------
  const { tipo } = await ctx.params;

  if (!TIPOS.includes(tipo as TipoKey)) {
    return NextResponse.json(
      {
        error: `tipo inválido: "${tipo}". Valores aceitos: ${TIPOS.join(', ')}`,
      },
      { status: 400 },
    );
  }
  const tipoKey = tipo as TipoKey;

  // -- Validate format -------------------------------------------------------
  const searchParams = request.nextUrl.searchParams;
  const formatRaw = searchParams.get('format') ?? 'pdf';

  if (formatRaw !== 'pdf' && formatRaw !== 'csv') {
    return NextResponse.json(
      { error: `format inválido: "${formatRaw}". Valores aceitos: pdf, csv` },
      { status: 400 },
    );
  }
  const format = formatRaw as 'pdf' | 'csv';

  // -- Parse + validate query params per tipo --------------------------------
  const rawParams = Object.fromEntries(searchParams.entries());
  const parseResult = schemas[tipoKey].safeParse(rawParams);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'parâmetros inválidos',
        detail: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------------------------
  // Fetch data + generate output per tipo
  // ---------------------------------------------------------------------------

  if (tipoKey === 'obra-completa') {
    const { obra_id } = parseResult.data as z.infer<typeof schemas['obra-completa']>;
    const data = await getObraCompletaData(obra_id);

    if (!data) {
      return NextResponse.json({ error: 'obra não encontrada' }, { status: 404 });
    }

    const filename = `obra-${slugify(data.obra.nome)}-${dateStamp()}.${format}`;

    if (format === 'csv') {
      const csvStr = obraCompletaToCsv(data);
      const buffer = csvToArrayBuffer(csvStr);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': contentDisposition(filename),
        },
      });
    }

    // PDF
    const element = renderObraCompletaPdf(data);
    const buffer = await pdfToArrayBuffer(element);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(filename),
      },
    });
  }

  if (tipoKey === 'mes') {
    const { ano, mes } = parseResult.data as z.infer<typeof schemas['mes']>;
    const data = await getMesData(ano, mes);

    const mesPad = String(mes).padStart(2, '0');
    const filename = `fechamento-${ano}-${mesPad}.${format}`;

    if (format === 'csv') {
      const csvStr = mesToCsv(data);
      const buffer = csvToArrayBuffer(csvStr);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': contentDisposition(filename),
        },
      });
    }

    // PDF
    const element = renderMesPdf(data);
    const buffer = await pdfToArrayBuffer(element);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(filename),
      },
    });
  }

  if (tipoKey === 'fornecedor') {
    const { fornecedor_id, from, to } = parseResult.data as z.infer<
      typeof schemas['fornecedor']
    >;
    const data = await getFornecedorData(fornecedor_id, from ?? null, to ?? null);

    if (!data) {
      return NextResponse.json(
        { error: 'fornecedor não encontrado' },
        { status: 404 },
      );
    }

    const filename = `fornecedor-${slugify(data.fornecedor.nome)}-${dateStamp()}.${format}`;

    if (format === 'csv') {
      const csvStr = fornecedorToCsv(data);
      const buffer = csvToArrayBuffer(csvStr);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': contentDisposition(filename),
        },
      });
    }

    // PDF
    const element = renderFornecedorPdf(data);
    const buffer = await pdfToArrayBuffer(element);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(filename),
      },
    });
  }

  // tipoKey === 'atividade'
  {
    const { from, to } = parseResult.data as z.infer<typeof schemas['atividade']>;
    const data = await getAtividadeData(from, to);

    const filename = `atividade-${from}-a-${to}.${format}`;

    if (format === 'csv') {
      const csvStr = atividadeToCsv(data);
      const buffer = csvToArrayBuffer(csvStr);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': contentDisposition(filename),
        },
      });
    }

    // PDF
    const element = renderAtividadePdf(data);
    const buffer = await pdfToArrayBuffer(element);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(filename),
      },
    });
  }
}
