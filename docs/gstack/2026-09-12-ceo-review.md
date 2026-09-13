---
status: ACTIVE
skill: plan-ceo-review (gstack)
modo_execucao: degradado, SESSION_KIND=spawned (decisões automáticas, registradas como D<N>)
---
# CEO Review: roadmap pós-entrega do CRM Cavalcanti

Gerado em 2026-09-12 · Branch `feat/gstack-time-virtual` · Base `main` (GitHub, `NogmaBR/CRM-CAVALCANTI`, público)
Modo: **SELECTIVE EXPANSION** · Plano revisado: `docs/PLANO-ARQUITETURA-CODE-FIRST.md`, `PLANO-FASE-6.md`,
`SO-FALTA-VOCE.md`, `ROTEIRO-GO-LIVE.md`, `ROTEIRO-DEMO-16-09.md`, `PLANO-BANCO-PREMIUM.md` §Próximos passos,
`PLANO-FRONTEND-PREMIUM.md`, `BLOCO-2-FLUXO-WHATSAPP.md`, `VERIFICACAO-BRIEFING-16-09.md`, `ALINHAMENTO-CAVALCANTI-16-09.md`.

**Modo degradado (documentado na própria skill):** nada em `~/.claude/skills/gstack/bin` ou `browse` foi executado.
Preamble, Telemetry, Brain Context, Artifacts Sync, Prior Learnings, Plan-tune, decision-log, Aside e Codex/outside
voice foram pulados. Sem AskUserQuestion: cada decisão escolheu a opção recomendada e está registrada abaixo.
Nenhum código foi alterado. Nenhum arquivo fora de `docs/gstack/` foi tocado.

---

## A frase que resume a revisão

O sistema entrega o **ciclo** contratado (mensagem → pergunta → SIM → lançamento) e entrega muito bem a
**operação** (filas, saúde, backup, log, RLS). O que ele ainda não entrega é a **primeira metade da frase do
contrato**: "manda a **foto** da nota, a IA extrai os dados". Hoje a IA nunca vê a foto. Os dados saem da
legenda que a pessoa digitou. E a foto, depois de confirmada, não vira documento do pagamento. O roadmap
pós-entrega põe a Fase 6 (vendas) na frente disso. Esta revisão inverte a ordem.

---

## Auditoria do sistema (antes do Step 0)

| Item | Estado verificado |
|---|---|
| `git status` na branch | limpo; `git stash list` vazio. Sem trabalho de outra sessão em voo |
| Últimos 30 commits | PRs #12 a #21 mergeados em 48h; só docs desde `e9add70` |
| Arquivos mais tocados (30 dias) | `CLAUDE.md` (21), `packages/db/src/types.ts` (14), `docs/SO-FALTA-VOCE.md` (12), `lib/supabase/middleware.ts` (8), `lib/services/classify-and-persist.ts` (7) |
| TODO/FIXME em código | zero reais (os 4 matches são "TODOS" em português) |
| `TODOS.md` | não existe no repo; o equivalente é `docs/SO-FALTA-VOCE.md` |
| PRs abertos | #7 `feat/emitir-eventos` (adiado para depois de 16/09 por decisão registrada) |
| Design doc / handoff gstack | nenhum (`docs/designs/` não existe; `.gstack/` ignorado) |
| Testes | 17 arquivos `*.test.ts`, todos em `apps/web/lib` (zero em `app/`); CLAUDE.md fala em 274 testes |
| `maxDuration` | nenhum configurado em `app/` nem em `vercel.json`: o webhook síncrono roda no limite padrão do plano |

**Calibração de gosto** (referências para o que vier depois):

- Bom: `apps/web/lib/services/inbound-whatsapp.ts` — cada etapa tem o porquê da ordem escrito em cima dela.
- Bom: `apps/web/lib/services/confirmacoes.ts` — um serviço, dois chamadores (painel e WhatsApp), idempotência em
  duas camadas, e cada UPDATE confere linhas afetadas.
- Bom: `apps/web/lib/automations/engine.ts` — toda avaliação vira linha, inclusive `pulada`; falha fechada na
  idempotência (`jaAgiuHoje` devolve `true` se o banco falhar).
- Ruim: `apps/web/lib/services/classify-and-persist.ts:90` — `midiaUrl: null, // hoje não baixamos; ver nota no
  header`. O comentário ficou velho: a mídia É baixada (em `materializarMidia`), mas ninguém a entrega ao
  classificador. Comentário desatualizado escondendo um furo de contrato.
- Ruim: `inbound-whatsapp.ts:246-249` — `classifyAndPersist(...).catch(err => ({ ok:false, error }))` sem nenhum
  `log.erro`. O erro morre ali.

**Os seis furos, com id (referenciados pelo id no resto do documento):**

| Id | Furo | Onde |
|---|---|---|
| G1 | 400 do Zod no webhook sem log nenhum; payload real nunca visto | `route.ts:54-64`, `schemas/uazapi.ts` |
| G2 | HMAC do provider é palpite (`x-signature`, hex); sem prova | `route.ts:43`, `hmac.ts` |
| G3 | Erro do classificador (ctor sem chave, 401/429/529, timeout) engolido; mensagem fica `processando` | `inbound-whatsapp.ts:246-249` |
| G4 | A foto nunca chega ao modelo; só a legenda | `classify-and-persist.ts:90`, `anthropic-classifier.ts:99-117` |
| G5 | Mídia confirmada não vira `documentos`; cobrança cobra a nota que já chegou | `confirmacoes.ts:163-214`, `cobrar-documento-fornecedor.ts:130-138` |
| G6 | Webhook síncrono com download (16 s) + transcrição (30 s) + modelo, sem `maxDuration`: função morta no meio não passa por catch nenhum | `route.ts:122`, `uazapi.ts:42`, `transcricao.ts:33` |

**Retrospectiva:** `classify-and-persist.ts` e `middleware.ts` foram tocados 7 e 8 vezes em 30 dias. Os dois são
onde esta revisão encontrou os furos. Área que muda toda semana é área que ainda não fechou.

---

## Step 0 — Desafio de escopo e modo

### 0A. Premissa

1. **O problema certo?** O roadmap trata a entrega de 16/09 como "falta credencial" e parte para a Fase 6. A
   premissa é que o fluxo central está pronto e só não roda. Está **parcialmente** errada: com credenciais
   perfeitas, uma foto de nota **sem legenda** termina em "faltaram dados, o gestor vai revisar no painel"
   (`inbound-whatsapp.ts:317-324`, código `dados_incompletos` de `confirmacoes.ts:104-110`). Isso é a aprovação
   manual que o contrato elimina.
2. **Resultado real?** O gestor da Cavalcanti quer parar de digitar. O caminho mais direto não é o ERP de vendas;
   é fazer a foto virar lançamento **e** documento sem legenda.
