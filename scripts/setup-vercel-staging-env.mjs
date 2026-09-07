#!/usr/bin/env node
/**
 * Provisiona env vars staging no Vercel Preview scope.
 *
 * Depois de rodar: Vercel Preview deploys usam staging DB. Production
 * continua no CRM-CAVALCANTI original.
 *
 * Uso:
 *   export STAGING_SUPABASE_URL=https://<ref>.supabase.co
 *   export STAGING_SUPABASE_ANON_KEY=<sb_publishable_...>
 *   export STAGING_SUPABASE_SERVICE_ROLE_KEY=<sb_secret_...>
 *   export VERCEL_TOKEN=<vcp_...>            # já em .env.local
 *   node scripts/setup-vercel-staging-env.mjs
 *
 * Vars provisionadas no target=preview:
 *   NEXT_PUBLIC_SUPABASE_URL         (override prod)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY    (override prod)
 *   SUPABASE_SERVICE_ROLE_KEY        (override prod)
 *
 * Production scope INTOCADO — só Preview.
 */
const projectId = process.env.VERCEL_PROJECT_ID ?? 'prj_z1pt9zxdish8cmqM2oAaFRB0qSM7';
const teamId = process.env.VERCEL_TEAM_ID ?? 'team_2A3cAOheq9LYalV1OoxEp47S';
const token = process.env.VERCEL_TOKEN;

const stagingUrl = process.env.STAGING_SUPABASE_URL;
const stagingAnon = process.env.STAGING_SUPABASE_ANON_KEY;
const stagingSecret = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;

if (!token || !stagingUrl || !stagingAnon || !stagingSecret) {
  console.error('ERRO: env vars ausentes.');
  console.error('Necessário:');
  console.error('  VERCEL_TOKEN                          (do .env.local)');
  console.error('  STAGING_SUPABASE_URL                  https://<ref>.supabase.co');
  console.error('  STAGING_SUPABASE_ANON_KEY             sb_publishable_...');
  console.error('  STAGING_SUPABASE_SERVICE_ROLE_KEY     sb_secret_...');
  process.exit(1);
}

const varsToSet = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', value: stagingUrl, type: 'plain' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: stagingAnon, type: 'plain' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', value: stagingSecret, type: 'sensitive' },
];

async function upsertEnv(key, value, type) {
  // 1) Lista atuais desta key no target=preview pra achar id
  const listRes = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}&decrypt=false`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const list = await listRes.json();
  const existing = (list.envs ?? []).find(
    (e) => e.key === key && e.target?.includes('preview') && !e.target?.includes('production'),
  );

  if (existing) {
    // Update
    const patchRes = await fetch(
      `https://api.vercel.com/v10/projects/${projectId}/env/${existing.id}?teamId=${teamId}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, type }),
      },
    );
    const j = await patchRes.json();
    if (!patchRes.ok) throw new Error(`PATCH ${key}: ${JSON.stringify(j)}`);
    console.log(`  ✓ ${key}: updated (Preview only)`);
  } else {
    // Create (só Preview)
    const postRes = await fetch(
      `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${teamId}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, type, target: ['preview'] }),
      },
    );
    const j = await postRes.json();
    if (!postRes.ok) throw new Error(`POST ${key}: ${JSON.stringify(j)}`);
    console.log(`  ✓ ${key}: created (Preview only)`);
  }
}

console.log(`Provisionando 3 env vars staging em Vercel Preview...`);
console.log(`Project: ${projectId} | Team: ${teamId}`);
console.log('---');

for (const v of varsToSet) {
  try {
    await upsertEnv(v.key, v.value, v.type);
  } catch (e) {
    console.error(`  ✗ ${v.key}: ${e.message}`);
    process.exit(2);
  }
}

console.log('---');
console.log('Env vars provisionadas em Preview scope. Production intocado.');
console.log('');
console.log('Próximo passo: push branch → Vercel gera Preview URL usando staging DB.');
