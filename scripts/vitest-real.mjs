#!/usr/bin/env node
/**
 * Roda um teste "real" (gated por TESTE_REAL=1) com as variáveis do .env.local:
 *
 *   node --env-file=.env.local scripts/vitest-real.mjs lib/ia/agente.real.test.ts
 *
 * Existe porque exportar variável no shell do Windows quebra com valores que
 * têm caracteres especiais; `--env-file` não.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const alvo = process.argv.slice(2);
if (alvo.length === 0) {
  console.error('Uso: node --env-file=.env.local scripts/vitest-real.mjs <arquivo.real.test.ts>');
  process.exit(1);
}
const web = path.resolve(process.cwd(), 'apps/web');
const r = spawnSync('pnpm', ['exec', 'vitest', 'run', ...alvo], {
  cwd: web,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, TESTE_REAL: '1' },
});
process.exit(r.status ?? 1);
