#!/usr/bin/env node
/**
 * Importa o acervo do OneDrive do cliente (pasta `_OBRAS ATIVAS_`) para o CRM.
 *
 * Uso:
 *   node --env-file=.env.local scripts/importar-onedrive.mjs <pasta-ou-zip> [--ensaio] [--criar-obras] [--processar]
 *
 *   --ensaio       calcula e imprime o plano; não escreve nada.
 *   --criar-obras  pasta de obra que não casa com o cadastro vira obra nova.
 *   --processar    ao terminar, chama POST /api/cron/acervo (extração, RAG,
 *                  conciliação) em vez de esperar o cron das 03:40 UTC.
 *
 * ## Como funciona
 *
 * O link do OneDrive não abre por API sem login (é pasta pessoal migrada para
 * SharePoint). Então o caminho é: baixar o ZIP pelo navegador (ou sincronizar
 * a pasta com o cliente OneDrive do Windows) e apontar este script para ele.
 * Reexecutar é sincronizar — novo, alterado, movido e removido são detectados
 * por hash e por caminho (`scripts/lib/importar-onedrive-core.mjs`).
 *
 * Cada arquivo vira uma linha em `documentos` (origem `onedrive`, categoria
 * pela subpasta, tipo pelo nome) e um objeto no bucket `documents` no mesmo
 * caminho que o app usa (`{obra_id}/{documento_id}/{nome}`), então a tela de
 * documentos e a URL assinada funcionam sem caso especial.
 *
 * ## O que ele NUNCA faz
 *
 * - Extrair o ZIP dentro do repositório (é público e os arquivos têm nome de
 *   cliente): vai para a pasta temporária do sistema e é apagado no fim.
 * - Imprimir credencial.
 * - Criar pagamento. Conciliar nota com pagamento é do app (`/api/cron/acervo`).
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, open, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  localizarRaizDasObras,
  magicConfere,
  mimeDaExtensao,
  planejar,
  relatorio,
} from './lib/importar-onedrive-core.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const entrada = args.find((a) => !a.startsWith('--'));
const ENSAIO = flags.has('--ensaio');
const CRIAR_OBRAS = flags.has('--criar-obras');
const PROCESSAR = flags.has('--processar');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!entrada) {
  console.error(
    'Uso: node --env-file=.env.local scripts/importar-onedrive.mjs <pasta-ou-zip> [--ensaio] [--criar-obras] [--processar]',
  );
  process.exit(1);
}
if (!URL || !KEY) {
  console.error(
    'Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode com --env-file=.env.local',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// REST
// ---------------------------------------------------------------------------
const cabecalhos = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function rest(metodo, caminho, corpo, extra = {}) {
  const r = await fetch(`${URL}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...cabecalhos, ...extra },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) {
    const err = new Error(`${metodo} ${caminho} → HTTP ${r.status}: ${texto.slice(0, 300)}`);
    err.status = r.status;
    err.corpo = texto;
    throw err;
  }
  return texto ? JSON.parse(texto) : null;
}

async function subirParaStorage(caminhoStorage, abs, mime, tamanho) {
  // Corpo em stream: vídeo de 150 MB não passa pela memória inteiro.
  const r = await fetch(`${URL}/storage/v1/object/documents/${caminhoStorage}`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': mime,
      'Content-Length': String(tamanho),
      'x-upsert': 'true',
    },
    body: Readable.toWeb(createReadStream(abs)),
    duplex: 'half',
  });
  if (!r.ok)
    throw new Error(
      `storage ${caminhoStorage} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`,
    );
}

/** Igual a `makeStoragePath` do app. */
function caminhoStorage(obraId, documentoId, nome) {
  const safe = nome.replace(/[^\w.\-]/gu, '_').slice(0, 200);
  return `${obraId}/${documentoId}/${safe}`;
}

// ---------------------------------------------------------------------------
// Disco
// ---------------------------------------------------------------------------
async function extrairZip(zip) {
  const destino = await mkdtemp(path.join(tmpdir(), 'crm-acervo-'));
  await extrairZipEm(zip, destino);
  return destino;
}

