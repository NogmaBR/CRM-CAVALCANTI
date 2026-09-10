#!/usr/bin/env node
/**
 * Domínio próprio: tudo que dá para fazer por API, num comando.
 *
 * Uso:
 *   node --env-file=.env.local scripts/configurar-dominio.mjs --dominio=crm.exemplo.com.br
 *   node --env-file=.env.local scripts/configurar-dominio.mjs --dominio=crm.exemplo.com.br --aplicar
 *
 * Sem `--aplicar` é um ensaio: mostra o que faria e não muda nada.
 *
 * ## O problema que resolve
 *
 * Trocar o domínio do app mexe em CINCO lugares, e esquecer qualquer um
 * deles quebra em silêncio:
 *
 *   1. Vercel — o domínio precisa estar no projeto (senão a Vercel responde
 *      404 para ele)
 *   2. Vercel — `NEXT_PUBLIC_APP_URL` de produção, usada nos links
 *      compartilháveis (planilha, convite de senha)
 *   3. Supabase Auth — `site_url` e a lista de redirect. Sem isso o link de
 *      "definir senha" volta para o domínio antigo
 *   4. Vault do banco — `app_base_url` e `fila_consumidor_url`: é o que o
 *      `pg_cron` chama para drenar a fila e indexar. Errado aqui, a fila para
 *      de ser drenada sem nenhum erro visível
 *   5. Redeploy — a variável só vale em deployment novo
 *
 * Este script faz os cinco. O que sobra para a mão humana está no fim da
 * saída: o registro DNS na Cloudflare (a API dela não está configurada aqui),
 * a regra de WAF, e a URL do webhook no painel da UAZAPI.
 *
 * ## Por que o domínio antigo continua valendo
 *
 * `crm-cavalcanti.vercel.app` não é removido. A Vercel serve os dois; a lista
 * de redirect do Supabase mantém os dois. Assim a virada não tem instante em
 * que nada responde, e voltar atrás é só apontar de novo.
 */

import { spawnSync } from 'node:child_process';

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID;
const PROJETO = process.env.VERCEL_PROJECT_ID;
const NOME = process.env.VERCEL_PROJECT_NAME ?? 'crm-cavalcanti';
const SB_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SB_REF = process.env.SUPABASE_PROJECT_REF;

const args = process.argv.slice(2);
const DOMINIO = args.find((a) => a.startsWith('--dominio='))?.slice(10)?.trim().toLowerCase();
const APLICAR = args.includes('--aplicar');

if (!DOMINIO || !/^[a-z0-9.-]+\.[a-z]{2,}$/u.test(DOMINIO) || DOMINIO.startsWith('http')) {
  console.error('Passe o domínio sem protocolo: --dominio=crm.exemplo.com.br');
  process.exit(1);
}
if (!TOKEN || !TEAM || !PROJETO || !SB_TOKEN || !SB_REF) {
  console.error('Faltam credenciais da Vercel/Supabase. Rode com --env-file=.env.local');
  process.exit(1);
}

const URL_NOVA = `https://${DOMINIO}`;
const ehApex = DOMINIO.split('.').length === 2;
const VH = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const SH = { Authorization: `Bearer ${SB_TOKEN}`, 'Content-Type': 'application/json' };

async function vercel(caminho, init = {}) {
  const sep = caminho.includes('?') ? '&' : '?';
  const r = await fetch(`https://api.vercel.com${caminho}${sep}teamId=${TEAM}`, { ...init, headers: VH });
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    // corpo não-JSON
  }
  return { ok: r.ok, status: r.status, json, texto };
}

