# TODOS — backlog técnico (convenção gstack)

> Itens adiados com contexto suficiente para virar PR. O `/ship` lê e atualiza este
> arquivo. Fonte de cada item: `docs/gstack/2026-09-12-*.md`. **Nada daqui entra antes
> de 2026-09-16** (congelamento da Fase 1) salvo correção de bug de demo.
> Ações que só o usuário faz continuam em `docs/SO-FALTA-VOCE.md`.

## P0 — o núcleo do contrato (CEO review, 2026-09-12)

- [x] **G4 A IA enxerga a foto** — feito em `920a7cf`: `AnthropicClassifier` relê a mídia do
  Storage e manda como bloco `image`/`document`. Falta provar com `ANTHROPIC_API_KEY`
  real (nunca existiu em ambiente nenhum): primeira foto de nota de verdade, medir o
  tempo do passo 3 do webhook (E3, `maxDuration`).
- [x] **G3 Erro do classificador visível** — feito em `920a7cf`: exceção marca a mensagem
  como `erro` com texto humano; antes ficava `processando` para sempre.
- [ ] **G5 Mídia confirmada vira `documentos`** — `midia_storage_path` só é escrito; a
  automação de cobrança cobraria o fornecedor pela nota que ele acabou de mandar.
  Copiar para `documentos/<pagamento_id>/` fora de `obterOuCriarPagamento`, com
  idempotência por `idx_documentos_hash`. Fonte: ceo-review D6/E5. Depois de 16/09.
- [ ] **G1/G2 Primeiro contato com o provider é mudo** — 400 do Zod sem log
  (`webhooks/uazapi/route.ts:54-64`) e HMAC nunca provado com payload real. Gravar o
  *shape* do payload rejeitado (nunca o corpo: é pré-autorizados) numa tabela ou log
  estruturado; adaptador se o formato divergir. Fonte: ceo-review D5/D7/E6/E7.
- [ ] **G6 `maxDuration` no webhook síncrono** — sem ele a função pode morrer no meio da
  classificação com foto. Fonte: ceo-review E3.
- [ ] **Risco de demo**: com `IA_PROVIDER=mock`, qualquer imagem vira `documento_apenas`
  sem valor. Sem `ANTHROPIC_API_KEY` a demo de 16/09 deve ser **texto puro**.

## P1 — antes de ligar WhatsApp/automações em produção

- [ ] **T1 `configSchema` Zod `.strict()` por automação** — `lib/automations/tipos.ts:64`
  aceita `Record<string, unknown>`; `numero()` cai no padrão em silêncio
  (`cobrar-documento-fornecedor.ts:201`). Um typo em `limite_por_rodada` mantém 25
  WhatsApps/dia. Validar em `salvarConfigAutomacao` e no engine; `registry.test.ts`.
  Fonte: eng-review C2/D6. CC ~30 min.
