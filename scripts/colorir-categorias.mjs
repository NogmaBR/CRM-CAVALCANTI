#!/usr/bin/env node
/**
 * Dá cor a toda categoria (etapa do plano de contas) que está sem cor — a
 * MESMA cor automática que o app já usa (`lib/categorias/cor.ts`), só que
 * gravada no cadastro, para aparecer no formulário e poder ser trocada.
 *
 *   node --env-file=.env.local scripts/colorir-categorias.mjs            # ensaio
 *   node --env-file=.env.local scripts/colorir-categorias.mjs --aplicar  # grava
 *
 * Não toca em categoria que já tem cor. Reversível: é um UPDATE em `cor`.
 */

import { corAutomatica } from './lib/cor-categoria-core.mjs';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APLICAR = process.argv.includes('--aplicar');
if (!BASE || !KEY) {
  console.error(
    'Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode com --env-file=.env.local',
  );
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function rest(metodo, caminho, corpo) {
  const r = await fetch(`${BASE}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...H, Prefer: 'return=representation' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho} → HTTP ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

const categorias = await rest('GET', 'categorias?select=id,nome,cor&deleted_at=is.null&order=nome');
const semCor = categorias.filter((c) => !c.cor || !String(c.cor).trim());

console.log(`${categorias.length} categorias vivas; ${semCor.length} sem cor.`);
for (const c of semCor) console.log(`  ${c.nome.padEnd(40)} → ${corAutomatica(c.id)}`);

if (!APLICAR) {
  console.log('\nEnsaio: nada gravado. Rode com --aplicar para gravar.');
  process.exit(0);
}

let n = 0;
for (const c of semCor) {
  await rest('PATCH', `categorias?id=eq.${c.id}`, { cor: corAutomatica(c.id) });
  n++;
}
console.log(`\n✓ ${n} categorias coloridas.`);