async function supabase(caminho, init = {}) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}${caminho}`, { ...init, headers: SH });
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    // corpo não-JSON
  }
  return { ok: r.ok, status: r.status, json, texto };
}

function passo(n, titulo) {
  console.log(`\n${APLICAR ? '▶' : '○'} ${n}. ${titulo}`);
}

function falhar(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

console.log(`Domínio: ${DOMINIO} (${ehApex ? 'apex' : 'subdomínio'})`);
console.log(`Modo:    ${APLICAR ? 'APLICAR — vai mudar Vercel, Supabase e Vault' : 'ensaio — nada muda; use --aplicar para valer'}`);

// ---------------------------------------------------------------------------
// 1. Domínio no projeto da Vercel
// ---------------------------------------------------------------------------
passo(1, 'Domínio no projeto da Vercel');
const dominios = await vercel(`/v9/projects/${PROJETO}/domains`);
if (!dominios.ok) falhar(`Não consegui listar os domínios (HTTP ${dominios.status}).`);
const jaExiste = (dominios.json.domains ?? []).some((d) => d.name === DOMINIO);

if (jaExiste) {
  console.log(`   já está no projeto.`);
} else if (APLICAR) {
  const add = await vercel(`/v10/projects/${PROJETO}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: DOMINIO }),
  });
  if (!add.ok) {
    falhar(`A Vercel recusou o domínio (HTTP ${add.status}): ${add.json?.error?.message ?? add.texto.slice(0, 200)}`);
  }
  console.log('   ✓ adicionado.');
} else {
  console.log(`   adicionaria ${DOMINIO} ao projeto ${NOME}.`);
}

// O que a Vercel espera no DNS. Só dá para ler depois de adicionar.
let dnsEsperado = ehApex
  ? [{ tipo: 'A', nome: '@', valor: '76.76.21.21' }]
  : [{ tipo: 'CNAME', nome: DOMINIO.replace(/\.[^.]+\.[^.]+$/u, ''), valor: 'cname.vercel-dns.com' }];
let verificado = false;
if (jaExiste || APLICAR) {
  const cfg = await vercel(`/v6/domains/${DOMINIO}/config`);
  const det = await vercel(`/v9/projects/${PROJETO}/domains/${DOMINIO}`);
  verificado = det.json?.verified === true && cfg.json?.misconfigured === false;
  if (Array.isArray(det.json?.verification) && det.json.verification.length > 0) {
    dnsEsperado = det.json.verification.map((v) => ({ tipo: v.type, nome: v.domain, valor: v.value }));
  }
  console.log(`   verificado pela Vercel: ${verificado ? 'sim' : 'ainda não (falta o DNS)'}`);
}

// ---------------------------------------------------------------------------
// 2. NEXT_PUBLIC_APP_URL de produção
// ---------------------------------------------------------------------------
passo(2, 'NEXT_PUBLIC_APP_URL (produção) na Vercel');
const envs = await vercel(`/v10/projects/${PROJETO}/env`);
if (!envs.ok) falhar(`Não consegui listar as variáveis (HTTP ${envs.status}).`);
const appUrl = (envs.json.envs ?? []).find(
  (e) => e.key === 'NEXT_PUBLIC_APP_URL' && (e.target ?? []).includes('production'),
);