3. **Se nada for feito?** A demo de 16/09 passa **só se** o apresentador digitar a legenda com valor, obra e
   fornecedor (é o que `ROTEIRO-DEMO-16-09.md` §3 manda fazer). No dia a dia da obra a legenda não vem, e o
   sistema devolve "o gestor vai revisar". O cliente vai perceber na primeira semana.

### 0B. Alavancagem do que já existe

| Sub-problema | Já existe | Reaproveita? |
|---|---|---|
| Bytes da imagem/PDF na hora do webhook | `materializarMidia` em `inbound-whatsapp.ts:407-448` já tem `download.bytes` e `mime` | Sim: falta só passar para o classificador. Hoje o buffer é jogado fora depois do upload |
| Chamada estruturada ao Claude | `anthropic-classifier.ts:119-132` (`messages.parse` + `zodOutputFormat`) | Sim: o `content` vira array com bloco `image`/`document` (base64) mais o texto. Uma mudança de tipo, não de arquitetura |
| Guardar documento ligado a pagamento | tabela `documentos`, bucket `documents`, policies de storage por ownership (PR do Bloco 1) | Sim: `mensagens_whats.midia_storage_path` (`inbound-whatsapp.ts:369`) já aponta para o arquivo em `whatsapp/…`. Nenhum código lê essa coluna hoje (grep: só a escrita) |
| Retentativa de envio de WhatsApp | handler `whatsapp_outbound` em `lib/queue/handlers.ts:50-65` lança e a fila retenta 3x (`MAX_TENTATIVAS`, `tipos.ts:121`) | Sim: a pergunta de confirmação (`inbound-whatsapp.ts:257`) chama `enviarTexto` direto, sem retry. Enfileirar reaproveita o que existe |
| Ver erro do classificador | `lib/log.ts` com `comContexto`; `mensagens_whats.status='erro'` + `erro_msg` | Sim: só falta chamar |
| Provar o formato do provider | `scripts/test-webhook-uazapi.mjs` + `scripts/fixtures/uazapi/*.json` | Parcial: as fixtures foram **escritas por nós**, nunca capturadas do provider |

Nada do plano reconstrói o que existe. O risco é o contrário: o plano assume que o que existe está completo.

### 0C. Estado-sonho (12 meses)

```
  ESTADO ATUAL (12/09)                  O PLANO (SO-FALTA-VOCE + FASE 6)          IDEAL EM 12 MESES
  ------------------------------------  ---------------------------------------  -----------------------------------
  Ciclo SIM funciona (sem provider)     + credenciais, equipe, Pro, backup       Foto/áudio/texto viram lançamento
  IA lê só a legenda, nunca a foto  --> (não toca nisso)                    -->  E documento, sem legenda, em <20 s
  Foto não vira `documentos`            (não toca nisso)                         Nota fica no pagamento; cobrança só
  Webhook: formato assumido             "descubra o HMAC antes do dia 16"        cobra o que falta de verdade
  Classificador: erro engolido          (não toca nisso)                         Todo erro tem nome, log e tela
  Filas prontas, desligadas             FILA_WHATSAPP=true depois de 16/09       Webhook <100 ms, tudo por fila
  Automações desligadas                 ligar com freio (limite 3/dia)           Cobrança, orçamento, saúde ligadas
  Painel ok em desktop e celular        (feito no PR #20)                        Idem
  Vendas: ERP CRM005 fora               Fase 6 M0-M5, 4-6 sem (8 com M5)        Agenda/inadimplência no WhatsApp do
                                                                                  vendedor, escrita no ERP com SIM
```

O plano anda na direção certa em operação e vendas, e **não anda** nos três furos do fluxo central. Sem eles, os 12
meses chegam com o WhatsApp sendo "mande a legenda completa", que é um formulário disfarçado.

### 0C-bis. Alternativas de implementação

```
APROACH A: Congelar e seguir o plano como está (mínimo viável)
  Resumo:  Só ações humanas até 16/09; dia 17 começa Fase 6 M0. Os furos viram itens de SO-FALTA-VOCE.
  Esforço: S (zero código antes; Fase 6 como planejada)
  Risco:   Alto para o contrato. Baixo para o deploy.
  Prós:    respeita o congelamento à risca; nenhuma mudança em produção na semana da entrega
  Contras: o cliente descobre na 1ª semana que precisa digitar a legenda; a nota enviada pelo WhatsApp some do
           pagamento e a cobrança automática cobra o fornecedor por ela; se o payload real da UAZAPI for
           diferente do assumido, a demo morre no 400 e ninguém vê por quê
  Reusa:   tudo; não muda nada

APROACH B: "Fechar o contrato antes de vender" (recomendada)
  Resumo:  Dois blocos pequenos e cirúrgicos. Bloco B0 (antes de 16/09, cabe em "correção de bug"): a IMAGEM
           (só foto; PDF fica para B1) entra no prompt do Claude, relida do Storage; erro do classificador vira
           log + status; 400 do webhook vira registro do formato (chaves e tipos, sem valores). Bloco B1 (17/09
           a ~26/09, antes da Fase 6): PDF no prompt; mídia confirmada vira `documentos`; adaptador do payload
           real da UAZAPI; Zod em `dados_extraidos`; FILA_WHATSAPP=true. PR #7 é item separado, não conta na
           semana. Fase 6 M0 corre em paralelo porque é humana (respostas do parceiro do ERP).
  Esforço: B0 = S (humano ~1 dia / CC ~2 h). B1 = M (humano ~1 semana / CC ~1 dia)
  Risco:   Médio em B0 (mexe no coração na semana da entrega; D3 fica atrás de `IA_PROVIDER=anthropic`, que hoje
           é mock; D4 e D5 não têm chave e entram valendo). Baixo em B1.
  Prós:    a promessa "manda a foto" vira verdade; cobrança automática deixa de cobrar nota que já chegou;
           o primeiro dia real de WhatsApp tem log em vez de silêncio
  Contras: atrasa o M1 da Fase 6 em ~1 semana; B0 exige `ANTHROPIC_API_KEY` para ser testado de verdade, e ela
           nunca existiu em ambiente nenhum
  Reusa:   `materializarMidia`, `messages.parse`, bucket/policies, fila `whatsapp_outbound`, `lib/log.ts`

APROACH C: Arquitetura ideal já (fila em três jobs, transcrição e IA como handlers, Python/LangGraph)
  Resumo:  Picar `processarInbound` em `midia` → `ia_classificacao` → resposta, com handlers próprios.
  Esforço: L
  Risco:   Alto: reordena etapas que o próprio código diz que "cada troca já custou um bug"
           (`lib/queue/handlers.ts:70-81`); contradiz a FASE 0 (sem Python, sem NestJS) e o congelamento.
  Prós:    webhook fica trivial; cada etapa retenta sozinha
  Contras: nenhum ganho para o cliente antes de dezembro; o ganho da fila já está no job único
  Reusa:   filas `midia`/`ia_classificacao` reservadas
```

