#!/usr/bin/env node
/**
 * Liga o CRM a uma instância do UAZAPI — a de teste (seu número) hoje, a
 * oficial (número do cliente) depois. É o mesmo comando nas duas vezes; só
 * muda o token no `.env.local`.
 *
 *   node --env-file=.env.local scripts/configurar-whatsapp.mjs                 # só mostra: status + webhook atual
 *   node --env-file=.env.local scripts/configurar-whatsapp.mjs --webhook       # grava o webhook certo na instância
 *   node --env-file=.env.local scripts/configurar-whatsapp.mjs --vercel        # grava UAZAPI_* na Vercel + redeploy
 *   node --env-file=.env.local scripts/configurar-whatsapp.mjs --teste 5551999999999  # manda "teste" para um número
 *   (as flags combinam: --webhook --vercel --teste …)
 *
 * Lê do `.env.local`: UAZAPI_BASE_URL, UAZAPI_TOKEN (obrigatórias),
 * NEXT_PUBLIC_APP_URL (para a URL do webhook; padrão produção) e, com
 * `--vercel`, VERCEL_TOKEN/VERCEL_PROJECT_ID/VERCEL_TEAM_ID.
 *
 * O webhook gravado é exatamente o que o CRM precisa (OpenAPI de
 * docs.uazapi.com, POST /webhook, modo simples):
 *   url = <app>/api/webhooks/uazapi, events = ["messages"],
 *   excludeMessages = ["wasSentByApi"] (evita laço; NÃO exclui isGroupYes nem
 *   fromMeYes — grupo e dono do número precisam chegar), sem sufixos na URL.
 *
 * Nunca imprime token.
 */

const BASE = process.env.UAZAPI_BASE_URL?.replace(/\/+$/u, '');
const TOKEN = process.env.UAZAPI_TOKEN;
const APP = (process.env.NEXT_PUBLIC_APP_URL || 'https://crm-cavalcanti.vercel.app').replace(
  /\/+$/u,
  '',
);
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const valorDe = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!BASE || !TOKEN) {
  console.error('Faltam UAZAPI_BASE_URL / UAZAPI_TOKEN no .env.local.');
  process.exit(1);
}
if (/localhost|127\.0\.0\.1/u.test(APP) && (flag('--webhook') || flag('--vercel'))) {
  console.error(
    `NEXT_PUBLIC_APP_URL aponta para ${APP}: o UAZAPI não alcança localhost. Ajuste para a URL pública.`,
  );
  process.exit(1);
}

const URL_WEBHOOK = `${APP}/api/webhooks/uazapi`;
const H = { token: TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' };

async function api(metodo, caminho, corpo) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: H,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(20_000),
  });
  const t = await r.text();
  let j = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    j = t;
  }
  if (!r.ok) throw new Error(`${metodo} ${caminho} → HTTP ${r.status}: ${String(t).slice(0, 200)}`);
  return j;
}

// 1. status da instância
try {
  const s = await api('GET', '/instance/status');
  const inst = s?.instance ?? {};
  const st = s?.status ?? {};
  const jid = typeof st.jid === 'string' ? st.jid : inst.owner;
  console.log('Instância:', inst.name ?? '(sem nome)');
  console.log('  estado   :', inst.status ?? (st.connected ? 'connected' : 'desconhecido'));
  console.log('  número   :', typeof jid === 'string' ? jid.split('@')[0].split(':')[0] : '—');
  console.log('  perfil   :', inst.profileName ?? '—');
  if (inst.status !== 'connected' && st.connected !== true) {
    console.log('  ⚠ não conectada: leia o QR code no painel do UAZAPI antes de testar.');
  }
} catch (e) {
  console.error('✗ não consegui falar com a instância:', e.message);
  process.exit(1);
}

// 2. webhook atual
const desejado = {
  enabled: true,
  url: URL_WEBHOOK,
  events: ['messages'],
  excludeMessages: ['wasSentByApi'],
  addUrlEvents: false,
  addUrlTypesMessages: false,
};
const norm = (u) =>
  String(u ?? '')
    .trim()
    .replace(/\/+$/u, '')
    .toLowerCase();
function conferir(lista) {
  const nosso = (lista ?? []).find((w) => norm(w.url) === norm(URL_WEBHOOK));
  const problemas = [];
  if (!nosso) problemas.push(`nenhum webhook aponta para ${URL_WEBHOOK}`);
  else {
    if (nosso.enabled === false) problemas.push('desabilitado');
    if (!(nosso.events ?? []).includes('messages')) problemas.push('sem o evento "messages"');
    const ex = nosso.excludeMessages ?? [];
    if (!ex.includes('wasSentByApi')) problemas.push('sem excluir "wasSentByApi" (laço)');
    if (ex.includes('isGroupYes')) problemas.push('"isGroupYes" excluído — grupos não chegam');
    if (ex.includes('fromMeYes'))
      problemas.push('"fromMeYes" excluído — o dono do número não chega');
    if (nosso.addUrlEvents || nosso.addUrlTypesMessages)
      problemas.push('addUrlEvents/addUrlTypesMessages ligados');
  }
  return { nosso, problemas };
}

