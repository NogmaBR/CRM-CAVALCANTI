#!/usr/bin/env node
/**
 * Tudo que vem DEPOIS do upgrade para Vercel Pro, num comando só.
 *
 * Uso:
 *   node --env-file=.env.local scripts/pos-vercel-pro.mjs
 *   node --env-file=.env.local scripts/pos-vercel-pro.mjs --repo-privado
 *   node --env-file=.env.local scripts/pos-vercel-pro.mjs --so-medir
 *
 * ## O que faz, na ordem do runbook (docs/RUNBOOK-VERCEL-PRO.md)
 *
 *   1. Lê o projeto e mostra a região atual das funções.
 *   2. Troca a região para `gru1` (São Paulo) pela API. Se a Vercel recusar,
 *      é porque o plano ainda é Hobby — o script diz isso e para. A única
 *      coisa que ele NÃO consegue fazer é o upgrade em si, que é billing.
 *   3. Redeploya a produção. **Sem isso a região não vale**: ela só se aplica
 *      a deployments novos. É o mesmo erro do redeploy das variáveis.
 *   4. Espera o deploy ficar READY e confirma, no próprio deployment, que a
 *      região gravada é `gru1` — não confia no "salvo com sucesso".
 *   5. Mede a latência do jeito do `medir-latencia.mjs` (lendo o
 *      `duracao_ms` que a função reporta) e compara com o baseline de 394 ms.
 *   6. Com `--repo-privado`: torna o repositório privado pelo `gh` e confere.
 *      Fica por último de propósito — se o deploy quebrar, é mais fácil
 *      investigar com o repo ainda público.
 *
 * Nada aqui imprime credencial.
 */

import { spawnSync } from 'node:child_process';

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID;
const PROJETO = process.env.VERCEL_PROJECT_ID;
const NOME = process.env.VERCEL_PROJECT_NAME ?? 'crm-cavalcanti';
const CRON_SECRET = process.env.CRON_SECRET;
const APP = process.env.APP_URL_MEDICAO ?? 'https://crm-cavalcanti.vercel.app';
const REPO = 'NogmaBR/CRM-CAVALCANTI';

const args = process.argv.slice(2);
const REGIAO = args.find((a) => a.startsWith('--regiao='))?.slice(9) ?? 'gru1';
const SO_MEDIR = args.includes('--so-medir');
const REPO_PRIVADO = args.includes('--repo-privado');
const REFERENCIA_IAD1 = 394;

if (!TOKEN || !TEAM || !PROJETO) {
  console.error('Faltam VERCEL_TOKEN / VERCEL_TEAM_ID / VERCEL_PROJECT_ID. Rode com --env-file=.env.local');
  process.exit(1);
}
if (!CRON_SECRET) {
  console.error('CRON_SECRET não está no ambiente — é ele que autentica a rota usada na medição.');
  process.exit(1);
}

const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function vercel(caminho, init = {}) {
  const sep = caminho.includes('?') ? '&' : '?';
  const r = await fetch(`https://api.vercel.com${caminho}${sep}teamId=${TEAM}`, { ...init, headers: H });
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    // corpo não-JSON: devolvemos o texto cru no erro
  }
  return { ok: r.ok, status: r.status, json, texto };
}