**RECOMENDAÇÃO:** B, porque "engineered enough": o menor diff que fecha o contrato, apoiado no que existe, sem
abrir a arquitetura. A é atalho que empurra o custo para o cliente; C é reescrita sem valor no horizonte de 90 dias.

**D1 — Aprovação da abordagem: escolhido B (auto, spawned)** porque é a única que fecha os três furos do contrato
com diff pequeno e reaproveita tudo. `Completeness: A=4/10, B=9/10, C=9/10 (mas fora de prazo e de decisão)`.
ELI10: hoje a IA recebe "chegou uma imagem" e não a imagem; a nota confirmada não fica no pagamento; e o formato
do webhook é um palpite. B conserta os três com pouco código. Stakes se errar: A entrega um produto que exige
legenda; C atrasa vendas 2 meses. Net: trocar uma semana de Fase 6 por um contrato cumprido.

### 0F. Modo

Iteração sobre sistema em produção, plano com >15 arquivos já entregues, entrega a 4 dias: o padrão da skill é
SELECTIVE EXPANSION (manter o escopo como base, blindar, e oferecer expansões uma a uma).
Não é HOLD porque o escopo atual tem furos de contrato que "blindar" não resolve; não é EXPANSION porque a semana
é de congelamento; não é REDUCTION porque o que há para cortar já está desligado atrás de chave.

**D2 — Modo: escolhido SELECTIVE EXPANSION (auto, spawned).** Nota: as opções diferem em tipo, não em cobertura;
sem nota de completude. Sob este modo, a abordagem B se mantém.

### 0D. Análise do modo

**Complexidade:** o plano pós-entrega toca 5 áreas (credenciais/humano, filas, automações, Fase 6, higiene do
banco). Nenhuma nova classe ou serviço além do adaptador do ERP (`lib/services/erp/`, Fase 6 M1). Não é smell.

**Mínimo que atinge o objetivo ("cliente manda foto e vê o lançamento sem ninguém tocar", `PLANO-ARQUITETURA` Fase
1):** imagem no prompt + credenciais + equipe cadastrada + payload real conferido. Tudo o mais pode esperar sem
bloquear o objetivo: filas ligadas, PR #7, Vercel Pro, domínio, RAG, Fase 6.

**10x:** o gestor manda a foto e recebe de volta, em 15 segundos, "R$ 850,00, Zé da Areia, obra Garibaldi, NF
1234, confirma?"; responde SIM; recebe "Lançado. A Garibaldi está em 6,2% do orçamento; faltam 3 notas do Zé".
Nunca abre o painel. O painel vira o lugar do relatório, não da operação. Isso é a mesma arquitetura de hoje mais
imagem no prompt, documento ligado, e um resumo de duas linhas depois do SIM.

**Delícias de 30 minutos** (candidatas, não escopo):
1. Depois do "Lançado ✅", uma linha com o total da obra no mês (a ferramenta `gasto_por_obra` já existe em
   `lib/ia/ferramentas/obras.ts:210`).
2. "sim" fora da janela de 24 h responde "essa confirmação venceu; o gestor vê no painel" em vez de virar
   `nao_identificado` em silêncio.
3. Pergunta de confirmação termina sempre com "Responda SIM ou NÃO" (o mock diz "[S/N]", o Claude escreve o que
   quiser).
4. `/whatsapp` mostra a foto recebida (o path está em `midia_storage_path`; a tela não o usa).
5. Alerta de saúde vai para quem tem "recebe alertas" marcado, não para o primeiro autorizado por `created_at`
   (`alertar_se_doente`, migration `20260910250000_saude.sql`).

**Plataforma:** imagem no prompt + documento ligado ao pagamento é a infraestrutura de que a Fase 6 M4 (escrita no
ERP com SIM) e o RAG sobre documentos (Fase 4, "quando os PDFs entrarem no sistema, basta um indexador novo")
dependem. É o mesmo trilho.

### Cherry-pick (posição neutra; escolha automática registrada)

Dez propostas (D3 a D12): cinco aceitas, cinco deferidas.

| # | Proposta | Fecha | Esforço | Risco | Decisão (auto) | Antes ou depois de 16/09 |
|---|---|---|---|---|---|---|
| D3 | Foto entra no prompt do Claude: bloco `image` base64, **relido do Storage por `midia_storage_path`** (funciona igual no webhook síncrono e na fila); imagem acima de 5 MB é reduzida ou recusada com motivo antes do base64. PDF (`document`) só em B1 | G4 | S | Baixo (atrás de `IA_PROVIDER=anthropic`) | **ACEITO** | Antes, se `ANTHROPIC_API_KEY` chegar até 14/09; senão dia 17 |
| D4 | Erro do classificador vira `log.erro` + `status='erro'` com `erro_msg` prefixado `[api] …` (distingue de "IA não entendeu", que já usa `erro`) + texto fixo ao remetente em `RESPOSTAS.falhaTecnica`: "Recebi sua mensagem, mas não consegui processar agora. O gestor vai ver no painel." Mais um SQL único para as linhas já presas em `processando` | G3 | S | Baixo | **ACEITO** | Antes |
| D5 | 400 do Zod grava uma linha em tabela `webhook_rejeitados` (só `service_role`): chaves e tipos do JSON (shape), motivo do Zod, `from` mascarado, primeiros 200 chars. **Nunca o corpo inteiro**: o 400 acontece antes da checagem de autorizados, então o remetente é qualquer um. Vercel Logs no Hobby retém horas; tabela retém | G1 | S | Baixo | **ACEITO** | Antes |
| D6 | Ao confirmar, `whatsapp/<msgid>/<nome>` é **copiado** para `documentos/<pagamento_id>/<nome>` e vira linha em `documentos` (`tipo` = `dados_extraidos.tipo_documento`, que já é o enum `anexo_tipo`; `hash_sha256` calculado; `idx_documentos_hash` único dá a idempotência no retry). `midia_storage_path` fica para auditoria. Feito **depois** do pagamento gravado, fora de `obterOuCriarPagamento`: falha aqui não desfaz o pagamento | G5 | S/M | Médio (policy do bucket para o prefixo novo) | **ACEITO** | Depois (17-19/09), antes de ligar a cobrança |
| D7 | Adaptador do payload real (`normalizarPayloadProvider` antes do Zod). **Placeholder**: só existe trabalho quando D5 tiver capturado um formato diferente; se o formato bater, D7 fecha sem código | G1 | S | Baixo | **ACEITO** | Depois, condicionado a D5 |
| D8 | Pergunta de confirmação enfileirada em `whatsapp_outbound` (retry 3x) em vez de `enviarTexto` direto | — | S | Baixo | **DEFERIDO** | Depois, junto com `FILA_WHATSAPP=true` |
| D9 | "sim" fora da janela de 24 h recebe resposta explícita | — | S | Baixo | **DEFERIDO** | Depois |
| D10 | Destinatário do alerta de saúde configurável | — | S | Baixo | **DEFERIDO** | Depois |
| D11 | Resumo de duas linhas depois do "Lançado ✅" | — | S | Baixo | **DEFERIDO** | Depois |
| D12 | Foto visível em `/whatsapp` e `/pendentes` | — | S | Baixo | **DEFERIDO** | Depois |

