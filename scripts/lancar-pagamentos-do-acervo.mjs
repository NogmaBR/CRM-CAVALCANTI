#!/usr/bin/env node
/**
 * Lança em `pagamentos` o extrato real de cada obra, a partir das planilhas
 * "Controle Financeiro" que já estão no acervo, e liga cada nota/comprovante
 * do acervo ao lançamento correspondente.
 *
 *   node --env-file=.env.local scripts/lancar-pagamentos-do-acervo.mjs            # ensaio: só relata
 *   node --env-file=.env.local scripts/lancar-pagamentos-do-acervo.mjs --aplicar  # escreve
 *
 * O que faz, nesta ordem (tudo idempotente — rodar duas vezes não duplica):
 *   1. Arquiva os pagamentos do protótipo (`observacoes` "prototipo pay-…"):
 *      eram fictícios e as notas reais nunca casariam com eles.
 *   2. Cria as categorias do plano de contas do cliente (ETAPA da planilha).
 *   3. Cria os fornecedores que faltam (grafias unificadas em
 *      `scripts/lib/lancar-pagamentos-core.mjs`).
 *   4. Insere um pagamento por linha da planilha, com a origem em
 *      `observacoes` ("planilha: <arquivo> item <n>") — é a chave que impede
 *      duplicar num rerun.
 *   5. Liga cada documento de `nfs_pagamentos` ao pagamento (data e
 *      fornecedor do nome do arquivo; descrição desempata; ambíguo fica
 *      para o gestor em /pendentes).
 *
 * Escreve o relatório completo em `dados-iniciais/lancamentos-do-acervo.csv`
 * (pasta fora do Git — tem nome de fornecedor e valor real).
 *
 * Só service_role; nunca imprime credencial.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { normalizarNome } from './lib/importar-onedrive-core.mjs';
import {
  PLANO_DE_CONTAS,
  casarNota,
  chaveFornecedor,
  lerExtrato,
  observacoesDe,
} from './lib/lancar-pagamentos-core.mjs';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APLICAR = process.argv.includes('--aplicar');

if (!BASE || !KEY) {
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
  const r = await fetch(`${BASE}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...cabecalhos, ...extra },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho} → HTTP ${r.status}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

async function baixar(storagePath) {
  const r = await fetch(`${BASE}/storage/v1/object/documents/${storagePath}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`storage GET ${storagePath} → ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Planilha → abas (matriz de células). O `xlsx` é o do app (apps/web).
// ---------------------------------------------------------------------------
async function lerAbas(bytes) {
  const { read, utils } = await import(
    new URL('../apps/web/node_modules/xlsx/xlsx.mjs', import.meta.url)
  );
  // Sem `cellDates`: a data chega como serial e o núcleo converte sem fuso.
  const pasta = read(bytes, { type: 'array' });
  const abas = {};
  for (const nome of pasta.SheetNames) {
    abas[nome] = utils.sheet_to_json(pasta.Sheets[nome], { header: 1, raw: true, defval: null });
  }
  return abas;
}

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------
const obras = await rest('GET', 'obras?select=id,nome&deleted_at=is.null');
const obraPorId = new Map(obras.map((o) => [o.id, o]));

const planilhas = (
  await rest(
    'GET',
    'documentos?select=id,obra_id,nome_arquivo,storage_path&deleted_at=is.null&nome_arquivo=ilike.*controle financeiro*&order=created_at',
  )
).filter((d) => !/c[oó]pia/iu.test(d.nome_arquivo) && d.storage_path !== 'pending');

const porObra = new Map();
for (const p of planilhas) {
  if (!porObra.has(p.obra_id)) porObra.set(p.obra_id, p); // a primeira (mais antiga) por obra
}

console.log(`Planilhas de controle no acervo: ${planilhas.length} (${porObra.size} obras)`);

const lancamentos = [];
const ignoradas = [];
for (const [obraId, p] of porObra) {
  const obra = obraPorId.get(obraId)?.nome ?? obraId;
  const abas = await lerAbas(await baixar(p.storage_path));
  const r = lerExtrato(abas, p.nome_arquivo);
  if (r.erro) {
    console.log(`  ${obra}: ${p.nome_arquivo} → ${r.erro}`);
    continue;
  }
  for (const l of r.lancamentos) lancamentos.push({ ...l, obraId, obra });
  for (const i of r.ignoradas) ignoradas.push({ ...i, obra, arquivo: p.nome_arquivo });
  const soma = r.lancamentos.reduce((s, l) => s + l.valor, 0);
  console.log(
    `  ${obra}: aba "${r.aba}", ${r.lancamentos.length} lançamentos (R$ ${soma.toFixed(2)}), ${r.ignoradas.length} linhas ignoradas`,
  );
}

// Já lançados (rerun) e protótipo (a arquivar).
const existentes = await rest(
  'GET',
  'pagamentos?select=id,obra_id,observacoes,fornecedor_id,data_pagamento,descricao&deleted_at=is.null&limit=10000',
);
const chavesExistentes = new Map();
const prototipo = [];
for (const p of existentes) {
  const obs = p.observacoes ?? '';
  if (obs.startsWith('planilha: ')) chavesExistentes.set(obs.split(' | ')[0], p.id);
  else if (/prototipo pay-/u.test(obs)) prototipo.push(p);
}
const novos = lancamentos.filter((l) => !chavesExistentes.has(l.chave));

// Categorias e fornecedores.
const categorias = await rest('GET', 'categorias?select=id,nome&deleted_at=is.null');
const catPorChave = new Map(categorias.map((c) => [normalizarNome(c.nome), c]));
const categoriasNovas = [
  ...new Set([...PLANO_DE_CONTAS, ...lancamentos.map((l) => l.categoria)]),
].filter((nome) => !catPorChave.has(normalizarNome(nome)));

const fornecedores = await rest('GET', 'fornecedores?select=id,nome&deleted_at=is.null');
const fornPorChave = new Map(fornecedores.map((f) => [chaveFornecedor(f.nome), f]));
const fornecedoresNovos = [];
for (const l of lancamentos) {
  if (!l.fornecedor) continue;
  const k = chaveFornecedor(l.fornecedor);
  if (!fornPorChave.has(k) && !fornecedoresNovos.some((f) => chaveFornecedor(f) === k))
    fornecedoresNovos.push(l.fornecedor);
}

// Notas a ligar.
const notas = await rest(
  'GET',
  'documentos?select=id,obra_id,nome_arquivo,fornecedor_id,pagamento_id&deleted_at=is.null&categoria=eq.nfs_pagamentos&order=nome_arquivo',
);
const idsPrototipo = new Set(prototipo.map((p) => p.id));
const notasLivres = notas.filter((n) => !n.pagamento_id || idsPrototipo.has(n.pagamento_id));

/**
 * Valor total lido do texto da nota, pelo modelo — só para as notas que a
 * data + fornecedor + descrição não bastaram. `null` sem chave da OpenAI ou
 * quando o modelo não acha valor.
 */
