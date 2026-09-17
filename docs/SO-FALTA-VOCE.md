# Só falta você

> **Tudo que não dá para eu fazer.** Um arquivo só, na ordem certa.
>
> Estado verificado em **2026-09-10, 20h**. Cada item diz o que fazer, onde, e
> **como conferir que deu certo** — porque "salvo com sucesso" não é prova de nada.
>
> Este documento substitui `MANUAL-PENDENCIAS.md` (08/09, desatualizado).

---

## O mapa em uma tela

```
JÁ FEITO (não precisa mexer)
  ✅ Banco populado: 10 obras, 8 fornecedores, 80 pagamentos (R$ 453.500,00)
  ✅ Motor de automações + painel /config/automacoes
  ✅ Filas pgmq + consumidor + dead-letter + painel /config/filas
  ✅ Base de conhecimento, busca vetorial, assistente (textos criados)
  ✅ /api/health + alerta por WhatsApp quando algo para (Fase 5.1)
  ✅ Backup semanal cifrado para fora do Supabase — provado (Fase 5.0)
  ✅ CI verde em todo PR (Fase 5.3)
  ✅ Log estruturado com id de correlação (Fase 5.2)

SÓ FALTA VOCÊ
  🔴 1. Telefones reais dos fornecedores        ← antes de qualquer automação
  🔴 2. Credenciais (UAZAPI, Anthropic, OpenAI) + redeploy
  🔴 3. Webhook da UAZAPI + cadastrar a equipe em /config/autorizados
  🟠 4. Mergear o PR #22 (time gstack; #20 e #21 já mergeados) + limpezas que só você faz
  🟠 5. Vercel Pro → um comando faz o resto (região + repo privado)
  🟠 6. Backup: restore de teste + guardar a frase + PITR
  🟡 7. Domínio próprio + Cloudflare
  🟡 8. Indexar a base de conhecimento (embeddings)
  🟡 9. Ligar as automações, com cuidado
  ✅ 10. PR #7 fechado em 16/09 (já estava na main pelo #19); FILA_WHATSAPP fica desligada até o número oficial
  🔵 11. Decisão: Fase 6 (vendas) — o que preciso de você para começar
  ⏳ 12. Depois de 16/09: acervo do OneDrive + agente no grupo (PR da branch feat/acervo-onedrive-e-agente-grupo)
  🔴 15. Agente sobre o CRM inteiro (17/09): mergear o PR #40, aplicar 1 migration, testar 11–19 no grupo
  🟠 16. Textos claros (#41) e painel do empresário (#42): mergear na ordem, conferir a tabela da §16

PARA O DIA 16
  📋 docs/ROTEIRO-DEMO-16-09.md — o que mostrar, em que ordem, e a versão B sem WhatsApp
```

---

# 🔴 1. Telefones reais dos fornecedores

**Por que é o primeiro:** os telefones que vieram do protótipo são **falsos**. São
sequenciais — `(51) 99812-0001`, `(51) 99734-0002`, até `-0007`. Os CNPJs também
(`12.345.678`, `23.456.789`, …).

Se você ligar a automação de cobrança com eles, o sistema manda WhatsApp para números
que não existem ou pertencem a estranhos. **Nada mais nesta lista importa se este item
não for feito.**

### Como fazer

1. Entre em <https://crm-cavalcanti.vercel.app/fornecedores>
2. Para cada um dos 8, clique em editar e troque **telefone** e **documento** pelos reais
3. Os nomes das obras e dos fornecedores **estão corretos** — não precisa mexer

### Como conferir

No SQL Editor do Supabase:

```sql
SELECT nome, telefone, documento
FROM fornecedores WHERE deleted_at IS NULL ORDER BY nome;
```

Nenhum telefone pode terminar em `-0001` a `-0007`.

---

# 🔴 2. Credenciais + redeploy

Faltam **7 variáveis**, em pares. O par importa: definir só a chave não liga nada, e a
chave passa a ser cobrada à toa.

| Integração | Variáveis | Sem isso |
|---|---|---|
| **WhatsApp** | `UAZAPI_BASE_URL` · `UAZAPI_TOKEN` | O CRM recebe e registra, mas **nunca responde** |
| **Classificador** | `IA_PROVIDER=openai` · `OPENAI_API_KEY` (**já na Vercel**, 15/09) | A extração da nota é simulada |
| **Transcrição** | `IA_TRANSCRICAO_PROVIDER=openai` · `OPENAI_API_KEY` | Áudio vira pendência para alguém ouvir |
| **Busca (RAG)** | `IA_EMBEDDINGS_PROVIDER=openai` | Perguntas livres não funcionam |

`IA_EMBEDDINGS_PROVIDER` reaproveita a mesma `OPENAI_API_KEY` da transcrição.

### Como fazer

1. <https://vercel.com/nogma1/crm-cavalcanti/settings/environment-variables>
2. **Add New** para cada uma. Marque **Production**.
3. Marque **Sensitive** só nas três chaves (`UAZAPI_TOKEN`, `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY`). As outras são configuração, não segredo.

> **Não defina `IA_AUTO_APROVAR=true`.** O padrão é `false` e é decisão de produto: o
> briefing define a confirmação do remetente como parte do fluxo.

### 2.1 — O redeploy, que todo mundo esquece

**Variável na Vercel só vale depois de um deploy novo.**

1. <https://vercel.com/nogma1/crm-cavalcanti/deployments>
2. No do topo → **⋯** → **Redeploy**
3. **Desmarque** "Use existing Build Cache"

### Como conferir

```bash
node --env-file=.env.local scripts/checar-integracoes.mjs
```

Tem que sair **sem nenhum ✗** e dizer que o deploy é mais novo que a última variável.

---

# 🔴 3. Webhook da UAZAPI + equipe autorizada

### 3.1 — Apontar o webhook

No painel da UAZAPI:

| Campo | Valor |
|---|---|
| URL | `https://crm-cavalcanti.vercel.app/api/webhooks/uazapi` |
| Método | `POST` |
| Header | `x-signature: <HMAC-SHA256 do corpo cru, chave = WEBHOOK_HMAC_SECRET>` |

> ⚠️ **Este é o risco que não consigo resolver daqui.** O CRM exige assinatura HMAC e
> devolve **401** sem ela. Se a UAZAPI não oferecer assinatura com segredo próprio, o
> webhook nunca passa — e isso precisa de decisão nossa. **Descubra antes do dia 16.**

O `WEBHOOK_HMAC_SECRET` já existe em produção e está no `.env.local`. Não gere outro.

### 3.2 — Cadastrar a equipe

**Hoje há zero autorizados.** Com a lista vazia o sistema **ignora toda mensagem**. É a
trava segura — mas por fora parece "o WhatsApp não funciona".

1. <https://crm-cavalcanti.vercel.app/config/autorizados>
2. Adicione cada pessoa: nome, telefone **com DDD**, função na obra
3. O número precisa ser o **mesmo** de onde a pessoa vai mandar mensagem

### Como conferir — o teste que vale

```bash
node --env-file=.env.local scripts/test-webhook-uazapi.mjs text-simples --url https://crm-cavalcanti.vercel.app
```

Espera-se `200`. Se vier `401`, a assinatura não bateu.