G2 (HMAC) e G6 (duração do webhook síncrono) não viram proposta de código: G2 é descoberta humana + decisão E7;
G6 é resolvido por `FILA_WHATSAPP=true` (B1) e, até lá, por medir a latência do passo 3 da demo com um `maxDuration`
explícito (E3).

Critério das escolhas: aceito o que fecha o contrato ou tira um silêncio; deferido o que é conforto. Nenhuma
opção destrutiva foi escolhida. Cada "antes" é correção de bug, permitida pelo congelamento
(`PLANO-ARQUITETURA` Fase 1: "só correção de bug").

---

## CEO Plan

Branch: `feat/gstack-time-virtual` | Modo: SELECTIVE EXPANSION | Repo: `NogmaBR/CRM-CAVALCANTI`

### Vision

**10x check.** O WhatsApp da obra vira o teclado do financeiro: foto ou áudio entram, uma pergunta de uma linha
volta, SIM grava pagamento **e** nota, e o gestor só abre o painel para imprimir relatório ou compartilhar a
planilha. A Fase 6 estende o mesmo gesto ao vendedor (agenda, inadimplência, agendamento com SIM). Um só
padrão, dois públicos.

### Scope Decisions

As 10 propostas do cherry-pick (D3-D12) e, abaixo da linha, o que o roadmap já tinha e fica como está.

| D | Proposta | Fecha | Esforço | Decisão | Antes/depois de 16/09 | Por quê |
|---|---|---|---|---|---|---|
| D3 | Foto no prompt do classificador (PDF em B1) | G4 | S | ACEITO | Antes (com chave) / 17/09 | Sem isso "manda a foto" é falso |
| D4 | Erro do classificador visível + reparo das linhas presas | G3 | S | ACEITO | Antes | Silêncio no coração do fluxo |
| D5 | 400 do webhook registrado (shape, sem valores) | G1 | S | ACEITO | Antes | Primeiro payload real precisa deixar rastro |
| D6 | Mídia confirmada vira `documentos` | G5 | S/M | ACEITO | Depois, antes da cobrança | Cobrança cobraria nota já enviada |
| D7 | Adaptador do payload real (placeholder) | G1 | S | ACEITO | Depois, se D5 mostrar formato diferente | Formato é palpite hoje |
| D8 | Pergunta via fila com retry | — | S | DEFERIDO | Depois | Conforto até `FILA_WHATSAPP` |
| D9 | "sim" expirado com resposta | — | S | DEFERIDO | Depois | Conforto |
| D10 | Alerta de saúde para quem escolher | — | S | DEFERIDO | Depois | Conforto |
| D11 | Resumo pós-SIM | — | S | DEFERIDO | Depois | Delícia |
| D12 | Foto na tela | — | S | DEFERIDO | Depois | Delícia |
| — | Fase 6 M1-M5 (espelho do ERP, 4-6 semanas; até 8 com M5) | — | L | MANTIDO, **começa depois de B1** | Depois (~29/09) | Depende de M0 humano; não muda |
| — | `FILA_WHATSAPP=true` | G6 | S | MANTIDO, entra em B1 | Depois | Já decidido |
| — | PR #7 (`emitir()` com chamadores) | — | S | MANTIDO, item separado de B1 | Depois | Não fecha furo nenhum; não dilui a semana |
| — | Vercel Pro, `gru1`, repo privado, domínio, PITR, restore de teste | — | humano | MANTIDO | Depois (Pro pode ser antes) | Hobby não permite uso comercial |
| — | Próximos passos do banco (`PLANO-BANCO-PREMIUM` itens 1-10) | — | S-M cada | MANTIDO na ordem de lá, exceto o item 7 (Zod em `dados_extraidos`), que entra em B1 | Depois | Com a foto no prompt, a saída do modelo carrega mais campos |

### Accepted Scope (entra no plano)

- **B0 (antes de 16/09, correção de bug):** D3 (foto no prompt, atrás de `IA_PROVIDER=anthropic`), D4 (erro
  visível; sem chave), D5 (400 registrado; sem chave). Arquivos: `anthropic-classifier.ts`,
  `classify-and-persist.ts`, `inbound-whatsapp.ts`, `app/api/webhooks/uazapi/route.ts`, uma migration pequena
  (`webhook_rejeitados`) e testes: `montarSaida` com bloco de imagem; `classifyAndPersist` com classificador que
  lança. Se a chave não chegar até 14/09, **só D3** escorrega para 17/09; D4 e D5 entram mesmo assim.
- **B1 (17/09 a ~26/09):** PDF no prompt, D6 (documento ligado), D7 (adaptador, se necessário), Zod em
  `dados_extraidos`, `FILA_WHATSAPP=true` (fecha G6). Depois disso: ligar `cobrar-documento-fornecedor` com
  `limite_por_rodada: 3`. PR #7 é item separado, quando couber.
- **Fase 6** começa após B1 (~29/09); M0 (humano) roda em paralelo desde já.

### Deferred (registrar em `SO-FALTA-VOCE.md` §10 ou num TODOS.md)

- D8 pergunta via fila; D9 "sim" expirado; D10 alerta configurável; D11 resumo pós-SIM; D12 foto na tela.
- Filas `midia` e `ia_classificacao` com handler próprio (abordagem C): só se o job único passar de 60 s.
- Python/LangGraph, NestJS, VPS: mantidos fora, como decidido na FASE 0.

---

## Mapa de erros e modos de falha (Prime Directives 1-4)

### Fluxo inbound com os quatro caminhos