async function valorDaNota(documentoId) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const [doc] = await rest('GET', `documentos?select=texto_extraido&id=eq.${documentoId}`);
  const texto = doc?.texto_extraido?.slice(0, 8000);
  if (!texto) return null;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.IA_MODEL || 'gpt-5.4-mini',
      reasoning_effort: 'low',
      max_completion_tokens: 200,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'valor_nota',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: { valor: { type: ['number', 'null'] } },
            required: ['valor'],
          },
        },
      },
      messages: [
        {
          role: 'system',
          content:
            'Você lê notas fiscais e comprovantes de pagamento brasileiros. Devolva o VALOR TOTAL pago/da nota em reais, como número (ex.: 1234.56). Se houver "valor total da nota" use esse; num comprovante Pix/TED use o valor transferido. Sem valor claro: null.',
        },
        { role: 'user', content: texto },
      ],
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  try {
    const v = JSON.parse(j.choices?.[0]?.message?.content ?? '{}').valor;
    return typeof v === 'number' && v > 0 ? v : null;
  } catch {
    return null;
  }
}

// O valor de cada nota vem do modelo uma vez só; fica em cache fora do Git.
const CACHE_VALORES = 'dados-iniciais/valores-das-notas.json';
mkdirSync('dados-iniciais', { recursive: true });
const cacheValores = existsSync(CACHE_VALORES)
  ? JSON.parse(readFileSync(CACHE_VALORES, 'utf8'))
  : {};
