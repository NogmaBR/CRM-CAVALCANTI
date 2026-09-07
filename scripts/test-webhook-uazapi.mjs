#!/usr/bin/env node
/**
 * Test harness pro webhook /api/webhooks/uazapi.
 *
 * Uso:
 *   node scripts/test-webhook-uazapi.mjs [fixture] [--url <url>]
 *
 * Exemplos:
 *   node scripts/test-webhook-uazapi.mjs text-simples
 *   node scripts/test-webhook-uazapi.mjs image-nf --url http://localhost:3000
 *   node scripts/test-webhook-uazapi.mjs pdf-boleto --url https://crm-cavalcanti.vercel.app
 *
 * Fixtures disponíveis: scripts/fixtures/uazapi/*.json
 *
 * Requer WEBHOOK_HMAC_SECRET no ambiente (mesmo valor do .env.local
 * ou da env var da Vercel).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHmac } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function usage() {
  console.error('Uso: node scripts/test-webhook-uazapi.mjs <fixture> [--url <url>]');
  console.error('Fixtures: text-simples, image-nf, pdf-boleto, audio-ignorado');
  process.exit(1);
}

const { positional, flags } = parseArgs(process.argv);
const fixtureName = positional[0];
if (!fixtureName) usage();

const url = flags.url ?? 'http://localhost:3000';
const secret = process.env.WEBHOOK_HMAC_SECRET;
if (!secret) {
  console.error('ERRO: WEBHOOK_HMAC_SECRET não está definido no ambiente.');
  console.error('Setup: export WEBHOOK_HMAC_SECRET=<valor do .env.local>');
  process.exit(2);
}

const fixturePath = resolve(__dirname, 'fixtures', 'uazapi', `${fixtureName}.json`);
let raw;
try {
  raw = readFileSync(fixturePath, 'utf8');
} catch (e) {
  console.error(`ERRO: fixture não encontrada em ${fixturePath}`);
  process.exit(3);
}

// Normaliza JSON pra remover whitespace diferente do que será enviado
const body = JSON.stringify(JSON.parse(raw));
const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
const endpoint = `${url.replace(/\/$/, '')}/api/webhooks/uazapi`;

console.log(`→ POST ${endpoint}`);
console.log(`  x-signature: ${signature.slice(0, 20)}... (${signature.length} chars)`);
console.log(`  body: ${body.slice(0, 100)}${body.length > 100 ? '...' : ''}`);
console.log();

const t0 = Date.now();
const res = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-signature': signature },
  body,
});
const elapsed = Date.now() - t0;
const responseText = await res.text();

console.log(`← HTTP ${res.status} (${elapsed}ms)`);
try {
  console.log(JSON.stringify(JSON.parse(responseText), null, 2));
} catch {
  console.log(responseText);
}

process.exit(res.ok ? 0 : 1);
