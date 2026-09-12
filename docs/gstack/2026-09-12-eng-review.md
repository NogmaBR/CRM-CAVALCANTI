# Eng review — plano técnico pós-entrega (2026-09-12)

> `/plan-eng-review` em **modo degradado** (sem `bin/`, sem Codex, sem AskUserQuestion:
> `SESSION_KIND=spawned`, toda decisão abaixo foi auto-escolhida na opção recomendada
> e está registrada com o brief completo). Branch `feat/gstack-time-virtual`, commit
> `5854fcd`. Repositório **público**: nenhum segredo aqui.
>
> **Alvo (opção C, nomeado):** `PLANO-BANCO-PREMIUM.md` §"Próximos passos" 1–9,
> `PLANO-ARQUITETURA-CODE-FIRST.md` (checkboxes abertos + `FILA_WHATSAPP` + PR #7),
> `PLANO-FASE-6.md` M0–M5, `ROTEIRO-GO-LIVE.md`, `SO-FALTA-VOCE.md`.
>
> **Evidência coletada antes de opinar:** `pnpm --filter web typecheck` → exit 0;
> `vitest run` → 17 arquivos, **274 testes, todos verdes** (5,45 s); `git merge-base
> origin/main origin/feat/emitir-eventos` = `76fe5a9`; `git diff origin/main...
> origin/feat/emitir-eventos --stat` = 4 arquivos; `grep "emitir("` em `lib/` e
> `app/` na `main` = **zero chamadores**. Não existe `TODOS.md`; `SO-FALTA-VOCE.md`
> faz esse papel. Design doc: nenhum (`docs/designs/` não existe); office-hours
> pulado por instrução.

---

## 0. Step 0 — Scope Challenge

### 0.1 O que já existe e resolve (ou quase) cada subproblema

| Item do plano | Código que já faz parte do trabalho | O plano reusa? |
|---|---|---|
| 1 Token hash da planilha | `lib/security/flash-secret.ts` (mostrar-uma-vez do secret de webhook); `audit_log_trigger` já oculta `token` (`revisao_banco.sql:269`); índice `idx_compartilhamentos_token_ativo` (`20260909150000:45`) | Não cita o flash-secret. **Reusar** |
| 2 Retenção | `purgar_automation_executions(90)` + crons `manutencao-*` (`revisao_banco.sql:329-338`, `:454-479`) | Sim, é o mesmo molde |
| 3 `exigirLinhas()` | Padrão inline 4× em `confirmacoes.ts:119-158`; `bulkArchiveObras` já faz `.select('id')` e conta (`obras/actions.ts:136-148`) | Cita o padrão, não propõe o helper. **Extrair helper** |
| 4 Paginação/agregação | RPC `pagamentos_sem_documento` (filtro no banco) é o modelo; `sumPagamentosBy` avisa "<10k rows" (`pagamentos.ts:75-78`) | Propõe RPC. Correto |
| 5 `search_path=''` | 21 funções `SECURITY DEFINER`, todas já com `search_path` **fixo** (`public`, `public, pgmq`, `public, net, vault`, `public, cron, pgmq`) | Migration só |
| 6 Autoria em RPC | `audit_log_trigger` já tem `v_user := auth.uid()` com `EXCEPTION` (`revisao_banco.sql:271-275`) | Falta só o `COALESCE` com `current_setting` |
| 7 Zod em `dados_extraidos` | `SaidaSchema` (zod/v4) em `anthropic-classifier.ts:40-53`; `DadosExtraidos` (interface) em `pendentes.ts:10-20` | Dois shapes do mesmo dado. **Unificar** |
| 8 Service role → sessão | 9 cópias da fábrica de service client (planilha, webhook, consume, classify, detect-duplicates, import, usuarios, documents, bus/PR7) | Não vê a duplicação |
| 9 `configSchema` | `configPadrao` + `numero(v, padrao)` com fallback silencioso (`cobrar-documento-fornecedor.ts:201-203`) | Sim |
| `FILA_WHATSAPP` | Tudo pronto: `route.ts:107-120`, `handlers.ts:102-129`, `fila_acordar_consumidor()` | Falta o teste da rota |
| PR #7 | `emitir()` sem chamadores na `main`; PR adiciona 3 (`pagamentos/actions`, `documentos/actions`, `classify-and-persist`) | Precisa **remerge** (ver A1) |
| Fase 6 M0 | `lib/services/uazapi.ts` como molde de adaptador; `fila_valida` whitelist; `lib/events/tipos.ts:91-95` já declara `EventosVendas` | Sim |

### 0.2 Mínimo de mudanças que atinge o objetivo

O objetivo declarado é "o que entra depois de 16/09, na ordem certa". O mínimo que
protege o cliente é **(3) exigirLinhas → (9) configSchema → (7) Zod → PR #7 remerge
→ FILA_WHATSAPP**. Tudo o mais é valor, não proteção. Item 5 (`search_path=''`) é o
único que eu adiaria sem dor: o advisor da Supabase já está verde porque o path é
fixo; o ganho é defesa em profundidade contra objeto malicioso em `public`, e
`anon`/`authenticated` não criam objeto lá (PR #21).

### 0.3 Complexity check

O plano somado toca **>8 arquivos** (12 actions + confirmacoes + 3 lib/data + 2
migrations + route + handlers) e cria **2 novas "coisas"** (helper `exigirLinhas`,
schema `DadosExtraidos`). O gatilho dispara. **Não é overbuild**: são 12 correções
pequenas e independentes, não uma abstração nova. Ver D1.

### 0.4 Search check (WebSearch, 8 buscas; Aside indisponível)

- **[Layer 1] `search_path = ''`** é a recomendação oficial da Supabase para
  SECURITY DEFINER, com nomes totalmente qualificados
  (<https://supabase.com/docs/guides/database/functions>,
  <https://supabase.github.io/splinter/0011_function_search_path_mutable/>). O
  advisor só acusa path *mutável*; o nosso é fixo. Item 5 é higiene, não incêndio.
- **[Layer 1] pgmq é at-least-once na vida da mensagem**; VT deve ser p99 + folga;
  `read_ct` sobe em toda re-entrega
  (<https://supabase.com/docs/guides/queues/pgmq>,
  <https://dev.to/mwiginton/supabase-queues-in-production-dead-letter-queues-retries-and-poison-messages-with-pgmq-28dp>).
  O código já modela isso (`tipos.ts:133-141`, VT 180 s).
- **[Layer 2] PostgREST tem `sum()`/`count()` nativos**, desligados por padrão
  (`ALTER ROLE authenticator SET pgrst.db_aggregates_enabled='true'`)
  (<https://docs.postgrest.org/en/v12/references/api/aggregate_functions.html>,
  <https://github.com/orgs/supabase/discussions/28112>). Alternativa ao item 4, mas
  liga agregação para **todo** papel autenticado. A RPC é o caminho chato e já é o
  padrão do repo. Ver D5.
- **[Layer 1] Token hash sha256, sem salt para token aleatório longo, mostrado uma
  vez** (<https://docs.apigee.com/api-platform/security/oauth/hashing-tokens>).
- **[Layer 1] Retenção por DELETE em lote + VACUUM, ou partição por tempo** quando
  o volume justificar (<https://dataegret.com/2025/05/data-archiving-and-retention-in-postgresql-best-practices-for-large-datasets/>,
  <https://blog.sequinstream.com/time-based-retention-strategies-in-postgres/>).
  Dezenas de mensagens/dia: DELETE em lote basta; partição é overbuild.
- **[Layer 1] RLS: UPDATE que a policy barra devolve 0 linhas e nenhum erro;
  encadear `.select()` e conferir o tamanho**
  (<https://dev.to/michelfaure/supabase-rls-in-production-four-traps-that-silence-your-queries-525p>,
  <https://github.com/PostgREST/postgrest/discussions/1844>). Confirma o item 3.
- **[Layer 1] pg_net grava resposta/timeout em `net._http_response`; nunca pôr
  trigger nas tabelas `net.*`** (<https://github.com/supabase/pg_net>,
  <https://supabase.com/docs/guides/troubleshooting/webhook-debugging-guide-M8sk47>).
  Relevante: `fila_acordar_consumidor` usa `timeout_milliseconds := 5000` e a rota
  pode levar 180 s (ver A2).
- **Vercel: com Fluid Compute o teto é 300 s em todo plano; projetos antigos podem
  estar no legado (10–60 s)** (<https://vercel.com/docs/functions/limitations>,
  <https://vercel.com/changelog/vercel-functions-for-hobby-can-now-run-up-to-60-seconds>).
  Não verificado no projeto (Settings → Functions). Importa para VT 180 s da fila.
- **[EUREKA] "Liberação de IP" no ERP (Fase 6 M0) não é opção na Vercel**: função
  serverless não tem IP de saída fixo sem add-on pago (Secure Compute). O
  pré-requisito do M0 tem de ser **HTTPS**, e ponto. Conhecimento de plataforma,
  não verificado por busca (7/10). Ver A7.

### 0.5 Completeness check

O plano é honesto sobre esforço mas propõe atalhos em três lugares: item 3 sem
helper (repetiria o bloco 12×), item 7 sem unificar com `SaidaSchema` (dois shapes
divergem no primeiro campo novo), item 9 sem `.strict()` (typo no JSON continua
silencioso). Com CC o custo da versão completa é minutos. Recomendo a completa nas
três (D3, D8, D6). Lake Score ao fim.

### 0.6 Distribution check

Nenhum artefato novo. Tudo é deploy Vercel + migration via `apply-migration.mjs
--ensaio`. O que **não** tem distribuição é a Fase 6: o adaptador ERP vai precisar
de credencial em `.env.local` + Vercel + Vault (se `pg_cron` chamar `/api/cron/
erp-sync`). Entra em "NOT in scope" como pipeline a desenhar no M1.

### 0.7 Cross-ref com pendências (SO-FALTA-VOCE.md)

- **Bloqueia este plano:** nada de código. Mas 3 itens humanos gateiam a ordem:
  telefones reais (§1) antes de ligar cobrança; credenciais (§2) antes do Zod em
  `dados_extraidos` valer com o classificador real; HTTPS do ERP (§11) antes do M1.
- **Pode ir junto sem inflar:** §4.3 (remover `SUPABASE_DB_URL`/`JWT_SECRET` da
  Vercel) é ação humana; nenhum código lê. Não entra em PR.
- **Trabalho novo que o plano cria:** teste da rota do webhook com `FILA_WHATSAPP`
  (não existe teste de rota nenhum); purga de objetos em Storage `whatsapp/`;
  `getUserById` (C5).

---

## 1. Decisões (auto, spawned)

**D1 — Reduzir escopo ou seguir como está?** escolhido **B (auto, spawned)**.
ELI10: o plano toca mais de 8 arquivos, o que normalmente cheira a overbuild. Aqui
são 12 correções de 5 linhas, cada uma provável em isolamento. Stakes: reduzir
deixaria `regenerarSecret`/`restoreX` com "sucesso" falso. Recomendação: B porque a
complexidade é de contagem, não de desenho. Completeness: A=6/10, B=10/10.
A) Reduzir: só pendências e obras. ✅ menos diff para revisar antes do dia 16
✅ menos risco de regressão em telas da demo ❌ deixa 10 actions com o bug conhecido.
B) Seguir com helper único (recomendado): ✅ um lugar para corrigir, 12 chamadores
✅ testável com cliente fake como `engine.test.ts` ❌ 12 arquivos no diff.
Net: preferência "DRY + edge cases" do usuário pede B.

**D2 — Token da planilha: hash em coluna nova ou continuar em claro com RLS?**
escolhido **A (auto)**. ELI10: hoje o link do cliente é uma senha guardada em texto;
quem lê a tabela (admin/gestor, backup, log) lê a senha. Stakes: vazamento do dump
= planilhas financeiras de todas as obras abertas. Recomendação: A porque o
backup semanal cifrado circula fora do Supabase. Completeness: A=10/10, B=5/10.
A) `token_hash` sha256, token só na resposta da action via `flash-secret`
(recomendado): ✅ dump não expõe link ✅ backfill trivial (`update set token_hash =
encode(sha256(token::bytea),'hex')`), nenhum link quebra ❌ tela da obra deixa de
listar o link; só descrição/data/acessos. B) manter: ✅ zero mudança ✅ RLS já
limita a admin/gestor ❌ backup e audit continuam com a credencial.
Net: A, porque o custo é 2 h e o de B é um incidente.

**D3 — `exigirLinhas` como helper ou inline?** escolhido **A (auto)**: helper em
`lib/supabase/escrita.ts` devolvendo `{ok:true,linhas}|{ok:false,codigo:'sem_
permissao'|'nao_encontrado'|'db',mensagem}`, usado nas 12 actions **e** nos 4
blocos de `confirmacoes.ts`. Completeness A=10/10, B=7/10. ✅ um teste cobre 16
chamadores ✅ mensagem ao usuário uniforme ❌ refatora `confirmacoes.ts`, que é o
coração — exige os testes de T2 antes.

**D4 — Retenção: DELETE ou anonimização?** escolhido **B, anonimizar (auto)**.
ELI10: `pagamentos.criado_via_msg_id` e `confirmacoes_pendentes.mensagem_id`
apontam para `mensagens_whats`; apagar a mensagem apaga a prova de que o lançamento
veio de um "SIM". Stakes: auditoria do financeiro perde a origem. Recomendação: B.
Note: options differ in kind, not coverage. A) DELETE: ✅ simples ✅ libera espaço
❌ FK `ON DELETE SET NULL`? Não verificado; se RESTRICT, o cron falha todo dia.
B) UPDATE zerando `texto_bruto`, `texto_transcrito`, `telefone_from` (mascarado),
`midia_storage_path` + apagar objeto no Storage; linha e status ficam (recomendado):
✅ trilha de auditoria intacta ✅ LGPD atendida (dado pessoal some) ❌ precisa de
job em duas fases (banco + Storage). Net: B; `audit_log` **fica fora** da purga
(registro financeiro, ver A5).

**D5 — Agregação: RPC ou PostgREST aggregates?** escolhido **A, RPC (auto)**.
ELI10: somar em JS exige baixar todas as linhas; com o histórico do ERP isso vira
segundos por página, a 394 ms de ida e volta. Stakes: painel lento e `listPagamentos`
truncado em 1.000 linhas sem aviso (P2). Note: differ in kind. A) RPC
`gasto_por_obra`, `pagamentos_por_mes` com `STATUS_QUE_CONTAM` dentro (recomendado):
✅ é o padrão do repo (`pagamentos_sem_documento`) ✅ a definição de "gasto" fica
em um só lugar, no banco ❌ 2 migrations. B) ligar `db_aggregates_enabled`: ✅ zero
migration ✅ `select('valor.sum()')` ❌ liga para todo papel, em toda tabela;
Supabase desliga por padrão por causa de custo sem limite. Net: A.

**D6 — `configSchema`: Zod `.strict()` ou só tipar?** escolhido **A, strict
(auto)**. ELI10: hoje `{"limite_por_rodadas": 3}` (typo) é aceito e a regra segue
com 25. Stakes: 25 WhatsApps por dia para fornecedor, exatamente o que
`ROTEIRO-GO-LIVE §3.1` chama de perigo concreto. Completeness A=10/10, B=6/10.
✅ typo vira erro na tela ✅ elimina `as never` em `automacoes/actions.ts:86,142`
❌ toda automação nova precisa declarar schema (é o que se quer).

**D7 — `FILA_WHATSAPP`: ligar como está ou corrigir o throughput antes?**
escolhido **B (auto)**. ELI10: com a chave ligada o `pg_cron` acorda o consumidor
uma vez por minuto e ele processa **uma** mensagem inbound por chamada
(`LOTE_POR_FILA.whatsapp_inbound = 1`). Cinco fotos em rajada = cinco minutos até a
última pergunta sair; o "SIM" da primeira só é lido no minuto seguinte. Stakes: o
cliente vê o bot "lento" logo depois da entrega. Completeness A=6/10, B=10/10.
A) ligar: ✅ é uma env var ❌ latência de 1–5 min visível. B) drenar em laço na
rota (`while` até fila vazia ou 50 s de orçamento, uma mensagem por vez, VT
respeitado) + `net.http_get timeout` alinhado + teste de rota (recomendado): ✅
latência volta a segundos ✅ o teste de regressão da chave passa a existir ❌ meio
dia de trabalho. Net: B, antes de virar a chave.