let lidos = 0;
for (const n of notasLivres) {
  if (n.id in cacheValores) continue;
  cacheValores[n.id] = await valorDaNota(n.id);
  lidos += 1;
  if (lidos % 25 === 0) writeFileSync(CACHE_VALORES, JSON.stringify(cacheValores, null, 1));
}
writeFileSync(CACHE_VALORES, JSON.stringify(cacheValores, null, 1));
const semValor = notasLivres.filter((n) => cacheValores[n.id] == null).length;
console.log(`
Valor das notas: ${notasLivres.length - semValor} lidas pelo modelo (${lidos} agora), ${semValor} sem valor legível`);

const casamentos = [];
for (const n of notasLivres) {
  const daObra = lancamentos.filter((l) => l.obraId === n.obra_id);
  const valor = cacheValores[n.id];
  const r = casarNota({ nome: n.nome_arquivo, valor: valor ?? undefined }, daObra);
  casamentos.push({ nota: n, valorLido: valor, ...r });
}
const ligadas = casamentos.filter((c) => c.lancamento);
const naoLigadas = casamentos.filter((c) => !c.lancamento);

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------
const porObraResumo = new Map();
for (const l of lancamentos) {
  const r = porObraResumo.get(l.obra) ?? { n: 0, total: 0, aguardando: 0 };
  r.n += 1;
  r.total += l.valor;
  if (l.status === 'aguardando') r.aguardando += 1;
  porObraResumo.set(l.obra, r);
}
console.log('\nLançamentos por obra:');
for (const [obra, r] of porObraResumo) {
  console.log(
    `  ${obra.padEnd(16)} ${String(r.n).padStart(4)}  R$ ${r.total.toFixed(2).padStart(12)}  (${r.aguardando} em aberto)`,
  );
}
console.log(`\nA arquivar (protótipo): ${prototipo.length} pagamentos`);
console.log(`Já lançados antes (pulados): ${lancamentos.length - novos.length}`);
console.log(`Categorias novas (${categoriasNovas.length}): ${categoriasNovas.join(', ') || '—'}`);
console.log(
  `Fornecedores novos (${fornecedoresNovos.length}): ${fornecedoresNovos.join(', ') || '—'}`,
);
console.log(`Linhas ignoradas (${ignoradas.length}):`);
for (const i of ignoradas)
  console.log(`  ${i.obra}: item ${i.item} ${i.descricao || ''} — ${i.motivo}`);
console.log(
  `\nNotas do acervo: ${notas.length}; livres ${notasLivres.length}; ligam ${ligadas.length}; não ligam ${naoLigadas.length}`,
);
const motivos = new Map();
for (const c of naoLigadas) motivos.set(c.motivo, (motivos.get(c.motivo) ?? 0) + 1);
for (const [m, n] of motivos) console.log(`  ${n} × ${m}`);

const csv = [
  [
    'obra',
    'item',
    'data',
    'categoria',
    'fornecedor',
    'descricao',
    'valor',
    'status',
    'pagamento',
    'adm',
    'notas_ligadas',
  ].join(';'),
  ...lancamentos.map((l) =>
    [
      l.obra,
      l.item,
      l.data,
      l.categoria,
      l.fornecedor ?? '',
      `"${l.descricao.replace(/"/gu, '""')}"`,
      l.valor.toFixed(2).replace('.', ','),
      l.status,
      l.pagamento ?? '',
      l.adm == null ? '' : l.adm.toFixed(2).replace('.', ','),
      `"${ligadas
        .filter((c) => c.lancamento === l)
        .map((c) => c.nota.nome_arquivo)
        .join(' | ')}"`,
    ].join(';'),
  ),
  '',
  'NOTAS NÃO LIGADAS;obra;arquivo;motivo',
  ...naoLigadas.map(
    (c) =>
      `;${obraPorId.get(c.nota.obra_id)?.nome ?? ''};"${c.nota.nome_arquivo}";${c.motivo}${c.valorLido != null ? ` (valor lido ${c.valorLido})` : ''}`,
  ),
].join('\n');
writeFileSync('dados-iniciais/lancamentos-do-acervo.csv', `﻿${csv}`);
console.log('\nRelatório: dados-iniciais/lancamentos-do-acervo.csv');

