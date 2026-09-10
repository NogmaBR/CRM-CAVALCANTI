#!/usr/bin/env node
/**
 * Mede a latência entre a função da Vercel e o banco.
 *
 * Uso:
 *   node --env-file=.env.local scripts/medir-latencia.mjs
 *   node --env-file=.env.local scripts/medir-latencia.mjs --amostras=15
 *
 * ## O que ele mede, e por que não é `curl`
 *
 * Cronometrar a requisição de fora mistura três coisas: a sua internet, a rede
 * até a Vercel, e o tempo que a função leva falando com o banco. Só a terceira
 * interessa — é ela que muda quando a região muda.
 *
 * Então o script não cronometra nada: ele **lê o `duracao_ms` que a própria
 * função reporta**, medido lá dentro. É a diferença entre "achei que melhorou"
 * e "melhorou de 394 para X".
 *
 * ## Descarta a primeira
 *
 * A primeira chamada paga cold start e vale o dobro das outras. Incluí-la na
 * mediana faz uma medida honesta parecer ruim.
 *
 * ## Referência
 *
 * Medido em 2026-09-10, com as funções em `iad1` (Virgínia) e o banco em
 * `sa-east-1` (São Paulo): mediana de **394 ms** para uma única consulta.
 * Depois de mover para `gru1`, rode isto de novo.
 */

const BASE = process.env.APP_URL_MEDICAO ?? 'https://crm-cavalcanti.vercel.app';
const SECRET = process.env.CRON_SECRET;

if (!SECRET) {
  console.error('CRON_SECRET não está no ambiente. Rode com --env-file=.env.local');
  process.exit(1);
}

const amostras = Number(process.argv.find((a) => a.startsWith('--amostras='))?.slice(11) ?? 8);

/**
 * `/api/cron/automacoes` com as regras desligadas é, essencialmente, **uma**
 * consulta ao banco. É a medida mais limpa que existe sem instrumentar nada:
 * quase todo o `duracao_ms` é ida e volta.
 */
const ALVO = `${BASE}/api/cron/automacoes`;

const medidas = [];

console.log(`Medindo ${amostras + 1} chamadas a ${ALVO}`);
console.log('(a primeira é descartada: paga cold start)\n');

for (let i = 0; i <= amostras; i++) {
  const r = await fetch(ALVO, { headers: { Authorization: `Bearer ${SECRET}` } });

  if (!r.ok) {
    console.error(`Chamada ${i} devolveu ${r.status}. Abortando.`);
    process.exit(1);
  }

  const corpo = await r.text();
  if (corpo.trimStart().startsWith('<')) {
    console.error('Veio HTML em vez de JSON — o middleware barrou a rota.');
    process.exit(1);
  }

  const j = JSON.parse(corpo);
  const ms = j.duracao_ms;

  if (i === 0) {
    console.log(`  descartada (cold start): ${ms} ms`);
    continue;
  }

  medidas.push(ms);
  console.log(`  ${String(i).padStart(2)}: ${ms} ms`);
}

medidas.sort((a, b) => a - b);
const mediana = medidas[Math.floor(medidas.length / 2)];
const media = Math.round(medidas.reduce((a, b) => a + b, 0) / medidas.length);

console.log('\n─────────────────────────────');
console.log(`mediana : ${mediana} ms`);
console.log(`média   : ${media} ms`);
console.log(`mín/máx : ${medidas[0]} / ${medidas[medidas.length - 1]} ms`);

// A mediana é o número que importa: uma chamada lenta isolada puxa a média e
// não representa o que o usuário sente na maioria das vezes.
const REFERENCIA_IAD1 = 394;

console.log('\nReferência: 394 ms com as funções em iad1 (Virgínia), medido em 2026-09-10.');

if (mediana < REFERENCIA_IAD1 * 0.6) {
  console.log(
    `✓ Melhorou ${Math.round((1 - mediana / REFERENCIA_IAD1) * 100)}% — a região nova está valendo.`,
  );
} else if (mediana > REFERENCIA_IAD1 * 0.9) {
  console.log('⚠ Sem melhora perceptível. Confira se a região foi trocada E se houve redeploy —');
  console.log('  a região só vale para deployments novos.');
} else {
  console.log('~ Melhora parcial. Meça de novo em outro horário antes de concluir.');
}