```
  UAZAPI POST ─▶ HMAC ─▶ JSON ─▶ Zod ─▶ rate limit ─▶ processarInbound
                 │        │       │        │              │
      401 ◀──────┘        │       │        429 ◀──────────┘ (log? não: resposta429 sem log)
      sem log             400     400
                          sem log sem log ◀── CRITICAL GAP (D5): payload real diferente do assumido
                                                morre aqui sem nenhuma linha em `nivel:erro`

  processarInbound:
   1 autorizados?  ─ nil (lista vazia) → log.aviso `autorizados_vazio`, ignora        [visível só no log]
                   ─ erro de banco     → log.erro, ignora                             [ok]
   2 dedupe        ─ existente         → `duplicada`                                  [ok]
   3 mídia         ─ sem url           → segue sem mídia                              [ok]
                   ─ download falha    → log.erro `midia_nao_baixada`, segue          [ok, degrada]
                   ─ >20 MB            → `grande_demais`, segue sem mídia             [ok]
                   ─ upload falha      → log.erro, `storagePath: null`                [ok]
                   ─ áudio, provider none → sem transcrição, sem log                  [ok, proposital]
                   ─ Whisper 4xx/5xx/timeout → log.aviso, segue                       [ok]
   4 "SIM"?        ─ pendência aberta  → aplicarConfirmacao                           [ok]
                   ─ dados_incompletos → "o gestor vai revisar no painel"             [é a aprovação manual]
                   ─ pendência >24 h   → vira mensagem comum → `nao_identificado`     [silêncio para o remetente]
                   ─ SIM + clique do gestor simultâneos → 23505 tratado                [ok]
   5 comando       ─ executarComando falha → log.erro + texto de desculpa             [ok]
   5b pergunta     ─ assistente falha  → log.erro, cai para classificação             [ok]
   6 gravar        ─ 23505             → `duplicada`, não classifica                  [ok]
                   ─ outro erro        → log.erro, `acao: erro`                       [ok]
     classificar   ─ getClassifier lança (provider anthropic sem chave) ─┐
                   ─ Anthropic 401/429/529/timeout                      ├─▶ catch SEM log; mensagem fica
                   ─ `parsed_output` nulo → confiança 0, `nao_identificado` │   `processando` para sempre;
                                                                          ┘   sem pergunta; sem aviso
                                                                              ◀── CRITICAL GAP (D4)
                   ─ imagem sem legenda (Anthropic) → texto "(sem texto — só anexo)" → sem valor → pendência
                     → SIM → dados_incompletos                                ◀── CRITICAL GAP (D3)
                   ─ imagem (mock) → sempre `documento_apenas`, sem valor → SIM → dados_incompletos
                                                                              ◀── afeta a DEMO (ver abaixo)
   7 perguntar     ─ enviarTexto nao_configurado → log.aviso, pendência aberta sem pergunta [visível só no log]
                   ─ HTTP/timeout → log.erro, sem retry; remetente nunca recebe a pergunta [D8]
```

### Registro de erros (métodos que podem falhar)

| Método / caminho | O que dá errado | Tratado? | Ação | Usuário vê | Log? |
|---|---|---|---|---|---|
| `route.ts` Zod (`:54-64`) | payload da UAZAPI em formato diferente | N | 400 e nada | nada; UAZAPI vê 400 | **não** → GAP |
| `route.ts` HMAC (`:43`) | provider não assina, ou assina em outro header/formato | N | 401 | nada | não |
| `getClassifier()` (`classifier.ts:77`) | `IA_PROVIDER` inválido | lança | catch mudo em `inbound-whatsapp.ts:246` | mensagem "processando" eterna | **não** → GAP |
| `AnthropicClassifier` ctor (`:88-91`) | provider anthropic sem chave (par incompleto) | lança | idem | idem | **não** → GAP |
| `client.messages.parse` | 401/429/529/timeout/rede | N | idem | idem | **não** → GAP |
| `messages.parse` | `parsed_output` nulo (refusal, max_tokens) | Y | confiança 0, `nao_identificado` | pendência "erro" no painel | sim |
| `montarSaida` | UUID inventado | Y | descarta id, rebaixa a 0.5 | pergunta sem obra | raciocínio marcado |
| `montarSaida` | valor negativo/zero | Y | descarta valor | pergunta sem valor → `dados_incompletos` no SIM | não |
| `classifyAndPersist` INSERT `confirmacoes_pendentes` | erro não-23505 | parcial | `log.erro`, status vira `classificada`, `confirmacao: null` | nenhuma pergunta; pendência não existe | sim |
| `dispatchEvento` (`classify-and-persist.ts:233-243`) | qualquer | Y | `catch {}` vazio | nada | **não** (catch-all mudo; webhooks outbound são opcionais) |
| Webhook síncrono inteiro (`route.ts:122`) | download + transcrição + modelo passam da duração da função (sem `maxDuration`) | N | função morre; nenhum catch roda | mensagem `processando` eterna, igual a G3 | **não** → G6 |
| `/api/queue/consume` (B1) | rota fora da allowlist do middleware | Y hoje (`middleware.ts:49` tem `/api/queue/`) | — | se alguém remover a linha: 200 HTML, job na dead-letter em 3 tentativas | só via `saude_sistema` (dead-letter) |
| `enviarTexto` (`uazapi.ts`) | sem credencial / HTTP / timeout 8 s | Y | devolve `{ok:false}`; chamador ignora | remetente não recebe a pergunta | sim |
| `aplicarConfirmacao` | `dados_incompletos` | Y | texto "o gestor vai revisar" | sim | aviso |
| `aplicarConfirmacao` UPDATEs | zero linhas (RLS) | Y | `sem_permissao` | no painel: erro; no WhatsApp: "Recebi sua confirmação, mas…" | sim |
| `buscarConfirmacaoAberta` | erro de banco | Y | `null` → "sim" vira mensagem comum | silêncio | sim |
| `jaRespondida` | erro de banco | Y | libera (pode responder 2x) | resumo duplicado | aviso |
| `transcreverAudio` | provider openai sem chave | Y | `sem_chave`, segue | áudio vira pendência | aviso |
| Handler `whatsapp_outbound` | sem credencial | lança | 3 tentativas, dead-letter | alerta de saúde nunca chega | sim + `saude_sistema` |
| `alertar_se_doente` | `autorizados` vazio | Y | "não há autorizado" | ninguém avisado | só no retorno da função |
| `cobrarDocumentoFornecedor.varrer` | RPC falha | lança | `automation_executions.falha` | histórico | sim |
| `cobrarDocumentoFornecedor` | pagamento confirmado via WhatsApp **com foto** | N | cobra mesmo assim (não há `documentos`) | fornecedor cobrado pela nota que mandou | não → GAP (D6) |

### Registro de modos de falha

