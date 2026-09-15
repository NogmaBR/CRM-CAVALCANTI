#!/usr/bin/env node
/**
 * Tira do CRM o que sobrou do protótipo e deixa só o que veio do acervo do
 * cliente (as pastas do OneDrive). Decisão do usuário em 2026-09-15.
 *
 *   node --env-file=.env.local scripts/arquivar-dados-do-prototipo.mjs            # ensaio
 *   node --env-file=.env.local scripts/arquivar-dados-do-prototipo.mjs --aplicar  # grava
 *
 * O que faz (tudo reversível — é soft delete ou update):
 *   1. Arquiva as obras que não têm pasta no acervo (0 documentos, 0
 *      pagamentos): eram do protótipo.
 *   2. Nas obras reais, troca os dados inventados pelo protótipo (cliente,
 *      endereço, orçamento, datas) pelo que os documentos do acervo provam
 *      (alvará, ART, propostas) — e deixa vazio o que nenhum documento diz.
 *      `data_inicio` = primeiro pagamento da planilha quando não há ART.
 *   3. Arquiva fornecedores sem nenhum pagamento nem documento (fictícios) e
 *      limpa telefone/documento/categoria inventados dos que são reais.
 *      O CNPJ volta pelas notas fiscais do próprio fornecedor no acervo
 *      (`scripts/lib/prototipo-core.mjs`). Telefone não: não há fonte segura.
 *   4. Arquiva categorias genéricas do protótipo sem uso (o plano de contas
 *      do cliente já está no lugar).
 *
 * Não mexe em: mensagens/pendências de teste (o usuário pediu para deixar),
 * `public."pagamentos.csv"` (só o usuário apaga).
 */

