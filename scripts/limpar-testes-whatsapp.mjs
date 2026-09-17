#!/usr/bin/env node
/**
 * Apaga o que a fase de testes do WhatsApp deixou no CRM, para o número do
 * cliente entrar num banco limpo.
 *
 *   node --env-file=.env.local scripts/limpar-testes-whatsapp.mjs --telefone 5551999999999 [--desde 2026-09-16] [--grupo 1203…@g.us]
 *   … --aplicar                    grava (sem a flag é ensaio)
 *   … --tudo                       apaga também o autorizado e o grupo de teste
 *
 * O que sai, a partir das mensagens do telefone (e do grupo, se dado):
 *   pagamentos criados por elas (apagados de verdade — eram teste), documentos
 *   de origem whatsapp (linha + arquivo no Storage), registros de obra,
 *   pendências, respostas, chamadas de ferramenta da IA, as próprias
 *   mensagens (com a mídia no Storage) e o rastro em webhook_eventos.
 *
 * Só o que nasceu do telefone/grupo de teste: o acervo do OneDrive e os
 * pagamentos das planilhas não têm mensagem por trás e não são tocados.
 */

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const valorDe = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const APLICAR = flag('--aplicar');
const TUDO = flag('--tudo');
const telefone = (valorDe('--telefone') ?? '').replace(/\D/gu, '');
const grupo = valorDe('--grupo');
const desde = valorDe('--desde');

