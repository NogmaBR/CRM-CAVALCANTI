#!/usr/bin/env node
/**
 * Põe no Vault do Supabase o que o agendador de filas precisa.
 *
 * Uso:
 *   node --env-file=.env.local scripts/provisionar-vault.mjs
 *
 * ## Por que o Vault e não a migration
 *
 * O `pg_cron` chama `/api/queue/consume`, e essa rota exige
 * `Authorization: Bearer <CRON_SECRET>`. Alguém precisa guardar esse segredo
 * do lado do banco.
 *
 * Na migration não pode: `supabase/migrations/` é versionado num repositório
 * **público**. Numa variável de sessão também não — `pg_cron` roda fora de
 * qualquer sessão nossa. Sobra o Vault, que é criptografado e não aparece em
 * `pg_dump`.
 *
 * ## O que este arquivo NÃO contém
 *
 * Nenhum valor. Ele lê `CRON_SECRET` e `NEXT_PUBLIC_APP_URL` do ambiente e os
 * envia; nada é impresso, nem truncado. O que aparece na saída é só o nome do
 * segredo e se foi criado ou atualizado.
 *
 * ## Quando rodar de novo
 *
 * Sempre que o `CRON_SECRET` for rotacionado. Sem isso o agendador continua
 * mandando o segredo antigo, a rota devolve 401, e a fila para de ser drenada
 * **em silêncio** — nada quebra, só deixa de acontecer.
 */

const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SECRET = process.env.CRON_SECRET;

/**
 * A URL que o BANCO vai chamar — e não a que o app usa.
 *
 * A distinção custou um erro real: a primeira versão deste script usava
 * `NEXT_PUBLIC_APP_URL`, que em `.env.local` vale `http://localhost:3000`. O
 * segredo foi gravado, o script disse "pronto", e o `pg_net` respondeu
 * "Couldn't connect to server" — porque o Postgres da Supabase, em São Paulo,
 * não alcança o localhost de quem rodou o script.
 *
 * Nada quebrou de forma visível. É por isso que existe a checagem de endereço
 * local logo abaixo: o modo de falhar aqui é silencioso.
 */
const APP_URL =
  process.argv.find((a) => a.startsWith('--url='))?.slice(6) ??
  process.env.FILA_CONSUMIDOR_URL ??
  'https://crm-cavalcanti.vercel.app';

if (!REF || !TOKEN) {
  console.error('Faltam SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN.');
  console.error('Rode com: node --env-file=.env.local scripts/provisionar-vault.mjs');
  process.exit(1);
}

if (!SECRET) {
  console.error('CRON_SECRET não está no ambiente — é ele que autentica a rota do consumidor.');
  process.exit(1);
}

let host;
try {
  host = new URL(APP_URL).hostname;
} catch {
  console.error(`URL inválida: ${APP_URL}`);
  process.exit(1);
}

// Quem faz a chamada é o Postgres da Supabase, não esta máquina.
if (/^(localhost|127\.|0\.0\.0\.0|::1|192\.168\.|10\.)/u.test(host)) {
  console.error(`✗ "${APP_URL}" é um endereço local.`);
  console.error('  Quem chama é o banco, lá na Supabase — ele não alcança sua máquina.');
  console.error('  Passe a URL pública: --url=https://crm-cavalcanti.vercel.app');
  process.exit(1);
}

const URL_CONSUMIDOR = `${APP_URL.replace(/\/+$/u, '')}/api/queue/consume`;
console.log(`Consumidor: ${URL_CONSUMIDOR}\n`);

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const texto = await r.text();
  if (!r.ok) {
    // A mensagem do Postgres pode citar o valor enviado. Não imprimimos o
    // corpo do erro por isso — só o status e o nome do segredo em questão.
    throw new Error(`Supabase devolveu ${r.status} ao gravar o segredo.`);
  }
  return JSON.parse(texto);
}

/** Escapa aspas simples para literal SQL. Nada é impresso. */
function lit(v) {
  return `'${String(v).replace(/'/gu, "''")}'`;
}

async function upsertSegredo(nome, valor, descricao) {
  const existente = await sql(`SELECT id FROM vault.secrets WHERE name = ${lit(nome)} LIMIT 1;`);

  if (existente.length > 0) {
    await sql(
      `SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name = ${lit(nome)}), ${lit(valor)}, ${lit(nome)}, ${lit(descricao)});`,
    );
    return 'atualizado';
  }

  await sql(`SELECT vault.create_secret(${lit(valor)}, ${lit(nome)}, ${lit(descricao)});`);
  return 'criado';
}

const BASE = APP_URL.replace(/\/+$/u, '');

const passos = [
  ['fila_consumidor_url', URL_CONSUMIDOR, 'Rota que o pg_cron chama para drenar as filas'],
  ['fila_consumidor_secret', SECRET, 'CRON_SECRET, para autenticar as chamadas do pg_cron'],
  // A base separada da rota: o agendador da indexação monta a própria URL.
  // Guardar a rota inteira de novo faria duas cópias do mesmo domínio, e uma
  // delas ficaria para trás no dia em que o domínio mudar.
  ['app_base_url', BASE, 'Domínio público do app, para o pg_net montar as rotas'],
];

for (const [nome, valor, descricao] of passos) {
  const acao = await upsertSegredo(nome, valor, descricao);
  console.log(`✓ ${nome.padEnd(24)} ${acao}`);
}

// Conferência.
//
// Chamar `fila_acordar_consumidor()` NÃO serve como prova: com a fila vazia
// ela retorna antes de tocar no Vault. Foi exatamente assim que a versão
// anterior deste script deu "pronto" com uma URL de localhost gravada.
//
// A checagem é direta: os dois segredos estão legíveis pelo banco, e a URL é
// a que se pretendia gravar?
const conferencia = await sql(`
  SELECT
    (SELECT count(*) FROM vault.decrypted_secrets
      WHERE name IN ('fila_consumidor_url','fila_consumidor_secret','app_base_url')
        AND decrypted_secret IS NOT NULL AND decrypted_secret <> '') AS legiveis,
    (SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'fila_consumidor_url') AS url;
`);

const { legiveis, url } = conferencia[0];

if (Number(legiveis) !== 3) {
  console.error(`\n✗ Só ${legiveis} de 3 segredos legíveis pelo banco.`);
  process.exit(1);
}

if (url !== URL_CONSUMIDOR) {
  console.error(`\n✗ O Vault guardou "${url}", diferente do pretendido.`);
  process.exit(1);
}

console.log('\n✓ Os três segredos legíveis pelo banco, e a URL confere.');
console.log('  O pg_cron drena as filas quando houver job, e indexa de hora em hora.');
