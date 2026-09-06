import 'server-only';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Database } from '@nogma/db';

const BUCKET = 'documents';

/** Client Supabase com SERVICE ROLE (bypass RLS) — só server-side. Uso pra Storage ops. */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausente');
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
  const supabase = serviceClient();
  const buffer = await file.arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Falha no upload: ${error.message}`);
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
  if (error || !data?.signedUrl) throw new Error(`Falha ao gerar URL: ${error?.message ?? 'sem URL'}`);
  return data.signedUrl;
}