**Depois disso, o teste de verdade:** do celular de alguém cadastrado, mande uma foto de
nota fiscal. O bot deve perguntar se confirma. Responda `SIM`. O lançamento tem que
aparecer em `/pagamentos` sem ninguém tocar no painel.

**Para seguir o rastro no log:** Vercel → projeto → Logs → filtre por
`correlacao:<id da mensagem>` ou `area:inbound`. Cada linha é JSON; a mesma mensagem
aparece do webhook até a resposta com o mesmo `correlacao`.

---

# 🟠 4. Mergear o PR #20 + 5 limpezas que só você faz

Os PRs #13 a #17 estão mergeados e **auditados**: deploy READY, CI verde na `main`,
`/api/health` com `problemas: []`, rotas, crons, filas, RLS, advisors do Supabase de 11
para 5 (os 5 restantes são intencionais ou exigem plano Pro). Com o #17, o assistente
funciona **sem** os embeddings do item 8: basta a `ANTHROPIC_API_KEY` do item 2.

### 4.0a — PR #22: o time virtual gstack (CEO, designer, engenharia, QA, release)

<https://github.com/NogmaBR/CRM-CAVALCANTI/pull/22> — o gstack do Garry Tan foi instalado
em `~/.claude/skills/gstack` e cinco personas revisaram o projeto inteiro. Relatórios em
`docs/gstack/`, backlog consolidado em `TODOS.md`. O que o PR muda para quem usa:

- **A IA passa a enxergar a foto da nota** (`IA_PROVIDER=anthropic`). Era o achado mais
  grave: o classificador real recebia só texto; uma foto sem legenda terminava em "o
  gestor vai revisar". Só vale quando a `ANTHROPIC_API_KEY` do item 2 existir.
- **Demo de 16/09 sem a chave: use texto, não foto.** Com o mock, qualquer imagem vira
  "documento" sem valor.
- 3 bugs corrigidos pelo QA (busca de pagamentos por obra/fornecedor/categoria,
  contagem "50" que era o teto da consulta, contraste do tema claro) e 22 ajustes do
  designer (login sem números inventados, "Pagamentos" no menu, badges legíveis, alvos
  de toque, cartão mobile com o valor primeiro).

Sem migration. 278 testes, typecheck, lint e build limpos. **Pode mergear.**

Duas coisas que o classificador me barrou e só você faz, no terminal do Claude Code
(prefixo `!`):

```bash
! cd ~/.claude/skills/gstack && ./setup            # registra as skills /qa, /ship, /review…
! cd ~/.claude/skills/gstack && ./setup --team && ~/.claude/skills/gstack/bin/gstack-team-init optional
```

E reiniciar o servidor local, que está com o worker do PostCSS morto desde 12/09:
`pnpm --filter web dev` (Ctrl+C no antigo antes).

### 4.0 — PR #20: revisão de front-end (mergeado em 2026-09-12)

<https://github.com/NogmaBR/CRM-CAVALCANTI/pull/20> — auditoria visual com screenshot
de cada tela em 1440px e 390px, nos três temas, e correção de tudo o que apareceu. O
plano completo, item a item, está em `docs/PLANO-FRONTEND-PREMIUM.md`. O que muda para
quem usa:

- **Celular funciona de verdade**: o botão "Nova Obra"/"Editar"/"Arquivar" sumia abaixo
  de 900px; agora fica numa linha abaixo do título. Tabelas viram cartões. Barra
  inferior com Painel, Obras, Pagamentos, Pendentes e Menu.
- **Desktop tem menu visível**: trilho de ícones que expande quando o mouse passa e
  recolhe quando sai (o pedido do briefing continua valendo).
- **Busca e sino funcionam**: `⌘K`/`Ctrl K` abre a busca (obras, fornecedores,
  pagamentos, atalhos); o sino mostra quantas confirmações esperam.
- **Painel**: cartões de KPI sem texto duplicado, gráficos na cor do tema (azul
  Cavalcanti no claro, lime no escuro), saudação por hora de Brasília.
- **Marca**: sidebar azul-marinho do cliente no tema claro; preto/petróleo nos escuros.
- Acentos corrigidos em dezenas de rótulos, 404 e erro em português com a cara do app,
  login empilhado no celular, formulários com controles do mesmo tamanho.

Sem migration, sem mudança de banco. 274 testes, typecheck, lint e build limpos; CI
verde no PR. **Mergeado.** Abra o app no celular e no desktop e troque o tema pelo
botão do topo — é o que o cliente vai ver.

### 4.0b — PR #21: revisão do banco (mergeado em 2026-09-12)

<https://github.com/NogmaBR/CRM-CAVALCANTI/pull/21> — inventário real do banco + dois
revisores. A migration **já está aplicada e conferida** (policies otimizadas, privilégios
reduzidos, auditoria ampliada, manutenção agendada, áudio do WhatsApp aceito no bucket).
O PR traz o código que acompanha: pendência sem "sucesso falso", automação que não perde
a configuração ao ligar/desligar, painel em Brasília. Achados e próximos passos em
`docs/PLANO-BANCO-PREMIUM.md`. **Mergeado.**

Três limpezas que só você faz, no SQL Editor da Supabase (o classificador me barra de
apagar tabela):

```sql
DROP TABLE public."pagamentos.csv";          -- lixo do import manual, sem policy
DROP TABLE public.notificacoes_email;        -- zero referências no código
DROP TABLE public.lembretes_agendados;       -- ideia substituída pelo pg_cron
```

E, no painel Auth → Settings, ligar **"Leaked password protection"** (HIBP) quando o
projeto for Pro.

### 4.1 — PR #19: a revisão geral (mergeado em 2026-09-12)

<https://github.com/NogmaBR/CRM-CAVALCANTI/pull/19> — três revisores independentes
(segurança, corretude, qualidade) leram o repositório inteiro depois do merge das Fases
1–5. **30 achados corrigidos**, cada um confirmado no código antes de mexer. Os que
importam:

- **Usuário arquivado continuava entrando com o papel inteiro.** Agora é banido no
  Auth e a RLS exige `deleted_at` nulo.
- **Retry do WhatsApp abria duas pendências** e perguntava duas vezes. A produção **já
  tinha** uma duplicata (mensagem de teste de 07/09) — a migration encerrou.
- **O classificador simulado lia "1200" como R$ 120.** É o de produção hoje e o da
  demo. Corrigido e pinado em teste.
- **"sim?" e "sim 👎" confirmavam pagamento.** Não confirmam mais.
- **"Hoje" era em UTC**: pagamento das 22h ganhava a data de amanhã. Agora é Brasília.
- Cobrança: telefone sem normalizar, re-cobrança diária, pagamentos novos nunca
  alcançados. PDF de fechamento somava recusado/erro. Fila com timeout menor que o
  processamento. Download de mídia sem guarda SSRF. `anon` com privilégios em toda
  tabela. E mais 20 menores.

**Já apliquei e conferi a migration em produção**: `/api/health` 200, `/login` 200,
webhook 200. 274 testes, typecheck, lint e build limpos; CI verde no PR. **Mergeado
em 2026-09-12 às 11:04**, deploy READY conferido.

