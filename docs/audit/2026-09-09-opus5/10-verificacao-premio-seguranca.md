# VERIFICAÇÃO PRÊMIO DE SEGURANÇA — Auditoria Adversarial

> Redisparada em 2026-09-09 (Sonnet 5) para repor a rodada perdida no crash do VS Code.

**Escopo:** `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA`, branch `feat/alinhamento-cavalcanti-16-09`. Verificação de código real (não do changelog) contra `docs/audit/AUDIT-CONSOLIDADO.md` e `docs/audit/2026-09-08-audit-security.md`, mais varredura adversarial independente (autorização/IDOR, injeção, fluxo WhatsApp, exposição de dados). Nenhum arquivo foi alterado durante a auditoria. Este relatório **confirma de forma independente** o achado E (escalação via self-signup) já corrigido a partir do relatório `01-seguranca-profunda.md` (lá chamado C-2) — dois agentes distintos, rodando em paralelo sem se comunicar, chegaram ao mesmo achado, o que reforça sua confiabilidade.

> **Nota de acompanhamento:** achados E (self-signup) e B (secret vazando via audit_log) foram corrigidos
> logo após esta auditoria — ver migration `20260909130000_fix_signup_privilege_escalation.sql` e
> `20260909130100_audit_log_exclude_webhook_secret.sql`.

---

## Parte 1 — Findings anteriores → status real

| # | Finding | Status declarado | Status real | Evidência |
|---|---|---|---|---|
| 1 | F-01 Security headers ausentes | Fixed | CONFIRMADO CORRIGIDO | `apps/web/next.config.ts:16-34` — 5 headers em `source: '/(.*)'`, cobre todas as rotas |
| 2 | HIGH-001 `Math.random()` no webhook secret | Fixed | CONFIRMADO CORRIGIDO | `dispatch-webhook.ts:192-194` usa `randomBytes(32)`. Grep repo-wide: nenhum outro `Math.random` perto de secret/token/senha |
| 3 | HIGH-002 iframe sandbox permissivo | Fixed | CONFIRMADO CORRIGIDO | `notificacoes/[id]/page.tsx:119-124` — `sandbox=""`, único iframe do app |
| 4 | BUG-01 merge-fornecedores sem transação | Fixed | CONFIRMADO CORRIGIDO (causa raiz) | `20260908120000_merge_fornecedores_rpc.sql` — `SECURITY DEFINER SET search_path=public`, `FOR UPDATE` (lock anti-race), `REVOKE ALL ... GRANT service_role`; caller (`duplicatas/actions.ts:15-36`) chama `assertAdminOrGestor()` antes |
| 5 | BUG-02 race em `confirmarPendencia` | Fixed | CONFIRMADO CORRIGIDO — gap lateral | `pendentes/actions.ts:64-121` pre-check + catch `23505` idempotente; `20260908100000_..._unique.sql` fecha a janela via unique index parcial. **Porém** `rejeitarPendencia` (mesmo arquivo, ~147-174) não tem o mesmo guard `if (confirmacao.resolvida)` que `confirmarPendencia` tem — inconsistência de padrão (impacto baixo, é idempotente por natureza) |
| 6 | BUG-04 RMW em `total_execucoes` | Fixed | CONFIRMADO CORRIGIDO (causa raiz) | `20260908110000_webhook_counter_rpc.sql` — `UPDATE ... SET total_execucoes = COALESCE(...)+1` em query única, `SECURITY DEFINER` restrito a `service_role` |
| 7 | BUG-03 `apelido-actions` expõe erro cru | Fixed | CONFIRMADO CORRIGIDO nesse arquivo — padrão não generalizado | `apelido-actions.ts:51-61,82-86` usa `mapDbErrorWithContext`. Mas `login/actions.ts:27`, `definir-senha/actions.ts:39` e `api/cron/sweep-pending-documentos/route.ts:47-49` continuam com erro cru (= INFO-004 nunca fixado) |
| 8 | MED magic bytes upload | Fixed | CONFIRMADO CORRIGIDO, sem bypass | `documento.ts:87-131` cobre os 4 MIMEs; chamada em `documentos/actions.ts:53-56` antes do upload; único call-site de upload no app. **Latente:** `lib/storage/documents.ts:30-33` exporta `uploadDocumentFile()` morto (não chamado por ninguém) sem essa validação — armadilha para reintrodução futura |
| 9 | MED StatusBanner ecoa `?error=` raw | Fixed | PARCIALMENTE CORRIGIDO | `StatusBanner.tsx:25-38` remove só URLs com protocolo explícito. Bypass: `bit.ly/xyz`, `www.phish.com`, `//evil.com` (sem protocolo) passam ilesos. Risco baixo (React escapa, não é link clicável) mas o objetivo "remove URLs" não é 100% atingido |
| 10 | MED cookie de tema inseguro | Fixed | CONFIRMADO CORRIGIDO | `api/theme/route.ts:20-27` — `httpOnly + sameSite:'strict' + secure` |
| 11 | MED manifest.json + OG | Fixed | CONFIRMADO CORRIGIDO | `app/manifest.ts` existe; `layout.tsx` com `openGraph`/`robots` |
| 12 | MED `loading.tsx` ausente | Fixed | CONFIRMADO CORRIGIDO | 6 arquivos presentes em `documentos/obras/pagamentos/painel/pendentes/relatorios` |
| 13 | HIGH-002 `/api/exports` na whitelist do middleware | Justificado (design) | JUSTIFICATIVA TÉCNICA VÁLIDA, mas achado-irmão nunca avaliado | `middleware.ts:38-41` mantém o path; `route.ts:127-138` faz `getUser()` como primeiro código, retorna 401 sem branch alternativo — sem regressão. Mas nenhuma auditoria checou que o handler **não filtra por papel** — ver novo achado C |
| 14 | MED-002 `commitImportCsv` confia em `PreviewRow[]` do client | Backlog | NÃO CORRIGIDO | `import-pagamentos.ts:159-207` monta `obra_id/fornecedor_id/categoria_id` direto de `matched.*` do client via `service_role` (bypassa RLS), sem revalidar contra o banco. Mitigado parcialmente por ser `admin`-only |
| 15 | MED-003 Storage SELECT liberado a qualquer `authenticated` | Backlog | NÃO CORRIGIDO | `20260907120000_storage_documents_rls_tighten.sql:13-16` — `USING (bucket_id='documents')` sem corte de papel. Path previsível (`{obra_id}/{documento_id}/{filename}`) descoberto via SELECT em `documentos` (também aberto). Bypassa `downloadDocumento` (que bloqueia docs arquivados e limita TTL a 60s) |
| 16 | INFO-003 `GRANT SELECT` para `anon` em todas as tabelas | Backlog | NÃO CORRIGIDO | `20260905120000_grants_authenticated.sql:16` inalterado; mitigado por RLS (`auth.uid() IS NOT NULL`) |
| 17 | INFO-004 erros de DB expostos em webhook/cron | Backlog | NÃO CORRIGIDO | `api/webhooks/uazapi/route.ts:89-92` e `api/cron/sweep-pending-documentos/route.ts:47-49` |