**D8 — PR #7: mergear como está ou remerge + ajustes?** escolhido **B (auto)**.
ELI10: a branch parou em `76fe5a9` (antes dos PRs #16–#21); `git merge-tree` não
acusa conflito textual, mas `bus.ts` do PR usa `console.error` (proibido desde o PR
#13) e o bloco de rollback em `documentos/actions.ts` do PR coexiste com o rollback
via service role que a `main` ganhou no PR #21. Stakes: dois rollbacks, um deles
silencioso. Completeness A=5/10, B=10/10. B: remerge da `main`, trocar
`console.error` por `log.erro('emissao_sem_credencial')`, reler o rollback, CI
verde na ponta nova, e teste de que `emitir` sem env não lança.

**D9 — Zod em `dados_extraidos`: schema novo ou reusar `SaidaSchema`?** escolhido
**C, schema em Zod 3 em `lib/schemas/dados-extraidos.ts`, com `SaidaSchema` (v4)
convertido na fronteira do classificador (auto)**. ELI10: o projeto está no Zod 3;
só o SDK da Anthropic exige v4. Um schema v4 vazando para `confirmacoes.ts` obriga
todo o resto a importar `zod/v4`. Completeness 10/10 vs 7/10 (reusar v4). ✅ um
shape, três consumidores (`confirmacoes`, `pendentes`, `classify-and-persist`) ✅
`valor > 0`, `obra_id` uuid, `data_pagamento` ISO validados **antes** do INSERT.

**D10 — Fase 6 M0: aceitar "HTTPS ou IP" como pré-requisito?** escolhido **B,
HTTPS obrigatório (auto)**. Ver A7. Completeness: N/A (kind).

---

## 2. Review — Arquitetura (7 issues)

Formato: `[Sev] (confiança) arquivo:linha — o que quebra → correção`.

**A1 [P1] (9/10) `origin/feat/emitir-eventos` — PR #7 está atrás da `main` e viola
a regra de log.** Evidência: `git merge-base` = `76fe5a9`; `bus.ts` do PR, linha 97:
`console.error(\`[eventos] "${nome}" não despachado…\`)`; `main` tem `lib/log.ts`
desde o PR #13. O PR também mexe no rollback de `documentos/actions.ts` (linhas
60-84 do diff) que a `main` reescreveu com service role (`documentos/actions.ts:27-40,
134`). Quebra: dois caminhos de rollback, um por sessão (que apaga zero linhas em
silêncio, exatamente o bug que o PR #21 corrigiu). Correção: D8. Bom no PR: `emitir`
monta o service client sozinho porque `automation_executions` não tem policy de
INSERT para sessão (`bus.ts` PR, linhas 53-72) — mantém.

**A2 [P1] (8/10) `lib/queue/tipos.ts:151-156` + `20260910210000_fila_agendamento.sql`
(`'* * * * *'`, `timeout_milliseconds := 5000`) — throughput de 1 msg/min quando
`FILA_WHATSAPP=true`.** `consume/route.ts:91` limita a `LOTE_POR_FILA[fila]` = 1 para
`whatsapp_inbound`, e `fila_acordar_consumidor` roda uma vez por minuto. Cenário
real: mestre de obras manda 4 fotos seguidas às 17h; a 4ª pergunta sai às 17h04; o
"SIM" da 1ª, mandado às 17h01, é lido às 17h05. Além disso o `pg_net` desiste em
5 s e registra timeout em `net._http_response` enquanto a função continua — o
`/config/filas` nunca vê o erro da rota. Correção: laço de drenagem com orçamento
de tempo na rota (D7); `timeout_milliseconds` ≥ 10 s só para o handshake (a
resposta não importa); teste de rota. Falha de produção: função morre no meio →
VT devolve a mensagem, `read_ct` sobe, 3ª vez arquiva — já coberto por desenho.

**A3 [P1] (9/10) `lib/data/planilha.ts:93-98` `.eq('token', token)`; migration
`20260909150000:25` `token TEXT UNIQUE NOT NULL`; `compartilhamentos.ts:33` devolve
`token` para a UI — credencial em claro.** Quebra: backup cifrado, `audit_log`
(oculta `token` mas não `diff.after` de UPDATE em `acessos`… verificado: `v_ocultas`
remove a chave inteira, ok) e qualquer `SELECT` de admin expõem o link. Correção:
D2 — `token_hash TEXT UNIQUE`, `registrar_acesso_compartilhamento(p_token_hash)`,
`getPlanilhaPorToken` faz `sha256` antes de consultar (mantém a regex `[0-9a-f]{64}`
em `planilha.ts:83`), `gerarLinkPlanilha` devolve o token uma vez por
`flash-secret`. Backfill in-place; **nenhum link vivo quebra.**

**A4 [P2] (8/10) 21 funções SECURITY DEFINER com `search_path = public[, …]` — item
5.** Verificado por grep nas 37 migrations. `fila_*` dependem de `pgmq`,
`fila_acordar_consumidor` de `net` e `vault`, `saude_sistema` de `cron`. Com `''`
todas essas referências precisam de schema explícito (`pgmq.send`, `net.http_get`,
`vault.decrypted_secrets`, `cron.job`). Quebra se feito pela metade: fila para de
ser drenada **sem erro** (a função devolve texto, não lança — `fila_agendamento.sql`
linhas 41-52). Correção: uma migration por família (auth/audit, fila, rag, saúde),
cada uma com `--ensaio` e conferência `pg_proc.proconfig`. Ordem 9 no plano travado.

**A5 [P2] (9/10) Retenção (item 2) — `mensagens_whats` é referenciada por
`pagamentos.criado_via_msg_id` (`confirmacoes.ts:169-173`, índice único parcial) e
`confirmacoes_pendentes.mensagem_id` (`confirmacoes.ts:83-87`).** DELETE quebra a
cadeia "SIM → pagamento". `audit_log` é registro financeiro: purgar é decisão
jurídica, não técnica. Correção: D4 (anonimizar, não apagar); `audit_log` fora;
Storage `whatsapp/<msg_id>/…` (`inbound-whatsapp.ts:435`) precisa de purga própria
(`storage.objects` por prefixo). Prazo (365 d?) é do cliente — **UNRESOLVED**.

**A6 [P2] (7/10) `lib/services/import-pagamentos.ts:21-29`, `detect-duplicates.ts:
20-27`, `lib/data/usuarios.ts:44-52` — service role onde a sessão bastaria (item
8).** `listUsuarios` precisa do Admin API para `auth.users` (`usuarios.ts:70-72`) —
legítimo. Os outros dois perdem a RLS como segunda barreira: um papel `financeiro`
importando CSV grava onde a policy `pagamentos_insert` talvez não deixe (policy não
lida nesta review — por isso 7/10). Correção: cliente de sessão nos dois; service
role só em `auth.admin.*`. Junto: **C7** (uma fábrica só).

**A7 [P2] (7/10) `docs/PLANO-FASE-6.md` M0 "HTTPS ou liberação de IP" — o segundo
não existe na Vercel sem add-on.** Função serverless não tem IP de saída fixo; e
tráfego de cliente (2.955 CPFs) em HTTP puro é problema LGPD. Correção: M0 exige
HTTPS; se o parceiro só liberar IP, a alternativa é um proxy (Cloudflare Worker com
IP estático não existe no free; VPS foi descartada na FASE 0) — decisão de custo
antes do M1. Também: `erp_sync` exige entrada na whitelist `fila_valida` e em
`FILAS` (`tipos.ts:87-92`) + `VISIBILITY_TIMEOUT`/`LOTE_POR_FILA` (o `satisfies`
obriga). Diagrama de fila da §7 vale igual.

Sem issue: `processarInbound` ordem das etapas (lida, comentada, consistente com
`handlers.ts:70-81`); idempotência em 3 camadas (`inbound:106-114, 377-388`;
`confirmacoes:169-204`); fila com falha fechada no Vault.

## 3. Review — Qualidade de código (8 issues)

**C1 [P1] (9/10) 12 actions de arquivar/restaurar sem conferir linhas afetadas
(item 3).** `obras/actions.ts:110-115` e `:156-161`; `pagamentos/actions.ts:130-135`,
`:147-152`; `fornecedores/actions.ts:121-126`, `:138-143`; `documentos/actions.ts:
235-240`, `:251`; `config/categorias/actions.ts:111-119`, `:136-141`;
`config/webhooks/actions.ts:172-181`, **`:211-218` (`regenerarSecret`)**. Todos
`.update().eq('id', id)` sem `.select('id')`. Papel `leitura` vê "arquivado" e nada
mudou; `regenerarSecret` diz que rotacionou e o secret antigo continua válido —
esse é o pior. Inconsistência extra: `archiveObra` não tem `.is('deleted_at',
null)`; categorias e webhooks têm. Correção: D3.

**C2 [P1] (9/10) `automations/tipos.ts:64` `configPadrao?: Record<string,unknown>`;
`config/automacoes/actions.ts:114-150` aceita qualquer objeto; `numero()` cai no
padrão em silêncio (`cobrar-documento-fornecedor.ts:201`).** O "freio de mão" do
go-live (`limite_por_rodada: 3`) não engata com um typo. Correção: D6 —
`configSchema: z.ZodObject<…>.strict()` obrigatório na interface `Automacao`;
`salvarConfigAutomacao` faz `safeParse` e devolve o campo errado; o engine faz
`configSchema.parse({...configPadrao, ...config})` e registra `falha` se inválido.

**C3 [P2] (9/10) `confirmacoes.ts:103-113, 181-184` (`dados.obra_id!`,
`dados.valor!`), `classify-and-persist.ts:132-134`, `pendentes.ts:75,104` — cast
`as DadosExtraidos | null` sem validar (item 7).** JSONB editado à mão em
`/whatsapp` ou vindo do mock chega ao INSERT sem cheque de tipo; `valor: "1.200"`
vira erro do Postgres em produção com mensagem crua no log. Correção: D9.

**C4 [P2] (9/10) `revisao_banco.sql:271-275` `v_user := auth.uid()` → NULL sob
service_role; `merge_fornecedores_rpc.sql` sem parâmetro de ator (grep vazio) —
item 6.** Correção: `p_ator uuid DEFAULT NULL` + `PERFORM set_config('app.ator',
p_ator::text, true)`; trigger: `COALESCE(auth.uid(), NULLIF(current_setting('app.ator',
true), '')::uuid)`. Mesmo gancho serve para `autorizado_id` do WhatsApp depois.

**C5 [P2] (9/10) `lib/data/usuarios.ts:111-114` `getUsuario` = `listUsuarios(true)`
+ `listUsers({perPage:1000})` + `find`.** Duas varreduras por página de usuário.
Correção: `profiles` por `user_id` + `auth.admin.getUserById`.

**C6 [P3] (8/10) 8 `as never` (`fila.ts:70`, `engine.ts:324`, `assistente.ts:
304,321,322`, `indexador.ts:376`, `automacoes/actions.ts:86,142`).** Todos são
`Json` do tipo gerado. Correção única: helper `paraJson<T>(v: T): Json` ou regenerar
`packages/db/src/types.ts` com `Json` mais largo. Some com D6 em 2 deles.

**C7 [P2] (9/10) DRY: 9 cópias da fábrica de service client** (`planilha.ts:65-72`,
`webhooks/uazapi/route.ts:83-85`, `queue/consume/route.ts:51-53`,
`classify-and-persist.ts:65-70`, `detect-duplicates.ts:20-27`, `import-pagamentos.ts:
21-29`, `usuarios.ts:44-52`, `storage/documents.ts`, `bus.ts` do PR #7). Três
comportamentos diferentes quando falta env (retorna `null`, lança, responde 500).
Correção: `lib/supabase/service.ts` com `clienteDeServico(): Client` que lança
`ErroAmbiente` e `tentarClienteDeServico(): Client | null`; um log `service_role_
ausente` só. Entra junto com o item 8.

**C8 [P3] (8/10) `lib/services/inbound-whatsapp.ts:487-506` `buscarAutorizado`
carrega todos os autorizados e normaliza em JS**, sendo que `autorizados.telefone_norm`
(gerada, única) existe desde o PR #21. Correção: `.eq('telefone_norm', telefone)`;
mantém o aviso `autorizados_vazio` com um `count` separado só quando não achar.

Diagramas ASCII em código: `inbound-whatsapp.ts:21-40` tem prosa, não diagrama; o
fluxo da §7.2 abaixo deveria ir para lá. `consumidor.ts:8-28` idem para a §7.1.

## 4. Review — Testes

Framework: Vitest 4.1.11 (CLAUDE.md §5), 17 arquivos, 274 testes. E2E Playwright só
por `workflow_dispatch` (sem staging). **Não há teste de rota HTTP nenhum.**
`processarInbound` e `aplicarConfirmacao` **não têm teste direto**: só aparecem em
`queue/handlers.test.ts` e `consumidor.test.ts` (via mock).

### 4.1 Diagrama de cobertura (código × fluxos de usuário)

```
CODE PATHS                                               USER FLOWS
[~] app/api/webhooks/uazapi/route.ts                     [+] Foto → pergunta → SIM → lançamento
  ├── [GAP] [→E2E] HMAC 401 / JSON 400 / Zod 400 / 429     ├── [GAP] [→E2E] síncrono (prova: test-webhook-uazapi.mjs)
  ├── [GAP] CRIT FILA_WHATSAPP=true → enfileira + 200        ├── [GAP] [→E2E] assíncrono (FILA_WHATSAPP=true)
  └── [GAP] CRIT enfileirar lança → fallback síncrono        ├── [GAP] SIM chega antes da pergunta sair (fila FIFO)
[~] lib/services/inbound-whatsapp.ts (processarInbound)     └── [GAP] duas pessoas, mesma pendência (24 h)
  ├── [GAP] não autorizado → sem resposta                 [+] Painel /pendentes
  ├── [GAP] duplicada (passo 2) e corrida 23505 (passo 6)   ├── [GAP] Confirmar como `leitura` → sem_permissao
  ├── [GAP] áudio transcrito vira "sim"                     └── [GAP] duplo clique Confirmar (jaEstavaResolvida)
  ├── [★★★] interpretarResposta — resposta.test.ts (12)  [+] Arquivar/restaurar (12 actions)
  ├── [★★ ] comandos — comandos.test.ts (7)                ├── [GAP] papel leitura → "arquivado" falso   (C1)
  ├── [★★ ] pergunta — pergunta.test.ts (8)                └── [GAP] regenerarSecret sem efeito          (C1)
  └── [GAP] classificada + pergunta enviada + msgId salvo [+] /config/automacoes
[~] lib/services/confirmacoes.ts                            ├── [GAP] JSON com typo → erro na tela        (C2)
  ├── [GAP] aplicarConfirmacao: ok / ja_resolvida /         └── [★★ ] engine simular/idempotência — engine.test.ts (18)
  │        dados_incompletos / sem_permissao / 23505      [+] Planilha pública
  └── [GAP] recusarConfirmacao: ok / sem_permissao          ├── [GAP] token inválido/revogado/vencido → null
[+] lib/queue                                                └── [GAP] hash: link antigo continua abrindo (backfill)
  ├── [★★★] consumidor — consumidor.test.ts (8)          [+] Retenção
  └── [★★ ] handlers — handlers.test.ts (7)                └── [GAP] anonimiza sem quebrar pagamento.criado_via_msg_id
[+] lib/automations/engine — [★★★] (18)                  LLM: [GAP] [→EVAL] AnthropicClassifier nunca rodou
[~] lib/data/planilha.ts — [GAP] regex do token, null nos 3 casos     contra o modelo (sem chave em ambiente nenhum)
[~] lib/ia/assistente — [★★ ] (7, cliente injetado)

COVERAGE: 6/26 caminhos (23%) | Código: 5/13 | Fluxos: 1/13 | QUALITY: ★★★:4 ★★:4
GAPS: 20 (4 E2E, 1 eval) | REGRESSÃO (regra de ferro): 2 CRIT na rota do webhook
```

### 4.2 Testes que o plano precisa incluir (por item)

| Item | Arquivo de teste | O que afirma |
|---|---|---|
| FILA_WHATSAPP (**CRÍTICO, regressão**) | `app/api/webhooks/uazapi/route.test.ts` (novo; `vi.mock` de `enfileirar`/`processarInbound`) | env `true` → `acao:'enfileirada'`, `processarInbound` não chamado; `enfileirar` lança → `processarInbound` chamado, 200; env ausente → síncrono; 401/400/429 |
| Drenagem em laço (D7) | `queue/consumidor.test.ts` | processa até vazio ou orçamento; 1 por vez; VT não ultrapassado |
| 3 exigirLinhas | `lib/supabase/escrita.test.ts` + `confirmacoes.test.ts` (novo, cliente fake como `engine.test.ts`) | 0 linhas → `sem_permissao`; erro → `db`; n linhas → ok; `aplicarConfirmacao` 5 desfechos; `recusar` 3 |
| 9 configSchema | `automations/engine.test.ts` + `registry.test.ts` (novo) | toda automação em `AUTOMACOES` tem `configSchema`; `configPadrao` passa no próprio schema; chave desconhecida → falha |
| 7 Zod dados | `lib/schemas/dados-extraidos.test.ts` | `valor` string → falha; uuid inválido → falha; conversão de `SaidaSchema` (null → undefined) |
| 1 token hash | `lib/data/planilha.test.ts` | `sha256` estável; formato ruim → null sem query; migration: `--ensaio` + `SELECT count(*) FROM obra_compartilhamentos WHERE token_hash IS NULL` = 0 |
| 6 autoria | SQL de verificação | `SELECT user_id FROM audit_log WHERE entidade='fornecedores' ORDER BY created_at DESC LIMIT 1` não nulo após merge com `p_ator` |
| 4 agregação | `lib/data/pagamentos.test.ts` | RPC devolve o mesmo total que `sumPagamentosBy` (teste de paridade antes de trocar); `.range()` respeita `total` |
| 2 retenção | SQL `--ensaio` | após purga, `pagamentos.criado_via_msg_id` continua resolvendo; `texto_bruto IS NULL` nas antigas |
| 5 search_path | catálogo | `SELECT proname, proconfig FROM pg_proc WHERE prosecdef` — todas `search_path=` vazio; `fila_acordar_consumidor()` devolve "fila vazia", não erro |
| PR #7 | `lib/events/bus.test.ts` (novo) | sem env → não lança, loga; com regra ativa → `automation_executions` recebe linha |

Plano de teste para `/qa` (não posso escrever em `~/.gstack/`): rotas `/pendentes`,
`/obras/[id]` (link da planilha), `/config/automacoes` (JSON inválido),
`/planilha/[token]` (antigo e novo), `/config/filas` (com a chave ligada).

## 5. Review — Performance (5 issues)

**P1 [P2] (9/10) `lib/data/pagamentos.ts:23-55` `listPagamentos` sem `.range()` e
`select('*')` — item 4.** PostgREST/Supabase corta em 1.000 linhas por padrão
(`db-max-rows`), sem aviso: a lista "acaba" na linha 1.000. Hoje 80. Correção:
`.range(offset, offset+limite-1)` + `{count:'exact'}` + paginação na `DataTable`.

**P2 [P2] (9/10) `orcamento-em-risco.ts:33-49` N+1: um `SELECT valor` por obra
ativa dentro do cron.** 10 obras × 394 ms ≈ 4 s; 50 obras ≈ 20 s numa função com
teto. Correção: RPC `gasto_por_obra()` (GROUP BY, `STATUS_QUE_CONTAM`) — D5.

**P3 [P2] (8/10) `lib/data/painel.ts:30-43` baixa **todos** os pagamentos duas vezes
(`valor,data_pagamento,status_pagto,created_at` e `valor`) e todas as mensagens
por render.** Correção: RPC `pagamentos_por_mes(p_meses)` + `sum` no banco;
`gastoTotal` vira `sumPagamentosBy` → RPC.

**P4 [P3] (9/10) `cobrar-documento-fornecedor.ts:94-137`: 3 consultas por pagamento
na condição + `jaAgiuHoje` (`engine.ts:281-301`) = 4 × 394 ms × 25 ≈ 40 s por
rodada.** Cabe nos 300 s (Fluid) mas não no legado de 60 s — plano da Vercel não
verificado. Correção: `pagamentos_sem_documento` já pode devolver `fornecedor_
telefone` e `ultima_cobranca_em`; sobra 1 consulta.

**P5 [P3] (9/10) `buscarAutorizado` (C8) e `getUsuario` (C5)** — já descritos.

Sem issue: índices parciais do PR #21 seguem os filtros reais; `jaRespondida`
usa PK; `buscarConfirmacaoAberta` usa `created_at` ordenado + `limit(1)`.

---

## 6. Saídas obrigatórias

### 6.1 Mapa de erros e resgates (nome de cada erro)

```
CAMADA           ERRO (nome)                              RESGATE                                    USUÁRIO VÊ
webhook route    'webhook secret missing' (500)           nenhum; env                               provider reenvia em loop
                 'invalid signature' (401)                nenhum (correto)                          silêncio
                 'invalid json' / 'schema validation failed' (400)  nenhum                          silêncio
                 429 (resposta429)                        retryApos                                 silêncio
                 fila_indisponivel_processando_sincrono   fallback síncrono (route.ts:113-119)      nada muda
                 processamento_falhou → acao:'erro'       log com correlacao; 200                   silêncio ← GAP (ver 6.3)
inbound          ignorada_nao_autorizada / autorizados_vazio   log                                 silêncio (por desenho)
                 duplicada (passo 2, 6, jaRespondida)     devolve sem agir                          nada
                 midia_nao_baixada / transcricao_falhou / upload_midia_falhou  degrada p/ pendência  pergunta genérica
                 comando_falhou                           texto "Não consegui consultar…"           mensagem
                 assistente_falhou                        cai para classificação                    pendência no painel
                 confirmacao_sem_pagamento (dados_incompletos)  RESPOSTAS.confirmadoSemPagamento    mensagem
                 gravar_mensagem_falhou → acao:'erro'     fila: retenta 3×, arquiva                 silêncio
confirmacoes     nao_encontrada | ja_resolvida | dados_incompletos | erro_insert | sem_permissao   redirect ?error= no painel; no WhatsApp só dados_incompletos responde
                 23505 em pagamentos → busca vencedor     idempotente                               "Lançado ✅"
fila             enfileirar: throw 'Não foi possível enfileirar'   route faz fallback               nada
                 ler: throw → drenar_falhou (por fila)    próximo minuto                            nada
                 concluir_falhou / arquivar_falhou        log; VT devolve → retrabalho              nada (handler idempotente)
                 handler: 'Payload inválido na fila'      3 tentativas rápidas → dead-letter        saude_sistema aviso
                 handler: 'processarInbound falhou'       devolvida (VT 180 s) até 3                idem
                 fila_acordar_consumidor: 'vault sem…'    texto, sem exceção                        fila para EM SILÊNCIO ← só /api/health pega
automations      regra_falhou / varredura_falhou          linha 'falha' em automation_executions    coluna Motivo
                 idempotencia_falhou (erro no count)      falha fechada: não age                    "pulada"
                 registrar_execucao_falhou                log                                       histórico incompleto
                 enviarWhatsapp: 'WhatsApp não configurado' / 'Telefone inválido' / 'Envio falhou'  'falha' no log
banco            pagamentos_obra_arquivada (trigger)      mapDbError                                erro na tela
                 23505 idx_confirmacoes_uma_aberta_por_mensagem  status classificada, sem 2ª pergunta  nada
                 0 linhas por RLS (C1)                    HOJE: NENHUM ← item 3                     "sucesso" falso
```

### 6.2 Modos de falha (por caminho novo)

| Caminho | Falha realista | Teste? | Tratamento? | Silencioso? | Veredito |
|---|---|---|---|---|---|
| Webhook com `FILA_WHATSAPP` | pg_cron desligado / Vault vazio → fila cresce | não | `saude_sistema` avisa | sim até o health | **gap** (T4 + alerta já existe) |
| Consumo em laço (D7) | função morre no meio | consumidor.test cobre VT | sim | não | ok |
| Token hash | backfill parcial → link antigo 404 | não | não | sim | **crítico** → teste de backfill obrigatório |
| exigirLinhas | helper devolve `sem_permissao` para caso legítimo de 0 linhas (já arquivado) | não | — | não | teste `.is('deleted_at', null)` + mensagem "já estava" |
| configSchema | regra em produção com config antiga inválida → engine registra `falha` e **para de cobrar** | não | sim | não (Motivo) | ok se migration valida config existente |
| Zod dados | pendência antiga com `valor` string → `dados_incompletos` | não | sim | responde ao remetente | ok |
| Retenção | Storage purgado, banco não (ou vice-versa) | não | não | sim | **crítico** → job em duas fases com `sync_runs`-like |
| search_path '' | referência não qualificada em `fila_*` | ensaio não pega (só executa DDL) | não | **sim** | **crítico** → chamar cada função depois da migration |
| Autoria RPC | `set_config` fora de transação vaza para a próxima query do pool | não | `is_local=true` resolve | sim | ok com `true` |
| PR #7 | `emitir` sem env em preview | bus.test novo | log | não | ok |
| Fase 6 sync | ERP 2.955 chamadas → rate limit | — | fila + `sync_runs` | — | desenho ok, M1 |

**Gaps críticos (sem teste, sem tratamento, silencioso): 3** — backfill do hash,
retenção em duas fases, `search_path=''` nas funções da fila.

### 6.3 Recomendações opinativas

1. **Ordem por risco ao cliente, não por valor.** O plano ordena "por valor" e põe
   o token hash em 1º. Um typo em `config` da cobrança (C2) manda 25 WhatsApps para
   fornecedores reais; o token em claro precisa de um vazamento de dump. C2 primeiro.
2. **`processarInbound` sem teste direto é a dívida mais cara do repo.** 274 testes
   e o coração do produto é exercitado só por mock. Antes de mexer em `confirmacoes.ts`
   (item 3) escreva `confirmacoes.test.ts` com cliente fake — `engine.test.ts` já
   mostra como. "Systems over heroes".
3. **`acao:'erro'` no caminho síncrono responde 200 e o remetente recebe silêncio**
   (`route.ts:122-127`). Quem mandou a foto não sabe que nada aconteceu. Uma linha:
   `enviarTexto(telefone, 'Não consegui processar agora; o gestor foi avisado.')`
   best-effort. Não está no plano; deveria.
4. **`search_path=''` por último e por família.** Zero valor visível, blast radius
   inclui a fila. Não é "1h, migration só": é 1h + provar cada função depois.
5. **Uma fábrica de service client (C7) antes do item 8**, senão o item 8 troca 3
   cópias e deixa 6.
6. **Fase 6: não comece o M1 sem HTTPS.** E declare `erp_sync` na whitelist do banco
   na mesma migration das tabelas `erp_*`, para o `satisfies` de `FILAS` não deixar
   a fila existir só de um lado.

### 6.4 O que NÃO está no escopo (considerado e adiado)

- Staging Supabase + E2E em PR — decidido no PR #14; os [→E2E] acima ficam como
  "prova em produção com scripts" até existir staging.
- Partição por tempo em `mensagens_whats` — volume de dezenas/dia não justifica.
- PostgREST aggregates ligado globalmente — RPC é o padrão (D5).
- NestJS / Python / VPS — decididos na FASE 0.
- Pipeline de credencial do ERP (env + Vault + `fila_valida`) — desenhar no M1.
- Purga de `audit_log` — decisão jurídica, fora.
- `IA_AUTO_APROVAR` — decisão de produto fechada; não reabrir.
- Regenerar `packages/db/src/types.ts` (C6) — só se o `Json` largo não bastar.

### 6.5 O que já existe (reuso vs. reconstrução)

Reusa bem: RPC como padrão de filtro no banco; crons de manutenção como molde de
retenção; `flash-secret` para o token (o plano **não** cita — é o único reuso que
falta); `engine.test.ts` como molde de cliente fake; `pareceUuid()` nos ids.
Reconstrói sem precisar: nada. Ignora duplicação existente: as 9 fábricas de
client (C7) e os 2 shapes de `dados_extraidos` (C3).

### 6.6 Paralelização em worktrees

| Passo | Módulos | Depende de |
|---|---|---|
| S1 helper `exigirLinhas` + 12 actions + `confirmacoes.ts` | `lib/supabase/`, `app/(app)/*/actions.ts`, `lib/services/confirmacoes.ts` | — |
| S2 `configSchema` + Zod dados | `lib/automations/`, `lib/schemas/`, `lib/ia/`, `app/(app)/config/automacoes/` | — |
| S3 PR #7 remerge | `lib/events/`, `pagamentos/actions.ts`, `documentos/actions.ts`, `classify-and-persist.ts` | S1 (mesmos actions) |
| S4 fila: laço + teste de rota | `lib/queue/`, `app/api/queue/`, `app/api/webhooks/` | — |
| S5 token hash | `lib/data/planilha.ts`, `compartilhamentos.ts`, `obras/actions.ts`, migration | S1 (obras/actions) |
| S6 fábrica de client + item 8 + autoria RPC | `lib/supabase/`, `lib/services/`, `lib/data/usuarios.ts`, migration | — |
| S7 agregação/paginação | `lib/data/`, migration | — |
| S8 retenção | migration + cron + Storage | decisão do cliente |
| S9 `search_path=''` | migrations | S6, S8 (todas as funções existem) |

Lanes: **A** = S1 → S3 → S5 (sequencial, `app/(app)/*/actions.ts`); **B** = S2;
**C** = S4; **D** = S6 → S9; **E** = S7; S8 quando o prazo vier. Lançar A, B, C, D, E
em paralelo. Conflito: B e D tocam `lib/services/classify-and-persist.ts`
(Zod) e `lib/services/*` (fábrica) — coordenar ou serializar B antes de D.

### 6.7 Implementation Tasks

- [ ] **T1 (P1, human ~4h / CC ~30min)** — automations — `configSchema` `.strict()`
  por automação; validar em `salvarConfigAutomacao` e no engine. Surfaced by: C2.
  Files: `lib/automations/tipos.ts`, `definitions/*.ts`, `engine.ts`,
  `app/(app)/config/automacoes/actions.ts`. Verify: `registry.test.ts` novo + vitest.
- [ ] **T2 (P1, ~4h / ~40min)** — actions — helper `exigirLinhas` + 12 actions +
  4 blocos de `confirmacoes.ts`; `confirmacoes.test.ts`. Surfaced by: C1, D3.
  Verify: vitest; manual: papel `leitura` em `/obras/[id]` → erro, não "arquivado".
- [ ] **T3 (P1, ~3h / ~30min)** — webhook/fila — `route.test.ts` (3 cenários da chave)
  + laço de drenagem com orçamento em `consume/route.ts` + `timeout_milliseconds`.
  Surfaced by: A2, regra de regressão. Verify: vitest; prod: `test-webhook-uazapi.mjs`
  com `FILA_WHATSAPP=true` e `/config/filas` esvaziando em <60 s.
- [ ] **T4 (P1, ~2h / ~20min)** — PR #7 — remerge `main`, `console.error` → `log.erro`,
  reler rollback de documentos, `bus.test.ts`. Surfaced by: A1. Verify: CI verde na
  ponta nova; `git diff origin/main...feat/emitir-eventos --stat` = 4-5 arquivos.
- [ ] **T5 (P2, ~2h / ~20min)** — schemas — `DadosExtraidosSchema` (Zod 3) usado em
  `confirmacoes`, `pendentes`, `classify-and-persist`; conversão de `SaidaSchema`.
  Surfaced by: C3, D9. Verify: `dados-extraidos.test.ts`.
- [ ] **T6 (P2, ~3h / ~30min)** — planilha — `token_hash`, backfill, `flash-secret`,
  RPC com hash. Surfaced by: A3, D2. Verify: link gerado antes da migration ainda abre.
- [ ] **T7 (P2, ~2h / ~20min)** — supabase — `lib/supabase/service.ts`; trocar 9
  cópias; sessão em `import-pagamentos` e `detect-duplicates`. Surfaced by: C7, A6.
- [ ] **T8 (P2, ~1h / ~10min)** — db — `p_ator` + `set_config` + `COALESCE` no
  trigger. Surfaced by: C4. Verify: SQL de autoria após um merge.
- [ ] **T9 (P2, ~4h / ~45min)** — data — RPCs `gasto_por_obra`, `pagamentos_por_mes`;
  `.range()` em `listPagamentos`; paridade com `sumPagamentosBy`. Surfaced by: P1-P3.
- [ ] **T10 (P2, ~3h / ~30min)** — db — retenção por anonimização em duas fases +
  cron; `audit_log` fora. Surfaced by: A5, D4. Blocked by: prazo do cliente.
- [ ] **T11 (P3, ~2h / ~30min)** — db — `search_path=''` por família + prova de cada
  função. Surfaced by: A4. Blocked by: T7, T10.
- [ ] **T12 (P3, ~30min / ~5min)** — inbound — `telefone_norm` em `buscarAutorizado`;
  `getUserById`. Surfaced by: C8, C5.
- [ ] **T13 (P3, ~30min / ~5min)** — inbound — resposta best-effort quando
  `acao:'erro'`. Surfaced by: 6.3 #3.

_JSONL de tarefas não escrito: `bin/` indisponível neste modo._

---

## 7. Diagramas

### 7.1 Fila pgmq (com `FILA_WHATSAPP=true`, após D7)

```
UAZAPI ──POST──▶ /api/webhooks/uazapi
                  │ HMAC ─▶ 401
                  │ Zod  ─▶ 400
                  │ rate ─▶ 429
                  ▼
           fila_enfileirar('whatsapp_inbound', {payload})  ──falha──▶ processarInbound síncrono (fallback)
                  │ 200 {acao:'enfileirada', jobId}
                  ▼
      pgmq.q_whatsapp_inbound   ◀── VT 180 s expira: volta, read_ct+1
                  │
  pg_cron '* * * * *' ─▶ fila_acordar_consumidor()
                  │  sum(na_fila)=0 → 'fila vazia' (sem HTTP)
                  │  Vault sem url/secret → texto, fila PARA em silêncio (health avisa)
                  ▼  net.http_get(url, Bearer) timeout 5 s (resposta ignorada)
           GET /api/queue/consume  (401 sem bearer)
                  │  for fila in HANDLERS:  [D7: repete até vazio ou 50 s]
                  │    ler(1) → handler → concluir | throw → devolvida
                  │    read_ct > 3 → arquivar → pgmq.a_whatsapp_inbound (dead-letter)
                  ▼
           processarInbound (idempotente por msg_id_uazapi)
```

### 7.2 Confirmação (o elo do briefing)

```
mensagem ─▶ autorizado? ─não─▶ ignora (sem resposta)
   │sim
   ▼
dedupe msg_id_uazapi ─dup─▶ 'duplicada'
   │
   ▼
mídia + transcrição (nunca lança)
   │
   ▼
interpretarResposta(texto) ── 'outro' ──▶ comando? ─▶ pergunta? ─▶ grava + classifica
   │ 'sim' | 'nao'                                                     │
   ▼                                                                   ▼
buscarConfirmacaoAberta(telefone, 24 h) ─nenhuma─▶ segue como 'outro'  abre confirmacoes_pendentes
   │ pendência                                                         (23505 → já perguntou)
   ├─'sim'─▶ aplicarConfirmacao ─▶ obterOuCriarPagamento (pré-checagem + 23505)
   │           ├─ dados_incompletos ─▶ "faltaram dados… gestor revisa"
   │           ├─ sem_permissao (0 linhas) ─▶ log            [item 3: mesmo padrão nas 12 actions]
   │           └─ ok ─▶ mensagens_whats.confirmada + pendência.resolvida ─▶ "Lançado ✅"
   └─'nao'─▶ recusarConfirmacao ─▶ status 'recusada' ─▶ "Ok, cancelei…"
                                                        ▲
           /pendentes (painel, sessão + RLS) ───────────┘  mesmo service, cliente diferente
```

### 7.3 Retenção (D4)

```
cron 03:35 UTC ─▶ anonimizar_mensagens_whats(p_dias)
   │  SELECT id, midia_storage_path FROM mensagens_whats
   │   WHERE created_at < now() - p_dias AND status IN ('confirmada','recusada','erro')
   │     AND anonimizada_em IS NULL LIMIT 500
   ├─ fase 1 (banco): texto_bruto/texto_transcrito/dados_extraidos = NULL,
   │                  telefone_from = '***' || right(telefone_from,4), anonimizada_em = now()
   │                  (linha, status, pagamento_id, criado_via_msg_id PERMANECEM)
   └─ fase 2 (storage): DELETE FROM storage.objects WHERE name LIKE 'whatsapp/<msg_id>/%'
        falha na fase 2 ─▶ linha em purga_pendente para a próxima rodada (não silencia)
ai_messages: mesma forma, 365 d.   audit_log: FORA (registro financeiro).
```

---

## 8. Plano travado

| # | Item | Antes/depois de 16/09 | Esforço | Risco | Decisão travada | Teste que prova |
|---|---|---|---|---|---|---|
| 1 | **9** `configSchema` por automação | depois (17/09), **antes de ligar cobrança** | S | baixo | D6: `.strict()`, validado na tela e no engine | `registry.test.ts`; JSON com typo → erro na tela |
| 2 | **3** `exigirLinhas()` | depois (17-18/09) | S-M | baixo | D3: helper único, 12 actions + `confirmacoes.ts` | `escrita.test.ts` + `confirmacoes.test.ts`; papel `leitura` não vê "arquivado" |
| 3 | PR #7 emitir eventos | depois | S | médio (caminho quente) | D8: remerge, log estruturado, rollback conferido | CI na ponta nova; `bus.test.ts`; 1 pagamento criado → linha `pulada` em `automation_executions` |
| 4 | **7** Zod em `dados_extraidos` | depois, **antes de `IA_PROVIDER=anthropic`** | S | baixo | D9: schema Zod 3 único | `dados-extraidos.test.ts`; pendência com `valor:"x"` → `dados_incompletos` |
| 5 | `FILA_WHATSAPP` | depois, após #3 e T3 | S (+T3) | médio | D7: laço de drenagem + teste de rota antes da chave; canário com `test-webhook-uazapi.mjs` | `route.test.ts`; em prod `/config/filas` vazia <60 s após 3 fixtures |
| 6 | **1** token hash | depois | M | médio (links vivos) | D2: `token_hash`, backfill in-place, flash-secret | link gerado antes da migration abre depois |
| 7 | **8** service role → sessão | depois | S | baixo | uma fábrica (C7); admin API só em `usuarios` | import como `financeiro` respeita RLS (manual) |
| 8 | **6** autoria nas RPCs | depois | S | baixo | `p_ator` + `set_config(…, true)` | `audit_log.user_id` não nulo após merge |
| 9 | **4** paginação/agregação | depois, **antes do M3 da Fase 6** | M | baixo | D5: RPC, não aggregates | paridade com `sumPagamentosBy`; lista com 1.001 linhas mostra todas |
| 10 | **2** retenção | depois, após decisão do cliente | M | médio | D4: anonimizar, duas fases, `audit_log` fora | `--ensaio` + `criado_via_msg_id` resolve após purga |
| 11 | **5** `search_path=''` | depois, por último | M | médio (fila) | por família, provar cada função | `pg_proc.proconfig`; `fila_acordar_consumidor()` devolve texto, não erro |
| 12 | Fase 6 **M0** | humano, paralelo | — | alto (parceiro) | D10: HTTPS obrigatório; `erp_sync` na whitelist junto com `erp_*` | `GetFuncionarios` real devolvendo 43 via HTTPS |

Antes de 16/09: **nada** deste plano. Só correção de bug de demo. T13 (resposta em
`acao:'erro'`) é candidata a "bug", mas mexe no inbound sem teste direto: depois.

---

## 9. Completion status

**DONE_WITH_CONCERNS.**

- Step 0: escopo aceito como está (D1), com reordenação.
- Arquitetura: 7 issues (3 P1). Qualidade: 8 (2 P1). Testes: diagrama, 20 gaps, 2
  regressões críticas. Performance: 5. Gaps críticos de falha: 3. Outside voice:
  **não rodou** (Codex/subagente vetados neste modo). Paralelização: 5 lanes.
- Lake Score: 10/10 decisões escolheram a opção completa.
- **Concerns / não verificado:** policies de INSERT de `pagamentos` para
  `financeiro` (A6, 7/10); plano da Vercel e Fluid Compute (P4); `ON DELETE` das FKs
  para `mensagens_whats` (A5); se `handlers.test.ts` mocka `processarInbound`
  (inferido pelo grep, não lido); `git merge-tree` em modo legado (0 marcadores) —
  o remerge do PR #7 precisa ser feito de verdade; nenhuma consulta ao banco de
  produção nesta review (só catálogo via migrations).
- Aprendizado durável: "PR #7 ficou 2 dias parado e `main` andou 6 PRs; branch
  'já sincronizada' vence em horas neste repo — conferir `merge-base` antes de dizer
  'pode mergear'". Não logado (`bin/` indisponível).

### Para o engenheiro de release — o que precisa estar verde para um PR ser mergeável

1. `ci.yml` verde **na ponta atual** da branch, com `main` mergeada há < 24 h
   (`git merge-base --is-ancestor origin/main HEAD` = sim).
2. Os três comandos locais: `pnpm --filter web typecheck`, `vitest run` (≥ 274),
   `pnpm --filter web build`. Lint só dos arquivos tocados, e typecheck **de novo**
   depois do `biome --fix`.
3. Migration: `apply-migration.mjs <arquivo> --ensaio` OK **e** consulta ao catálogo
   citada na descrição do PR (`pg_policies`/`pg_proc`/`pg_indexes`), objeto a objeto.
4. Nenhum `console.*` novo em `lib/` ou `app/api` (`grep -rn "console\." --include=
   *.ts lib app/api` sem linhas novas); telefone só via `logger`.
5. Nenhum secret no diff (`git diff origin/main | grep -iE 'key|token|secret' `
   revisado à mão); `.env.local` e `dados-iniciais/` fora.
6. Item que muda comportamento em produção (FILA, PR #7, token) chega **atrás de
   chave ou com backfill idempotente**, e o PR diz como desligar em uma linha.
7. Teste novo para todo caminho que o PR cria; regressão (chave `FILA_WHATSAPP`)
   é bloqueante, sem exceção.
8. Verificação em produção **depois** do deploy READY, no domínio de produção (preview
   tem SSO): uma request real, corpo lido, JSON e não HTML.
9. `CLAUDE.md` §7 atualizado no mesmo PR quando o estado muda.

### Suppressed findings (confiança ≤ 5)

- (5/10) `import-pagamentos` pode contornar `pagamentos_bloquear_obra_arquivada`? Não:
  trigger vale para service_role. Suprimido.
- (4/10) `registrar_acesso_compartilhamento` é `SECURITY DEFINER` com `EXECUTE` para
  quem? Não lido o GRANT; se `anon` tiver, é oráculo de tokens por timing. Verificar.
- (4/10) `net.http_get` com resposta ignorada pode acumular `net._http_response`;
  Supabase purga sozinha (padrão 6 h). Não verificado neste projeto.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | vetado neste modo |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES_OPEN (PLAN) | 20 issues, 3 critical gaps, 2 regressões críticas |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT:** eng review required — plano travado com reordenação; nenhum item é
mergeável antes de T1–T4 existirem com teste. Sem outside voice.

**UNRESOLVED DECISIONS:**
- Prazo de retenção de `mensagens_whats`/`ai_messages` (sugestão 365 d) — decisão do cliente.
- Purga de `audit_log`: manter indefinidamente até parecer jurídico.
- Fase 6: caminho A/B/C (recomendado C começando por B) e quem recebe o quê no WhatsApp.
- Plano da Vercel (Hobby legado vs Fluid 300 s) — determina o teto do consumidor da fila.
