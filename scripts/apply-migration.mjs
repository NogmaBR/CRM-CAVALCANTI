#!/usr/bin/env node
/**
 * Aplica UMA migration `.sql` específica contra um projeto Supabase.
 * Usado pra aplicar migrations novas em prod sem re-rodar histórico inteiro.
 *
 * Uso:
 *   node scripts/apply-migration.mjs <migration-basename> [--staging]
 *
 * Env vars necessárias:
 *   Prod  (default):
 *     SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN
 *   Staging (--staging):
 *     STAGING_SUPABASE_PROJECT_REF, STAGING_SUPABASE_ACCESS_TOKEN
 *
 * Exemplo:
 *   node scripts/apply-migration.mjs 20260908100000_pagamentos_criado_via_msg_unique.sql
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '..', 'supabase', 'migrations');

const args = process.argv.slice(2);
const useStaging = args.includes('--staging');
const target = args.find((a) => !a.startsWith('--'));

if (!target) {
  console.error('ERRO: passe o nome da migration como argumento.');
  console.error('');
  console.error('Migrations disponíveis:');
  for (const f of readdirSync(MIGRATIONS_DIR).sort()) {
    if (f.endsWith('.sql')) console.error(`  - ${f}`);
  }
  process.exit(1);
}

const path = existsSync(target)
  ? target
  : existsSync(join(MIGRATIONS_DIR, target))
    ? join(MIGRATIONS_DIR, target)
    : null;

if (!path) {
  console.error(`ERRO: migration não encontrada: ${target}`);
  process.exit(1);
}

const ref = useStaging
  ? process.env.STAGING_SUPABASE_PROJECT_REF
  : process.env.SUPABASE_PROJECT_REF;
const token = useStaging
  ? process.env.STAGING_SUPABASE_ACCESS_TOKEN
  : process.env.SUPABASE_ACCESS_TOKEN;

if (!ref || !token) {
  const suffix = useStaging ? 'STAGING_' : '';
  console.error(`ERRO: ${suffix}SUPABASE_PROJECT_REF ou ${suffix}SUPABASE_ACCESS_TOKEN ausente.`);
  process.exit(1);
}

const sql = readFileSync(path, 'utf8');
const env = useStaging ? 'STAGING' : 'PROD';

console.log(`Aplicando ${target} em ${env} (ref=${ref})...`);

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
  console.error(`✗ HTTP ${res.status}`);
  console.error(err.slice(0, 500));
  process.exit(2);
}

const body = await res.json();
console.log(`✓ Aplicado.`);
if (Array.isArray(body) && body.length) {
  console.log(`  Retorno: ${JSON.stringify(body).slice(0, 200)}`);
}
