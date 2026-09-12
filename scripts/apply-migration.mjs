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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const ensaio = args.includes('--ensaio');

// Registro em supabase_migrations.schema_migrations: sem isto, o estado
// "aplicada" só vivia no CLAUDE.md, e um `supabase db push` futuro tentaria
// reaplicar tudo. Versão = os 14 dígitos do nome; nome = o resto.
const base = target
  .split(/[\\/]/)
  .pop()
  .replace(/\.sql$/, '');
const m = base.match(/^(\d{14})_(.+)$/);
const registro = m
  ? `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${m[1]}', '${m[2].replace(/'/g, "''")}') ON CONFLICT (version) DO NOTHING;`
  : '';

// `--ensaio`: roda tudo numa transação e reverte no fim. Se a resposta
// contiver ENSAIO_OK, toda statement executou sem erro.
const corpo = ensaio
  ? `BEGIN;\n${sql}\n${registro}\nDO $ensaio$ BEGIN RAISE EXCEPTION 'ENSAIO_OK'; END $ensaio$;\nROLLBACK;`
  : `${sql}\n${registro}`;

console.log(`${ensaio ? 'Ensaiando' : 'Aplicando'} ${target} em ${env} (ref=${ref})...`);

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: corpo }),
});

const texto = await res.text();
if (ensaio) {
  if (texto.includes('ENSAIO_OK')) {
    console.log('✓ Ensaio OK: todas as statements executaram e foram revertidas.');
    process.exit(0);
  }
  console.error(`✗ Ensaio falhou (HTTP ${res.status})`);
  console.error(texto.slice(0, 800));
  process.exit(2);
}

if (!res.ok) {
  console.error(`✗ HTTP ${res.status}`);
  console.error(texto.slice(0, 500));
  process.exit(2);
}

console.log(`✓ Aplicado${registro ? ' e registrado em schema_migrations' : ''}.`);
console.log('  Confira no catálogo (pg_policies, pg_proc, pg_indexes) — "aplicado" não é prova.');