**Regressões:** nenhuma. `git log` dos arquivos-chave não mostra revert de nenhuma correção após os commits `cb33f4c`/`1a29ae4`; o único commit posterior que tocou o middleware (`a8feb5d`) apenas excluiu rotas estáticas (`manifest.webmanifest`, `robots.txt`, etc.) do matcher — sem impacto de autorização.

**Conclusão da Parte 1:** as 13 correções resistem à verificação adversarial — as de maior risco técnico (BUG-01/02/04) corrigem causa raiz via RPC atômica com `SECURITY DEFINER` bem restrito, não são tapa-buraco. Os itens deixados no backlog original seguem exatamente como estavam.

---

## Parte 2 — Novos findings (varredura independente)

### CRÍTICO

#### A. Fluxo de auto-aprovação via WhatsApp não verifica remetente — tabela `autorizados` existe no schema mas nunca é consultada

**Localização:** `apps/web/app/api/webhooks/uazapi/route.ts` + `apps/web/lib/services/classify-and-persist.ts:80-127`

O schema tem `autorizados` (`supabase/migrations/20260903100100_profiles_autorizados_categorias.sql:29-39`, comentário literal "Equipe autorizada (números que podem mandar WhatsApp)", com `telefone_whats UNIQUE` + `ativo`) e FK `mensagens_whats.autorizado_id`. **Nenhum código de runtime lê essa tabela** — grep completo em `apps/web/lib` e `apps/web/app` só retorna rótulos de auditoria em `lib/data/auditoria.ts`. Não existe UI para gerenciá-la.

O HMAC do webhook (`lib/webhooks/hmac.ts`) autentica que a chamada veio do **servidor UAZAPI** — não que o **remetente da mensagem WhatsApp** é um funcionário autorizado. `telefone_from` nunca é comparado contra `autorizados.telefone_whats WHERE ativo=true`.

