#!/usr/bin/env node
/**
 * Diz o que ainda falta para as integrações funcionarem em produção.
 *
 * Uso:
 *   node --env-file=.env.local scripts/checar-integracoes.mjs
 *
 * ## Por que este script existe
 *
 * "Configurei a variável" não é o mesmo que "está valendo". Na Vercel, variável
 * de ambiente só passa a existir para o código depois de um **novo deploy** —
 * e é exatamente aí que se conclui, errado, que a credencial não funcionou.
 *
 * Então este script não pergunta só "a variável existe?". Ele compara a data da
 * última variável alterada com a data do último deploy de produção, e avisa
 * quando há mudança que ainda não entrou em vigor.
 *
 * ## O que ele NUNCA faz
 *
 * Imprimir valor de credencial. Variáveis do tipo `sensitive` nem retornam
 * valor pela API da Vercel; as demais, este script só mostra quando o nome
 * indica que é configuração e não segredo (`IA_PROVIDER`, `UAZAPI_BASE_URL`).
 * Qualquer coisa com KEY, TOKEN ou SECRET no nome aparece como "definida".
 */

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID;
const PROJ = process.env.VERCEL_PROJECT_ID;

if (!TOKEN || !PROJ) {
  console.error('Faltam VERCEL_TOKEN / VERCEL_PROJECT_ID. Rode com --env-file=.env.local');
  process.exit(1);
}

/** Nome que indica segredo — nunca imprime valor. */
function ehSegredo(nome) {
  return /KEY|TOKEN|SECRET|PASSWORD/u.test(nome);
}

/**
 * As integrações, com o que cada variável liga.
 *
 * `esperado` existe para o caso em que a variável estar presente não basta:
 * ter `ANTHROPIC_API_KEY` sem `IA_PROVIDER=anthropic` deixa o classificador em
 * mock — a chave paga, e o sistema continua simulando. É o tipo de meia
 * configuração que passa despercebida justamente porque nada quebra.
 */
const INTEGRACOES = [
  {
    nome: 'WhatsApp (UAZAPI)',
    consequencia:
      'Sem isto o CRM recebe e registra, mas nunca responde — o ciclo de confirmação não fecha.',
    vars: [
      { nome: 'UAZAPI_BASE_URL', obrigatoria: true },
      { nome: 'UAZAPI_TOKEN', obrigatoria: true },
    ],
  },
  {
    nome: 'Classificador de IA (Anthropic)',
    consequencia:
      'Sem isto a extração dos dados da nota é simulada — o fluxo funciona, os valores não são reais.',
    vars: [
      { nome: 'IA_PROVIDER', obrigatoria: true, esperado: 'anthropic', padrao: 'mock' },
      { nome: 'ANTHROPIC_API_KEY', obrigatoria: true },
      { nome: 'IA_MODEL', obrigatoria: false, padrao: 'claude-opus-5' },
    ],
  },
  {
    nome: 'Transcrição de áudio (OpenAI)',
    consequencia:
      'Sem isto o áudio é gravado e vira pendência para alguém ouvir no painel, em vez de virar texto.',
    vars: [
      { nome: 'IA_TRANSCRICAO_PROVIDER', obrigatoria: true, esperado: 'openai', padrao: 'none' },
      { nome: 'OPENAI_API_KEY', obrigatoria: true },
      { nome: 'OPENAI_TRANSCRICAO_MODEL', obrigatoria: false, padrao: 'whisper-1' },
    ],
  },
  {
    nome: 'Base (já configurado)',
    consequencia: 'É o que faz o sistema subir.',
    vars: [
      { nome: 'NEXT_PUBLIC_SUPABASE_URL', obrigatoria: true },
      { nome: 'SUPABASE_SERVICE_ROLE_KEY', obrigatoria: true },
      { nome: 'CRON_SECRET', obrigatoria: true },
      { nome: 'WEBHOOK_HMAC_SECRET', obrigatoria: true },
    ],
  },
];

async function api(caminho) {
  const sep = caminho.includes('?') ? '&' : '?';
  const url = `https://api.vercel.com${caminho}${TEAM ? `${sep}teamId=${TEAM}` : ''}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) {
    console.error(`Vercel devolveu ${r.status} em ${caminho}`);
    process.exit(1);
  }
  return r.json();
}

const { envs } = await api(`/v10/projects/${PROJ}/env`);
const producao = envs.filter((e) => e.target?.includes('production'));
const porNome = new Map(producao.map((e) => [e.key, e]));

let faltando = 0;
let meiaBoca = 0;

for (const integracao of INTEGRACOES) {
  const linhas = [];
  let problema = false;

  for (const v of integracao.vars) {
    const e = porNome.get(v.nome);

    if (!e) {
      if (v.obrigatoria) {
        linhas.push(
          `  ✗ ${v.nome.padEnd(28)} AUSENTE${v.padrao ? ` (o código assume "${v.padrao}")` : ''}`,
        );
        problema = true;
        faltando++;
      } else {
        linhas.push(`  · ${v.nome.padEnd(28)} não definida — usa o padrão "${v.padrao}"`);
      }
      continue;
    }

    // `sensitive` nunca retorna valor; `plain` retorna. Só mostramos o valor
    // quando o nome não indica segredo.
    const mostravel = e.type !== 'sensitive' && !ehSegredo(v.nome) && e.value != null;
    const valor = mostravel ? e.value : '(definida)';

    if (v.esperado && mostravel && e.value !== v.esperado) {
      linhas.push(
        `  ⚠ ${v.nome.padEnd(28)} "${e.value}" — precisa ser "${v.esperado}" para ligar de verdade`,
      );
      problema = true;
      meiaBoca++;
    } else {
      linhas.push(`  ✓ ${v.nome.padEnd(28)} ${valor}`);
    }
  }

  console.log(`\n${problema ? '✗' : '✓'} ${integracao.nome}`);
  for (const l of linhas) console.log(l);
  if (problema) console.log(`     ${integracao.consequencia}`);
}

// ---------------------------------------------------------------------------
// A armadilha do redeploy
// ---------------------------------------------------------------------------
const ultimaMudanca = producao.reduce(
  (max, e) => Math.max(max, e.updatedAt ?? e.createdAt ?? 0),
  0,
);
const { deployments } = await api(
  `/v6/deployments?projectId=${PROJ}&target=production&limit=1&state=READY`,
);
const ultimoDeploy = deployments?.[0]?.created ?? 0;

console.log('\n─────────────────────────────────────────────');
console.log(
  `Última variável alterada : ${new Date(ultimaMudanca).toISOString().slice(0, 16).replace('T', ' ')}`,
);
console.log(
  `Último deploy de produção: ${new Date(ultimoDeploy).toISOString().slice(0, 16).replace('T', ' ')}`,
);

if (ultimaMudanca > ultimoDeploy) {
  console.log('\n⚠  HÁ VARIÁVEL ALTERADA DEPOIS DO ÚLTIMO DEPLOY.');
  console.log('   Ela ainda NÃO está valendo em produção. Faça um redeploy:');
  console.log('   Vercel → Deployments → (o do topo) → ⋯ → Redeploy');
  console.log('   Desmarque "Use existing Build Cache".');
} else {
  console.log('\n✓  O deploy em produção é mais novo que a última variável — tudo em vigor.');
}

if (faltando > 0 || meiaBoca > 0) {
  console.log(
    `\n${faltando} variável(is) obrigatória(s) ausente(s), ${meiaBoca} definida(s) mas sem efeito.`,
  );
  process.exit(1);
}
console.log('\nTodas as integrações configuradas.');
