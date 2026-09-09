> **Recuperado do transcript da sessao de 2026-09-09** (VS Code fechou antes de consolidar).
> Agente: Agent "Summarize docs folder" finished
> Custo: 100553 tokens, 16 tool calls

All files read. Here is the complete report.

---

# Documentation Inventory — CRM-CONSTRUTORA-NOGMA

**Note on count:** `docs/` contains **29** markdown files, not 26. The task listed `docs/*.md` (4), `docs/audit/*.md` (4), `docs/operacao/*.md` (18) = 26, but there are also **3 files under `docs/superpowers/`** (2 plans + 1 spec) that were omitted from the brief. All 29 + the 3 root/app files (32 total) are covered below.

---

## Part A — File-by-file inventory

### Root-level docs

| Path | Lines | Summary |
|---|---|---|
`C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\docs\PROJETO-STATUS.md` | 168 | Snapshot dated **2026-09-04 (end of Fase 0 handoff)** — is *not* the current phase tracker. Lists Supabase/GitHub/Vercel provisioning as 100% done, toolchain versions, and a security post-mortem of two leaked-but-inert secrets (DB password, HMAC secret). Ends with "Fase 1 — pronto pra começar". Stale relative to MANUAL-PENDENCIAS (which reports 21 phases shipped).
`C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\docs\MANUAL-PENDENCIAS.md` | 644 | **The canonical "what a human must still click" doc** (2026-09-08, prod commit `a8feb5d`). 29 manual items in 4 tiers (blockers/critical/recommended/nice-to-have) + a 29-item go-live checklist. Zero blockers; the 5 criticals are Resend, Anthropic key, UAZAPI, Supabase staging, GitHub E2E workflow+secrets, team invites.
`C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\docs\N8N-COMPLETO.md` | 1707 | Copy-paste-ready n8n guide: 2 architecture patterns (CRM-direct vs n8n-as-middleware), cloud vs self-hosted Docker+Caddy setup, 7 credentials to create, universal HMAC-validation Code node, **7 full workflow JSONs**, Claude system prompt + tool_use schema, env vars, E2E test checklist, troubleshooting, cost table.
`C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\docs\TUTORIAL-COMPLETO.md` | 638 | End-user manual in 18 sections: first admin login, screen-by-screen tour, invites, personal prefs, cadastros (obras/fornecedores/categorias), payments, docs upload, CSV bulk import, 4 reports, audit trail, email notifications, apelidos+duplicates, **§13 WhatsApp+IA marked "aguarda creds"**, n8n, activating Resend, staging+CI, troubleshooting.
`C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\README.md` | 51 | Project front page: product one-liner (obra financial management + AI-classified WhatsApp bot), client Cavalcanti / vendor Nogma, links to spec + plan v2 + design system, requirements (Node ≥20, pnpm ≥9), local setup commands, monorepo tree, pointers to `docs/operacao/`. Note: references `runbook.md` and `backup-restore.md` which **do not exist**.
`C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\apps\web\CLAUDE.md` | 1 | Single line: `@AGENTS.md` — pure import/redirect to the sibling AGENTS.md. No project-specific instructions.
`C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\apps\web\AGENTS.md` | 9 | Auto-generated `nextjs-agent-rules` block written by `next dev`: warns this Next.js version has breaking changes vs training data and to read `node_modules/next/dist/docs/` before writing code. Not human-authored.

### docs/audit/ (4 files)

| Path | Lines | Summary |
|---|---|---|
`...\docs\audit\AUDIT-CONSOLIDADO.md` | 237 | Consolidation of the 3 parallel audits: **31 findings** (1 crit, 5 high, 15 med, 10 info). Documents session 1 (3 fixes) then session 2 (commits `cb33f4c`+`1a29ae4`, 3 prod migrations + 10 code fixes). Final tally: **10 fixed, 1 justified, 7 deferred, 0 open criticals**.
`...\docs\audit\2026-09-08-audit-security.md` | 281 | RLS + auth + secrets audit (commit `ff16552`, git-tracked files only). 0 crit / 2 high (Math.random webhook secret; `/api/exports` public in middleware) / 3 med (magic-bytes MIME bypass, `commitImportCsv` trusts client PreviewRow, Storage SELECT for any authed user) / 4 info.
`...\docs\audit\2026-09-08-audit-backend.md` | 606 | Server actions + services + API routes + data layer audit. **6 BUG · 9 QUALITY · 6 REFACTOR · 2 INFO** with a full severity index (BUG-01..06, QUALITY-01..09, REFACTOR-01..06) and a 3-sprint prioritization. Praises consistency across 19 actions / 17 data-service files; also documents test-coverage gaps.
`...\docs\audit\2026-09-08-audit-frontend-infra.md` | 397 | XSS/CSRF/bundle/env/Vercel/GH-Actions/a11y/perf audit. **16 findings F-01..F-16**: F-01 CRIT missing security headers, F-02/F-03 HIGH (iframe `allow-same-origin`, no manifest/OG), F-04..F-11 MED, F-12..F-16 INFO (positives). Many CHECK PASS sections (no unsafe innerHTML, Server Action CSRF, CRON_SECRET, skip-link, next/image).

### docs/operacao/ (18 files)

