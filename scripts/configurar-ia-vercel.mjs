#!/usr/bin/env node
/**
 * Grava na Vercel (produção) as variáveis da IA OpenAI, lendo do `.env.local`.
 *
 * Uso:
 *   node --env-file=.env.local scripts/configurar-ia-vercel.mjs [--com-provider] [--redeploy]
 *
 *   sem flag        OPENAI_API_KEY, IA_TRANSCRICAO_PROVIDER, IA_EMBEDDINGS_PROVIDER
 *   --com-provider  + IA_PROVIDER=openai (só depois do merge do PR #28: a main
 *                   anterior não conhece esse provider e a classificação quebraria)
 *   --redeploy      dispara um redeploy de produção no fim (variável só vale
 *                   depois de um deploy novo — a armadilha clássica daqui)
 *
 * Nunca imprime valor. Variável que já existe é atualizada; a chave entra como
 * `sensitive`.
 */

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID;
const PROJ = process.env.VERCEL_PROJECT_ID;
const args = process.argv.slice(2);

if (!TOKEN || !PROJ) {
  console.error('Faltam VERCEL_TOKEN / VERCEL_PROJECT_ID. Rode com --env-file=.env.local');
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY vazia no .env.local.');
  process.exit(1);
}

const vars = [
  { key: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY, type: 'sensitive' },
  { key: 'IA_TRANSCRICAO_PROVIDER', value: 'openai', type: 'plain' },
  { key: 'IA_EMBEDDINGS_PROVIDER', value: 'openai', type: 'plain' },
];
if (args.includes('--com-provider'))
  vars.push({ key: 'IA_PROVIDER', value: 'openai', type: 'plain' });

const q = TEAM ? `?teamId=${TEAM}` : '';
const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const lista = await (
  await fetch(`https://api.vercel.com/v10/projects/${PROJ}/env${q}`, { headers: h })
).json();
const existentes = new Map(
  (lista.envs ?? [])
    .filter((e) => (e.target ?? []).includes('production'))
    .map((e) => [e.key, e.id]),
);

for (const v of vars) {
  const id = existentes.get(v.key);
  const corpo = { key: v.key, value: v.value, type: v.type, target: ['production'] };
  const r = id
    ? await fetch(`https://api.vercel.com/v9/projects/${PROJ}/env/${id}${q}`, {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify({ value: v.value, type: v.type, target: ['production'] }),
      })
    : await fetch(`https://api.vercel.com/v10/projects/${PROJ}/env${q}`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify(corpo),
      });
  console.log(
    `${r.ok ? '✓' : '✗'} ${v.key} ${id ? 'atualizada' : 'criada'}${r.ok ? '' : ` (HTTP ${r.status}: ${(await r.text()).slice(0, 160)})`}`,
  );
}

if (args.includes('--redeploy')) {
  const deps = await (
    await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${PROJ}&target=production&limit=1${TEAM ? `&teamId=${TEAM}` : ''}`,
      { headers: h },
    )
  ).json();
  const ultimo = deps.deployments?.[0];
  if (!ultimo) {
    console.error('Sem deploy de produção para reaproveitar.');
    process.exit(1);
  }
  const r = await fetch(`https://api.vercel.com/v13/deployments${q}`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      name: ultimo.name,
      target: 'production',
      project: PROJ,
      deploymentId: ultimo.uid,
    }),
  });
  const j = await r.json();
  console.log(r.ok ? `✓ redeploy disparado: ${j.url}` : `✗ redeploy: HTTP ${r.status}`);
} else {
  console.log(
    '\nLembre: variável só vale depois de um redeploy (--redeploy, ou o deploy do merge).',
  );
}