```
  CODEPATH                          | FALHA                              | RESGATE | TESTE | USUÁRIO VÊ        | LOG
  ----------------------------------|------------------------------------|---------|-------|-------------------|-----
  webhook Zod 400                   | formato real ≠ assumido            | N       | N     | silêncio          | N   ← G1 CRITICAL GAP
  webhook HMAC 401                  | provider não assina como assumido  | N       | Y(hmac)| silêncio         | N   ← G2 CRITICAL GAP
  classifyAndPersist catch          | ctor/API/timeout do classificador  | N       | N     | "processando"     | N   ← G3 CRITICAL GAP
  Anthropic sem imagem              | foto sem legenda → sem dados       | N       | N     | "gestor revisa"   | N   ← G4 CRITICAL GAP (contrato)
  SIM confirmado, foto não vira doc | pagamento fica "sem documento"     | N       | N     | cobrança indevida | N   ← G5 CRITICAL GAP (contrato)
  webhook síncrono > duração        | função morta no meio               | N       | N     | "processando"     | N   ← G6 CRITICAL GAP
  mock com imagem                   | sempre documento_apenas            | N       | Y     | "gestor revisa"   | N   (risco de DEMO, não gap)
  imagem > limite da API (D3)       | 5 MB img / base64 estoura request  | D3 trata| a criar| aviso técnico    | Y   (nasce tratado com D3)
  enviarTexto HTTP/timeout          | pergunta não sai                   | Y(log)  | Y     | silêncio          | Y
  SIM após 24 h                     | vira nao_identificado              | Y       | Y     | silêncio          | N
  alertar_se_doente sem autorizado  | ninguém avisado                    | Y       | N     | nada              | N
  dispatchEvento catch {}           | webhook outbound falha             | Y(mudo) | N     | nada              | N   (aceitável: opcional)
```

Seis CRITICAL GAPs (G1-G6, a mesma lista da auditoria); quatro deles são o mesmo tema: o caminho da foto e o
primeiro contato com o provider real. G2 e G6 não têm proposta de código: G2 é descoberta humana + decisão E7;
G6 fecha com `FILA_WHATSAPP=true` em B1.

### Máquina de estados de `confirmacoes_pendentes` (existente; transições inválidas anotadas)

```
   [classificada] ──cria──▶ ABERTA (resolvida=false, uma por mensagem: índice parcial)
                                │
        SIM (WhatsApp/painel) ──┼──▶ resolvida=true, resultado=confirmada, pagamento_id   (idempotente: criado_via_msg_id + 23505)
        NÃO (WhatsApp/painel) ──┼──▶ resolvida=true, resultado=recusada                   (msg_status=recusada, não erro)
        24 h sem resposta ──────┼──▶ segue ABERTA para o gestor; "sim" tardio NÃO fecha    (janela em buscarConfirmacaoAberta)
        SIM sem valor/obra ─────┴──▶ segue ABERTA; remetente avisado                       (dados_incompletos)
   Impossível: duas abertas por mensagem (índice); reabrir (não há UPDATE para resolvida=false); resolver por papel
   sem permissão (UPDATE confere linhas).
```

### Semana da entrega: o que falha em silêncio, em ordem de probabilidade

1. **Payload real da UAZAPI ≠ schema** (`lib/schemas/uazapi.ts`): o schema é plano (`id,type,timestamp,from,
   text,media`), com header `x-signature` hex. Isso nunca foi confrontado com uma mensagem real: as fixtures são
   nossas (`scripts/fixtures/uazapi/image-nf.json`), a credencial nunca existiu. Três buscas na web não acharam a
   especificação pública do formato; o produto parecido (wuzapi) usa `x-hmac-signature` e formato `form`
   por padrão. Se bater diferente: 400 sem log. **Mitigação antes do dia 16:** D5 (log do 400 com corpo
   mascarado) e um teste manual com o número real assim que a instância existir, olhando o log por
   `area:webhook`.
2. **Demo com classificador mock e foto:** `mock-classifier.ts:26-36` devolve `documento_apenas` sem valor para
   qualquer imagem, mesmo com legenda. O passo 3 do `ROTEIRO-DEMO` (foto + "paguei 850 pro Zé…") termina em
   "faltaram dados, o gestor vai revisar". **Sem `ANTHROPIC_API_KEY`, o passo 3 tem que ser texto puro**, sem
   foto. O roteiro precisa dizer isso.
3. **Par `IA_PROVIDER=anthropic` sem `ANTHROPIC_API_KEY`** (ou chave inválida): toda mensagem fica "processando"
   e nada é logado. `checar-integracoes.mjs` acusa a variável, não o comportamento.
4. **Foto sem legenda com Anthropic ligado:** vira pendência sem valor; SIM → "gestor revisa". Não é silêncio,
   é o contrato não cumprido.
5. **Pergunta não enviada** (instância UAZAPI desconectada, HTTP 4xx): pendência aberta, ninguém perguntado; só o
   log sabe. Sintoma na obra: "mandei e não respondeu".
6. **Equipe cadastrada com número diferente do que manda** (ex.: sem o 55, ou com o 9 a mais/a menos):
   `buscarAutorizado` compara dígitos completos; `ignorada_nao_autorizada` no log, silêncio para a pessoa.
7. **Redeploy esquecido** depois das variáveis. Já coberto por `checar-integracoes.mjs`.

---

## Diagramas

### Arquitetura (o que muda com B0/B1)

```
  UAZAPI ──POST──▶ /api/webhooks/uazapi ──▶ [D7 normalizarPayload] ──▶ Zod ──▶ [D5 log 400]
                          │                                                          
                          ▼ (FILA_WHATSAPP=true, B1)         (hoje: síncrono)
                    pgmq whatsapp_inbound ──pg_cron/pg_net──▶ /api/queue/consume ──▶ processarInbound
                                                                                        │
              ┌──────────────────────────────┬──────────────────────────────────────────┤
              ▼                              ▼                                          ▼
     materializarMidia                classifyAndPersist                         resolverPendencia
     bytes + mime ──[D3]──▶ Claude (texto + image/document) ──▶ confirmacoes_pendentes    │
     Storage whatsapp/…                 [D4 erro → status+log]                            ▼
              │                                                             aplicarConfirmacao
              └────────────────[D6 ao confirmar]───────────────────────────▶ pagamentos + documentos
                                                                                          │
     enviarTexto ◀── hoje direto ── [D8 via whatsapp_outbound, retry 3x] ◀────────────────┘
```

### Sequência do go-live (o que o usuário faz, e o que confere)