| Path | Lines | Summary |
|---|---|---|
`...\docs\operacao\fase-8-integracao.md` | 290 | **WhatsApp (UAZAPI) + AI classifier.** Foundation shipped (Tasks 8.1–8.6); 7 numbered steps to finish, including a ~120-line copy-paste `AnthropicClassifier`. See Part E below.
`...\docs\operacao\fase-9-relatorios.md` | 123 | Fase 9 PDF/CSV reports — **shipped in prod** (`1fedaa2`). `/relatorios` with 4 cards (Relatório da Obra, Fechamento Mensal, Histórico do Fornecedor, Atividade Recente), each PDF+CSV. Covers stack, key files, perf notes, cost.
`...\docs\operacao\fase-10-emails.md` | 162 | Email notifications — **shipped with `EMAIL_PROVIDER=mock` active in prod**. Documents trigger → `send-email.tsx` → `getRecipientsByPapel(['admin','gestor'])` → React Email template → provider factory → log in `notificacoes_email`. 5-step Resend activation guide + deliverability + cost.
`...\docs\operacao\fase-11-auditoria.md` | 138 | Audit trail — **shipped, "LGPD compliance ready"**. Postgres triggers `trg_audit_&lt;table&gt;` on 6 business tables (obras, fornecedores, pagamentos, documentos, categorias, autorizados) → `audit_log` → `/auditoria` viewer for admin+gestor. Retention, perf, RLS.
`...\docs\operacao\fase-12-e2e.md` | 193 | Playwright E2E — **infra shipped, 12 tests in 5 specs**, but **hCaptcha in prod blocks automated runs** (needs local config to run). Documents config, `global.setup.ts`, helpers/`cleanupAllE2E()`, `scripts/e2e-cleanup.mjs`, data isolation via `E2E_PREFIX`, and "CI (não implementado)".
`...\docs\operacao\fase-13-usuarios.md` | 174 | User management + invites — **shipped**. `/config/usuarios`, `convidarUsuario` action → `admin.inviteUserByEmail` with `redirectTo=/definir-senha`, `handle_new_user()` trigger creating profile from metadata. 4 RLS-enforced roles, middleware, email templates.
`...\docs\operacao\fase-14-preferencias.md` | 101 | User preferences — **shipped**. `/config/perfil` with 4 fieldsets (info, theme radio-cards light/black/dark, IANA timezone, 3 email opt-in checkboxes), migration `20260907180000`, unchecked-checkbox handling, impact on Fase 10 email service.
`...\docs\operacao\fase-15-staging.md` | 256 | Staging Supabase + CI E2E — **infra shipped, awaits 1 human step**: `SUPABASE_ACCESS_TOKEN` PAT returns 403 on `POST /v1/projects` (free tier / scope), so the human must create the staging project in the dashboard; scripts then auto-run. 8 steps incl. 6 GitHub secrets + workflow push.
`...\docs\operacao\fase-16-categorias.md` | 112 | Accounting categories — **shipped**. `/config/categorias` admin CRUD over the 8 seeded categories (migration `20260903100100`), 8-colour Nogma palette via CSS `:has()` radio-cards, soft-delete `deleted_at`, usage counts + R$ totals per category.
`...\docs\operacao\fase-17-dashboard.md` | 145 | Advanced dashboard — **shipped, zero mocks**. Replaced `MOCK_TREND_*` sparklines and hardcoded activity feed with real data: 4 KPIs + real 8-month sparklines + MoM delta %, Recharts 12-month bar chart, real activity timeline. Data layer in `lib/data/painel.ts`.
`...\docs\operacao\fase-18-bulk.md` | 158 | Bulk operations — **shipped**. (1) `/config/importar` CSV payment import: template download via data URL, per-row validation, preview with errors, confirm → batch insert. (2) Multi-select checkbox bulk archive on `/obras`.
`...\docs\operacao\fase-19-apelidos-duplicatas.md` | 162 | Supplier aliases + duplicate detection — **shipped**. `fornecedor_apelidos` table feeds the Fase 8 AI classifier (e.g. matching "CDT" → "Casa das Tintas Ltda"); `/fornecedores/duplicatas` suggests merges, admin confirms; documents the merge operation and its classifier impact.
`...\docs\operacao\fase-20-a11y-polish.md` | 178 | A11y + polish (WCAG AA) — **shipped, final phase of the 21-phase roadmap**. `styles/a11y.css` (skip link, universal focus-visible lime ring, prefers-reduced-motion → 0.01ms), root-layout skip link, semantic landmarks in app shell + sidebar, Sonner Toaster wired, reusable StatusBanner. Explicitly not 100% WCAG AA.
`...\docs\operacao\handoff-fase-0.md` | 516 | Foolproof Fase 0 runbook in parts A–E: Supabase account/project/extensions/PAT/4 credentials (A), Vercel steps for the NogmaBR org partner (B), MCPs to activate (C), credential handoff checklist with what's already in `.env.local` (D), what the agent executes on receipt (E), plus secret-sharing appendix.
`...\docs\operacao\handoff-vercel-parceiro.md` | 172 | Standalone 11-section doc to forward to the NogmaBR GitHub org owner: create Vercel account + MFA, create team, install Vercel GitHub App on the org, import `CRM-CAVALCANTI` with exact build config, enable Deployment Protection, generate a scoped access token, return 4 values. ~15 min, no credit card.
`...\docs\operacao\n8n-integracao.md` | 252 | n8n integration — **infra shipped**: CRM emits HMAC-signed webhooks on **6 events**, n8n can also read Supabase directly via native node. Covers cloud vs self-hosted Docker, webhook registration in `/config/webhooks`, signature validation snippet, payload shapes, **4 example workflows**, security, costs.
`...\docs\operacao\setup-supabase.md` | 103 | One-time Supabase provisioning: new project (`sa-east-1`, Free), collect credentials, enable extensions, install CLI, link local project (after plan Task 3.1), create a test admin user, troubleshooting.
`...\docs\operacao\setup-vercel.md` | 99 | One-time Vercel provisioning: GitHub repo prerequisite, import project, environment variables, domain, first deploy, protect `main`, troubleshooting. Predates the actual `nogma1`/`crm-cavalcanti` setup recorded in PROJETO-STATUS.

