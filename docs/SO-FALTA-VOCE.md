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
  🟠 4. Mergear os PRs #20 (front-end) e #21 (banco) + 6 limpezas que só você faz
  🟠 5. Vercel Pro → um comando faz o resto (região + repo privado)
  🟠 6. Backup: restore de teste + guardar a frase + PITR
  🟡 7. Domínio próprio + Cloudflare
  🟡 8. Indexar a base de conhecimento (embeddings)
  🟡 9. Ligar as automações, com cuidado
  ⏳ 10. Depois de 16/09: PR #7 e a chave FILA_WHATSAPP
  🔵 11. Decisão: Fase 6 (vendas) — o que preciso de você para começar

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
| **Classificador** | `IA_PROVIDER=anthropic` · `ANTHROPIC_API_KEY` | A extração da nota é simulada |
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

### 4.0 — PR #20: revisão de front-end (o que o cliente vê no dia 16)

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
verde no PR. **Pode mergear.** Depois do merge, abra o app no celular e no desktop e
troque o tema pelo botão do topo — é o que o cliente vai ver.

### 4.0b — PR #21: revisão do banco (migration já em produção)

<https://github.com/NogmaBR/CRM-CAVALCANTI/pull/21> — inventário real do banco + dois
revisores. A migration **já está aplicada e conferida** (policies otimizadas, privilégios
reduzidos, auditoria ampliada, manutenção agendada, áudio do WhatsApp aceito no bucket).
O PR traz o código que acompanha: pendência sem "sucesso falso", automação que não perde
a configuração ao ligar/desligar, painel em Brasília. Achados e próximos passos em
`docs/PLANO-BANCO-PREMIUM.md`. **Pode mergear.**

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