```
  1 telefones reais ─▶ 2 credenciais (pares!) ─▶ 3 REDEPLOY ─▶ 4 checar-integracoes sem ✗
        │                                                              │
        ▼                                                              ▼
  5 webhook UAZAPI apontado ─▶ 6 equipe em /config/autorizados ─▶ 7 test-webhook: 200 com `acao` no corpo
                                                                    (`ignorada_nao_autorizada` = HMAC ok, fixture
                                                                     não está na equipe; `classificada` = tudo ok)
        │                                                              │
        ▼                                                              ▼
  8 mensagem real de TEXTO ("paguei 850 pro Zé da areia na Garibaldi") ─▶ pergunta chega? ─▶ SIM ─▶ /pagamentos
        │ não chega                                                    
        ▼                                                              
     log `area:webhook` tem 400? ─▶ payload diferente ─▶ D7 (adaptador), não a demo
     log `area:inbound ignorada_nao_autorizada`? ─▶ número cadastrado errado
     log `envio_ignorado_nao_configurado` / `envio_falhou`? ─▶ credencial ou instância desconectada
     nada no log? ─▶ webhook não chegou: URL/HMAC no painel da UAZAPI
  9 só depois: foto COM legenda (mock: não; Anthropic: sim) ─▶ 10 automação inócua ─▶ 11 cobrança com limite 3
```

### Rollback

```
  D3 quebrou algo?  ─▶ IA_PROVIDER=mock + redeploy (só D3 está atrás da chave)                  [~3 min]
  D4/D5 quebraram?  ─▶ `git revert` do PR de B0 (4 arquivos + migration aditiva, que pode ficar) [~10 min + deploy]
  B1 (documentos)   ─▶ revert do PR; linhas em `documentos` ficam (são válidas); nada a apagar   [~10 min]
  FILA_WHATSAPP     ─▶ remover a variável + redeploy; jobs já na fila são drenados normalmente   [~3 min]
  Cobrança ligada   ─▶ botão Desligar em /config/automacoes ou UPDATE automation_rules            [~1 min]
```

---

## Para o gerente de engenharia (travas E1-E10)

- **E1. B0 antes de 16/09?** Recomendo sim. D4 e D5 não dependem de chave e entram valendo; D3 fica atrás de
  `IA_PROVIDER=anthropic`. Se a chave não chegar até 14/09, só D3 escorrega para 17/09 e a demo usa **texto
  puro** no passo 3.
- **E2. Como a imagem chega ao modelo:** `classifyAndPersist` relê o arquivo do Storage por
  `mensagens_whats.midia_storage_path` (ela já faz `select` dessa coluna, `classify-and-persist.ts:74`, e não a
  usa). É o único caminho que funciona igual no webhook síncrono de hoje e no job da fila de B1, onde o payload
  vem de `jsonb` sem buffer. Passar bytes pela assinatura seria dívida em uma semana. Caso limite: upload falhou
  (`storagePath: null`, `inbound-whatsapp.ts:446`) → classifica só o texto, como hoje, com `raciocinio` avisando.
  Teto: imagem acima de 5 MB é reduzida (sharp já está no bundle? conferir) ou recusada com motivo antes do base64.
- **E3. Duração do webhook síncrono (G6):** declarar `export const maxDuration` na rota e **medir** o passo 3 da
  demo (foto + thinking adaptativo) antes de prometer "<20 s". Se passar de 30 s, D3 espera `FILA_WHATSAPP`.
- **E4. Prompt para imagem:** `INSTRUCOES` diz "nunca invente valor"; com foto, a regra vira "extraia da imagem;
  se ilegível, null". 3-5 casos em `montarSaida` com fixture de saída do modelo (o modelo real segue sem chave em CI).
- **E5. D6, onde e como:** logo após `obterOuCriarPagamento` em `resolverPendencia`, nunca dentro dele: falha ao
  ligar o documento não desfaz o pagamento. Copiar `whatsapp/<msgid>/<nome>` para `documentos/<pagamento_id>/<nome>`,
  `hash_sha256` calculado (o índice único `idx_documentos_hash` segura o retry), `tipo` de
  `dados_extraidos.tipo_documento` (mesmo enum `anexo_tipo`). Policy do bucket para o prefixo novo: migration pequena.
- **E6. D5 e privacidade:** o 400 acontece **antes** de `autorizados`; o remetente é qualquer um. Gravar shape
  (chaves + tipos), motivo do Zod, `from` mascarado e 200 chars. Nunca o corpo. Tabela só `service_role`.
- **E7. HMAC do provider (G2):** se a UAZAPI não assinar com HMAC-SHA256 hex em `x-signature`, decidir entre (a)
  aceitar também `x-hmac-signature`/base64, (b) token fixo em header próprio, (c) intermediário. Nunca "sem
  assinatura". A **descoberta** é do usuário antes do dia 16 (item 3 dele); a **mitigação** é sua e pode ser dia 17.
- **E8. Ordem pós-entrega:** B1 (uma semana) antes da Fase 6 M1; M0 humano em paralelo; PR #7 fora de B1.
- **E9. `dados_extraidos` com Zod** antes do INSERT em `pagamentos` entra em B1 (não em B0): com a foto no prompt,
  a saída carrega mais campos.
- **E10. Testes mínimos:** (i) `classifyAndPersist` com classificador que lança → `status='erro'`, `[api]` em
  `erro_msg`, log emitido; (ii) SIM sobre pendência sem valor → `dados_incompletos` + texto ao remetente; (iii)
  fixture capturada do provider real substituindo `image-nf.json`; (iv) D6 duas vezes → uma linha em `documentos`.

---

## Para o usuário (ações humanas, em ordem)

1. **Telefones reais dos 8 fornecedores** (`SO-FALTA-VOCE` §1). Nada de automação antes disso.
2. **`ANTHROPIC_API_KEY` + `IA_PROVIDER=anthropic`** na Vercel, **em par**, Production, Sensitive na chave.
   É o que decide se B0 entra antes da demo e se a foto vale alguma coisa.
3. **UAZAPI:** instância conectada, `UAZAPI_BASE_URL` + `UAZAPI_TOKEN`, e **descobrir no painel deles se o
   webhook assina** (nome do header, formato). Se não assinar como o CRM espera, avisar o gerente de engenharia
   antes do dia 16 (trava E7).
4. **`IA_TRANSCRICAO_PROVIDER=openai` + `OPENAI_API_KEY`** (par). Sem isso, áudio vira pendência.
5. **Redeploy** sem cache. Depois `node --env-file=.env.local scripts/checar-integracoes.mjs` sem ✗.
6. **Webhook apontado** para `https://crm-cavalcanti.vercel.app/api/webhooks/uazapi`.
7. **Equipe em `/config/autorizados`** com o número **exatamente** como o WhatsApp manda (com 55 e DDD).
8. **Primeira mensagem real, de texto**, do seu celular. Se não voltar pergunta em 60 s: Vercel → Logs →
   `area:webhook` e `area:inbound`; a tabela "Se algo der errado, olhe aqui primeiro" (fim de `SO-FALTA-VOCE`)
   diz onde olhar.
9. **Só então foto com legenda.** Sem a chave da Anthropic, **não** faça a demo com foto: o classificador mock
   devolve "documento" sem valor e o SIM termina em "o gestor vai revisar".