O que a revisão **não** conseguiu provar: o banimento de usuário arquivado com um
usuário real (só existe um em produção) e o fluxo do WhatsApp com provider real.

### 4.1b — Apagar as 3 mensagens de teste de 07/09

Sobrou da Fase 1: três mensagens de teste em `/pendentes` (`Paguei R$ 1.250,00 na
Casa das Tintas…`, `NF do cimento — obra Beta`, e uma vazia), com 3 confirmações
abertas. Vão aparecer na demo. Recuse as três na tela
<https://crm-cavalcanti.vercel.app/pendentes> (botão **Rejeitar**), ou no SQL Editor:

```sql
DELETE FROM confirmacoes_pendentes WHERE mensagem_id IN (SELECT id FROM mensagens_whats WHERE created_at < '2026-09-08');
DELETE FROM mensagens_whats WHERE created_at < '2026-09-08';
```

### 4.2 — Apagar a tabela `pagamentos.csv`

Quando você importou o CSV pelo painel do Supabase, ele criou uma **tabela** chamada
`pagamentos.csv` (80 linhas, tudo `text`, sem chave primária). Os pagamentos de verdade
estão em `pagamentos`; essa é uma cópia crua que só polui. Não apaguei porque não fui eu
que criei — mas ela está no backup de 19:27, então é recuperável.

No SQL Editor:

```sql
DROP TABLE public."pagamentos.csv";
```

### 4.3 — Remover 2 variáveis que a Vercel não usa

`SUPABASE_DB_URL` e `SUPABASE_JWT_SECRET` estão em produção na Vercel e **nenhum código
do app as lê** (conferido por `grep`). A primeira contém a senha do banco. Segredo que
não é usado é só superfície de ataque.

<https://vercel.com/nogma1/crm-cavalcanti/settings/environment-variables> → nas duas,
**⋯ → Remove**. Não precisa de redeploy. Os valores continuam no `.env.local`.

### 4.4 — Apagar as branches já mergeadas

13 branches de PRs mergeados ou fechados continuam no GitHub. O classificador me
barrou de apagá-las. Ative a limpeza automática e apague as atuais de uma vez:

```bash
gh repo edit NogmaBR/CRM-CAVALCANTI --delete-branch-on-merge
git push origin --delete feat/scripts-operacao ci/verde feat/fase5-logs-estruturados feat/fase5-saude fix/indexador-lote feat/rag-fase4 feat/fila-corte-webhook feat/fila-pgmq feat/painel-automacoes feat/motor-automacoes feat/alinhamento-cavalcanti-16-09 dependabot/npm_and_yarn/vitest-4.1.11 dependabot/npm_and_yarn/apps/web/next-15.5.21 dependabot/npm_and_yarn/next-15.5.21
```

