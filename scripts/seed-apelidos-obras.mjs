#!/usr/bin/env node
/**
 * Preenche `obras.apelidos` e atualiza `obras.onedrive_folder_id` para a
 * estrutura nova do Drive (`_OBRAS ATIVAS_/<pasta>`).
 *
 * Uso:
 *   node --env-file=.env.local scripts/seed-apelidos-obras.mjs [--ensaio]
 *
 * ## Por que existe
 *
 * Em 2026-09-15 as 10 obras estavam com `apelidos = {}`. É esse campo que
 * o classificador do WhatsApp usa para entender "manda pra Garibaldi" ou
 * "é da EJ" — sem ele, obra só casa pelo nome completo, que ninguém digita
 * no canteiro. E o `onedrive_folder_id` apontava para a convenção antiga
 * (`PAGAMENTOS/<x>/`), com duas obras na mesma pasta.
 *
 * É dado do cliente, por isso não vai em migration: quem muda apelido é o
 * gestor, pela tela de obra. Este script só dá o ponto de partida e **nunca
 * apaga** apelido já cadastrado — faz união.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENSAIO = process.argv.includes('--ensaio');

if (!URL || !KEY) {
  console.error(
    'Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Rode com --env-file=.env.local',
  );
  process.exit(1);
}

/** Chave: `obras.nome` exato em produção. */
const SEED = {
  'Casa EJ': {
    apelidos: ['EJ', 'E&J', 'Caminho do Meio', 'Caminho do meio E&J'],
    pasta: '_OBRAS ATIVAS_/Caminho do meio E&J',
  },
  'Casas Rotterdam': { apelidos: ['Rotterdam', 'K&C', 'KC'], pasta: '_OBRAS ATIVAS_/Rotterdam' },
  FAIHome: { apelidos: ['Faihome', 'FAI'], pasta: '_OBRAS ATIVAS_/Faihome' },
  'G&C Aura Legano': {
    apelidos: ['Aura', 'Legano', 'Aura Legano', 'G&C'],
    pasta: '_OBRAS ATIVAS_/Aura Legano',
  },
  Garibaldi: { apelidos: ['Gari'], pasta: '_OBRAS ATIVAS_/Garibaldi' },
  'INOX Piratini': { apelidos: ['Inox', 'Piratini'], pasta: '_OBRAS ATIVAS_/Inox Piratini' },
  'NSIY 4 Sobrados': {
    apelidos: ['NSIY 4', '4 sobrados', 'sobrados'],
    pasta: '_OBRAS ATIVAS_/NSIY 4 sobrados',
  },
  'NSIY 7 Casas': { apelidos: ['NSIY 7', '7 casas'], pasta: '_OBRAS ATIVAS_/NSIY 7 Casas' },
  'Reservas do Lago': { apelidos: ['Reservas', 'Lago'], pasta: '_OBRAS ATIVAS_/Reservas do Lago' },
  'WRB House': { apelidos: ['WRB'], pasta: '_OBRAS ATIVAS_/WRB' },
  Aguirre: { apelidos: [], pasta: '_OBRAS ATIVAS_/Aguirre' },
};

const cab = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function principal() {
  const r = await fetch(
    `${URL}/rest/v1/obras?select=id,nome,apelidos,onedrive_folder_id&deleted_at=is.null`,
    { headers: cab },
  );
  if (!r.ok) throw new Error(`GET obras → HTTP ${r.status}`);
  const obras = await r.json();

  let mudadas = 0;
  for (const o of obras) {
    const seed = SEED[o.nome];
    if (!seed) {
      console.log(`  (sem seed) ${o.nome}`);
      continue;
    }
    const apelidos = [...new Set([...(o.apelidos ?? []), ...seed.apelidos])];
    const mudouApelidos = apelidos.length !== (o.apelidos ?? []).length;
    const mudouPasta = o.onedrive_folder_id !== seed.pasta;
    if (!mudouApelidos && !mudouPasta) {
      console.log(`  ok        ${o.nome}`);
      continue;
    }
    mudadas += 1;
    console.log(
      `  ${ENSAIO ? 'mudaria ' : 'mudando '} ${o.nome}: apelidos=[${apelidos.join(', ')}] pasta=${seed.pasta}`,
    );
    if (ENSAIO) continue;
    const p = await fetch(`${URL}/rest/v1/obras?id=eq.${o.id}`, {
      method: 'PATCH',
      headers: cab,
      body: JSON.stringify({ apelidos, onedrive_folder_id: seed.pasta }),
    });
    if (!p.ok)
      throw new Error(`PATCH ${o.nome} → HTTP ${p.status}: ${(await p.text()).slice(0, 200)}`);
  }
  const faltam = Object.keys(SEED).filter((n) => !obras.some((o) => o.nome === n));
  if (faltam.length)
    console.log(`  não cadastradas (o importador cria com --criar-obras): ${faltam.join(', ')}`);
  console.log(
    `\n${ENSAIO ? 'Ensaio: ' : ''}${mudadas} obra(s) ${ENSAIO ? 'mudariam' : 'atualizadas'}.`,
  );
}

principal().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