let atual = await api('GET', '/webhook').catch(() => []);
if (!Array.isArray(atual)) atual = atual ? [atual] : [];
console.log(`\nWebhooks na instância: ${atual.length}`);
for (const w of atual) {
  console.log(
    `  - ${w.url}  eventos=${(w.events ?? []).join(',')}  exclui=${(w.excludeMessages ?? []).join(',') || '—'}  ${w.enabled === false ? '(desabilitado)' : ''}`,
  );
}
let { nosso, problemas } = conferir(atual);

// 3. gravar
if (flag('--webhook')) {
  const corpo = nosso?.id ? { ...desejado, id: nosso.id, action: 'update' } : desejado;
  await api('POST', '/webhook', corpo);
  atual = await api('GET', '/webhook');
  if (!Array.isArray(atual)) atual = atual ? [atual] : [];
  ({ nosso, problemas } = conferir(atual));
  console.log(
    `\n${problemas.length === 0 ? '✓' : '✗'} webhook ${nosso?.id ? 'atualizado' : 'criado'} e relido do provider`,
  );
  const outros = atual.filter((w) => norm(w.url) !== norm(URL_WEBHOOK));
  if (outros.length) {
    console.log(
      `  ⚠ há ${outros.length} outro(s) webhook(s) na instância (${outros.map((w) => w.url).join(', ')}). Se não usa, apague no painel — cada um recebe uma cópia de tudo.`,
    );
  }
}
console.log(
  problemas.length === 0
    ? '✓ webhook do CRM está correto'
    : `✗ webhook: ${problemas.join('; ')}${flag('--webhook') ? '' : ' → rode com --webhook'}`,
);

// 4. Vercel
if (flag('--vercel')) {
  const VT = process.env.VERCEL_TOKEN;
  const PROJ = process.env.VERCEL_PROJECT_ID;
  const TEAM = process.env.VERCEL_TEAM_ID;
  if (!VT || !PROJ) {
    console.error('Faltam VERCEL_TOKEN / VERCEL_PROJECT_ID para --vercel.');
    process.exit(1);
  }
  const q = TEAM ? `?teamId=${TEAM}` : '';
  const h = { Authorization: `Bearer ${VT}`, 'Content-Type': 'application/json' };
  const lista = await (
    await fetch(`https://api.vercel.com/v10/projects/${PROJ}/env${q}`, { headers: h })
  ).json();
  const existentes = new Map(
    (lista.envs ?? [])
      .filter((e) => (e.target ?? []).includes('production'))
      .map((e) => [e.key, e.id]),
  );
  for (const v of [
    { key: 'UAZAPI_BASE_URL', value: BASE, type: 'plain' },
    { key: 'UAZAPI_TOKEN', value: TOKEN, type: 'sensitive' },
  ]) {
    const id = existentes.get(v.key);
    const r = id
      ? await fetch(`https://api.vercel.com/v9/projects/${PROJ}/env/${id}${q}`, {
          method: 'PATCH',
          headers: h,
          body: JSON.stringify({ value: v.value, type: v.type, target: ['production'] }),
        })
      : await fetch(`https://api.vercel.com/v10/projects/${PROJ}/env${q}`, {
          method: 'POST',
          headers: h,
          body: JSON.stringify({
            key: v.key,
            value: v.value,
            type: v.type,
            target: ['production'],
          }),
        });
    console.log(
      `${r.ok ? '✓' : '✗'} Vercel ${v.key} ${id ? 'atualizada' : 'criada'}${r.ok ? '' : ` (HTTP ${r.status})`}`,
    );
  }
  const deps = await (
    await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${PROJ}&target=production&limit=1${TEAM ? `&teamId=${TEAM}` : ''}`,
      { headers: h },
    )
  ).json();
  const ultimo = deps.deployments?.[0];
  if (ultimo) {
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
    console.log(
      r.ok
        ? `✓ redeploy disparado: ${j.url} (espere ficar READY antes de testar)`
        : `✗ redeploy: HTTP ${r.status}`,
    );
  }
}

// 5. teste de envio
const destino = valorDe('--teste');
if (destino) {
  const numero = /@g\.us$/u.test(destino) ? destino : destino.replace(/\D/gu, '');
  const r = await api('POST', '/send/text', {
    number: numero,
    text: 'Teste do CRM Cavalcanti ✔ (configurar-whatsapp.mjs)',
  });
  console.log(
    `✓ enviado para ${numero}${r?.messageid || r?.id ? ` (id ${r.messageid ?? r.id})` : ''}`,
  );
}

console.log(
  `\nPróximo passo: mande uma mensagem para o número da instância (ou no grupo) e abra ${APP}/config/whatsapp.`,
);