**Não apague `feat/emitir-eventos`** (PR #7, item 10).

### 4.5 — Proteção contra senha vazada (Supabase Pro)

O advisor pede `auth_leaked_password_protection`. A API respondeu **402: só no plano
Pro**. Se o Supabase virar Pro (junto com o PITR do item 6.3), ligue em Authentication →
Settings → *Leaked password protection*.

### Como conferir

```bash
node --env-file=.env.local -e "fetch('https://crm-cavalcanti.vercel.app/api/health',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.json()).then(j=>console.log(j.ok, j.problemas))"
```

Tem que dar `true []`.

---

# 🟠 5. Vercel Pro → um comando faz o resto

**Você faz o upgrade** (é billing): <https://vercel.com/nogma1/~/settings/billing>
→ **Pro**. O motivo real não é recurso: o plano Hobby **não permite uso comercial**, e
este CRM é entregue a cliente pagante.

**Depois, um comando** (precisa do PR #15 mergeado, ou rode da branch
`feat/scripts-operacao`):

```bash
node --env-file=.env.local scripts/pos-vercel-pro.mjs --repo-privado
```

Ele troca a região das funções para São Paulo, redeploya, espera ficar pronto, confere
a região no deployment, mede a latência contra os 394 ms de hoje, e torna o
repositório privado. Se a Vercel recusar a região, ele diz que o plano ainda é Hobby e
não mexe em nada.

### Como conferir

O próprio script imprime. Espere:

```
✓ Região gravada no projeto: gru1
✓ Deploy READY em ["gru1"]
mediana: <bem abaixo de 394> ms
✓ Repositório PRIVATE (conferido pelo gh)
```

**Depois de virar privado, faça um commit qualquer na `main` e veja se a Vercel
constrói.** Se não construir, é a permissão do GitHub App em Settings → Git.

O passo a passo manual está em `docs/RUNBOOK-VERCEL-PRO.md`, como plano B.

---

# 🟠 6. Backup — o que ainda é seu

O backup semanal **existe e foi provado** (`docs/RUNBOOK-BACKUP.md`): `pg_dump` toda
madrugada de domingo, cifrado, guardado 90 dias no GitHub. Baixei o primeiro, decifrei
com a frase do `.env.local` e as contagens bateram com a produção (10 / 8 / 80 /
R$ 453.500,00).

Três coisas continuam sendo suas:

### 6.1 — Guardar a frase da cifra

`BACKUP_PASSPHRASE` está no `.env.local` desta máquina e no secret do GitHub (que não
pode ser lido de volta). **Copie para o gerenciador de senhas da Nogma.** Quem perder
os dois perde todos os backups.

### 6.2 — Um restore de teste

Backup que nunca restaurou é hipótese. O runbook tem o passo a passo: projeto
descartável no Supabase, migrations, `pg_restore`, conferir contagens, apagar o
projeto, **registrar na tabela do runbook**. Precisa do cliente do PostgreSQL 17
instalado (não tem nesta máquina) ou de Docker.

### 6.3 — PITR

<https://supabase.com/dashboard/project/bbtejxugeeccywwhfpoc/database/backups> — veja
o que existe. PITR (voltar para "5 minutos antes do erro") exige Supabase Pro. É
decisão de custo; o dump semanal cobre a perda do fornecedor, não o erro de ontem.

---

# 🟡 7. Domínio próprio + Cloudflare

Hoje o app vive em `crm-cavalcanti.vercel.app`. A FASE 0 decidiu DNS na Cloudflare
com domínio próprio. Faltam duas coisas que só você tem: **qual domínio** e **a conta
da Cloudflare**.

### O que é um comando

Trocar o domínio mexe em cinco lugares (Vercel, variável de ambiente, Supabase Auth,
Vault do banco, redeploy). Esquecer o Vault faz a fila parar de ser drenada **sem
nenhum erro**. O script faz os cinco:

```bash
# Ensaio (não muda nada):
node --env-file=.env.local scripts/configurar-dominio.mjs --dominio=crm.seudominio.com.br
# Para valer:
node --env-file=.env.local scripts/configurar-dominio.mjs --dominio=crm.seudominio.com.br --aplicar
```

### O que é seu

O script imprime no fim, com os valores exatos:

- **A.** O registro DNS na Cloudflare (CNAME → `cname.vercel-dns.com`, proxy ligado,
  SSL "Full (strict)")
- **B.** A regra de WAF: rate limit de 60 req/min por IP em `/api/webhooks/uazapi`
- **C.** Trocar a URL do webhook no painel da UAZAPI para o domínio novo

### Como conferir

Rode o script de novo sem `--aplicar`: ele diz se a Vercel já verificou o domínio.
Depois, `scripts/checar-integracoes.mjs` e uma mensagem de teste no WhatsApp.

---

# 🟡 8. Indexar a base de conhecimento

Só depois das credenciais do item 2 (precisa da `OPENAI_API_KEY`).

Os **98 textos já estão criados**. Falta gerar os embeddings:

```bash
node --env-file=.env.local -e "fetch('https://crm-cavalcanti.vercel.app/api/cron/indexar',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.text()).then(console.log)"
```

A partir daí o `pg_cron` mantém em dia sozinho, de hora em hora, e só gasta no que mudou.

### Como conferir

```sql
SELECT count(*) AS documentos,
       count(*) FILTER (WHERE indexado_em IS NOT NULL) AS com_embedding
FROM knowledge_documents WHERE deleted_at IS NULL;
```

Depois, mande no WhatsApp: **"quanto gastei na obra Garibaldi?"**

---

# 🟡 9. Ligar as automações

Tela: <https://crm-cavalcanti.vercel.app/config/automacoes>

### 9.1 — Comece pela inócua

**"Registra alerta quando o gasto passa do limiar"** — só escreve no histórico. Clique
em **Ligar**, depois em **Ensaiar sem agir**.

> O consumo real das obras está entre **4,4% e 9,3%**, e o limiar é 80%. Ela vai
> registrar "Não se aplicava" em todas — **corretamente**. Para mostrar na demo, baixe o
> limiar para 5. É legítimo, mas é um alarme fabricado; vale dizer isso ao Fernando.

### 9.2 — A cobrança, só depois do item 1

> 🔴 Há **80 pagamentos sem documento**, todos com mais de 7 dias. Ligar a cobrança sem
> cuidado dispara 25 mensagens por dia até esgotar os 80 — para os telefones do item 1.

**Antes de ligar**, ponha o freio de mão nos parâmetros:

```json
{"dias_sem_documento": 7, "limite_por_rodada": 3}
```

Depois **Ligar** → **Ensaiar sem agir** → leia o histórico inteiro antes de deixar rodar.

### Para desligar tudo, rápido

Botão **Desligar** em cada regra. Ou: `UPDATE automation_rules SET ativo = false;`

---

# ⏳ 10. Depois de 16/09

Nada aqui antes da entrega.

1. **Mergear o PR #7** — o barramento de eventos ganha chamadores.
   <https://github.com/NogmaBR/CRM-CAVALCANTI/pull/7>. Em 2026-09-10 eu trouxe a
   `main` para dentro dele (um conflito de import, resolvido): typecheck e 240 testes
   passam com o código de hoje, e o CI roda nele.
2. **Criar `FILA_WHATSAPP=true`** na Vercel + redeploy. O webhook passa a só enfileirar.
3. Conferir em <https://crm-cavalcanti.vercel.app/config/filas> que os jobs são drenados.

---

# 🔵 11. Decisão: Fase 6 (vendas) — o que preciso de você

**O plano está escrito: `docs/PLANO-FASE-6.md`.** E ele mudou, por um fato que estava
no alinhamento de 16/09 e ninguém tinha ligado à Fase 6: **a Cavalcanti já tem um CRM de
vendas** — o ERP/CRM005, com 34 vendedores, 2.955 clientes, agenda, ocorrências e
inadimplência. Construir leads/propostas/contratos aqui criaria um segundo sistema de
verdade para vendedores que já trabalham no primeiro.

O plano novo recomenda **espelhar o ERP pelo WhatsApp** (agenda do dia no celular do
vendedor, inadimplência da carteira, escrita com confirmação SIM) em 4–6 semanas, e
deixar o funil próprio só para leads que o ERP não captura. Cada marco termina no
WhatsApp de alguém, não numa tabela.

**Nada disso entra em código antes de 16/09.** Para o dia 17 começar, preciso de você:

1. **O caminho:** A (funil próprio), B (espelho do ERP) ou C (B primeiro, funil
   depois). Minha recomendação é C.
2. **As respostas do parceiro do ERP** que estão abertas desde 09/09 (Bloco A.2 do
   alinhamento): os 9 funcionários sem login, a legenda de `Funcao`, e — o bloqueador
   de verdade — **HTTPS ou liberação de IP** para produção.
3. **A credencial e a URL de produção do ERP** no `.env.local`.
4. **Quem recebe o quê no WhatsApp:** agenda para o vendedor, inadimplência para o
   gestor, ou tudo para o Fernando?
5. **O que se vende** (unidades, lotes, casas, contrato) — pode esperar até o marco 3.

Sem o item 2 não há marco 1. Com ele, o marco 1 começa no dia 17 e o vendedor recebe a
agenda no WhatsApp na terceira semana.

---

## Checklist final

Marque só o que você **conferiu**, não o que fez.

- [ ] Nenhum telefone de fornecedor terminando em `-000N`
- [ ] `scripts/checar-integracoes.mjs` sem nenhum ✗
- [ ] `test-webhook-uazapi.mjs` devolvendo 200
- [ ] Equipe em `/config/autorizados`, com os números certos
- [ ] **Foto de nota → bot pergunta → "SIM" → lançamento no painel**
- [ ] PR #17 mergeado; 3 mensagens de teste apagadas; `pagamentos.csv` apagada; 2 variáveis removidas da Vercel; branches limpas
- [ ] Vercel Pro; `pos-vercel-pro.mjs` mostrando `gru1` e latência menor
- [ ] Repositório PRIVATE e um deploy novo saiu depois disso
- [ ] `BACKUP_PASSPHRASE` no gerenciador de senhas
- [ ] Restore de teste registrado em `docs/RUNBOOK-BACKUP.md`
- [ ] Base indexada; "quanto gastei na obra X?" respondido com fonte
- [ ] `orcamento-em-risco` ligada, com histórico aparecendo
- [ ] `cobrar-documento-fornecedor` só depois do item 1

---

# ⏳ 12. Depois de 16/09 — acervo do OneDrive e agente no grupo

**O que é:** a branch `feat/acervo-onedrive-e-agente-grupo` (spec em
`docs/superpowers/specs/2026-09-15-acervo-onedrive-e-agente-grupo-design.md`) traz o
acervo do OneDrive para dentro do CRM (pastas por obra, texto pesquisável, notas
conciliadas com os 80 pagamentos "sem documento") e faz o agente funcionar no **grupo**
com o Cavalcanti e o gerente: foto/PDF vira arquivo na pasta da obra, áudio vira diário,
pagamento continua com o "SIM".

**Nada disso toca produção antes da demo.** A ordem, na quarta à tarde:

> **Atualização 2026-09-15 (noite):** os ZIPs já estão em
> `C:\Users\User\Downloads\OBRAS ATIVAS CAVALCANTI` (um por obra: Aguirre,
> Caminho do Meio E&J, Garibaldi, Inox Piratini — 329 arquivos, ~1,1 GB, TUDO
> entra: vídeo, DWG, planilha). E a IA passou a ser **100% OpenAI** (chave já no
> `.env.local` e na Vercel). Os passos 12.2–12.4 viraram **um comando**, que o
> Claude Code não pode rodar (escrita de configuração em produção). Rode no
> prompt com `!`:
>
> ```
> ! node --env-file=.env.local scripts/preparar-acervo.mjs "C:\Users\User\Downloads\OBRAS ATIVAS CAVALCANTI"
> ```
>
> Ele sobe o limite do bucket ao máximo do plano e libera todos os tipos, aplica
> a migration (confere o catálogo), grava os apelidos e importa os 329 arquivos
> (cria a Aguirre). Arquivo acima do teto do plano do Supabase aparece numa lista
> "Não subiram" no fim — é o único caso em que algo fica de fora, e é do plano,
> não do código. Com `--ensaio` no fim só mostra o plano. Depois do merge do
> PR #28: `node --env-file=.env.local scripts/configurar-ia-vercel.mjs
> --com-provider --redeploy` liga o classificador OpenAI em produção.

### 12.1 — Baixar o ZIP do OneDrive

O link que ele mandou não abre por API sem login. Abra no navegador (logado na conta
Microsoft que recebeu o compartilhamento), entre em `_OBRAS ATIVAS_`, clique em
**Baixar** (gera um ZIP) e salve fora do repositório (ex.: `Downloads/`). O repo é
público: **nunca** copie os arquivos para dentro dele.

### 12.2 — Mergear o PR e aplicar a migration

```bash
node --env-file=.env.local scripts/apply-migration.mjs 20260915120000_acervo_e_grupo.sql --ensaio
node --env-file=.env.local scripts/apply-migration.mjs 20260915120000_acervo_e_grupo.sql
```

**Como conferir:** `select count(*) from whatsapp_grupos` responde (tabela existe);
`select jobname from cron.job where jobname = 'acervo-processar'` devolve 1 linha.

### 12.3 — Apelidos das obras e a obra Aguirre

```bash
node --env-file=.env.local scripts/seed-apelidos-obras.mjs --ensaio   # mostra
node --env-file=.env.local scripts/seed-apelidos-obras.mjs            # aplica
```

É o que faz "manda pra Gari" e "é da EJ" casarem com a obra certa. Só faz união —
apelido que você já tiver cadastrado fica.

### 12.4 — Importar o acervo

```bash
node --env-file=.env.local scripts/importar-onedrive.mjs "C:\...\OBRAS ATIVAS.zip" --ensaio --criar-obras
node --env-file=.env.local scripts/importar-onedrive.mjs "C:\...\OBRAS ATIVAS.zip" --criar-obras --processar
```

O `--ensaio` imprime, por obra e pasta, o que vai entrar, o que foi ignorado (e por
quê) e as pastas que não casaram com nenhuma obra. `--criar-obras` cria a Aguirre.
`--processar` chama a extração/indexação/conciliação na hora (senão o `pg_cron` faz a
cada 20 min). **Reexecutar com um ZIP novo é sincronizar.**

**Como conferir:** `/obras/<id>` mostra a seção **Pastas** com contagens; `/documentos`
filtra por pasta; `/pendentes` mostra "Notas e comprovantes sem pagamento vinculado" com
o que a conciliação não conseguiu ligar sozinha (você liga pelo formulário do documento).
Sem `OPENAI_API_KEY` (já está), foto e PDF escaneado ficam sem texto — só PDF com camada de
texto é lido.

### 12.5 — Cadastrar o grupo

Crie o grupo no WhatsApp com você, o Cavalcanti, o gerente e o número do agente. Mande
qualquer mensagem. No log da Vercel aparece `ignorada_grupo_nao_autorizado` com o
`chat_id` (`…@g.us`). Cole em `/config/autorizados/grupos`. A partir daí:

| Ele manda | O agente faz |
|---|---|
| foto/PDF com valor, ou "paguei 1200…" | pergunta e espera **SIM** (como sempre) |
| foto sem valor, PDF de proposta/projeto/cronograma | arquiva na pasta da obra e avisa `📁 Obra › Pasta ✔` |
| áudio/texto do dia a dia | anota no diário e avisa `📝 Anotado em Obra ✔` |
| qualquer coisa sem obra identificável | pergunta `1) Aguirre 2) Garibaldi…`, ele responde o número |

Grupo com **obra dedicada** (campo na tela) não pergunta: tudo vai para aquela obra.

### 12.6 — Trocar os pagamentos do protótipo pelos reais (uma linha)

Os 80 pagamentos que estavam no banco eram do protótipo (fictícios). Os reais estão nas
planilhas "Controle Financeiro" de cada obra, que o import trouxe para o acervo. O script
lê as planilhas direto do acervo, arquiva o protótipo, cria as categorias do seu plano de
contas (ETAPA), os fornecedores que faltam, lança um pagamento por linha e liga cada nota
do acervo ao lançamento. Rodar duas vezes não duplica nada.

```bash
# 1. ensaio: só relata, não grava (e escreve dados-iniciais/lancamentos-do-acervo.csv)
node --env-file=.env.local scripts/lancar-pagamentos-do-acervo.mjs

