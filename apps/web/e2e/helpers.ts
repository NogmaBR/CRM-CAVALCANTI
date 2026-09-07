import { createClient } from '@supabase/supabase-js';
import type { Database } from '@nogma/db';

/**
 * Helpers para os testes E2E.
 *
 * O projeto usa um único banco Supabase (dev = prod), então TODA carga
 * criada nos testes precisa:
 *   1. Ter prefixo `e2e_test_` no nome (facilita identificação)
 *   2. Ter suffix único (`Date.now() + random`) pra evitar colisão
 *   3. Ser removida em `test.afterEach` ou `test.afterAll`
 *
 * Script de emergência `pnpm e2e:cleanup` (definido em package.json
 * root) faz DELETE ... WHERE nome LIKE 'e2e_test_%' pra recuperar
 * de falhas.
 */

export const E2E_PREFIX = 'e2e_test_';

/** Suffix único pra combinar unicidade + rastreabilidade. */
export function uniqueId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Nome de teste padronizado — sempre começa com E2E_PREFIX. */
export function testName(base: string): string {
  return `${E2E_PREFIX}${base}_${uniqueId()}`;
}

/**
 * Cliente Supabase com SERVICE ROLE — bypassa RLS. Usado nos testes
 * pra cleanup (delete row garantido mesmo se user do teste não tem
 * permissão de delete via RLS).
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausente — cleanup impossível. Configure em .env.local.',
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Hard-delete de rows pelo prefixo e2e_test_ na tabela indicada.
 * Passa a coluna `columnName` (default 'nome') pra tabelas que não
 * usam nome. Retorna count de rows removidas.
 */
export async function cleanupByPrefix(
  table: 'obras' | 'fornecedores' | 'categorias' | 'autorizados',
  columnName = 'nome',
): Promise<number> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from(table)
    .delete()
    .like(columnName, `${E2E_PREFIX}%`)
    .select('id');
  if (error) {
    console.error(`Cleanup ${table} falhou:`, error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Cleanup específico: pagamentos linkados a obras e2e_test_.
 * Precisa duas passadas (pagamentos referencia obras via FK).
 */
export async function cleanupPagamentosDeObrasE2E(): Promise<number> {
  const supabase = adminClient();
  const { data: obras } = await supabase
    .from('obras')
    .select('id')
    .like('nome', `${E2E_PREFIX}%`);
  if (!obras || obras.length === 0) return 0;

  const obraIds = obras.map((o) => o.id);
  const { data, error } = await supabase
    .from('pagamentos')
    .delete()
    .in('obra_id', obraIds)
    .select('id');
  if (error) {
    console.error(`Cleanup pagamentos falhou:`, error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Cleanup de documentos vinculados a obras/pagamentos e2e_test_.
 * Storage cleanup deferido — orphans limpos pelo cron sweeper Fase 7.5.
 */
export async function cleanupDocumentosDeObrasE2E(): Promise<number> {
  const supabase = adminClient();
  const { data: obras } = await supabase
    .from('obras')
    .select('id')
    .like('nome', `${E2E_PREFIX}%`);
  if (!obras || obras.length === 0) return 0;

  const obraIds = obras.map((o) => o.id);
  const { data, error } = await supabase
    .from('documentos')
    .delete()
    .in('obra_id', obraIds)
    .select('id');
  if (error) {
    console.error(`Cleanup documentos falhou:`, error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Cleanup total de teste — ordem correta pra respeitar FKs:
 * documentos → pagamentos → obras/fornecedores/categorias/autorizados
 *
 * Chame em `test.afterAll` ou `pnpm e2e:cleanup`.
 */
export async function cleanupAllE2E(): Promise<{
  documentos: number;
  pagamentos: number;
  obras: number;
  fornecedores: number;
  categorias: number;
  autorizados: number;
}> {
  const documentos = await cleanupDocumentosDeObrasE2E();
  const pagamentos = await cleanupPagamentosDeObrasE2E();
  const obras = await cleanupByPrefix('obras');
  const fornecedores = await cleanupByPrefix('fornecedores');
  const categorias = await cleanupByPrefix('categorias');
  const autorizados = await cleanupByPrefix('autorizados');
  return { documentos, pagamentos, obras, fornecedores, categorias, autorizados };
}
