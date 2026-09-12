import 'server-only';
import { createHash } from 'node:crypto';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';

const BUCKET = 'documents';

/** SHA-256 hex digest de um ArrayBuffer. Usado pra dedup de conteúdo idêntico. */
export function sha256Hex(buffer: ArrayBuffer): string {
  return createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

/** Client Supabase com SERVICE ROLE (bypass RLS) — só server-side. Uso pra Storage ops. */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausente');
  return createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Path convention: {obra_id}/{documento_id}/{safeFilename} */
export function makeStoragePath(obraId: string, documentoId: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-]/gu, '_').slice(0, 200);
  return `${obraId}/${documentoId}/${safe}`;
}

/** Upload File pra Storage. Retorna path final. Throw em erro. */
export async function uploadDocumentFile(path: string, file: File): Promise<void> {
  const buffer = await file.arrayBuffer();
  await uploadDocumentBuffer(path, buffer, file.type);
}

/** Upload de buffer já materializado (usado quando o buffer também alimenta hash SHA-256). */
export async function uploadDocumentBuffer(
  path: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const supabase = serviceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Falha no upload: ${error.message}`);
}

/**
 * Baixa um objeto do bucket como bytes. Usado pelo classificador real para
 * enxergar a foto/PDF que o WhatsApp mandou. `null` quando o objeto não
 * existe ou o Storage falha — quem chama decide se segue só com o texto.
 */
export async function downloadDocumentBytes(path: string): Promise<Uint8Array | null> {
  const supabase = serviceClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/** Delete objeto do Storage. Usado no rollback se DB insert falhar. */
export async function deleteDocumentFile(path: string): Promise<void> {
  const supabase = serviceClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Falha ao deletar: ${error.message}`);
}

/** Gera signed URL válida por ttlSeconds (default 60s). */
export async function getSignedUrl(path: string, ttlSeconds = 60): Promise<string> {
  const supabase = serviceClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  if (error || !data?.signedUrl)
    throw new Error(`Falha ao gerar URL: ${error?.message ?? 'sem URL'}`);
  return data.signedUrl;
}