# 2. gravar
node --env-file=.env.local scripts/lancar-pagamentos-do-acervo.mjs --aplicar
```

O que conferir no fim (o próprio script imprime): "No banco agora: 250 pagamentos da
planilha, 0 do protótipo vivos, 200 notas ligadas". As 11 notas que não ligam têm o
comprovante com valor diferente da planilha — ficam em `/pendentes` › "Documentos sem
pagamento", com os candidatos listados no fim do CSV.

### 12.7 — Tirar o que sobrou do protótipo (uma linha)

Decisão de 2026-09-15: no CRM fica só o que veio das pastas do OneDrive. O script arquiva
as 7 obras sem pasta, 4 fornecedores fictícios e 5 categorias genéricas; nas 4 obras
reais troca cliente/endereço/datas inventados pelo que o alvará, a ART e as propostas
dizem (e deixa vazio o que nenhum documento prova); limpa telefones e CNPJs inventados
dos fornecedores e põe o CNPJ real lido das notas fiscais deles. Tudo reversível.

```bash
node --env-file=.env.local scripts/arquivar-dados-do-prototipo.mjs            # ensaio
node --env-file=.env.local scripts/arquivar-dados-do-prototipo.mjs --aplicar  # grava
```

Esperado no fim: "4 obras vivas, 37 fornecedores (0 com telefone), 19 categorias".
Depois, `/api/cron/indexar` (ou esperar o `rag-indexar` das :07) tira as obras
arquivadas do RAG.

- [x] Migration aplicada e conferida no catálogo (2026-09-15)
- [x] Apelidos aplicados (10 obras) e Aguirre criada (2026-09-15)
- [x] Import feito: 318 documentos; `/obras/<id>` › Pastas com contagens (2026-09-15)
- [ ] Pagamentos reais lançados (12.6)
- [x] Protótipo arquivado (12.7, 2026-09-15: 4 obras vivas, 37 fornecedores, 19 categorias, RAG 611/611)
- [ ] Grupo cadastrado; uma foto no grupo respondida com `📁 … ✔`

---

## 13. Fase de testes com o SEU número, depois o número do cliente

> **Uma regra que muda tudo:** o número que você conecta no UAZAPI vira o **agente**.
> O que o dono desse número manda pelo próprio celular chega ao CRM como `fromMe`
> — e o CRM **aceita** (é assim que o Cavalcanti vai usar o dele). O que o CRM
> responde pela API é descartado (`wasSentByApi`), por isso não entra em laço.
>
> **O UAZAPI não assina o webhook.** A prova de origem é o **token da instância**,
> que vem dentro do corpo de cada evento: o CRM compara com `UAZAPI_TOKEN`. Ou seja,
> a mesma variável que liga o envio também protege a entrada — nada a configurar
> no painel do UAZAPI além da URL e dos filtros abaixo.

### 13.1 — O que você precisa ter em mão

| Item | Onde pegar |
|---|---|
| Uma instância no UAZAPI conectada ao **seu** número (QR code) | painel do UAZAPI |
| `UAZAPI_BASE_URL` (ex.: `https://sua-instancia.uazapi.com`) e o **token da instância** | painel do UAZAPI › instância |
| Um **segundo celular** para mandar mensagens (o número da instância também funciona, mas você quer ver os dois caminhos) | — |
| Um grupo de WhatsApp com você (número da instância) + o segundo celular | crie no WhatsApp |

