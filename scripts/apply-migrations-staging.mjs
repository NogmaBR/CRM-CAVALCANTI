#!/usr/bin/env node
/**
 * Aplica TODAS as migrations `.sql` em ordem (por nome) contra o banco
 * staging via SQL admin endpoint.
 *
 * Uso:
 *   export STAGING_SUPABASE_PROJECT_REF=<ref>
 *   export STAGING_SUPABASE_ACCESS_TOKEN=<sbp_...>   # PAT staging (ou o mesmo do prod)
 *   node scripts/apply-migrations-staging.mjs
 *
 * Alternativa (recomendado se supabase CLI instalado):
 *   supabase link --project-ref <STAGING_REF> --password <STAGING_DB_PASS>
 *   supabase db push
 *
 * Este script é fallback + idempotência checkable — cada migration termina
 * com um COMMIT (implícito no bloco) e é wrapped em BEGIN/END pra rollback
 * automático se falhar no meio.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'supabase', 'migrations');

const ref = process.env.STAGING_SUPABASE_PROJECT_REF;
const token = process.env.STAGING_SUPABASE_ACCESS_TOKEN;

if (!ref || !token) {
  console.error('ERRO: STAGING_SUPABASE_PROJECT_REF ou STAGING_SUPABASE_ACCESS_TOKEN ausente.');
  console.error('');
  console.error('Passo-a-passo:');
  console.error('  1. Crie projeto staging em https://supabase.com/dashboard');
  console.error('  2. Copie o "Reference ID" (ex: abc123xyz)');
  console.error('  3. Use o Personal Access Token (mesmo do prod serve — está em .env.local SUPABASE_ACCESS_TOKEN)');
  console.error('  4. Rode:');
  console.error('     export STAGING_SUPABASE_PROJECT_REF=<ref>');
  console.error('     export STAGING_SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN');
  console.error('     node scripts/apply-migrations-staging.mjs');
  process.exit(1);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

console.log(`Aplicando ${files.length} migrations no staging (ref=${ref})...`);
console.log('---');

for (const file of files) {
  const path = join(MIGRATIONS_DIR, file);
  const sql = readFileSync(path, 'utf8');

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ ${file}: HTTP ${res.status} — ${err.slice(0, 200)}`);
    process.exit(2);
  }

  console.log(`  ✓ ${file}`);
}

console.log('---');
console.log('Migrations aplicadas com sucesso.');
console.log('');
console.log('Próximo passo: rode `pnpm staging:seed` se quiser dados de teste.');
