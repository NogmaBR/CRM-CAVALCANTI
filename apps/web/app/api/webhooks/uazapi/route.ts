import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Database } from '@nogma/db';
import { verifyHmacSignature } from '@/lib/webhooks/hmac';
import {
  UazapiInboundSchema,
  mapTipoToDb,
  normalizeTelefone,
  toIsoDate,
} from '@/lib/schemas/uazapi';
import { classifyAndPersist } from '@/lib/services/classify-and-persist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Webhook inbound do UAZAPI. Fluxo:
 *  1. Lê raw body pra verificar HMAC-SHA256 (header `x-signature`).
 *  2. Parse via Zod (permissivo com campos extras do provider).
 *  3. Upsert em `mensagens_whats` — `msg_id_uazapi` UNIQUE dá idempotência
 *     (mesma msg reenviada por retry do provider vira update no-op).
 *  4. Chama `classifyAndPersist` (aguarda pra garantir execução no serverless).
 *  5. Retorna 200 pra UAZAPI parar de retryar.
 *
 * Segurança: HMAC-SHA256 hex do body com WEBHOOK_HMAC_SECRET. Sem secret
 * ambiente ou header ausente → 401. Payload inválido → 400.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WEBHOOK_HMAC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook secret missing' }, { status: 500 });
  }

  const raw = await request.text();
  const signature = request.headers.get('x-signature');
  if (!verifyHmacSignature(raw, signature, secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = UazapiInboundSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: 'schema validation failed', detail: first ? `${first.path.join('.')}: ${first.message}` : undefined },
      { status: 400 },
    );
  }

  const p = parsed.data;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'supabase env missing' }, { status: 500 });
  }
  const supabase = createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: row, error: upsertErr } = await supabase
    .from('mensagens_whats')
    .upsert(
      {
        msg_id_uazapi: p.id,
        telefone_from: normalizeTelefone(p.from),
        tipo: mapTipoToDb(p.type),
        texto_bruto: p.text ?? null,
        midia_mime: p.media?.mimetype ?? null,
        midia_storage_path: null, // será preenchido no classifier após download+upload do arquivo
        recebida_em: toIsoDate(p.timestamp),
        status: 'recebida',
        dados_extraidos: null,
        confianca_ia: null,
      },
      { onConflict: 'msg_id_uazapi' },
    )
    .select('id')
    .single();

  if (upsertErr || !row) {
    return NextResponse.json(
      { error: 'db upsert failed', code: upsertErr?.code, msg: upsertErr?.message },
      { status: 500 },
    );
  }

  const classifyResult = await classifyAndPersist(row.id).catch((err) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  return NextResponse.json({ ok: true, mensagem_id: row.id, classify: classifyResult });
}