Sobre a tela de webhook do painel: **não use** `https://webhook.nogmacorp.com.br/...`
(relay). O CRM recebe direto. E o painel sugere excluir `isGroupYes` — **não exclua**:
isso mataria as mensagens de grupo. `addUrlEvents` e `addUrlTypesMessages` ficam
**desligados** (eles acrescentam `/messages/…` à URL e a rota não existe).

### 13.2 — Ligar (5 minutos, três comandos e uma tela)

1. No `.env.local` da raiz, acrescente (sem aspas):
   ```
   UAZAPI_BASE_URL=https://<sua-instancia>.uazapi.com
   UAZAPI_TOKEN=<token da instância de teste>
   ```
2. Mergeie o PR e aplique a migration do rastro do webhook:
   ```
   ! node --env-file=.env.local scripts/apply-migration.mjs 20260916100000_webhook_eventos.sql
   ```
3. Grave o webhook certo na instância, as variáveis na Vercel e redeploye — tudo num
   comando (ele mostra o estado da instância antes e relê o webhook depois):
   ```
   ! node --env-file=.env.local scripts/configurar-whatsapp.mjs --webhook --vercel
   ```
   Espere o deploy ficar READY (1–2 min). Depois, um envio de teste para o seu
   segundo celular, pela API:
   ```
   ! node --env-file=.env.local scripts/configurar-whatsapp.mjs --teste 55DDDNUMERO
   ```
4. Abra **`/config/whatsapp`** (Configurações › Diagnóstico do WhatsApp). Tudo tem
   que estar verde: instância conectada, webhook (URL, `messages`, `wasSentByApi`
   excluído, grupos e dono do número chegando, sem sufixos), credencial na Vercel, IA.
   Vermelho vem com o motivo escrito.
5. Cadastre **os dois números** (o da instância e o segundo celular) em
   `/config/autorizados`. Mande "oi" de cada um para o número da instância: os dois
   aparecem em "Últimos eventos" com a ação que o CRM tomou.
6. Mande qualquer coisa **no grupo**. Aparece um aviso amarelo "Chegou mensagem de
   grupo que não está cadastrado: `1203…@g.us` → cadastrar". Clique, dê um nome
   (ex.: "Teste"), escolha ou não uma obra dedicada, salve.

> **17/09 — só grupo cadastrado.** Depois do PR `fix/somente-grupos-cadastrados`, mensagem no
> privado (de quem for, inclusive do dono do número) é ignorada sem resposta. Os testes são
> **sempre no grupo cadastrado**. O passo 5 da §13.2 ("mande oi de cada um") passa a ser no grupo.

### 13.3 — Roteiro de testes (o que mandar, o que tem que acontecer)

Faça no grupo, pelo segundo celular; repita 2 ou 3 pelo número da instância.

| # | Você manda | O agente faz | Onde conferir |
|---|---|---|---|
| 1 | texto: `paguei 1200 de cimento pro Mathias Velho na Garibaldi hoje` | responde com o resumo e **"Confirma? Responda SIM"** | `/pendentes` mostra a pendência |
| 2 | `SIM` | "✅ Lançado" | `/pagamentos`: novo pagamento R$ 1.200, Garibaldi, Mathias Velho; `/whatsapp` mostra a mensagem `classificada` |
| 3 | foto de um comprovante Pix ou nota (com valor) | lê valor/data/fornecedor da imagem, pergunta "Confirma?" | `/pendentes` › dados extraídos |
| 4 | `não` ou nada por 24 h | pendência recusada/expira, nada é lançado | `/pendentes` |
| 5 | foto sem valor (canteiro, projeto) | `📁 Obra › Fotos ✔` — arquiva na pasta da obra | `/obras/<id>` › Pastas › Fotos |
| 6 | PDF de proposta/projeto | `📁 Obra › Proposta ✔` | `/obras/<id>` › Pastas |
| 7 | áudio: "hoje concretamos a laje do segundo pavimento" | transcreve e `📝 Anotado em Obra ✔` | `/obras/<id>` › Diário |
| 8 | texto sem obra reconhecível (grupo **sem** obra dedicada) | `1) Aguirre 2) Casa EJ 3) Garibaldi 4) INOX Piratini` — você responde o número | `/pendentes` › tipo obra |
| 9 | `resumo` / `pendências` / `quanto gastei na garibaldi` | responde com números reais | — |
| 10 | mensagem de um número **não** cadastrado | silêncio total | `/config/whatsapp` mostra `ignorada_nao_autorizada` |

Se algo não acontecer: `/config/whatsapp` › Últimos eventos diz o que o CRM decidiu
para cada mensagem (`pendencia_criada`, `arquivado`, `ignorada_grupo_nao_autorizado`,
`payload_rejeitado` com o campo…). Se nem aparecer lá, o UAZAPI não chamou o CRM:
volte ao item 4 (webhook).

### 13.4 — Limpar os testes (uma linha)

Tudo que nasceu do seu número e do grupo de teste sai — pagamentos, documentos e
arquivos, diário, pendências, mensagens, rastro. O acervo e os pagamentos das planilhas
não têm mensagem por trás e não são tocados.

```
node --env-file=.env.local scripts/limpar-testes-whatsapp.mjs --telefone 55DDDNUMERO --grupo 1203…@g.us --tudo            # ensaio
node --env-file=.env.local scripts/limpar-testes-whatsapp.mjs --telefone 55DDDNUMERO --grupo 1203…@g.us --tudo --aplicar  # grava
```

(`--tudo` também arquiva o autorizado e o grupo de teste. Repita com `--telefone` do
segundo celular.)

### 13.5 — Trocar para o número oficial do Cavalcanti (os mesmos comandos)

1. No UAZAPI: crie/conecte a instância com o número do Cavalcanti (QR code no celular
   dele). Copie o token **dessa** instância.
2. No `.env.local`, troque `UAZAPI_TOKEN` (e `UAZAPI_BASE_URL`, se for outra).
3. ```
   ! node --env-file=.env.local scripts/configurar-whatsapp.mjs --webhook --vercel
   ```
   (grava o webhook na instância nova, troca o token na Vercel, redeploya).