Quando `kind === 'pagamento_completo' && confidence >= 0.85`, `classify-and-persist.ts:87-114` insere diretamente um `pagamentos` com `status_pagto: 'confirmado'` — **sem revisão humana, sem "digite OK"** (esse fluxo de confirmação por texto não existe no backend — toda mensagem recebida é reclassificada do zero; a única confirmação real hoje é feita autenticado no painel `/pendentes`).

**Por que ainda não explorável:** `IA_PROVIDER=mock` (`lib/ia/classifier.ts`) nunca atinge confidence ≥ 0.85 nem retorna `pagamento_completo` de fato — o branch `autoAprovar` está dormente. Mas segundo o status do próprio projeto ("Fase 8 Integration aguarda creds UAZAPI/AI"), isso ativa assim que as credenciais Anthropic/OpenAI chegarem.

**PoC (pós-ativação da IA real):** enviar ao número WhatsApp Business conectado: "Paguei R$ 5.000,00 pro fornecedor [conhecido] na obra [nome real] hoje, à vista". Se a IA real atingir confidence ≥ 0.85, um pagamento **confirmado** é lançado sem qualquer verificação de identidade do remetente — qualquer pessoa com o número público do WhatsApp Business pode fraudar o livro financeiro.

**Fix:**
1. No webhook, antes de `classifyAndPersist`: `SELECT id FROM autorizados WHERE telefone_whats = normalizeTelefone(from) AND ativo = true`; se ausente, gravar como `rejeitada_nao_autorizado` e nunca classificar.
2. Preencher `mensagens_whats.autorizado_id`.
3. Bloquear (ou remover) o branch `autoAprovar` até essa checagem existir — nenhum pagamento deveria nascer sem revisão humana em `/pendentes`.
4. Tratar como **bloqueador de go-live da Fase 8**, junto com o achado D (formula injection) abaixo, pois compartilham a mesma superfície de entrada não autenticada.

#### B. Secret HMAC de webhooks outbound vaza em texto puro para o papel `gestor` via `audit_log` — CORRIGIDO 2026-09-09

**Localização:** `supabase/migrations/20260907160000_audit_triggers.sql:25-83,103-106` + `20260907190000_webhooks_outbound.sql:39-52`

`webhooks_outbound` é `admin`-only por RLS (`USING (has_role(['admin']))`), mas a mesma migration anexa `trg_audit_webhooks_outbound`, que grava `to_jsonb(NEW) - 'updated_at'` — **incluindo a coluna `secret`** — em `audit_log.diff` a cada INSERT/UPDATE (criação ou regeneração de secret). `audit_log` é legível por `admin` **e `gestor`** (`audit_admin_gestor_select`), sem exceção por tabela.

**Impacto:** um usuário `gestor` (que não tem acesso direto a `webhooks_outbound`) lê `SELECT diff FROM audit_log WHERE entidade='webhooks_outbound'` e extrai o secret HMAC de qualquer webhook outbound — podendo forjar payloads que o n8n/Zapier/Slack do outro lado confia como vindos do CRM (ex: injetar eventos `pagamento_created` falsos no automation downstream).

**PoC:** login como `gestor` → query em `audit_log` filtrando `entidade='webhooks_outbound'` → ler o campo `secret` dentro do diff gravado.

**Fix aplicado:** migration `20260909130100_audit_log_exclude_webhook_secret.sql` altera o trigger de auditoria de `webhooks_outbound` para excluir a coluna `secret` do diff gravado (`to_jsonb(NEW) - 'updated_at' - 'secret'`).

---

### ALTO

#### C. `/api/exports` — qualquer autenticado (inclusive papel `leitura`) exporta dados financeiros completos de qualquer obra

**Localização:** `apps/web/app/api/exports/[tipo]/route.ts:127-138` + `apps/web/lib/data/reports.ts`

O handler autentica mas não checa papel. Como a policy de SELECT em `pagamentos`/`documentos`/`obras` é `auth.uid() IS NOT NULL` (sem distinção de role), um usuário `leitura` — documentado como "apenas visualização" — pode chamar `GET /api/exports/obra-completa?obra_id=<uuid>&format=pdf` e baixar o relatório financeiro consolidado de qualquer obra, iterando UUIDs. É diferente de navegar a UI: o export em lote amplia a superfície de exfiltração muito além do que a tela normal exibiria para esse papel.

**Fix:** checar papel dentro do handler (ex.: `leitura` não pode exportar `obra-completa`/`mes`/`fornecedor`) e/ou logar exports em `audit_log` para rastreabilidade.