if (!BASE || !KEY) {
  console.error(
    'Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode com --env-file=.env.local',
  );
  process.exit(1);
}
if (!telefone && !grupo) {
  console.error('Diga de quem limpar: --telefone <ddi+ddd+número> e/ou --grupo <id@g.us>.');
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
async function apagarDoStorage(caminhos) {
  const validos = caminhos.filter((c) => c && c !== 'pending');
  if (validos.length === 0) return 0;
  const r = await fetch(`${BASE}/storage/v1/object/documents`, {
    method: 'DELETE',
    headers: H,
    body: JSON.stringify({ prefixes: validos }),
  });
  if (!r.ok) console.log(`  ⚠ storage: HTTP ${r.status} ao apagar ${validos.length} arquivo(s)`);
  return validos.length;
}
const REP = { Prefer: 'return=representation' };

// ---------------------------------------------------------------------------
// O que existe
// ---------------------------------------------------------------------------
// O WhatsApp esconde o nono dígito: "(73) 99848-9747" chega como 557398489747
// (12) e o cadastro tem 5573998489747 (13). As duas formas valem.
function variantes(t) {
  if (!t) return [];
  const m = t.match(/^55(\d{2})(\d{8,9})$/u);
  if (!m) return [t];
  const [, ddd, resto] = m;
  const sem9 = resto.length === 9 && resto.startsWith('9') ? resto.slice(1) : resto;
  return [...new Set([`55${ddd}${sem9}`, `55${ddd}9${sem9}`])];
}
const formas = variantes(telefone);
const filtros = [];
if (telefone) filtros.push(`telefone_from.in.(${formas.join(',')})`);
if (grupo) filtros.push(`chat_id.eq.${encodeURIComponent(grupo)}`);
let q = `mensagens_whats?select=id,msg_id_uazapi,telefone_from,chat_id,pagamento_id,documento_id,registro_id,midia_storage_path,created_at&or=(${filtros.join(',')})`;
if (desde) q += `&created_at=gte.${desde}`;
const msgs = await rest('GET', q);
const ids = msgs.map((m) => m.id);
const inList = (xs) => `(${xs.map((x) => `"${x}"`).join(',')})`;

const pendencias = ids.length
  ? await rest('GET', `confirmacoes_pendentes?select=id,pagamento_id&mensagem_id=in.${inList(ids)}`)
  : [];
const registros = ids.length
  ? await rest('GET', `registros_obra?select=id,midia_storage_path&mensagem_id=in.${inList(ids)}`)
  : [];
const docsIds = [...new Set(msgs.map((m) => m.documento_id).filter(Boolean))];
const docs = docsIds.length
  ? await rest('GET', `documentos?select=id,storage_path,pagamento_id&id=in.${inList(docsIds)}`)
  : [];
const pagIds = [
  ...new Set(
    [
      ...msgs.map((m) => m.pagamento_id),
      ...pendencias.map((p) => p.pagamento_id),
      ...docs.map((d) => d.pagamento_id),
    ].filter(Boolean),
  ),
];
// Documentos que o painel anexou a esses pagamentos de teste também saem.
const docsDosPags = pagIds.length
  ? await rest('GET', `documentos?select=id,storage_path&pagamento_id=in.${inList(pagIds)}`)
  : [];
const todosDocs = [...new Map([...docs, ...docsDosPags].map((d) => [d.id, d])).values()];
const msgIdsProvider = msgs.map((m) => m.msg_id_uazapi).filter(Boolean);
const respostas = msgIdsProvider.length
  ? await rest(
      'GET',
      `whatsapp_respostas?select=msg_id_uazapi&msg_id_uazapi=in.${inList(msgIdsProvider)}`,
    )
  : [];
const toolCalls = ids.length
  ? await rest('GET', `ai_tool_calls?select=id&message_id=in.${inList(ids)}`)
  : [];
const eventosFiltro = [];
for (const f of formas) eventosFiltro.push(`remetente.like.${f}*`);
if (grupo) eventosFiltro.push(`chat_id.eq.${encodeURIComponent(grupo)}`);
const eventos = await rest(
  'GET',
  `webhook_eventos?select=id&or=(${eventosFiltro.join(',')})`,
).catch(() => []);
const autorizado = telefone
  ? await rest(
      'GET',
      `autorizados?select=id,nome&telefone_norm=in.(${formas.join(',')})&deleted_at=is.null`,
    )
  : [];
// Conversas do assistente (perguntas/ações) não viram mensagens_whats: saem
// pelo autorizado e pelo período. Sem --desde, tudo do autorizado.
const conversas =
  autorizado.length > 0
    ? await rest(
        'GET',
        `ai_conversations?select=id&canal=eq.whatsapp&autorizado_id=eq.${autorizado[0].id}${desde ? `&created_at=gte.${desde}` : ''}`,
      ).catch(() => [])
    : [];
const conversaIds = conversas.map((c) => c.id);
const mensagensIA = conversaIds.length
  ? await rest('GET', `ai_messages?select=id&conversation_id=in.${inList(conversaIds)}`)
  : [];
const toolCallsIA = mensagensIA.length
  ? await rest(
      'GET',
      `ai_tool_calls?select=id&message_id=in.${inList(mensagensIA.map((m) => m.id))}`,
    )
  : [];
const grupoRow = grupo
  ? await rest(
      'GET',
      `whatsapp_grupos?select=id,nome&chat_id=eq.${encodeURIComponent(grupo)}&deleted_at=is.null`,
    )
  : [];

console.log(`Mensagens do teste: ${msgs.length}${desde ? ` (desde ${desde})` : ''}`);
console.log(`  pagamentos criados por elas : ${pagIds.length}`);
console.log(`  documentos (whatsapp)       : ${todosDocs.length}`);
console.log(`  registros de obra           : ${registros.length}`);
console.log(`  pendências                  : ${pendencias.length}`);
console.log(`  respostas (dedupe)          : ${respostas.length}`);
console.log(`  chamadas de ferramenta IA   : ${toolCalls.length}`);
console.log(`  eventos do webhook          : ${eventos.length}`);
console.log(`  conversas do assistente     : ${conversas.length}`);
if (TUDO) {
  console.log(`  autorizado a apagar         : ${autorizado.map((a) => a.nome).join(', ') || '—'}`);
  console.log(`  grupo a apagar              : ${grupoRow.map((g) => g.nome).join(', ') || '—'}`);
}

if (!APLICAR) {
  console.log('\nEnsaio: nada foi apagado. Rode com --aplicar para gravar.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Apagar, na ordem que as chaves estrangeiras exigem
// ---------------------------------------------------------------------------
console.log('\n== Apagando ==');
const del = async (tabela, filtro) =>
  (await rest('DELETE', `${tabela}?${filtro}&select=*`, undefined, REP)).length;

if (ids.length) {
  console.log(`  ai_tool_calls: ${await del('ai_tool_calls', `message_id=in.${inList(ids)}`)}`);
  console.log(
    `  confirmacoes_pendentes: ${await del('confirmacoes_pendentes', `mensagem_id=in.${inList(ids)}`)}`,
  );
  // As mensagens apontam para pagamento/documento/registro: desligar antes de apagar os alvos.
  await rest('PATCH', `mensagens_whats?id=in.${inList(ids)}`, {
    pagamento_id: null,
    documento_id: null,
    registro_id: null,
  });
}
if (registros.length) {
  await apagarDoStorage(registros.map((r) => r.midia_storage_path));
  console.log(
    `  registros_obra: ${await del('registros_obra', `id=in.${inList(registros.map((r) => r.id))}`)}`,
  );
}
if (todosDocs.length) {
  console.log(
    `  arquivos no Storage: ${await apagarDoStorage(todosDocs.map((d) => d.storage_path))}`,
  );
  console.log(
    `  documentos: ${await del('documentos', `id=in.${inList(todosDocs.map((d) => d.id))}`)}`,
  );
}
if (pagIds.length) {
  console.log(`  pagamentos: ${await del('pagamentos', `id=in.${inList(pagIds)}`)}`);
}
if (msgIdsProvider.length) {
  console.log(
    `  whatsapp_respostas: ${await del('whatsapp_respostas', `msg_id_uazapi=in.${inList(msgIdsProvider)}`)}`,
  );
}
if (ids.length) {
  await apagarDoStorage(msgs.map((m) => m.midia_storage_path));
  console.log(`  mensagens_whats: ${await del('mensagens_whats', `id=in.${inList(ids)}`)}`);
}
if (eventos.length) {
  console.log(
    `  webhook_eventos: ${await del('webhook_eventos', `id=in.${inList(eventos.map((e) => e.id))}`)}`,
  );
}
if (conversaIds.length) {
  if (toolCallsIA.length) {
    await del('ai_tool_calls', `id=in.${inList(toolCallsIA.map((t) => t.id))}`);
  }
  if (mensagensIA.length) {
    await del('ai_messages', `id=in.${inList(mensagensIA.map((m) => m.id))}`);
  }
  console.log(
    `  ai_conversations: ${await del('ai_conversations', `id=in.${inList(conversaIds)}`)}`,
  );
}
if (TUDO) {
  if (autorizado.length) {
    console.log(
      `  autorizados: ${(await rest('PATCH', `autorizados?id=in.${inList(autorizado.map((a) => a.id))}&select=id`, { deleted_at: new Date().toISOString(), ativo: false }, REP)).length} arquivado(s)`,
    );
  }
  if (grupoRow.length) {
    console.log(
      `  whatsapp_grupos: ${(await rest('PATCH', `whatsapp_grupos?id=in.${inList(grupoRow.map((g) => g.id))}&select=id`, { deleted_at: new Date().toISOString(), ativo: false }, REP)).length} arquivado(s)`,
    );
  }
}

const [resto] = await rest('GET', `mensagens_whats?select=count&or=(${filtros.join(',')})`);
console.log(
  `\nNo banco agora: ${resto.count} mensagem(ns) desse telefone/grupo. O RAG tira o que sumiu na próxima rodada (/api/cron/indexar).`,
);
