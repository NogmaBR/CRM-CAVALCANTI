#!/usr/bin/env node
/**
 * Liga (ou só confere) o provedor de e-mail do Supabase Auth.
 *
 * Achado de 2026-09-16: `external_email_enabled = false` no projeto. Com isso
 * `signInWithPassword` — o único login do CRM — responde
 * "Email logins are disabled" (422 `email_provider_disabled`). Quem já estava
 * logado continua (o refresh token não passa pelo provedor); quem abrir o
 * /login numa aba nova não entra. `disable_signup` continua `true`: ligar o
 * provedor NÃO reabre o cadastro público.
 *
 *   node --env-file=.env.local scripts/habilitar-login-email.mjs            # só mostra
 *   node --env-file=.env.local scripts/habilitar-login-email.mjs --aplicar  # liga
 *
 * Escrita de configuração em produção: é o usuário que roda, com `!`.
 */

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('Faltam SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN no .env.local');
  process.exit(1);
}
const aplicar = process.argv.includes('--aplicar');
const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const atual = await (await fetch(url, { headers })).json();
const mostrar = (c) =>
  console.log(
    `  external_email_enabled=${c.external_email_enabled}  disable_signup=${c.disable_signup}  mailer_autoconfirm=${c.mailer_autoconfirm}`,
  );
console.log('Agora:');
mostrar(atual);

if (atual.external_email_enabled === true) {
  console.log('\nO provedor de e-mail já está ligado. Nada a fazer.');
  process.exit(0);
}
if (!aplicar) {
  console.log('\nEnsaio. Para ligar o login por e-mail: acrescente --aplicar');
  process.exit(0);
}

const r = await fetch(url, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ external_email_enabled: true }),
});
if (!r.ok) {
  console.error('PATCH falhou:', r.status, (await r.text()).slice(0, 300));
  process.exit(1);
}
const depois = await (await fetch(url, { headers })).json();
console.log('\nDepois:');
mostrar(depois);
console.log(
  depois.external_email_enabled
    ? '\n✓ Login por e-mail ligado. Teste abrindo /login numa aba anônima.'
    : '\n✗ A API respondeu OK mas o valor não mudou — confira no painel do Supabase (Auth › Providers › Email).',
);