10. **Apagar as 3 mensagens de teste de 07/09**, `pagamentos.csv`, as 2 variáveis mortas na Vercel, branches.
11. **Vercel Pro** (Hobby não permite uso comercial) → `scripts/pos-vercel-pro.mjs --repo-privado`.
12. **`BACKUP_PASSPHRASE` no gerenciador de senhas** e um restore de teste registrado.
13. **Fase 6 M0:** respostas do parceiro do ERP (9 logins, `Funcao`, HTTPS/IP), credencial do ERP, quem recebe o
    quê no WhatsApp, e a escolha A/B/C (recomendação: C começando por B).

---

## NOT in scope (considerado e deixado de fora)

- Picar `processarInbound` em três jobs: o job único já tira o trabalho do request; a ordem das etapas é frágil.
- Python/LangGraph, NestJS, VPS, Redis: decididos fora na FASE 0; nada aqui muda essa conta.
- Funil de vendas próprio no Supabase (caminho A da Fase 6): o ERP CRM005 já é a fonte de verdade.
- Auto-aprovação por confiança (`IA_AUTO_APROVAR=true`): decisão de produto; continua desligada.
- Métrica de confiança na UI: o cliente pediu para tirar.
- OCR próprio ou serviço de OCR: o modelo lê a imagem; não precisa de mais um provider.

## What already exists (reaproveitado)

`materializarMidia` (bytes em mãos), `messages.parse` com schema Zod, `confirmacoes.ts` como serviço único,
bucket `documents` com policies, fila `whatsapp_outbound` com retry, `lib/log.ts` com correlação, RPC
`pagamentos_sem_documento`, `/config/automacoes` com ensaio, `checar-integracoes.mjs`, `test-webhook-uazapi.mjs`.

## Dream state delta

Com B0+B1 o sistema fica a uma credencial de "foto vira lançamento e documento". Sem eles, fica a um formulário
disfarçado de WhatsApp. A Fase 6 herda o padrão certo (imagem, confirmação, documento) em vez de repetir o furo.

---

## Completion status

**DONE_WITH_CONCERNS.** Conferido no código (arquivo:linha citados acima): `inbound-whatsapp.ts` inteiro,
`classify-and-persist.ts` inteiro, `confirmacoes.ts` inteiro, `anthropic-classifier.ts` e `mock-classifier.ts`
inteiros, `classifier.ts`, `transcricao.ts`, `uazapi.ts`, `route.ts` do webhook, `hmac.ts`, `schemas/uazapi.ts`,
`queue/handlers.ts` e trechos de `queue/tipos.ts`, `automations/engine.ts` e `cobrar-documento-fornecedor.ts`,
`api/health/route.ts`, `supabase/middleware.ts`, `vercel.json`, `alertar_se_doente` na migration `20260910250000`,
fixture `image-nf.json`, grep de `midia_storage_path` (só escrita) e de inserts em `documentos` (nenhum via
WhatsApp), grep de TODO/FIXME, git log/status/stash.

**Inferência, não verificação:** (1) o formato real do webhook da UAZAPI e se ela assina com HMAC: três buscas na
web não acharam a especificação pública; o que apareceu foi um produto parecido (wuzapi) com header e formato
diferentes dos assumidos aqui. Trato como "não provado", não como "errado". (2) Que o SDK da Anthropic aceita bloco
`document` para PDF no `messages.parse`: é o comportamento documentado do SDK, não testado neste repo (nunca houve
chave). (3) Contagem de 274 testes e de policies vêm do CLAUDE.md, não rodei a suíte (os 17 arquivos de teste eu
contei). (4) Se `sharp` ou equivalente está no bundle para reduzir imagem (E2): não conferi o `package.json`.
(5) Limites atuais da API da Anthropic por imagem/PDF: de memória, não de documentação lida nesta sessão.

**Corrigido depois da revisão adversarial (1 rodada, 6/10 → itens fechados):** contagens unificadas (10 propostas,
5 aceitas, 5 deferidas; 6 gaps G1-G6 com id único); D3 passa a reler do Storage (funciona na fila); PDF sai de B0;
PR #7 sai de B1; D5 grava shape em tabela (não corpo em log); D4 distingue `[api]` de "não entendeu"; G6 (duração
do webhook) entrou; D6 ganhou idempotência pelo `idx_documentos_hash`; `gasto_por_obra` (não `total_por_obra`);
17 arquivos de teste, todos em `lib/`; o upload do painel faz `.from('documentos').insert` em
`app/(app)/documentos/actions.ts:89` (meu grep de uma linha errou).

**Preocupações abertas:** B0 mexe no coração do fluxo na semana da entrega; a mitigação de D3 é a chave
`IA_PROVIDER`, mas D4/D5 entram sem chave. Se o gerente de engenharia preferir zero mudança de código antes de
16/09, o roteiro da demo precisa mudar para texto puro no passo 3 e o cliente precisa ouvir, na entrega, que a
leitura da foto entra na semana seguinte. G6 continua sem medição até E3.

Sem aprendizados duráveis novos além dos que já estão em `CLAUDE.md` §8; o único candidato (o comentário
"hoje não baixamos" desatualizado escondendo o furo) vira tarefa, não regra.

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION (auto, spawned)         |
  | System Audit         | branch limpa; sem TODOs; SO-FALTA-VOCE=TODOS|
  | Step 0               | abordagem B; 10 propostas, 5 aceitas,       |
  |                      | 5 deferidas (D3-D12)                        |
  | Error/rescue registry| 21 caminhos, 6 CRITICAL GAPS (G1-G6)        |
  | Failure modes        | 12 mapeados, 6 CRITICAL GAPS (G1-G6)        |
  | Diagrams             | 5 (fluxo, estados, arquitetura, go-live,    |
  |                      | rollback)                                   |
  | Outside voice        | skipped (modo degradado); 1 revisor Claude  |
  |                      | adversarial rodou (6/10, achados aplicados) |
  | CEO plan             | escrito (este arquivo)                      |
  | Unresolved decisions | 0 automáticas; 10 travas E1-E10 p/ gerente  |
  +====================================================================+
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open | 10 proposals, 5 accepted, 5 deferred; 6 critical gaps (G1-G6) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | skipped (modo degradado); revisor Claude adversarial: 6/10, achados aplicados |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | recomendado antes de B0 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | não necessário (sem escopo de UI) |

- **VERDICT:** CEO review concluída com 6 critical gaps abertos; eng review required antes de implementar B0.

**UNRESOLVED DECISIONS:**
- Nenhuma decisão ficou sem escolha automática; as 10 travas E1-E10 da seção "Para o gerente de engenharia" são
  decisões humanas pendentes, não perguntas desta skill sem resposta.
