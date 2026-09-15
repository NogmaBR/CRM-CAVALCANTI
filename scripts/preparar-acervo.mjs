#!/usr/bin/env node
/**
 * Prepara produção para o acervo e importa, em um comando só.
 *
 * Uso:
 *   node --env-file=.env.local scripts/preparar-acervo.mjs "<pasta-com-os-zips-ou-zip>" [--ensaio]
 *
 * Passos (cada um confere o anterior e para no primeiro erro):
 *   1. Bucket `documents`: sobe o limite por arquivo ao máximo que o plano
 *      permite e libera qualquer tipo (o cliente quer TUDO do Drive: vídeo,
 *      DWG, planilha). Sem isto, vídeo e DOCX seriam recusados no upload.
 *   2. Migration 20260915120000_acervo_e_grupo.sql (pula se já aplicada).
 *   3. Apelidos das obras (`seed-apelidos-obras.mjs`).
 *   4. Importação (`importar-onedrive.mjs --criar-obras`).
 *
 * Existe porque escrita de configuração em produção é ação humana neste
 * projeto (o classificador do Claude Code barra): a pessoa roda uma linha,
 * o script faz a sequência inteira. `--ensaio` só mostra o que faria.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const ENSAIO = args.includes('--ensaio');
const entrada = args.find((a) => !a.startsWith('--'));

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!entrada) {
  console.error(
    'Uso: node --env-file=.env.local scripts/preparar-acervo.mjs "<pasta-ou-zip>" [--ensaio]',
  );
  process.exit(1);
}
if (!URL || !KEY || !REF || !TOKEN) {
  console.error('Faltam variáveis do Supabase. Rode com --env-file=.env.local');
  process.exit(1);
}

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

function rodar(script, extra = []) {
  const r = spawnSync(
    process.execPath,
    ['--env-file=.env.local', path.join(aqui, script), ...extra],
    { stdio: 'inherit', cwd: path.join(aqui, '..') },
  );
  if (r.status !== 0) {
    console.error(`\n✗ ${script} saiu com código ${r.status}. Parando aqui.`);
    process.exit(r.status ?? 1);
  }
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`SQL → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// ---------------------------------------------------------------------------
// 1. Bucket
// ---------------------------------------------------------------------------
console.log('1/4 Bucket `documents`');
{
  const atual = await (await fetch(`${URL}/storage/v1/bucket/documents`, { headers: h })).json();
  console.log(
    `    hoje: limite ${Math.round((atual.file_size_limit ?? 0) / 1048576)} MB, tipos ${atual.allowed_mime_types ? atual.allowed_mime_types.length : 'todos'}`,
  );
  if (ENSAIO) {
    console.log('    (ensaio) subiria o limite ao máximo do plano e liberaria todos os tipos');
  } else {
    let aplicado = null;
    // Do maior para o menor: o Storage recusa acima do teto global do plano.
    for (const mb of [5120, 500, 50]) {
      const r = await fetch(`${URL}/storage/v1/bucket/documents`, {
        method: 'PUT',
        headers: h,
        body: JSON.stringify({
          public: false,
          file_size_limit: mb * 1048576,
          allowed_mime_types: null,
        }),
      });
      if (r.ok) {
        aplicado = mb;
        break;
      }
      console.log(`    ${mb} MB recusado (${r.status}); tentando menor…`);
    }
    if (!aplicado) {
      console.error(
        '✗ Não consegui alterar o bucket. Ajuste no painel do Supabase: Storage › documents › limite e tipos.',
      );
      process.exit(1);
    }
    const depois = await (await fetch(`${URL}/storage/v1/bucket/documents`, { headers: h })).json();
    console.log(
      `    agora: limite ${Math.round(depois.file_size_limit / 1048576)} MB, tipos ${depois.allowed_mime_types ? depois.allowed_mime_types.length : 'todos'}`,
    );
    if (aplicado < 500) {
      console.log(
        '    ⚠ Arquivo acima desse limite não sobe (vídeos grandes). É o teto do plano do Supabase.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Migration
// ---------------------------------------------------------------------------
console.log('\n2/4 Migration 20260915120000_acervo_e_grupo.sql');
{
  const ja = await sql(`select 1 from supabase_migrations.schema_migrations where version = '20260915120000'`);
  if (Array.isArray(ja) && ja.length > 0) {
    console.log('    já aplicada, pulando');
  } else if (ENSAIO) {
    rodar('apply-migration.mjs', ['20260915120000_acervo_e_grupo.sql', '--ensaio']);
  } else {
    rodar('apply-migration.mjs', ['20260915120000_acervo_e_grupo.sql']);
    const cols = await sql(
      `select count(*)::int n from information_schema.columns where table_name='documentos' and column_name in ('categoria','origem','caminho_origem','texto_extraido_em','conciliado_em')`,
    );
    const tabs = await sql(
      `select count(*)::int n from pg_tables where schemaname='public' and tablename in ('whatsapp_grupos','registros_obra')`,
    );
    const cron = await sql(`select count(*)::int n from cron.job where jobname='acervo-processar'`);
    console.log(
      `    conferido: ${cols[0].n}/5 colunas, ${tabs[0].n}/2 tabelas, cron ${cron[0].n}/1`,
    );
    if (cols[0].n !== 5 || tabs[0].n !== 2 || cron[0].n !== 1) {
      console.error('✗ Catálogo não bate com a migration. Parando.');
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Apelidos
// ---------------------------------------------------------------------------
console.log('\n3/4 Apelidos das obras');
rodar('seed-apelidos-obras.mjs', ENSAIO ? ['--ensaio'] : []);

// ---------------------------------------------------------------------------
// 4. Importação
// ---------------------------------------------------------------------------
console.log('\n4/4 Importação');
rodar('importar-onedrive.mjs', [entrada, '--criar-obras', ...(ENSAIO ? ['--ensaio'] : [])]);

if (!ENSAIO) {
  const n = await sql(
    `select origem, count(*)::int n, round(sum(tamanho_bytes)/1048576.0)::int mb from documentos where deleted_at is null group by 1`,
  );
  console.log('\nDocumentos no banco por origem:', JSON.stringify(n));
  console.log(
    '\nPróximo passo: extração de texto, RAG e conciliação rodam pelo /api/cron/acervo (a cada 20 min depois do merge do PR #28).',
  );
}