#### D. CSV/Formula injection nas exportações
*(confirmado independentemente por dois agentes; já apontado em `docs/audit/2026-09-09-opus5/02-servicos-integracoes.md` F-07 como MÉDIO e nunca corrigido — elevo para ALTO aqui por combinar com o achado A: entrada externa via WhatsApp, sem autenticação)*

**Localização:** `apps/web/lib/reports/csv.ts:17-24` (`csvCell`)

Faz escaping RFC 4180 (aspas) mas não neutraliza células iniciadas por `=`, `+`, `-`, `@` ou tab — prefixos que Excel/Sheets interpretam como fórmula. `descricao`/`observacoes` de pagamentos podem vir de texto livre de WhatsApp (`classify-and-persist.ts:97`) ou CSV importado (`import-pagamentos.ts:182`); `documentos.nome_arquivo` vem do nome de arquivo do usuário. Todos são despejados sem sanitização nos exports CSV.

**PoC:** cadastrar/receber via WhatsApp uma descrição de fórmula com link embutido → exportar "Fechamento Mensal" ou "Obra Completa" em CSV → abrir no Excel do gestor/financeiro → link de exfiltração ativo.

**Fix:** em `csvCell()`, se a célula começar com `=`, `+`, `-`, `@`, tab ou CR, prefixar com apóstrofo antes do quoting existente.

#### E. `handle_new_user()` herda `papel` de `raw_user_meta_data` — risco de auto-promoção a admin se signup público estiver habilitado — CORRIGIDO 2026-09-09

**Localização:** `supabase/migrations/20260907170000_profiles_deleted_at_papel_metadata.sql:19-41`

O trigger lia o papel de `raw_user_meta_data`, caindo em `'leitura'` só se ausente/inválido. Hoje seguro no código da aplicação (só `admin.auth.admin.inviteUserByEmail`, gated por `assertAdmin()`, seta esse metadata; nenhum client-side `signUp()`/`updateUser({data})` existe). **Mas** `raw_user_meta_data` é populado pelo endpoint público de signup do Supabase usando apenas a `anon key` (pública, `NEXT_PUBLIC_*`) — se "Allow new user signups" estiver habilitado no dashboard do projeto Supabase (configuração fora do repo, não verificável por código), qualquer pessoa poderia se cadastrar pedindo o papel `admin` no próprio payload e o trigger criaria um profile `admin` sem nenhuma validação.

**Este é o mesmo achado que `01-seguranca-profunda.md` chama de C-2** — dois agentes rodando em paralelo, sem visibilidade um do outro, convergiram na mesma vulnerabilidade de forma independente.

**Fix aplicado:** mesma migration do C-2 (`20260909130000_fix_signup_privilege_escalation.sql`) — trigger agora hardcoda `'leitura'` sempre, ignorando `raw_user_meta_data`.

**Pendente (ação manual):** confirmar/desabilitar signup público no dashboard do Supabase Auth.

---

### MÉDIO

#### F. `commitImportCsv` confia em IDs vindos do client sem revalidar (MED-002, ainda aberto)
`import-pagamentos.ts:159-207` — ver Parte 1 #14. Mitigado por ser `admin`-only, mas o service-role bypassa RLS e os UUIDs recebidos não são reconferidos contra o CSV original.

#### G. Storage `documents` — SELECT aberto a qualquer autenticado, bypassa ownership/TTL/arquivamento (MED-003, ainda aberto)
Ver Parte 1 #15. Bypassa `downloadDocumento` (TTL 60s, bloqueio de doc arquivado) e a policy de `documentos` não filtra `deleted_at`, então docs arquivados também ficam expostos.

#### H. SSRF via URL de webhook outbound configurável por admin, sem allowlist
**Localização:** `apps/web/app/(app)/config/webhooks/actions.ts:38-59` + `dispatch-webhook.ts:84,165`. Validação Zod só exige `z.string().url()` com prefixo `http`. Admin (ou sessão admin comprometida) pode registrar URL para IP interno da rede Vercel/Supabase; `dispatchEvento`/`testWebhook` fazem `fetch()` server-side a cada evento.
**Fix:** resolver hostname e rejeitar IPs privados/loopback/link-local antes de salvar e a cada fetch.

#### I. `CRON_SECRET` comparado com igualdade direta em vez de comparação em tempo constante
**Localização:** `api/cron/sweep-pending-documentos/route.ts:24`. Inconsistente com o padrão correto já usado em `lib/webhooks/hmac.ts`. Risco prático baixo (jitter de rede), mas barato de corrigir.

