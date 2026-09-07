import 'server-only';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Database } from '@nogma/db';

/**
 * Merge de 2 fornecedores em 1:
 *   1. UPDATE pagamentos SET fornecedor_id = keep_id WHERE fornecedor_id = drop_id
 *   2. UPDATE documentos SET fornecedor_id = keep_id WHERE fornecedor_id = drop_id
 *   3. Move apelidos de drop → keep (com ON CONFLICT skip)
 *   4. INSERT apelido do drop.nome como novo apelido de keep
 *   5. Soft-delete drop (deleted_at = now())
 *
 * NÃO cascateia hard-delete — drop fica no banco pra histórico.
 * Reversível: unarchive drop + rerun migrations manual.
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

  // Fetch drop pra pegar nome (usar como novo apelido)
  const { data: drop, error: dropErr } = await supabase
    .from('fornecedores')
    .select('id, nome')
    .eq('id', args.dropId)
    .maybeSingle();
  if (dropErr || !drop) {
    return {
      ok: false,
      pagamentos_movidos: 0,
      documentos_movidos: 0,
      apelidos_movidos: 0,
      drop_nome: '',
      error: dropErr?.message ?? 'Fornecedor drop não encontrado',
    };
  }

  // 1) Move pagamentos
  const { data: pagsMoved } = await supabase
    .from('pagamentos')
    .update({ fornecedor_id: args.keepId })
    .eq('fornecedor_id', args.dropId)
    .select('id');

  // 2) Move documentos
  const { data: docsMoved } = await supabase
    .from('documentos')
    .update({ fornecedor_id: args.keepId })
    .eq('fornecedor_id', args.dropId)
    .select('id');

  // 3) Move apelidos existentes (FK CASCADE do drop será deletado quando
  //    hard-delete; usamos soft-delete então precisa mover explicit)
  const { data: apelidos } = await supabase
    .from('fornecedor_apelidos')
    .select('id, apelido')
    .eq('fornecedor_id', args.dropId);

  let apelidosMoved = 0;
  for (const ap of apelidos ?? []) {
    // Reassign pro keep (ON CONFLICT do lower(apelido) — check manual)
    const { data: existing } = await supabase
      .from('fornecedor_apelidos')
      .select('id')
      .eq('fornecedor_id', args.keepId)
      .ilike('apelido', ap.apelido)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase
        .from('fornecedor_apelidos')
        .update({ fornecedor_id: args.keepId })
        .eq('id', ap.id);
      if (!error) apelidosMoved += 1;
    } else {
      // Duplicata — deleta apelido órfão pra não vazar
      await supabase.from('fornecedor_apelidos').delete().eq('id', ap.id);
    }
  }

  // 4) INSERT drop.nome como novo apelido (se ainda não existir em keep)
  const { data: exists } = await supabase
    .from('fornecedor_apelidos')
    .select('id')
    .eq('fornecedor_id', args.keepId)
    .ilike('apelido', drop.nome)
    .maybeSingle();
  if (!exists) {
    await supabase.from('fornecedor_apelidos').insert({
      fornecedor_id: args.keepId,
      apelido: drop.nome,
      criado_por_ia: false,
    });
  }

  // 5) Soft-delete drop
  await supabase.from('fornecedores').update({ deleted_at: new Date().toISOString() }).eq('id', args.dropId);

  return {
    ok: true,
    pagamentos_movidos: pagsMoved?.length ?? 0,
    documentos_movidos: docsMoved?.length ?? 0,
    apelidos_movidos: apelidosMoved,
    drop_nome: drop.nome,
  };
}