import { PLANO_DE_CONTAS } from './lib/lancar-pagamentos-core.mjs';
import { CNPJ_CAVALCANTI, RE_CNPJ, cnpjPorFornecedor } from './lib/prototipo-core.mjs';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APLICAR = process.argv.includes('--aplicar');
if (!BASE || !KEY) {
  console.error(
    'Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode com --env-file=.env.local',
  );
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function rest(metodo, caminho, corpo, extra = {}) {
  const r = await fetch(`${BASE}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...H, ...extra },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho} → HTTP ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
const agora = () => new Date().toISOString();
const REP = { Prefer: 'return=representation' };

// ---------------------------------------------------------------------------
// O que os documentos do acervo provam sobre as obras reais. Fonte entre
// parênteses; nada aqui é chute. O que não está provado fica null.
// ---------------------------------------------------------------------------
const FATOS_DAS_OBRAS = {
  'Casa EJ': {
    cliente: 'Carolina Malinski Coelho', // Alvará SEGOV 062/2026 e ART 14088689
    tipo: 'nova', // alvará: "Obra Nova — Residência unifamiliar", 135,09 m²
    endereco: {
      rua: 'Estrada Caminho do Meio',
      numero: '2259',
      bairro: 'Vila Augustina (Cond. Caminho do Verde I, Q-E L-29, acesso 09)',
      cidade: 'Viamão',
      uf: 'RS',
      cep: '94856-060',
    },
    data_inicio: '2025-10-31', // ART: data início
    data_prevista_fim: '2026-10-31', // ART: previsão de fim
    orcamento: null,
    observacoes:
      'Residência unifamiliar, 135,09 m² (Alvará de Construção SEGOV 062/2026, processo 180/2026; ART 14088689). Pasta do acervo: Caminho do Meio E&J. Orçamento contratual não consta nos documentos.',
  },
  Garibaldi: {
    cliente: null,
    tipo: 'reforma', // cronograma: conclusão de prédio (platibandas, reboco, liberação do pavilhão inferior)
    endereco: null,
    data_inicio: '2026-01-14', // primeiro pagamento da planilha
    data_prevista_fim: null,
    orcamento: null,
    observacoes:
      'Conclusão de prédio com pavilhão inferior e apartamentos (Garibaldi - CRONOGRAMA.pdf, Lista de execuções). CNPJ destinatário das notas fiscais: 41.294.917/0001-23. Cliente, endereço e orçamento não constam nos documentos.',
  },
  'INOX Piratini': {
    cliente: 'Inox Piratini', // destinatário das notas, CNPJ 06.747.085/0001-52
    tipo: 'reforma', // vestiário, ar-condicionado, pintura, esquadrias em pavilhão existente
    endereco: { cidade: 'Canoas', uf: 'RS' }, // orçamentos datados em Canoas
    data_inicio: '2025-02-11', // primeiro pagamento da planilha
    data_prevista_fim: null,
    orcamento: null,
    observacoes:
      'Obra por administração (Inox Piratini - Orçamento por administração: prazo de 6 semanas para o vestiário; depois ar-condicionado, elétrica, pintura, cobertura). CNPJ do cliente (destinatário das notas): 06.747.085/0001-52. Orçamento contratual não consta nos documentos.',
  },
  Aguirre: {
    cliente: null,
    tipo: null,
    endereco: null,
    data_inicio: null,
    data_prevista_fim: null,
    orcamento: null,
    observacoes:
      'Proposta de administração de obra com prazo de 14 meses (Aguirre - Proposta Administração de Obra). Ainda sem pagamentos nem notas no acervo.',
  },
};

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------
const obras = await rest(
  'GET',
  'obras?select=id,nome,cliente,tipo,orcamento,endereco,data_inicio,data_prevista_fim,observacoes&deleted_at=is.null&order=nome',
);
const docs = await rest(
  'GET',
  'documentos?select=id,obra_id,fornecedor_id,tipo,texto_extraido&deleted_at=is.null&limit=10000',
);
const pags = await rest(
  'GET',
  'pagamentos?select=id,obra_id,fornecedor_id,categoria_id&deleted_at=is.null&limit=10000',
);
const forns = await rest(
  'GET',
  'fornecedores?select=id,nome,telefone,documento,categoria_id,origem&deleted_at=is.null&order=nome',
);
const cats = await rest('GET', 'categorias?select=id,nome&deleted_at=is.null&order=nome');

const conta = (lista, campo, id) => lista.filter((x) => x[campo] === id).length;

// 1. obras do protótipo = sem documento e sem pagamento
const obrasArquivar = obras.filter(
  (o) => conta(docs, 'obra_id', o.id) === 0 && conta(pags, 'obra_id', o.id) === 0,
);
const obrasReais = obras.filter((o) => !obrasArquivar.includes(o));

// 3. fornecedores
const fornArquivar = forns.filter(
  (f) => conta(pags, 'fornecedor_id', f.id) === 0 && conta(docs, 'fornecedor_id', f.id) === 0,
);
const fornReais = forns.filter((f) => !fornArquivar.includes(f));
const ocorrencias = [];
for (const f of fornReais) {
  const porCnpj = new Map();
  for (const d of docs) {
    if (d.fornecedor_id !== f.id || d.tipo !== 'nota_fiscal' || !d.texto_extraido) continue;
    for (const c of new Set(d.texto_extraido.match(RE_CNPJ) ?? []))
      porCnpj.set(c, (porCnpj.get(c) ?? 0) + 1);
  }
  for (const [cnpj, n] of porCnpj) ocorrencias.push({ fornecedor: f.nome, cnpj, docs: n });
}
const { porFornecedor: cnpjs, compartilhados } = cnpjPorFornecedor(ocorrencias);
const fornLimpar = fornReais.filter(
  (f) => f.telefone || f.documento || f.categoria_id || cnpjs.has(f.nome),
);

// 4. categorias sem pagamento e fora do plano de contas do cliente
const usadas = new Set(pags.map((p) => p.categoria_id));
const PLANO = new Set(PLANO_DE_CONTAS);
const catsArquivar = cats.filter((c) => !usadas.has(c.id) && !PLANO.has(c.nome));

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------
console.log(
  `Obras a arquivar (${obrasArquivar.length}): ${obrasArquivar.map((o) => o.nome).join(', ') || '—'}`,
);
console.log(`Obras reais (${obrasReais.length}): ${obrasReais.map((o) => o.nome).join(', ')}`);
for (const o of obrasReais) {
  const f = FATOS_DAS_OBRAS[o.nome];
  if (!f) {
    console.log(`  ${o.nome}: sem fatos cadastrados — fica como está`);
    continue;
  }
  console.log(
    `  ${o.nome}: cliente "${o.cliente ?? ''}" → "${f.cliente ?? ''}", tipo ${o.tipo} → ${f.tipo}, orçamento ${o.orcamento} → ${f.orcamento}, início ${o.data_inicio} → ${f.data_inicio}`,
  );
}
console.log(
  `\nFornecedores a arquivar (${fornArquivar.length}): ${fornArquivar.map((f) => f.nome).join(', ') || '—'}`,
);
console.log(`CNPJs de destinatário (ignorados): ${compartilhados.join(', ')}`);
console.log(`Fornecedores a limpar/atualizar (${fornLimpar.length}):`);
for (const f of fornLimpar) {
  console.log(
    `  ${f.nome}: tel "${f.telefone ?? ''}"→∅, doc "${f.documento ?? ''}"→"${cnpjs.get(f.nome) ?? ''}", categoria ${f.categoria_id ? 'limpa' : '—'}`,
  );
}
console.log(
  `\nCategorias a arquivar (${catsArquivar.length}): ${catsArquivar.map((c) => c.nome).join(', ') || '—'}`,
);

if (!APLICAR) {
  console.log('\nEnsaio: nada foi escrito. Rode com --aplicar para gravar.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------
console.log('\n== Aplicando ==');
if (obrasArquivar.length) {
  const r = await rest(
    'PATCH',
    `obras?id=in.(${obrasArquivar.map((o) => o.id).join(',')})&deleted_at=is.null&select=id`,
    { status: 'arquivada', deleted_at: agora() },
    REP,
  );
  console.log(`  obras arquivadas: ${r.length}`);
}
for (const o of obrasReais) {
  const f = FATOS_DAS_OBRAS[o.nome];
  if (!f) continue;
  const r = await rest('PATCH', `obras?id=eq.${o.id}&select=id`, f, REP);
  if (r.length !== 1) throw new Error(`obra ${o.nome} não atualizada`);
}
console.log(
  `  obras reais atualizadas: ${obrasReais.filter((o) => FATOS_DAS_OBRAS[o.nome]).length}`,
);

if (fornArquivar.length) {
  const r = await rest(
    'PATCH',
    `fornecedores?id=in.(${fornArquivar.map((f) => f.id).join(',')})&deleted_at=is.null&select=id`,
    { deleted_at: agora(), ativo: false },
    REP,
  );
  console.log(`  fornecedores arquivados: ${r.length}`);
}
let atualizados = 0;
for (const f of fornLimpar) {
  const corpo = {
    telefone: null,
    documento: cnpjs.get(f.nome) ?? null,
    documento_tipo: cnpjs.has(f.nome) ? 'cnpj' : null,
    categoria_id: null,
  };
  const r = await rest('PATCH', `fornecedores?id=eq.${f.id}&select=id`, corpo, REP);
  atualizados += r.length;
}
console.log(`  fornecedores limpos/atualizados: ${atualizados}`);

if (catsArquivar.length) {
  const r = await rest(
    'PATCH',
    `categorias?id=in.(${catsArquivar.map((c) => c.id).join(',')})&deleted_at=is.null&select=id`,
    { deleted_at: agora() },
    REP,
  );
  console.log(`  categorias arquivadas: ${r.length}`);
}

// Conferência no banco
const [o] = await rest('GET', 'obras?select=count&deleted_at=is.null', undefined, {
  Prefer: 'count=exact',
});
const [fo] = await rest('GET', 'fornecedores?select=count&deleted_at=is.null');
const [ft] = await rest('GET', 'fornecedores?select=count&deleted_at=is.null&telefone=not.is.null');
const [c] = await rest('GET', 'categorias?select=count&deleted_at=is.null');
console.log(
  `\nNo banco agora: ${o.count} obras vivas, ${fo.count} fornecedores (${ft.count} com telefone), ${c.count} categorias.`,
);