function falhar(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Estado atual
// ---------------------------------------------------------------------------
const proj = await vercel(`/v9/projects/${PROJETO}`);
if (!proj.ok) falhar(`Não consegui ler o projeto (HTTP ${proj.status}).`);

const regiaoAtual = proj.json.serverlessFunctionRegion ?? '(padrão)';
console.log(`Projeto: ${proj.json.name}`);
console.log(`Região das funções hoje: ${regiaoAtual}`);
console.log(`Banco (Supabase):        sa-east-1 (São Paulo)\n`);

// ---------------------------------------------------------------------------
// 2. Trocar a região
// ---------------------------------------------------------------------------
let redeployNecessario = false;

if (SO_MEDIR) {
  console.log('--so-medir: pulando troca de região e redeploy.\n');
} else if (regiaoAtual === REGIAO) {
  console.log(`Região já é ${REGIAO}. Nada a trocar.\n`);
} else {
  console.log(`Trocando a região para ${REGIAO}…`);
  const troca = await vercel(`/v9/projects/${PROJETO}`, {
    method: 'PATCH',
    body: JSON.stringify({ serverlessFunctionRegion: REGIAO }),
  });

  if (!troca.ok) {
    const motivo = troca.json?.error?.message ?? troca.texto.slice(0, 200);
    console.error(`\n✗ A Vercel recusou (HTTP ${troca.status}): ${motivo}`);
    if (/plan|hobby|pro|upgrade|billing/iu.test(motivo)) {
      console.error('\n  Isso é o plano Hobby. A região só pode ser trocada no Pro.');
      console.error('  Faça o upgrade em https://vercel.com/nogma1/~/settings/billing e rode este script de novo.');
    } else {
      console.error('\n  Confira em https://vercel.com/nogma1/crm-cavalcanti/settings/functions');
    }
    process.exit(1);
  }

  // Não confiar no 200: reler.
  const releitura = await vercel(`/v9/projects/${PROJETO}`);
  const gravada = releitura.json?.serverlessFunctionRegion;
  if (gravada !== REGIAO) {
    falhar(`A API respondeu 200, mas o projeto continua com região "${gravada}". Não confie; confira no painel.`);
  }
  console.log(`✓ Região gravada no projeto: ${gravada}\n`);
  redeployNecessario = true;
}

// ---------------------------------------------------------------------------
// 3. Redeploy
// ---------------------------------------------------------------------------
async function ultimoDeployProd() {
  const r = await vercel(`/v6/deployments?projectId=${PROJETO}&target=production&limit=1`);
  if (!r.ok) falhar(`Não consegui listar deployments (HTTP ${r.status}).`);
  return r.json.deployments?.[0] ?? null;
}

if (redeployNecessario) {
  const ultimo = await ultimoDeployProd();
  if (!ultimo) falhar('Nenhum deployment de produção para redeployar.');

  console.log(`Redeployando a produção a partir de ${ultimo.uid} (${ultimo.meta?.githubCommitSha?.slice(0, 7) ?? '?'})…`);
  const novo = await vercel('/v13/deployments?forceNew=1', {
    method: 'POST',
    body: JSON.stringify({ name: NOME, project: PROJETO, target: 'production', deploymentId: ultimo.uid }),
  });
  if (!novo.ok) {
    falhar(`Redeploy recusado (HTTP ${novo.status}): ${novo.json?.error?.message ?? novo.texto.slice(0, 200)}`);
  }

  const id = novo.json.id ?? novo.json.uid;
  console.log(`  deployment novo: ${id}`);

  // 4. Esperar READY e conferir a região DO DEPLOYMENT, não do projeto.
  const inicio = Date.now();
  let estado = novo.json.readyState ?? novo.json.state ?? 'QUEUED';
  let detalhe = novo.json;
  while (!['READY', 'ERROR', 'CANCELED'].includes(estado)) {
    if (Date.now() - inicio > 10 * 60 * 1000) falhar('O deploy não ficou READY em 10 minutos.');
    await new Promise((r) => setTimeout(r, 10_000));
    const d = await vercel(`/v13/deployments/${id}`);
    detalhe = d.json ?? {};
    estado = detalhe.readyState ?? detalhe.state ?? estado;
    process.stdout.write(`  ${Math.round((Date.now() - inicio) / 1000)}s: ${estado}\r`);
  }
  console.log();

  if (estado !== 'READY') falhar(`Deploy terminou em ${estado}. Veja https://vercel.com/nogma1/crm-cavalcanti/deployments`);

  const regioes = detalhe.regions ?? [];
  if (!regioes.includes(REGIAO)) {
    falhar(`Deploy READY, mas as regiões dele são ${JSON.stringify(regioes)} — não ${REGIAO}. A troca não pegou.`);
  }
  console.log(`✓ Deploy READY em ${JSON.stringify(regioes)}\n`);

  // Dá um tempo para o alias de produção apontar para o deploy novo.
  await new Promise((r) => setTimeout(r, 15_000));
}

// ---------------------------------------------------------------------------
// 5. Medir
// ---------------------------------------------------------------------------
console.log(`Medindo latência em ${APP}/api/cron/automacoes (9 chamadas, a 1ª descartada)…`);
const medidas = [];
for (let i = 0; i <= 8; i++) {
  const r = await fetch(`${APP}/api/cron/automacoes`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  if (!r.ok) falhar(`Chamada ${i} devolveu ${r.status}.`);
  const corpo = await r.text();
  if (corpo.trimStart().startsWith('<')) falhar('Veio HTML em vez de JSON — o middleware barrou a rota.');
  const ms = JSON.parse(corpo).duracao_ms;
  if (i === 0) {
    console.log(`  descartada (cold start): ${ms} ms`);
    continue;
  }
  medidas.push(ms);
  console.log(`  ${String(i).padStart(2)}: ${ms} ms`);
}
medidas.sort((a, b) => a - b);
const mediana = medidas[Math.floor(medidas.length / 2)];
console.log(`\nmediana: ${mediana} ms   (referência em iad1: ${REFERENCIA_IAD1} ms)`);

if (mediana < REFERENCIA_IAD1 * 0.6) {
  console.log(`✓ Melhorou ${Math.round((1 - mediana / REFERENCIA_IAD1) * 100)}% — a região nova está valendo.`);
} else if (mediana > REFERENCIA_IAD1 * 0.9) {
  console.log('⚠ Sem melhora perceptível. Se a região foi trocada, o alias de produção pode ainda');
  console.log('  não ter virado; rode com --so-medir daqui a um minuto.');
} else {
  console.log('~ Melhora parcial. Meça de novo em outro horário antes de concluir.');
}

// ---------------------------------------------------------------------------
// 6. Repositório privado
// ---------------------------------------------------------------------------
if (REPO_PRIVADO) {
  console.log(`\nTornando ${REPO} privado…`);
  const r = spawnSync(
    'gh',
    ['repo', 'edit', REPO, '--visibility', 'private', '--accept-visibility-change-consequences'],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (r.status !== 0) falhar('gh repo edit falhou. O gh está autenticado com escopo repo?');

  const v = spawnSync('gh', ['repo', 'view', REPO, '--json', 'visibility', '-q', '.visibility'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const visibilidade = (v.stdout ?? '').trim();
  if (visibilidade !== 'PRIVATE') falhar(`gh diz que a visibilidade é "${visibilidade}", não PRIVATE.`);
  console.log('✓ Repositório PRIVATE (conferido pelo gh).');
  console.log('  Confira agora se um deploy novo sai: faça um commit qualquer na main e olhe a Vercel.');
  console.log('  Se não sair, é a permissão do GitHub App em Settings → Git.');
} else {
  console.log('\nPara tornar o repositório privado, rode de novo com --repo-privado.');
}