### docs/superpowers/ (3 files — not in the original brief)

| Path | Lines | Summary |
|---|---|---|
`...\docs\superpowers\specs\2026-09-03-crm-nogma-gestor-obras-design.md` | 853 | **The origin design spec** (status "Aprovado para planejamento"), 14 sections + Anexo A: context/business flow (zelador photographs receipt → WhatsApp → AI classifies), scope, architectural decisions, Nogma DS, repo structure, full Postgres data model, modules/screens, end-to-end WhatsApp bot flow, security/RLS, testing, **a 21-row (0–20) phased roadmap**, risks, V2 extras, env-var appendix.
`...\docs\superpowers\plans\2026-09-03-plano-1-fundacoes.md` | 2540 | Plan #1 v1 — **superseded**. Task-by-task implementation plan for Fases 0–3 (monorepo, design system via shadcn + Tailwind v4 + 3 themes, Supabase Auth, initial schema + RLS), with embedded copies of the Supabase/Vercel setup steps and a self-review section.
`...\docs\superpowers\plans\2026-09-03-plano-1-fundacoes-v2.md` | 1703 | Plan #1 v2 — **canonical**. Replaces v1 because the user supplied the complete `Nogma Design System/`; ports its `.jsx` components to `.tsx` under `components/nogma/` and reproduces the NogmaOS Chrome (Sidebar+TopBar) instead of recreating via shadcn. Same Fases 0–3 scope + Task 4 closeout.

---

## Part B — `docs/PROJETO-STATUS.md`: phases and status

**Important caveat:** this file does **not** contain a 21-phase list. It is frozen at **2026-09-04, end of the Fase 0 handoff session**, and tracks *provisioning blocks* rather than product phases. Verbatim structure:

**"O que está pronto ✅"** — Documentação (spec, plan v1 superseded, plan v2 canonical, setup-supabase, setup-vercel); Design System (`Nogma Design System/` = source of truth, `.design-system/` historical); Repositório (git init, remote `NogmaBR/CRM-CAVALCANTI`, branch `main`, 4 commits pushed); Monorepo (pnpm-workspace with `allowBuilds`, root package.json scripts, biome.json, tsconfig.base.json, `pnpm install` OK).

**"O que está PENDENTE ⏳"** — three lettered blocks, all in fact marked done:

| Block | Status line as written | Residual pending |
|---|---|---|
| 🅰️ Supabase | **100% pronto ✅** — project `CRM-CAVALCANTI` ref `bbtejxugeeccywwhfpoc`, `sa-east-1`, PG 17.6; extensions; all API keys in `.env.local`; Auth hardening via Management API; security advisor 0 lints | DB password is weak (11 chars) — "recomendável rotacionar" |
| 🅱️ GitHub | **100% pronto ✅** — secret scanning + push protection + Dependabot; branch protection on `main` (1 review, no force-push, no delete, conversation resolution); squash-only; auto-delete head branches; wiki/projects off | "só org admin pode fazer": **enforce 2FA na org NogmaBR**; **revisar colaboradores admin** (`Tarsis59`, `Hugo6404`, `guilbmarcon`) |
| 🅲 Vercel | **100% pronto ✅** — team `nogma1`, project `crm-cavalcanti`, GitHub link, prod URL `https://crm-cavalcanti.vercel.app`, build config via REST API (`rootDirectory=apps/web`, node 22.x), Ignored Build Step, **7 env keys** across production+preview+development, Deployment Protection, Supabase auth URL allow-list synced | — |

**"Fase 1 — pronto pra começar"**: *"Todos os ingredientes Supabase + GitHub + Vercel prontos. Nenhum bloqueio. Executar plano v2 Task 1.1 em diante."*

**Toolchain table:** Node v22.18.0 ✅ · pnpm v11.7.0 ✅ · git v2.50.1 ✅ · Docker v28.3.3 ✅ · gh CLI v2.99.0 ✅ · Supabase CLI v2.101.0 ✅ · **Vercel CLI v59.11.2 ⏳ (não autenticado ainda)** — the only ⏳ in the table.

**Security section:** two previously-committed values in commit `ff16552` on a *public* repo — DB password prefix `BPGAbjz…4Fq` (**inert**, tested and auth failed) and HMAC secret prefix `dcbb2015…93d` (**rotated**). Real secrets never touched git.

**Gotchas recorded:** pnpm v11 `allowBuilds:` syntax; Supabase Free = 2 projects/member (limit hit on `contato.nogma@gmail.com`); Nogma DS is complete (maximum reuse); NogmaOS UI kit CSS must be extracted to `styles/nos-chrome.css` in Task 1.5; **circular FK** between `pagamentos.criado_via_msg_id` and `mensagens_whats.pagamento_id` → resolve with `DEFERRABLE INITIALLY DEFERRED`.

### The actual phase list (reconstructed — for the caller's benefit)

The real 21-phase status is recorded across the other docs. `MANUAL-PENDENCIAS.md` line 5 states: *"✅ 21 fases + integração n8n + 2 rodadas de auditoria de segurança shipadas (`a8feb5d` em prod). Zero código faltando."* Per-phase docs exist only for 8–20:

| Fase | Doc status line |
|---|---|
0 Kickoff/repo, 1 Design System, 2 Auth, 3 Schema/RLS, 4–7 CRUD | shipped (no individual doc; covered by plan v2 + PROJETO-STATUS) |
**8 WhatsApp UAZAPI + IA** | **Foundation shipada (8.1–8.6) — falta UAZAPI real + provider IA** |
9 Relatórios PDF/CSV | shipada em prod (`1fedaa2`) |
**10 Emails** | shipada **com mock provider ativo** — falta trocar para Resend |
11 Auditoria | shipada em prod (LGPD ready) |
**12 E2E Playwright** | infra shipada — **hCaptcha em prod bloqueia execução automática**; CI não implementado |
13 Usuários + convites | shipada em prod |
14 Preferências | shipada em prod |
**15 Staging + CI E2E** | infra shipada — **aguarda 1 passo manual** (criar projeto Supabase staging) |
16 Categorias | shipada em prod |
17 Dashboard advanced | shipada em prod |
18 Bulk operations | shipada em prod |
19 Apelidos + duplicatas | shipada em prod |
20 A11y + polish | shipada em prod — "última fase do roadmap 21-fases" |

(The spec's §11 roadmap uses a *different* 0–20 numbering — e.g. its Fase 8 is "Painel &amp; métricas", 11 is UAZAPI, 12 is IA classification, 16 is OneDrive, 20 is "Beta com Cavalcanti". The `docs/operacao/fase-N-*.md` numbering is the one that was actually executed.)

---

## Part C — `docs/MANUAL-PENDENCIAS.md`: manual (outside-VS-Code) pending items

### TL;DR happy path (~2h30 human + ~30min DNS propagation)

| # | Ação | Tempo | Onde | Depende de |
|---|---|---|---|---|
| 1 | Criar conta Resend + verificar domínio DNS | 10 min + 15-30min DNS | resend.com | — |
| 2 | Gerar API key Anthropic (Claude Haiku 4.5) | 5 min | console.anthropic.com | — |
| 3 | Provisionar instância UAZAPI + configurar webhook inbound | 20 min | uazapi.com | — |
| 4 | Adicionar 8 env vars faltando no Vercel prod | 15 min | vercel.com | 1, 2, 3 |
| 5 | Redeploy Vercel (git push vazio ou botão) | 7 min | vercel.com | 4 |
| 6 | Criar projeto Supabase STAGING (segundo projeto free) | 10 min | supabase.com | — |
| 7 | Provisionar staging via scripts (auto) | 5 min | terminal | 6 |
| 8 | Adicionar 6 secrets GitHub + subir workflow E2E | 15 min | github.com | 6, 7 |
| 9 | Convidar equipe Cavalcanti pelo `/config/usuarios` | 5 min/pessoa | app prod | 5 |
| 10 | Smoke test manual das 8 features críticas | 30 min | app prod | 5 |

### 🔴 BLOQUEADORES

Verbatim: **"Nada. O CRM já está operacional em prod"** with all CRUD, uploads, reports, audit, painel, categories, aliases, duplicates, staging infra (code ready), n8n outbound webhooks (endpoint ready), email notifications (mock provider) and WhatsApp classification (mock classifier). *"Se você só quer usar o CRM pra gestão manual + emails simulados + WhatsApp fake, não precisa fazer nada."*

### 🟠 CRÍTICOS (6 items)

**1. Resend — emails reais.** Today `EMAIL_PROVIDER=mock` → emails ("Pagamento aguardando", "Nova pendência WhatsApp") are written to `notificacoes_email` but **never reach an inbox**. Steps: signup at resend.com (free 100/day, 3k/month), confirm account email, verify domain `nogmacorp.com.br` (add SPF/DKIM/DMARC, wait 15–30 min for **Verified**; quick alternative `onboarding@resend.dev`), create API key `nogma-crm-prod` (Full Access, `re_…` shown once), add **3 Vercel env vars** across production+preview+development — `EMAIL_PROVIDER=resend`, `EMAIL_FROM="Nogma Gestor de Obras &lt;no-reply@nogmacorp.com.br&gt;"`, `RESEND_API_KEY` (type `sensitive`) — with ready-made `Invoke-RestMethod` calls against project `prj_z1pt9zxdish8cmqM2oAaFRB0qSM7` / team `team_2A3cAOheq9LYalV1OoxEp47S`; redeploy; test by creating a payment with `status_pagto='aguardando'` (email within 30s); mirror the 3 vars in `.env.local`. Verification: `/notificacoes` last row shows **enviada** (green) instead of **simulada** (grey).

**2. Anthropic — IA classifier API key.** Today `IA_PROVIDER=mock` (deterministic heuristic that always creates a pending confirmation) → WhatsApp messages **pile up in `/pendentes` for manual confirmation**. Steps: console.anthropic.com → API Keys → Create Key `nogma-crm-classifier` → copy `sk-ant-api03-…` → **Settings → Billing add card + credits (US$5-10 ≈ 2k messages)** → add `IA_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` in Vercel → `pnpm --filter web add @anthropic-ai/sdk` → create `apps/web/lib/ia/anthropic-classifier.ts` from the fase-8 §Passo 3 template (lines 76-188, ~120 lines copy-paste ready) → enable the `anthropic` branch in the `classifier.ts` factory → commit/push/redeploy. Cost: ~US$0.002/msg → **1000 msgs/month ≈ US$2**.

**3. UAZAPI — WhatsApp Business instance.** `/api/webhooks/uazapi` is ready and validates HMAC, but **no provider is sending**; the entire WhatsApp flow is in standby. Steps: create account at uazapi.com (Brazilian plan, no Meta verification), provision instance `nogma-cavalcanti-prod`, **scan QR code** in WhatsApp Business, collect **Instance ID / Base URL / outbound API token**, configure inbound webhook → `https://crm-cavalcanti.vercel.app/api/webhooks/uazapi`, POST, `application/json`, custom header `x-signature: &lt;hmac-sha256 of body with WEBHOOK_HMAC_SECRET&gt;` — *if UAZAPI has no custom HMAC support, evaluate their signature and adapt `verifyHmacSignature`*; add 3 Vercel vars `UAZAPI_BASE_URL`, `UAZAPI_INSTANCE_ID`, `UAZAPI_API_TOKEN`; redeploy. **Nota importante:** two Fase 8 sub-features are still **not implemented in code** and only make sense after UAZAPI is contracted — (a) media download+upload (~40 lines in `classify-and-persist.ts`), (b) outbound reply of `perguntaConfirmacao` (~30 lines in a new `apps/web/lib/whatsapp/uazapi-client.ts`).

**4. Supabase STAGING.** E2E currently runs against prod. Create `CRM-CAVALCANTI-STAGING` (Free, `sa-east-1`, strong 32+ char password), collect ref/URL/anon/service_role, `cp .env.staging.example .env.staging`, `pnpm staging:apply-migrations` (all 18), create staging admin `admin@nogmacorp.com.br` + `UPDATE profiles SET papel='admin'`, **turn hCaptcha off in staging** (or use test keys `10000000-ffff-ffff-ffff-000000000001`), `pnpm staging:setup-vercel`, validate with `pnpm test:e2e:staging`.

**5. GitHub — E2E workflow + 6 secrets.** `.github/workflows/e2e.yml` exists locally (10.5 KB) but **was never pushed** — the Claude CLI OAuth token lacks the `workflow` scope. Option A: paste it via the GitHub Actions UI. Option B: PAT with `repo`+`workflow`, temporarily `git remote set-url` with the token, push, restore. Then add secrets: `VERCEL_TOKEN`, `STAGING_AUTH_EMAIL`, `STAGING_AUTH_PASSWORD`, `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`.

**6. Convidar equipe Cavalcanti.** Only 1 admin exists (`operacao@nogmacorp.com.br`). Invite via `/config/usuarios` → roles `admin` / `gestor` / `financeiro` / `leitura` → Supabase Auth sends a PKCE link → `/definir-senha`. **If Resend is not active the invite email will not arrive** — workaround: copy the link from `notificacoes_email.corpo` and send via Slack/WhatsApp.

### 🟡 RECOMENDADOS (7 items)

**7. n8n — automações externas.** CRM already emits HMAC-signed outbound webhooks (`/config/webhooks` functional) but **nobody is consuming them**. Choose hosting: **n8n.cloud Starter US$20/month, 2500 executions/month, 15 min setup** (recommended) *or* self-hosted Docker on a VPS/k8s (1–2 h, free but needs maintenance). Then: in CRM `/config/webhooks` → Novo webhook → pick events (`pagamento_created`, `confirmacao_pendente_created`) → copy the n8n URL; in n8n add Supabase API credential (service role key), create a Webhook-trigger workflow with HMAC validation, build the automation (Slack / Sheets / HTTP nodes); back in CRM press **Testar webhook**. Source: `docs/operacao/n8n-integracao.md` (4 example workflows) and the fuller `docs/N8N-COMPLETO.md`.

**8. Supabase backups.** Free plan = manual only. Pro US$25/month → daily backups (7-day retention), **PITR**, 2 GB RAM, no pausing after 7 days idle. Free alternative: weekly `pg_dump` to private S3 (command provided).

**9. GitHub 2FA org-level** — org owner only, at `github.com/organizations/NogmaBR/settings/security`; members without 2FA are auto-removed.

**10. Auditar colaboradores admin** — review Owner/Admin roles for `Tarsis59`, `Hugo6404`, `guilbmarcon`, downgrade to Member where possible.

**11. Rotacionar DB password Supabase** — current is 11 chars; reset to 32+, update `SUPABASE_DB_URL` in Vercel *and* `.env.local`, redeploy. Warning: everything using direct Postgres breaks until vars update — do it off-peak.

**12. Sentry OU Vercel Analytics** — Sentry free tier 5k events/month + `sentry-wizard`, or Vercel Analytics/Speed Insights.

**13. Rate limiting** — Upstash Redis (free 10k req/day) → `UPSTASH_REDIS_REST_URL` + `_TOKEN` in Vercel → `@upstash/ratelimit` guards on `/api/webhooks/uazapi` and `/api/exports/*`.

### 🟢 NICE-TO-HAVE (7 items)

**14.** Custom domain `crm.cavalcanti.com.br` (CNAME → `cname.vercel-dns.com`, auto TLS, then update `NEXT_PUBLIC_APP_URL`). **15.** Supabase Branching (staging per PR, Pro + ~US$0.01/h). **16.** Grafana/DataDog monitoring (only after 1–2 months of real baseline). **17.** Full LGPD compliance (data export + right to be forgotten). **18.** SOC 2 / ISO 27001 (~R$50-100k, enterprise only). **19.** Disaster-recovery runbook (1–2 h to write). **20.** The 7 residual audit backlog items (Recharts lazy loading, action version pin, CSP with nonces, `/api/exports` rate limiting, axe-core in CI, LGPD data export, SOC 2 / third-party pentest).

### Go-live checklist blocks
Crítico ~1h30 (items 1–8) · CI/staging ~40 min (9–15) · Equipe+docs ~30 min (16–19, incl. sharing credentials via 1Password/Bitwarden shared vault and a 2–3 h live handoff meeting) · Hardening opcional ~1h (20–26) · Cosmético (27–29).

Footer: **last update 2026-09-08 (post-audit session 2), prod commit `a8feb5d` READY, 29 manual items total (5 críticos + 6 recomendados + 6 nice-to-have + 12 checklist go-live)**.

---

## Part D — `docs/audit/AUDIT-CONSOLIDADO.md`: findings with IDs and status

**Baseline: 31 findings — 1 critical, 5 high, 15 medium, 10 informational.**

### Final timeline (end of session 2)

| Finding | Severidade | Status |
|---|---|---|
| F-01 Security headers | 🔴 CRIT | ✅ Fixed (sessão 1) |
| HIGH-001 Math.random secret | 🟠 HIGH | ✅ Fixed (sessão 1) |
| HIGH-002 iframe sandbox | 🟠 HIGH | ✅ Fixed (sessão 1) |
| BUG-01 merge sem transação | 🟠 HIGH | ✅ Fixed (sessão 2) |
| BUG-02 race confirmarPendencia | 🟠 HIGH | ✅ Fixed (sessão 2) |
| BUG-04 RMW total_execucoes | 🟠 HIGH | ✅ Fixed (sessão 2) |
| HIGH-002 /api/exports whitelist | 🟠 HIGH | ⚠️ Justificado (design) |
| BUG-03 apelido-actions raw error | 🟡 MED | ✅ Fixed (sessão 2) |
| MED magic bytes upload | 🟡 MED | ✅ Fixed (sessão 2) |
| MED StatusBanner sanitize | 🟡 MED | ✅ Fixed (sessão 2) |
| MED cookie tema secure | 🟡 MED | ✅ Fixed (sessão 2) |
| MED manifest.json + OG | 🟡 MED | ✅ Fixed (sessão 2) |
| MED loading.tsx skeletons | 🟡 MED | ✅ Fixed (sessão 2) |
| MED .env.example completo | 🟡 MED | ✅ Fixed (sessão 2) |

**Progresso total (verbatim):** *"de 31 findings iniciais → **10 fixados** + **1 justificado** + **7 residuais adiáveis** (perf/opcional/roadmap). Zero findings críticos abertos."* (The table lists 13 ✅ rows; the "10 fixados" figure in the prose counts session-2 fixes differently — a minor internal inconsistency in the doc.)

### Fix details

**Session 1** — F-01: 5 headers added in `apps/web/next.config.ts` `async headers()` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`). CSP deliberately excluded — needs per-request nonces (Recharts SVG + hCaptcha iframe + Storage URLs break). HIGH-001: `dispatch-webhook.ts` `Math.random()` HMAC → `randomBytes(32).toString('hex')`. HIGH-002: `notificacoes/[id]/page.tsx` `sandbox="allow-same-origin"` → `sandbox=""`.

**Session 2** (commits `cb33f4c` + `1a29ae4`) — 3 migrations applied to prod `bbtejxugeeccywwhfpoc`: `20260908100000_pagamentos_criado_via_msg_unique.sql` (partial unique index → BUG-02), `20260908110000_webhook_counter_rpc.sql` (atomic `increment_webhook_execution` → BUG-04), `20260908120000_merge_fornecedores_rpc.sql` (transactional plpgsql `merge_fornecedores_atomic` → BUG-01); helper `scripts/apply-migration.mjs`. Code: BUG-02 idempotency (pre-check + catch `23505` returns existing), BUG-04 RPC counter, BUG-01 service reduced to a thin RPC wrapper, BUG-03 `mapDbErrorWithContext`, `validateFileMagicBytes` (PDF/PNG/JPEG/WebP), StatusBanner sanitizer (strips URLs + HTML tags, collapses whitespace, truncates at 240 chars), theme cookie `httpOnly + sameSite=strict + secure`, `app/manifest.ts` + OpenGraph/Twitter/`robots:noindex`, 6 `loading.tsx` skeletons (painel, pagamentos, relatorios, documentos, obras, pendentes), complete root `.env.example`. Plus `packages/db/src/types.ts` signatures for the 2 new RPCs.

### Residual backlog (not fixed)

| Finding | Sev | Rationale |
|---|---|---|
| HIGH-002 `/api/exports` whitelist | 🟠 | Design decision — removing it would make middleware return a 307 HTML redirect to programmatic clients expecting 401 JSON; route handler has its own `auth.getUser()` check |
| MED Recharts lazy load | 🟡 | Bundle optimization, no security impact — deferred to a perf cycle |
| MED action version pin | 🟡 | Needs `workflow` scope on the PAT (`.github/workflows/*` never pushed) |
| CSP com nonces | 🟡 | Future extension — Recharts SVG + hCaptcha iframe + Storage URLs break without per-request nonces |
| Rate limiting `/api/exports` + `/api/webhooks/uazapi` | 🟡 | Requires Upstash Redis; no current incident |
| Sentry / error tracking | 🟢 | Optional tooling |
| axe-core CI + LGPD data export + SOC 2 | 🟢 | Long-term roadmap |

### 🟢 INFO — positives (no action)
HMAC `timingSafeEqual` correct in all 3 usages · RLS enabled + policies on every table · service role isolated behind `import 'server-only'` in 32 modules · `assertAdmin()` in **all** privileged actions · no real secrets in committed files · consistent Zod + mapDbError + revalidatePath across 19 actions · CSRF via native Next.js Server Action protection + HMAC webhooks + Bearer `CRON_SECRET` · Fase 20 a11y primitives OK · `font-display: swap` everywhere · `next/image` used correctly.

### Strategic recommendations
Short term (2 weeks): fix the 4 remaining 🟠 HIGH, magic bytes, `loading.tsx` on `/painel` `/relatorios` `/pagamentos`, confirmarPendencia race. Medium (1 month): merge RPC, CSP nonces, rate limiting, manifest+OG, Sentry/Vercel Analytics. Long term: automated security tests (axe-core + OWASP ZAP in CI), third-party pentest, full LGPD, SOC 2 / ISO 27001 if the contract demands.

---

## Part E — `docs/N8N-COMPLETO.md`: the 7 workflows

| WF | Name | Purpose (one line) |
|---|---|---|
| **WF1** | UAZAPI → CRM (bridge com HMAC assinado) | Pattern-B middleware: receives the UAZAPI payload, optionally downloads media + runs Claude Haiku, signs HMAC and POSTs to the CRM's `/api/webhooks/uazapi`. |
| **WF2** | Slack notif: pagamento novo &gt; R$5k | On `pagamento_created`, validates HMAC, filters `valor &gt; 5000`, enriches from Supabase and posts to Slack `#financeiro`. |
| **WF3** | Google Sheets: log de todos os pagamentos | On `pagamento_created`, flattens obra+fornecedor+categoria into one row and appends it to a live spreadsheet for Excel/Sheets analysis. |
| **WF4** | OneDrive/Google Drive: sync de documentos | On `documento_created`, gets a Supabase Storage signed URL, downloads the bytes, uploads to `/obras/{obra_nome}/` and writes back `documentos.external_backup_url`. |
| **WF5** | WhatsApp reminder: NFs sem comprovante &gt; 7d | Daily cron 09:00 America/Sao_Paulo: selects payments still `aguardando` for &gt;7 days and chases the supplier by WhatsApp via UAZAPI, logging to `audit_log`. |
| **WF6** | Weekly digest email (sexta 18h) | Cron `0 18 * * 5`: aggregates the last 7 days of payments by obra/categoria/status into an HTML template and sends via SMTP or Resend. |
| **WF7** | Confirmação automática WhatsApp (bot conversacional) | On `confirmacao_pendente_created`, formats the classifier's confirmation question, sends it via UAZAPI and stores `msg_id_pergunta_uazapi`. |

Supporting content: 2 architecture patterns (A = CRM direct, B = n8n middleware), n8n Cloud (10 min) vs self-hosted Docker+Caddy (1–2 h), **7 credentials** (C1 Supabase API, C2 Anthropic Claude, C3 CRM webhook HMAC shared secret, C4 UAZAPI outbound, C5 Slack, C6 Google Sheets, C7 OneDrive/Drive), a universal HMAC-validation Code node, Claude system prompt + `tool_use` JSON schema + user-prompt template + HTTP Request node config, n8n env vars, a per-workflow end-to-end test checklist, 7 troubleshooting scenarios (invalid HMAC, webhook not firing, empty Supabase array, UAZAPI 401, classifier always `nao_identificado`, Sheets duplicate rows, Drive 403 quota), costs/limits, and workflow security/backup/versioning (export via the n8n `/rest/workflows` endpoint).

---

## Part F — `docs/operacao/fase-8-integracao.md`: WhatsApp/UAZAPI + AI design and what is blocked

**Header status, verbatim:** *"Estado: **Foundation shipada** (Tasks 8.1–8.6). Falta plugar UAZAPI real + escolher provider de IA."*

### What already exists (ready to use)

- **`POST /api/webhooks/uazapi`** — receives the UAZAPI payload, verifies **HMAC-SHA256** from the `x-signature` header against `WEBHOOK_HMAC_SECRET`, performs an **idempotent upsert** into `mensagens_whats` keyed on `msg_id_uazapi`, then calls `classifyAndPersist(mensagem_id)`.
- **`Classifier` interface** (`apps/web/lib/ia/classifier.ts`) with a `getClassifier()` factory selecting the implementation from the `IA_PROVIDER` env var. Default is **`mock`** (deterministic heuristic); the `anthropic` and `openai` branches are **reserved in code, ready to activate**.
- **`classifyAndPersist`** (`apps/web/lib/services/classify-and-persist.ts`) — loads context (active obras, fornecedores), calls the classifier, then routes:
  - `pagamento_completo` **AND** `confidence ≥ 0.85` **AND** valor/obra present → creates a Pagamento with `origem='whatsapp'` and `criado_via_msg_id`.
  - otherwise → creates a row in `confirmacoes_pendentes` for human review.
- **UI `/pendentes`** — gestor confirms or rejects AI-classified messages. **UI `/whatsapp`** — chronological feed of all messages with status filters and cross-nav links to the generated payment or the `/pendentes` queue.
- **Fixtures** `scripts/fixtures/uazapi/*.json` + harness `scripts/test-webhook-uazapi.mjs`.

### The 7-step completion plan

**Passo 1 — Provision UAZAPI:** account → instance (`nogma-cavalcanti-prod`) registering a WhatsApp Business number → collect Instance ID / API base URL / outbound API token → configure the inbound webhook (`https://crm-cavalcanti.vercel.app/api/webhooks/uazapi`, POST, JSON, custom `x-signature: HMAC_SHA256(body, WEBHOOK_HMAC_SECRET)`) — *"se UAZAPI não suporta HMAC custom, avaliar signature deles + adaptar `verifyHmacSignature`"* → send a test message and confirm it appears in `/whatsapp`. Env vars: `UAZAPI_BASE_URL`, `UAZAPI_INSTANCE_ID`, `UAZAPI_API_TOKEN`.

**Passo 2 — Choose the AI provider.** Recommendation: **Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)**, with a comparison table vs GPT-4o-mini: input ~US$0.80 vs ~US$0.15 /1M, output ~US$4.00 vs ~US$0.60 /1M, both excellent PT-BR and native vision, **PDF native in Claude vs image conversion required for OpenAI**, latency 500-1500 ms vs 800-2000 ms, context 200k vs 128k. Trade-off, verbatim: OpenAI is cheaper but Claude has better Brazilian-document OCR (nota fiscal, boleto) — *"errar um pagamento importante custa mais que a diferença."*

**Passo 3 — Implement `AnthropicClassifier`** in `apps/web/lib/ia/anthropic-classifier.ts`. The doc embeds the **full ~90-line implementation** (lines 80–167): `import 'server-only'`, a PT-BR `SYSTEM_PROMPT` framing the model as a financial classifier for a construction company receiving field-operator WhatsApp messages with optional receipt/NF photo or PDF, instructed to always return strict JSON and to *"nunca invente valores"*; a `CLASSIFICATION_TOOL` with `kind ∈ {pagamento_completo, pagamento_parcial, documento_apenas, nao_identificado}`, `confidence` 0–1, and `extracted` fields `valor`, `data_pagamento`, `obra_id`, `fornecedor_id`, `fornecedor_nome_novo`, `tipo_documento ∈ {nota_fiscal, comprovante, contrato, outro}`, `numero_nf`, `descricao`, `raciocinio`, plus `perguntaConfirmacao`; user content assembling active obras + known fornecedores + sender phone + text, then attaching media as `type:'image'` or `type:'document'` via `source: {type:'url'}`; the call uses `max_tokens: 1024` with `tool_choice: {type:'tool', name:'classify_mensagem'}` and throws if no `tool_use` block returns. Then enable the `anthropic` branch in the factory and `pnpm --filter web add @anthropic-ai/sdk`. Env: `IA_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=sk-ant-...`.

**Passo 4 — Media download + Storage upload (NOT implemented).** Today `classifyAndPersist` only receives `midia_mime` and **never downloads the file**. Needed before calling a real classifier: fetch from the provider URL (**UAZAPI serves temporary URLs, ~10 min TTL**), upload to the `documents` bucket via the existing `uploadDocumentBuffer` at path `whatsapp/{mensagem_id}/{filename}`, update `mensagens_whats.midia_storage_path`, generate a 60s signed URL for `input.midiaUrl`. More robust alternative: download bytes and pass `source: {type:'base64'}` — more request bytes but no public-URL dependency.

**Passo 5 — Outbound WhatsApp confirmation reply (NOT implemented).** When the classifier returns `perguntaConfirmacao` the bot should ask the sender. Requires a new `apps/web/lib/whatsapp/uazapi-client.ts` — the doc gives the `enviarMensagem(telefone, texto)` implementation (POST `${UAZAPI_BASE_URL}/send/text` with the `token` header, body `{number, text}`, returning `messageId ?? id`) — to be called from `classifyAndPersist` after the `confirmacoes_pendentes` insert, then updating `msg_id_pergunta_uazapi`.

**Passo 6 — Inbound confirmation-reply processing (NOT implemented, explicitly non-blocking).** When the sender replies "sim"/"não"/"não, era X" it hits the same webhook. Needed: after the upsert, if `texto_bruto` matches a short reply pattern (starts with S/N/Sim/Não), look up the active (`resolvida=false`) `confirmacoes_pendentes` for that `telefone_from`; "sim" → promote to Pagamento; "não" → `resolvida=true` + `status='erro'`; free-form correction → re-invoke the classifier with the reply as extra context. Verbatim: *"Isso é uma iteração — não bloqueante. Enquanto não implementado, o gestor resolve tudo pelo painel `/pendentes`."*

**Passo 7 — Testing.** Local: export `WEBHOOK_HMAC_SECRET` then `node scripts/test-webhook-uazapi.mjs text-simples` / `image-nf --url http://localhost:3000`, verifying the message shows in `/whatsapp` and a pending confirmation in `/pendentes` (the mock classifier always generates one). Prod: same harness with `--url https://crm-cavalcanti.vercel.app`.

### "Fase 8 completa" checklist — all 10 items still unchecked
UAZAPI provisioned + webhook URL configured · `UAZAPI_*` env vars in Vercel (3 scopes) · `IA_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` · `AnthropicClassifier` implemented + SDK installed · media download+upload in `classifyAndPersist` · UAZAPI outbound client + sending `perguntaConfirmacao` · real E2E (msg → webhook → classification → panel confirmation → payment created) · bot replies to the sender with the gestor's decision · structured logs (Vercel Log Drain?) · alert if `mensagens_whats.status='erro'` grows (Slack/email).

### Security notes
`WEBHOOK_HMAC_SECRET` was rotated on **2026-09-07 (Fase 7.5 hardening)**; the previous values (`dcbb2015…`, `221299…`) are burned and must never be reused. **No rate limit** on `/api/webhooks/uazapi` today — if opened to a public webhook, consider Upstash Redis + `@upstash/ratelimit` per IP (~60 req/min is reasonable for genuine UAZAPI traffic and blocks scanning). `/api/webhooks/*` already bypasses auth via the Fase 2 middleware whitelist.

---

## Cross-document observations worth flagging

1. **`docs/PROJETO-STATUS.md` is stale** (2026-09-04, pre-Fase-1) while `docs/MANUAL-PENDENCIAS.md` (2026-09-08) reports 21 phases shipped. Anyone reading PROJETO-STATUS as the current state will be misled — it does not contain a phase-status list at all.
2. **`README.md` links two nonexistent files**: `docs/operacao/runbook.md` and `docs/operacao/backup-restore.md`. (A DR runbook is item 19 in MANUAL-PENDENCIAS' nice-to-have list — still unwritten.)
3. **Env-var count drift**: PROJETO-STATUS says 7 Vercel env keys; MANUAL-PENDENCIAS says 10 (adds `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`), with 8 more to add.
4. **Commit-hash drift across docs**: `ff16552` (audit baseline) → `f807df3` (N8N-COMPLETO) → `a8feb5d` (MANUAL-PENDENCIAS, current prod).
5. **Two conflicting phase numberings**: the spec's §11 roadmap (0–20, where 11=UAZAPI, 12=IA, 16=OneDrive) vs the executed `fase-N` docs (8=WhatsApp+IA, 9=reports, 10=emails …20=a11y). OneDrive sync never became a phase — it survives only as n8n **WF4**.
6. **Three chained single-point blockers** all reduce to credentials: mock email, mock classifier, and no WhatsApp provider. Notably, invites (critical item 6) silently depend on Resend (critical item 1).