async function extrairZipEm(zip, destino) {
  const ps = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${zip.replace(/'/gu, "''")}' -DestinationPath '${destino}' -Force`,
    ],
    { stdio: 'inherit' },
  );
  if (ps.status !== 0) {
    const un = spawnSync('unzip', ['-q', zip, '-d', destino], { stdio: 'inherit' });
    if (un.status !== 0) throw new Error('Não consegui extrair o ZIP (nem PowerShell nem unzip).');
  }
}

async function listarArquivos(raiz) {
  const saida = [];
  async function andar(dir) {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) await andar(abs);
      else if (ent.isFile()) saida.push(abs);
    }
  }
  await andar(raiz);
  return saida;
}

function sha256Arquivo(abs) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(abs)
      .on('data', (c) => h.update(c))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

async function primeirosBytes(abs, n = 12) {
  const fh = await open(abs, 'r');
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fh.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------
async function principal() {
  let base = path.resolve(entrada);
  let temporaria = null;
  const st = await stat(base);
  if (st.isFile() && /\.zip$/iu.test(base)) {
    console.log('Extraindo ZIP para pasta temporária…');
    temporaria = await extrairZip(base);
    base = temporaria;
  } else if (st.isDirectory()) {
    // Pasta com um ZIP por obra (é como o OneDrive baixa quando se seleciona
    // várias pastas): extrai todos numa temporária só e varre de lá.
    const zips = (await readdir(base)).filter((n) => /\.zip$/iu.test(n));
    if (zips.length > 0) {
      console.log(`Extraindo ${zips.length} ZIP(s) para pasta temporária…`);
      temporaria = await mkdtemp(path.join(tmpdir(), 'crm-acervo-'));
      for (const z of zips) {
        console.log(`  ${z}`);
        await extrairZipEm(path.join(base, z), temporaria);
      }
      base = temporaria;
    }
  } else {
    throw new Error(`${entrada} não é pasta nem .zip`);
  }

  try {
    const absolutos = await listarArquivos(base);
    const relativos = absolutos.map((a) => path.relative(base, a).split(path.sep).join('/'));
    const prefixo = localizarRaizDasObras(relativos);
    const raizObras = prefixo ? path.join(base, ...prefixo.split('/')) : base;
    console.log(
      `Raiz das obras: ${prefixo || '(a própria pasta)'}  —  ${absolutos.length} arquivos`,
    );

    // Só o que está debaixo da raiz das obras interessa.
    const arquivos = [];
    for (const abs of absolutos) {
      const rel = path.relative(raizObras, abs).split(path.sep).join('/');
      if (rel.startsWith('..')) continue;
      const s = await stat(abs);
      const nome = path.basename(abs);
      const mime = mimeDaExtensao(nome);
      const magicOk = magicConfere(mime, await primeirosBytes(abs));
      arquivos.push({
        abs,
        caminhoRel: rel,
        tamanho: s.size,
        mtime: s.mtime.toISOString(),
        magicOk,
        // Tudo sobe, sem teto de tamanho (pedido do cliente): o hash é
        // calculado em stream, então um vídeo de 150 MB não vai para a memória.
        hash: magicOk ? await sha256Arquivo(abs) : `nao-confere:${rel}`,
      });
    }

    console.log('Lendo cadastro…');
    const obras = await rest(
      'GET',
      'obras?select=id,nome,apelidos,onedrive_folder_id&deleted_at=is.null',
    );
    let existentes;
    try {
      existentes = await rest(
        'GET',
        'documentos?select=id,hash_sha256,caminho_origem,obra_id&origem=eq.onedrive&deleted_at=is.null&limit=10000',
      );
    } catch (err) {
      // 42703 = coluna não existe: a migration 20260915120000 ainda não foi
      // aplicada. Em ensaio dá para mostrar o plano mesmo assim; de verdade, não.
      if (!(ENSAIO && err.status === 400 && String(err.corpo).includes('42703'))) throw err;
      console.log(
        'AVISO: migration 20260915120000_acervo_e_grupo.sql não aplicada — ensaio segue sem dedupe.',
      );
      existentes = [];
    }

    const plano = planejar({
      arquivos,
      obras,
      documentosExistentes: existentes,
      criarObras: CRIAR_OBRAS,
    });

    console.log('\nPlano:');
    console.log(relatorio(plano));

    if (ENSAIO) {
      console.log('\n--ensaio: nada foi escrito.');
      return;
    }

    // 1. Obras novas
    const idPorObraNova = new Map();
    for (const nome of plano.obrasNovas) {
      const [criada] = await rest(
        'POST',
        'obras',
        { nome, status: 'ativa', onedrive_folder_id: `_OBRAS ATIVAS_/${nome}` },
        { Prefer: 'return=representation' },
      );
      idPorObraNova.set(nome, criada.id);
      console.log(`  obra criada: ${nome}`);
    }

    // 2. Apagar (substituídos e removidos)
    for (const a of plano.apagar) {
      await rest('PATCH', `documentos?id=eq.${a.id}`, { deleted_at: new Date().toISOString() });
    }
    if (plano.apagar.length) console.log(`  apagados: ${plano.apagar.length}`);

    // 3. Atualizar (movidos/renomeados)
    for (const u of plano.atualizar) {
      await rest('PATCH', `documentos?id=eq.${u.id}`, {
        caminho_origem: u.caminho,
        origem_modificado_em: u.mtime,
        categoria: u.categoria,
        nome_arquivo: u.nome,
      });
    }
    if (plano.atualizar.length) console.log(`  atualizados: ${plano.atualizar.length}`);

    // 4. Criar
    let criados = 0;
    let falhas = 0;
    const falhados = [];
    const porArq = new Map(arquivos.map((a) => [a.caminhoRel, a]));
    for (const c of plano.criar) {
      const obraId = c.obraId ?? idPorObraNova.get(c.obraNome);
      if (!obraId) {
        falhas += 1;
        console.error(`  sem obra para ${c.caminho}`);
        continue;
      }
      const abs = porArq.get(c.caminho).abs;
      try {
        const [novo] = await rest(
          'POST',
          'documentos',
          {
            obra_id: obraId,
            tipo: c.tipo,
            categoria: c.categoria,
            origem: 'onedrive',
            caminho_origem: c.caminho,
            origem_modificado_em: c.mtime,
            nome_arquivo: c.nome,
            mime_type: c.mime,
            tamanho_bytes: c.tamanho,
            hash_sha256: c.hash,
            storage_path: 'pending',
          },
          { Prefer: 'return=representation' },
        );
        const destino = caminhoStorage(obraId, novo.id, c.nome);
        await subirParaStorage(destino, abs, c.mime, c.tamanho);
        await rest('PATCH', `documentos?id=eq.${novo.id}`, { storage_path: destino });
        criados += 1;
        if (criados % 25 === 0) console.log(`  …${criados}/${plano.criar.length}`);
      } catch (err) {
        falhas += 1;
        // 23505 no hash: o mesmo arquivo já existe com outra origem (ex.: veio
        // pelo WhatsApp). Não é erro — é o dedupe funcionando.
        if (err.status === 409) console.log(`  já existia (hash): ${c.caminho}`);
        else {
          const mb = Math.round(c.tamanho / 1048576);
          console.error(`  falhou ${c.caminho} (${mb} MB): ${err.message}`);
          falhados.push({ caminho: c.caminho, mb });
        }
      }
    }
    if (falhados.length) {
      console.log('\nNão subiram (o limite por arquivo é do plano do Supabase):');
      for (const f of falhados) console.log(`  ${f.mb} MB  ${f.caminho}`);
    }
    console.log(`\nCriados: ${criados}  Falhas: ${falhas}`);

    if (PROCESSAR) {
      const app = process.env.NEXT_PUBLIC_APP_URL;
      const cron = process.env.CRON_SECRET;
      if (!app || !cron) {
        console.log('--processar ignorado: faltam NEXT_PUBLIC_APP_URL / CRON_SECRET');
      } else {
        const r = await fetch(`${app}/api/cron/acervo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${cron}` },
        });
        console.log(`/api/cron/acervo → ${r.status}: ${(await r.text()).slice(0, 300)}`);
      }
    }
  } finally {
    if (temporaria) await rm(temporaria, { recursive: true, force: true });
  }
}

principal().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
