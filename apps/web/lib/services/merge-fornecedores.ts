import 'server-only';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';

/**
 * Merge de 2 fornecedores em 1 — TRANSACIONAL.
 *
 * Audit BUG-01 fix: antes as 5 operações (UPDATE pagamentos, UPDATE
 * documentos, mover apelidos, INSERT apelido, soft-delete) rodavam em
 * sequência via supabase-js. Se qualquer uma falhasse no meio, dados
 * ficavam parcialmente movidos. Agora tudo roda em uma transação
 * plpgsql única via RPC `merge_fornecedores_atomic` — falhas causam
 * rollback automático.
 *
 * Chamado de server action que já validou (admin/gestor + confirmação UI).
 */

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE env ausente');
  return createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface MergeResult {
  ok: boolean;
  pagamentos_movidos: number;
  documentos_movidos: number;
  apelidos_movidos: number;
  drop_nome: string;
  error?: string;
}

export async function mergeFornecedores(args: {
  keepId: string;
  dropId: string;
}): Promise<MergeResult> {
  if (args.keepId === args.dropId) {
    return {
      ok: false,
      pagamentos_movidos: 0,
      documentos_movidos: 0,
      apelidos_movidos: 0,
      drop_nome: '',
      error: 'keepId igual a dropId',
    };
  }

  const supabase = serviceRoleClient();

  const { data, error } = await supabase.rpc('merge_fornecedores_atomic', {
    p_keep_id: args.keepId,
    p_drop_id: args.dropId,
  });

  if (error) {
    return {
      ok: false,
      pagamentos_movidos: 0,
      documentos_movidos: 0,
      apelidos_movidos: 0,
      drop_nome: '',
      error: error.message,
    };
  }

  const row = data?.[0];
  if (!row) {
    return {
      ok: false,
      pagamentos_movidos: 0,
      documentos_movidos: 0,
      apelidos_movidos: 0,
      drop_nome: '',
      error: 'RPC não retornou linha esperada',
    };
  }

  return {
    ok: true,
    pagamentos_movidos: row.pagamentos_movidos ?? 0,
    documentos_movidos: row.documentos_movidos ?? 0,
    apelidos_movidos: row.apelidos_movidos ?? 0,
    drop_nome: row.drop_nome ?? '',
  };
}