#### J. Secret do webhook exposto na URL de redirect
**Localização:** `config/webhooks/actions.ts:97,200` — redirect com o secret na query string. Vaza para logs de acesso, histórico do navegador e `Referer` de cliques subsequentes.
**Fix:** transportar via cookie `httpOnly` de vida curta, como já feito em `api/theme/route.ts`.

#### K. `removerApelido` não valida que o apelido pertence ao `fornecedor_id` informado
**Localização:** `fornecedores/[id]/apelido-actions.ts` — delete por id do apelido sem também filtrar pelo `fornecedor_id`. Um usuário com permissão de mutação pode remover apelido de outro fornecedor. Impacto baixo (bug lógico, não há modelo de ownership por fornecedor), fix trivial.

#### L. Padrão de mapeamento de erro não generalizado + erros crus residuais
`login/actions.ts:27`, `definir-senha/actions.ts:39`, `api/cron/sweep-pending-documentos/route.ts:47-49`, `api/webhooks/uazapi/route.ts:89-92` continuam expondo erro cru. Risco baixo (endpoints autenticados/protegidos por HMAC ou Bearer), mas item de higiene consistente.

#### M. `rejeitarPendencia` sem guard de idempotência (inconsistente com `confirmarPendencia`)
Ver Parte 1 #5. Baixo risco por ser operação idempotente por natureza, mas quebra o padrão aplicado ao vizinho.

#### N. StatusBanner — bypass de sanitização para URLs sem protocolo
Ver Parte 1 #9.

---

### BAIXO / observações

- **INFO-003** `GRANT SELECT` para `anon` em todas as tabelas — ainda presente, mitigado por RLS.
- **`uploadDocumentFile`** morto em `lib/storage/documents.ts:30-33`, sem validação de magic bytes — risco latente se reativado no futuro.
- **Fluxo "digite OK" do WhatsApp não está implementado** — nenhuma mensagem recebida é tratada como confirmação de uma `confirmacoes_pendentes` existente; a única confirmação real passa por login + UI. Isso é hoje uma proteção de fato, mas quando esse handler for construído, ele deve herdar as mesmas guardas do achado A (verificação de `autorizados` + idempotência).

---

## O que foi testado e está seguro

- Zero pontos de renderização de HTML não sanitizado no app inteiro (nenhum uso da API de injeção direta de markup do React).
- Filtros dinâmicos (`.or()`) passam por `sanitizeSearchQuery` — sem PostgREST filter injection.
- `EXECUTE format(...)` nas migrations usa `%I` corretamente, sem input de usuário.
- Nenhum uso de `child_process`/`exec`/`spawn` na aplicação.
- `profiles_self_update` bloqueia auto-promoção de papel via `WITH CHECK`; `alterarPapelUsuario`/`arquivarUsuario` bloqueiam auto-edição além de `assertAdmin()`.
- `merge_fornecedores_atomic` e `increment_webhook_execution`: `REVOKE ALL FROM PUBLIC` + `GRANT service_role`, `SET search_path=public` (sem search_path hijack).
- HMAC de webhook inbound usa comparação em tempo constante corretamente.
- Cookie de tema com `httpOnly+sameSite=strict+secure`.
- Magic bytes cobre os 4 MIME types permitidos, validado antes do upload real, único call-site ativo.

---

## Resumo de severidade

| Severidade | Achado |
|---|---|
| Crítico | A — `autorizados` nunca verificado no pipeline WhatsApp (bloqueador Fase 8) |
| Crítico | B — secret de webhook vaza para `gestor` via `audit_log` — **corrigido** |
| Alto | C — `/api/exports` sem corte de papel |
| Alto | D — CSV/formula injection nas exportações |
| Alto | E — auto-promoção a admin via signup público — **corrigido** (mesmo achado que C-2 de `01-seguranca-profunda.md`) |
| Médio | F, G, H, I, J, K, L, M, N |
| Baixo | INFO-003, `uploadDocumentFile` morto, fluxo "digite OK" inexistente |

**Conclusão geral:** as 13 correções das duas rodadas anteriores resistem à verificação adversarial, sem regressões. O ponto cego real das auditorias anteriores foi não seguir o fluxo WhatsApp → IA → banco de ponta a ponta questionando "quem é o remetente" — um gap que passou batido justamente por não ser explorável *ainda* (classificador em modo mock), mas que se torna crítico exatamente quando a Fase 8 (credenciais UAZAPI/AI) for ativada, conforme o roadmap do próprio projeto. **Achado A é o bloqueador de segurança mais importante antes de ligar `IA_PROVIDER=anthropic` em produção.**