if (!appUrl) {
  console.log('   não existe em produção; seria criada.');
  if (APLICAR) {
    const cria = await vercel(`/v10/projects/${PROJETO}/env`, {
      method: 'POST',
      body: JSON.stringify({ key: 'NEXT_PUBLIC_APP_URL', value: URL_NOVA, type: 'plain', target: ['production'] }),
    });
    if (!cria.ok) falhar(`Criar a variável falhou (HTTP ${cria.status}).`);
    console.log('   ✓ criada.');
  }
} else if (appUrl.value === URL_NOVA) {
  console.log(`   já é ${URL_NOVA}.`);
} else {
  console.log(`   hoje: ${appUrl.value}  →  ${URL_NOVA}`);
  if (APLICAR) {
    const upd = await vercel(`/v9/projects/${PROJETO}/env/${appUrl.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ value: URL_NOVA }),
    });
    if (!upd.ok) falhar(`Atualizar a variável falhou (HTTP ${upd.status}).`);
    console.log('   ✓ atualizada (vale depois do redeploy do passo 5).');
  }
}

// ---------------------------------------------------------------------------
// 3. Supabase Auth: site_url + redirects
// ---------------------------------------------------------------------------
passo(3, 'Supabase Auth — site_url e lista de redirect');
const auth = await supabase('/config/auth');
if (!auth.ok) falhar(`Não consegui ler a config de auth (HTTP ${auth.status}).`);
const lista = String(auth.json.uri_allow_list ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const faltam = [URL_NOVA, `${URL_NOVA}/**`].filter((u) => !lista.includes(u));
const siteUrlOk = auth.json.site_url === URL_NOVA;

console.log(`   site_url hoje: ${auth.json.site_url}${siteUrlOk ? ' (ok)' : `  →  ${URL_NOVA}`}`);
console.log(`   redirects a acrescentar: ${faltam.length ? faltam.join(', ') : 'nenhum (já estão)'}`);

if (APLICAR && (!siteUrlOk || faltam.length)) {
  const upd = await supabase('/config/auth', {
    method: 'PATCH',
    body: JSON.stringify({ site_url: URL_NOVA, uri_allow_list: [...lista, ...faltam].join(',') }),
  });
  if (!upd.ok) falhar(`PATCH da config de auth falhou (HTTP ${upd.status}).`);
  const rel = await supabase('/config/auth');
  if (rel.json?.site_url !== URL_NOVA) falhar('A API respondeu ok, mas o site_url não mudou. Confira no painel.');
  console.log('   ✓ gravado e relido.');
}

// ---------------------------------------------------------------------------
// 4. Vault: app_base_url e fila_consumidor_url
// ---------------------------------------------------------------------------
passo(4, 'Vault do banco — app_base_url e fila_consumidor_url');
if (APLICAR) {
  const r = spawnSync(
    process.execPath,
    ['--env-file=.env.local', 'scripts/provisionar-vault.mjs', `--url=${URL_NOVA}`],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) falhar('provisionar-vault.mjs falhou — o pg_cron continuaria chamando o domínio antigo.');
} else {
  console.log(`   rodaria: node --env-file=.env.local scripts/provisionar-vault.mjs --url=${URL_NOVA}`);
}

// ---------------------------------------------------------------------------
// 5. Redeploy
// ---------------------------------------------------------------------------
passo(5, 'Redeploy da produção (a variável só vale em deployment novo)');
if (APLICAR) {
  const ult = await vercel(`/v6/deployments?projectId=${PROJETO}&target=production&limit=1`);
  const ultimo = ult.json?.deployments?.[0];
  if (!ultimo) falhar('Nenhum deployment de produção para redeployar.');
  const novo = await vercel('/v13/deployments?forceNew=1', {
    method: 'POST',
    body: JSON.stringify({ name: NOME, project: PROJETO, target: 'production', deploymentId: ultimo.uid }),
  });
  if (!novo.ok) falhar(`Redeploy recusado (HTTP ${novo.status}): ${novo.json?.error?.message ?? ''}`);
  console.log(`   ✓ disparado: ${novo.json.id ?? novo.json.uid}. Acompanhe em https://vercel.com/nogma1/crm-cavalcanti/deployments`);
} else {
  console.log('   dispararia um redeploy da produção.');
}

// ---------------------------------------------------------------------------
// O que sobra para a mão humana
// ---------------------------------------------------------------------------
console.log('\n════════════════════════════════════════════════════════════');
console.log('SÓ FALTA VOCÊ — não dá para fazer por API daqui');
console.log('════════════════════════════════════════════════════════════');
console.log('\nA. DNS na Cloudflare (dash.cloudflare.com → seu domínio → DNS → Records):');
for (const r of dnsEsperado) {
  console.log(`   ${r.tipo.padEnd(6)} ${String(r.nome).padEnd(28)} → ${r.valor}`);
}
console.log('   Proxy (nuvem laranja): LIGADO. SSL/TLS → Overview → "Full (strict)".');
console.log('   Se a Vercel não verificar em 10 min, desligue o proxy até verificar e religue.');
console.log('\nB. WAF na Cloudflare (Security → WAF → Rate limiting rules):');
console.log('   Se URI Path equals /api/webhooks/uazapi → 60 requisições / 1 minuto por IP → Block.');
console.log('   É camada extra ao HMAC, não substituto.');
console.log('\nC. UAZAPI: apontar o webhook para');
console.log(`   ${URL_NOVA}/api/webhooks/uazapi`);
console.log('\nD. Conferir:');
console.log(`   curl -sI ${URL_NOVA}/login | head -1     → HTTP/2 200`);
console.log(`   node --env-file=.env.local scripts/checar-integracoes.mjs`);
console.log(`   node --env-file=.env.local scripts/provisionar-vault.mjs --url=${URL_NOVA}   (só relê e confere)`);
if (!verificado && (jaExiste || APLICAR)) {
  console.log('\n   Rode este script de novo depois do DNS: ele diz quando a Vercel verificou.');
}