- [ ] **T2 `exigirLinhas()` nas 12 actions de arquivar/restaurar** — `obras`, `pagamentos`,
  `fornecedores`, `documentos`, `categorias`, `webhooks` (incl. `regenerarSecret`) fazem
  `.update().eq('id')` sem `.select('id')`: papel sem permissão vê "arquivado" e nada
  mudou. Mesmo padrão já aplicado em `confirmacoes.ts` (PR #21). Fonte: eng-review C1/D3.
  CC ~40 min.
- [ ] **T3 Fila `whatsapp_inbound`: laço de drenagem + teste de rota** — `LOTE_POR_FILA=1`
  + cron por minuto = 1 mensagem/min; `pg_net` desiste em 5 s ignorando a resposta.
  Antes de criar `FILA_WHATSAPP=true` na Vercel. Fonte: eng-review A2/D7. CC ~30 min.
- [ ] **T4 PR #7 (`feat/emitir-eventos`)** — `merge-base` = `76fe5a9`, seis PRs atrás;
  `bus.ts:97` usa `console.error` (proibido desde o PR #13); rollback de documentos
  colide com o service role do PR #21. Remerge + `log.erro` + `bus.test.ts`. Só depois
  de 16/09. Fonte: eng-review A1/D8.

## P2 — qualidade e segurança

- [ ] **T5 Zod em `dados_extraidos`** — `confirmacoes.ts:103-113`, `classify-and-persist.ts:
  132-134`, `pendentes.ts:75,104` fazem cast sem validar; `valor:"1.200"` vira erro cru
  do Postgres. Antes de `IA_PROVIDER=anthropic`. Fonte: eng-review C3/D9.
- [ ] **T6 Token da planilha como hash** — `planilha.ts:93-98` compara token em claro;
  `token_hash` sha256 + backfill in-place + `flash-secret` (já existe). Nenhum link vivo
  quebra. Fonte: eng-review A3/D2, PLANO-BANCO item 1.
- [ ] **T7 Uma fábrica de service client** — 9 cópias com 3 comportamentos diferentes
  quando falta env. `lib/supabase/service.ts`; sessão (RLS) em `import-pagamentos` e
  `detect-duplicates`. Fonte: eng-review C7/A6, PLANO-BANCO item 8.
- [ ] **T8 Autoria nas RPCs de service_role** — `p_ator uuid` + `set_config('app.ator')`
  + `COALESCE(auth.uid(), current_setting(...))` no trigger de auditoria. Fonte:
  eng-review C4, PLANO-BANCO item 6.
- [ ] **T9 Paginação e agregação no banco** — `listPagamentos` trunca em 1.000 sem aviso;
  somas em JS. RPCs `gasto_por_obra`, `pagamentos_por_mes`; `.range()`. Antes do M3 da
  Fase 6. Fonte: eng-review P1-P3/D5, PLANO-BANCO item 4.
- [ ] **T10 Retenção por anonimização (duas fases)** — `mensagens_whats` é referenciada
  por `pagamentos.criado_via_msg_id`: DELETE quebra a cadeia SIM → pagamento.
  Anonimizar campos + purgar Storage; `audit_log` fora. **Bloqueado: prazo é decisão
  do cliente** (sugestão 365 d). Fonte: eng-review A5/D4, PLANO-BANCO item 2.

## P3 — higiene

- [ ] **T11 `search_path=''` nas 21 SECURITY DEFINER** — por família (auth/audit, fila,
  rag, saúde), cada uma com `--ensaio`; `fila_*` dependem de `pgmq`/`net`/`vault`.
  Por último, depois de T7 e T10. Fonte: eng-review A4, PLANO-BANCO item 5.
- [ ] **T12 `buscarAutorizado` por `telefone_norm`** e `getUsuario` sem listar todos.
  Fonte: eng-review C8/C5.
- [ ] **T13 Resposta best-effort quando `acao:'erro'`** — `webhooks/uazapi/route.ts:
  122-127` responde 200 e o remetente recebe silêncio. Fonte: eng-review 6.3 #3.
- [ ] **Fase 6 M0: HTTPS obrigatório** — IP fixo de saída não existe na Vercel; tráfego
  de 2.955 CPFs em HTTP é problema LGPD. `erp_sync` entra na whitelist `fila_valida`.
  Fonte: eng-review A7/D10.

## QA ao vivo (2026-09-12) — adiados com contexto

- [ ] **T-QA-3 Rótulos de status no formulário de pagamento** — `pagamento-form.tsx`:
  `<select name="status_pagto">` lista "Confirmado/Aguardando/Recusado/Erro"; usar
  `PAGAMENTO_STATUS_LABEL` de `lib/status-labels.ts`. CC ~10 min.
- [x] **T-QA-5 Contraste dos tokens de status** — feito em `97ba3d6` (badge sucesso,
  `--danger`, literal `#ef4444`). Falta só o `--warning` sobre creme.
- [ ] **T-QA-6 Erro de Zod preserva o formulário** — actions fazem `redirect('?error=…')`
  e o usuário perde o que digitou. `useActionState` devolvendo `{ erro, valores }`.
  CC ~1 h (todas as actions).
- [ ] **T-QA-7 `notFound()` com HTTP 200** em `/pagamentos/[id]` e `/documentos/[id]`
  (`/obras/[id]` devolve 404). Afeta cache/monitoramento. CC ~30 min.
- [ ] **T-QA-8 `<title>` por página** (só `/login` tem) + acento em "Convidar novo usuário".
- [ ] **T-QA-9 TTFB de `/pagamentos` ~1 s** (4 consultas sequenciais) — `Promise.all` ou
  RPC; reforça a região `gru1`.
- [ ] **T-QA-10 Tabela de automações no celular** — virar cartão como o `DataTable`.
- [ ] **T-QA-11 Busca de pagamentos por descrição/observações** — `columnVisibility` no
  `DataTable` + colunas ocultas com `accessorFn`.
- [ ] **T-QA-12 Testes de regressão de UI** — Vitest roda em `node`; opções: jsdom +
  testing-library para `DataTable`, ou axe-core no E2E do Playwright.

## Design review (2026-09-12) — adiados [DEPOIS DE 16/09]

- [ ] **A4 Confirmar em Pendentes com obra/valor faltando** — desabilitar até completar e
  trocar por "Completar e confirmar" abrindo `/pagamentos/novo` pré-preenchido. É o
  falso-sim pelo painel.
- [ ] **A7 Documentos com duas buscas e três modos** — uma busca só + "Agrupar por".
- [ ] **A8 Automações: um campo por parâmetro** gerado do `configSchema` (T1) em vez de
  JSON em textarea; cartão por regra no celular.
- [ ] **M4 Pendentes: agrupar sem-nota por fornecedor** com contagem e soma; vermelho só
  acima de 30 dias.
- [ ] **M5 Valor em R$ com `inputMode="decimal"` e máscara pt-BR** (`type=number` recusa
  "1.250,00" no Android).
- [ ] **M6 Obrigatoriedade consistente** (asterisco no `Nome` da obra; rodapé único).
- [ ] **M9 Auditoria legível**: agrupar por dia, frase humana, paginar por 50.
- [ ] **M12 Busca ⌘K numa RPC `busca_global`** (uma viagem em vez de três).
- [ ] **A1 Números reais no login** (contagens por service_role), se quiser números.

## Decisões humanas em aberto (não são código)

- Prazo de retenção de `mensagens_whats`/`ai_messages`.
- Purga de `audit_log`: manter até parecer jurídico.
- Fase 6: caminho A/B/C e quem recebe o quê no WhatsApp.
- Plano da Vercel (Hobby vs Pro/Fluid): teto do consumidor da fila e região `gru1`.
- Rodar `./setup` do gstack e `gstack-team-init` (o classificador do Claude Code barra;
  ver CLAUDE.md §10).
- Reiniciar `pnpm --filter web dev` (worker do PostCSS morto desde 12/09; T-QA-13).