if (!APLICAR) {
  console.log('\nEnsaio: nada foi escrito. Rode com --aplicar para gravar.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------
console.log('\n== Aplicando ==');

// 1. desligar notas presas ao protótipo, depois arquivar o protótipo
if (prototipo.length > 0) {
  const ids = prototipo.map((p) => p.id).join(',');
  const desligadas = await rest(
    'PATCH',
    `documentos?pagamento_id=in.(${ids})&select=id`,
    { pagamento_id: null, conciliado_em: null },
    { Prefer: 'return=representation' },
  );
  const arquivados = await rest(
    'PATCH',
    `pagamentos?id=in.(${ids})&deleted_at=is.null&select=id`,
    { deleted_at: new Date().toISOString() },
    { Prefer: 'return=representation' },
  );
  console.log(
    `  protótipo arquivado: ${arquivados.length} pagamentos (${desligadas.length} notas desligadas)`,
  );
}

// 2. categorias
for (const nome of categoriasNovas) {
  const [c] = await rest('POST', 'categorias', { nome }, { Prefer: 'return=representation' });
  catPorChave.set(normalizarNome(nome), c);
}
if (categoriasNovas.length) console.log(`  categorias criadas: ${categoriasNovas.length}`);

// 3. fornecedores
for (const nome of fornecedoresNovos) {
  const [f] = await rest(
    'POST',
    'fornecedores',
    { nome, origem: 'manual', ativo: true },
    { Prefer: 'return=representation' },
  );
  fornPorChave.set(chaveFornecedor(nome), f);
}
if (fornecedoresNovos.length) console.log(`  fornecedores criados: ${fornecedoresNovos.length}`);

// 4. pagamentos, em lotes; a chave (observacoes) volta para casar id ↔ lançamento
const idPorChave = new Map(chavesExistentes);
const LOTE = 100;
for (let i = 0; i < novos.length; i += LOTE) {
  const lote = novos.slice(i, i + LOTE).map((l) => ({
    obra_id: l.obraId,
    fornecedor_id: l.fornecedor
      ? (fornPorChave.get(chaveFornecedor(l.fornecedor))?.id ?? null)
      : null,
    categoria_id: catPorChave.get(normalizarNome(l.categoria))?.id ?? null,
    descricao: l.descricao,
    valor: l.valor,
    data_pagamento: l.data,
    origem: 'importado',
    status_pagto: l.status,
    observacoes: observacoesDe(l),
  }));
  const criados = await rest('POST', 'pagamentos', lote, { Prefer: 'return=representation' });
  for (const p of criados) idPorChave.set(p.observacoes.split(' | ')[0], p.id);
  console.log(`  pagamentos: ${Math.min(i + LOTE, novos.length)}/${novos.length}`);
}

// 5. ligar as notas
let ligadasOk = 0;
for (const c of ligadas) {
  const pagamentoId = idPorChave.get(c.lancamento.chave);
  if (!pagamentoId) continue;
  const corpo = { pagamento_id: pagamentoId, conciliado_em: new Date().toISOString() };
  if (!c.nota.fornecedor_id && c.lancamento.fornecedor) {
    corpo.fornecedor_id = fornPorChave.get(chaveFornecedor(c.lancamento.fornecedor))?.id ?? null;
  }
  const r = await rest('PATCH', `documentos?id=eq.${c.nota.id}&select=id`, corpo, {
    Prefer: 'return=representation',
  });
  if (r.length === 1) ligadasOk += 1;
}
console.log(`  notas ligadas: ${ligadasOk}/${ligadas.length}`);

// Conferência no banco, não na memória.
const [conf] = await rest(
  'GET',
  'pagamentos?select=count&deleted_at=is.null&observacoes=like.planilha:*',
  undefined,
  { Prefer: 'count=exact' },
);
const [confProto] = await rest(
  'GET',
  'pagamentos?select=count&deleted_at=is.null&observacoes=like.*prototipo pay-*',
);
const [confNotas] = await rest(
  'GET',
  'documentos?select=count&deleted_at=is.null&categoria=eq.nfs_pagamentos&pagamento_id=not.is.null',
);
console.log(
  `\nNo banco agora: ${conf.count} pagamentos da planilha, ${confProto.count} do protótipo vivos, ${confNotas.count} notas ligadas.`,
);
