#!/usr/bin/env node
/**
 * Emergency cleanup script — remove tudo com prefixo `e2e_test_` do banco.
 *
 * Uso: `pnpm e2e:cleanup` (script no package.json root).
 * Requer SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL em env
 * (carregados via .env.local automaticamente pelo dotenv).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega .env.local do root manualmente (script node standalone)
function loadEnv(filepath) {
  try {
    const content = readFileSync(filepath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // env file não existe — segue
  }
}

loadEnv(resolve(__dirname, '..', '.env.local'));
loadEnv(resolve(__dirname, '..', 'apps', 'web', '.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente em .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PREFIX = 'e2e_test_';

console.log(`Cleanup e2e_test_% no banco ${url}`);
console.log('---');

// Ordem correta: documentos → pagamentos → obras/fornecedores/etc
async function del(table, columnName = 'nome') {
  const { data, error } = await supabase.from(table).delete().like(columnName, `${PREFIX}%`).select('id');
  const count = data?.length ?? 0;
  if (error) {
    console.error(`  ✗ ${table}: ${error.message}`);
    return 0;
  }
  console.log(`  ${count > 0 ? '✓' : '·'} ${table}: ${count} row(s)`);
  return count;
}

// Documentos vinculados a obras e2e
const { data: obrasE2e } = await supabase.from('obras').select('id').like('nome', `${PREFIX}%`);
const obraIds = (obrasE2e ?? []).map((o) => o.id);
let docsCount = 0;
let pagsCount = 0;
if (obraIds.length > 0) {
  const docs = await supabase.from('documentos').delete().in('obra_id', obraIds).select('id');
  docsCount = docs.data?.length ?? 0;
  console.log(`  ${docsCount > 0 ? '✓' : '·'} documentos (linkados a obras e2e): ${docsCount} row(s)`);

  const pags = await supabase.from('pagamentos').delete().in('obra_id', obraIds).select('id');
  pagsCount = pags.data?.length ?? 0;
  console.log(`  ${pagsCount > 0 ? '✓' : '·'} pagamentos (linkados a obras e2e): ${pagsCount} row(s)`);
}

const obrasCount = await del('obras');
const forCount = await del('fornecedores');
const catCount = await del('categorias');
const autCount = await del('autorizados');

const total = docsCount + pagsCount + obrasCount + forCount + catCount + autCount;
console.log('---');
console.log(`Total: ${total} row(s) removidas.`);
process.exit(0);