4. `/config/autorizados`: cadastre Cavalcanti (o número da instância), o gerente e você.
   `/config/whatsapp`: confira verde.
5. Crie o grupo oficial (Cavalcanti + gerente + você). Primeira mensagem → aviso amarelo
   em `/config/whatsapp` → cadastrar, com **obra dedicada vazia** (o agente pergunta a
   obra quando precisar; são 4 obras).
6. Faça o roteiro 13.3 uma vez com o Cavalcanti olhando. Pronto.

Depois disso, ligar a cobrança de nota em `/config/automacoes` exige telefone real
nos fornecedores (`/fornecedores`) — hoje todos estão vazios de propósito.

> **Registro de 2026-09-16 (fase de testes, seu número 557398489747 + Hugo, grupo "Teste"):**
> testes 1–7 passaram; 8 e 9 ficaram para a próxima rodada. Quatro bugs achados e
> corrigidos no caminho (PRs #34–#38): nono dígito do WhatsApp, UUID trocado pelo modelo,
> pagamento sem obra sem saída, anexo ignorado. Limpeza feita (13.4): 250 pagamentos e
> 320 documentos de volta ao estado do acervo, 0 mensagens, RAG 611/611. Autorizados
> (2) e grupo Teste mantidos para continuar amanhã. Acabamento anotado: nome do arquivo
> arquivado pelo WhatsApp fica `midia.jpeg`/`midia.pdf` (renomear por data/obra).

- [x] Instância de teste conectada e `/config/whatsapp` verde (2026-09-16)
- [ ] Roteiro 13.3 completo no grupo de teste (1–7 ✓ em 16/09; faltam 8 e 9)
- [x] Testes limpos (13.4, 2026-09-16 — grupo e autorizados mantidos para a próxima rodada)
- [ ] Número oficial ligado (13.5) e roteiro repetido com o Cavalcanti

---

## 14. Ver a mídia dentro do CRM (16/09) — o que é seu depois do merge

O PR "ver a mídia no CRM" faz foto, PDF, vídeo e áudio abrirem **dentro do site** (página
do documento, pendentes, WhatsApp, pagamento, obra) e faz o WhatsApp guardar **qualquer
arquivo** (vídeo, planilha, Word…), com nome legível. Duas coisas dependem de você.

### 14.1 — Aplicar a migration (uma linha, depois do merge)

```bash
! node --env-file=.env.local scripts/apply-migration.mjs 20260916200000_msg_tipo_video_arquivo.sql
```

**Como conferir:** no SQL do Supabase, `select unnest(enum_range(null::msg_tipo));` tem que
listar `texto, imagem, pdf, audio, video, arquivo`. Sem a migration, um vídeo mandado no
grupo dá erro de enum ao gravar a mensagem (o log mostra `invalid input value for enum
msg_tipo: "video"`) — foto, PDF e áudio continuam funcionando.

### 14.2 — Ligar o login por e-mail no Supabase Auth (achado do teste) — ✅ feito em 17/09

> **17/09:** o script respondeu "já está ligado" (`external_email_enabled=true`, `disable_signup=true`), e a prova pelo comportamento passou: senha errada devolve `invalid_credentials`, não "Email logins are disabled". Nada a fazer.

Ao testar com sessão de verdade, o Auth respondeu **"Email logins are disabled"**: o provedor
de e-mail está desligado no projeto (`external_email_enabled=false`). Quem já está logado
continua entrando (o refresh não passa pelo provedor); quem abrir `/login` numa aba nova
**não consegue entrar**. Não é código: é configuração do projeto.

```bash
! node --env-file=.env.local scripts/habilitar-login-email.mjs            # só mostra
! node --env-file=.env.local scripts/habilitar-login-email.mjs --aplicar  # liga
```

`disable_signup` continua `true` — ligar o provedor não reabre cadastro público.
**Como conferir:** aba anônima → `/login` → entrar com seu usuário.

### 14.3 — O que ver depois de deployar (READY + 1 min)

| Onde | O que tem que aparecer |
|---|---|
| `/documentos/<id de uma NF>` | O PDF aberto na página, botões Abrir em nova aba / Baixar, "Texto lido do arquivo" dobrado |
| `/documentos?categoria=fotos` | Grade de miniaturas (a pasta Fotos abre em grade sozinha; "Ver como" troca) |
| `/pagamentos/<id com comprovante>` | Seção **Documentos** com a miniatura do comprovante |
| `/obras/INOX Piratini` | Faixa **Últimas fotos** acima das pastas |
| `/pendentes` (quando houver) | A foto da nota ao lado da pergunta, não só `image/jpeg` |
| Grupo Teste: mandar um vídeo curto | Resposta `📁 Obra › Fotos ✔`; o vídeo roda em `/documentos/<id>` |
| Grupo Teste: mandar uma planilha `.xlsx` | Vira documento na pasta Outro (ou a que a legenda disser), com botão Baixar |

A primeira vez que uma miniatura é pedida ela é gerada (`sharp`, ~0,1–0,5 s por foto) e
guardada em `miniaturas/` no bucket; da segunda em diante é instantânea. As 124 imagens
do acervo geram sob demanda — não precisa rodar nada.

---

## 15. O agente responde e age sobre o CRM inteiro (17/09) — o que é seu

O PR `feat/agente-crm-completo` faz o WhatsApp responder **qualquer coisa** que esteja no
CRM (obras, lucro, etapas, fornecedores, notas, documentos, diário, recebimentos) e
executar cinco cadastros pedidos por texto — **sempre** repetindo o que entendeu e
esperando o *SIM*: criar obra, cadastrar fornecedor, valor do contrato, recebimento do
cliente, arquivar obra. Também corrige um defeito antigo: o assistente estava **mudo em
produção** desde a troca para OpenAI (o modelo recusava ferramentas com raciocínio ligado
— era o teste 9 do roteiro 13.3 que nunca passou).

### 15.1 — Mergear o PR e aplicar a migration (uma linha, depois do merge)

```bash
! node --env-file=.env.local scripts/apply-migration.mjs 20260916230000_contrato_recebimentos_acoes.sql
```

Ela cria `obras.valor_contrato`, a tabela `recebimentos` (parcelas que o cliente da obra
pagou) e o tipo `acao` nas pendências. Foi **ensaiada** em produção (transação + rollback)
em 16/09. **Como conferir** (SQL do Supabase):

```sql
select column_name from information_schema.columns where table_name='obras' and column_name='valor_contrato';
select count(*) from recebimentos;   -- 0, sem erro
```

Sem a migration: o agente responde perguntas, mas "criar obra"/"contrato"/"recebimento"
falham com erro de coluna, e a página da obra dá 500 (ela lê `recebimentos`). **Aplique
antes de o deploy ficar READY** — ou logo depois.

### 15.2 — Dizer os contratos (pelo WhatsApp ou pelo painel)

Nenhuma das 4 obras tem valor de contrato (nenhum documento do acervo traz). Sem ele o
agente responde "o valor do contrato ainda não foi informado" — correto, mas você vai
querer ver o lucro. Duas formas:

- No grupo: `o contrato da Garibaldi é 850 mil` → ele repete → `SIM`.
- No painel: Obras › obra › Editar › **Valor do contrato (R$)**.

E as parcelas já recebidas: `recebi 300 mil do cliente da Garibaldi em 01/08` → `SIM`,
ou Obras › obra › **Recebimentos do cliente** › formulário.

### 15.3 — Roteiro de testes (continuação do 13.3, no grupo Teste)

| # | Você manda | O agente faz | Onde conferir |
|---|---|---|---|
| 11 | `velho, quanto tô lucrando na garibaldi` | gasto, recebido, resultado; **sem contrato** diz que falta e ensina a informar | — |
| 12 | `o contrato da garibaldi é 850 mil` → `SIM` | repete "Valor do contrato: R$ 850.000,00 (850 mil)" e pede SIM; depois "✅ Anotado" | `/obras/Garibaldi` › Resultado da obra |
| 13 | `como está a obra garibaldi` | contrato, gasto, recebido, lucro até agora, margem, por etapa, notas faltando, último diário | — |
| 14 | `cria uma obra chamada Sítio do Pedro, cliente Pedro Alves` → `SIM` | repete os dados e pede SIM; "✅ Obra criada"; depois foto sem legenda no grupo → arquiva **no Sítio do Pedro** (obra recente, 2 h) | `/obras` (obra nova), `/pendentes` (ficou vazio) |
| 15 | `cria uma obra chamada Sítio do Pedro` de novo | "já existe uma obra chamada…" — não abre pendência | — |
| 16 | `bom dia` / `valeu` | uma linha simpática, sem pendência no painel | `/pendentes` continua vazio |
| 17 | `cadastra o fornecedor Elétrica Silva, CNPJ 12.345.678/0001-90` → `NÃO` | pergunta; "Ok, cancelei. Nada foi gravado." | `/fornecedores` sem o Silva |
| 18 | `quais obras temos` / `quem mais recebeu esse mês` / `tem projeto aprovado da casa ej` | responde com números/nomes reais, ≤ 12 linhas, termina com "o que fazer em seguida" | — |
| 19 | `paguei 1200 de cimento pro Mathias na Garibaldi` | **continua** o fluxo de pagamento (pergunta "Confirma?") — nunca vai ao assistente | `/pendentes` |

Toda ação pendente também aparece em `/pendentes` como **"Ação pedida pelo WhatsApp"**,
com *Confirmar e executar* / *Cancelar* — o painel é outro caminho para o mesmo SIM.

`/config/whatsapp` › Últimos eventos mostra `acao_proposta`, `executou_acao`, `pergunta`
e, no log da Vercel, `roteador` com `destino`/`motivo`/`intencao` por mensagem.

### 15.4 — Custo e limites

Cada mensagem de texto que **não** é lançamento, comando nem resposta a pendência custa
uma chamada curta ao modelo (intenção, ~200 tokens) e, se for para o assistente, até 4
rodadas com ferramentas. Foto e "paguei X" continuam custando o de sempre.

- [ ] PR mergeado e deploy READY
- [ ] Migration 20260916230000 aplicada e conferida (15.1)
- [ ] Contratos das 4 obras informados (15.2)
- [ ] Roteiro 15.3 (11–19) feito no grupo Teste

---

## 16. Painel do empresário e textos claros (17/09) — o que ver depois dos merges

Três PRs **empilhados** (cada um contém o anterior). Mergeie **nesta ordem**, esperando o
deploy READY entre um e outro: **#40** (agente sobre o CRM) → **#41** (textos claros) →
**#42** (painel do empresário + tamanho do texto). A migration da §15.1 vale para os três.

| Onde | O que tem que aparecer |
|---|---|
| `/painel` | Seis abas grandes (Visão geral, Por obra, Fornecedores, Caixa, Documentos, Alertas); cartão "Como estão as obras" com as 4 obras |
| `/painel?aba=por-obra` | Barras por obra com o valor em cima (sem quebrar em 3 linhas), empilhado mês a mês com uma cor por obra, etapas por obra |
| `/painel?aba=caixa` | "Entrou × saiu" (verde × laranja) — entrou fica zero até você registrar recebimentos (§15.2) |
| `/painel?aba=alertas` | Frases com número grande e botão; "50 pagamentos sem nota" é real (são as notas do acervo que não casaram) |
| Topo, à direita | **A / A+ / A++** — clique em A++ e recarregue: continua grande (é cookie) |
| Tela larga (≥ 1280 px) | Sidebar aberta com os nomes; em notebook menor continua o trilho que expande no hover |
| Grupo Teste: `paguei 1200 de cimento pro Mathias na Garibaldi` | A pergunta vem em linhas: Valor / Obra / Fornecedor / O que foi / Data, e termina com "Responda *SIM* para lançar, ou *NÃO* para cancelar" |
| Grupo Teste: `ajuda` | Lista numerada com as 5 coisas que o agente faz |
| Grupo Teste: `asdfgh` (texto sem sentido) | "Não entendi o que fazer com essa mensagem" + exemplo — antes era silêncio |

- [ ] #40 mergeado → READY → migration §15.1 aplicada
- [ ] #41 mergeado → READY
- [ ] #42 mergeado → READY → tabela acima conferida

---

## Se algo der errado, olhe aqui primeiro

| Sintoma | Onde olhar |
|---|---|
| Mensagem chega e nada acontece | `/config/autorizados` — lista vazia ignora tudo |
| Bot não responde | Credencial UAZAPI + **redeploy feito?** |
| Webhook devolve 401 | HMAC — o segredo da UAZAPI bate com `WEBHOOK_HMAC_SECRET`? |
| Automação não disparou | `/config/automacoes`, coluna **Motivo** no histórico |
| Pergunta responde "não encontrei" | Base indexada? (item 8) |
| Job parado na fila | `/config/filas` — parado há 15 min = consumidor não chamado; confira o Vault (`provisionar-vault.mjs`) |
| `/api/health` devolve 503 | O corpo diz o quê. `problemas` é o que parou; `avisos` é o que falta configurar |
| Qualquer erro em produção | Vercel → Logs → filtre `nivel:erro`. Cada linha tem `area` e `evento`; mensagens de WhatsApp têm `correlacao` |
| Backup semanal falhou | E-mail do GitHub para quem fez o último commit; tabela de sintomas em `docs/RUNBOOK-BACKUP.md` |
| Mensagem de grupo não responde | `/config/autorizados/grupos` — grupo fora da lista é ignorado; o id está no log |
| Importador diz `column caminho_origem does not exist` | Migration `20260915120000` não aplicada (item 12.2) |
| Documento sem texto em `/documentos` | Extração roda a cada 20 min; imagem/scan exige `ANTHROPIC_API_KEY` |
| `/login` diz "Email logins are disabled" | Provedor de e-mail desligado no Auth — item 14.2 |
| Foto/PDF não abre na página (404 na rota `/api/arquivos`) | O arquivo ficou `pending` (upload não terminou) ou a RLS não deixa este usuário ver a obra |
| Vídeo no grupo dá `invalid input value for enum msg_tipo` | Migration `20260916200000` não aplicada — item 14.1 |
