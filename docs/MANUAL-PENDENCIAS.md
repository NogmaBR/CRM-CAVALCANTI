# MANUAL PENDÊNCIAS — CRM Nogma-Cavalcanti

> **Único documento** com tudo que ainda precisa ser feito **fora do VS Code** pro projeto ficar 100% conectado e operacional em produção. Consolidação de todos os handoffs de fase + auditorias.
>
> **Estado do código:** ✅ 21 fases + integração n8n + 2 rodadas de auditoria de segurança shipadas (`a8feb5d` em prod). Zero código faltando.
>
> **Este doc:** contas/dashboards/env vars/DNS/convites — coisas que humano precisa clicar fora do editor.

📅 Gerado: 2026-09-08 · Autor: pipeline autônomo Claude Code · Sessão: pós-auditoria

---

## 🧭 Sumário

- [🎯 TL;DR — Caminho happy path](#-tldr--caminho-happy-path)
- [📊 Estado atual da infra (verificado agora)](#-estado-atual-da-infra-verificado-agora)
- [🔴 BLOQUEADORES — precisam pra funcionalidade core](#-bloqueadores--precisam-pra-funcionalidade-core)
- [🟠 CRÍTICOS — ativação de features principais](#-críticos--ativação-de-features-principais)
- [🟡 RECOMENDADOS — hardening + ergonomia](#-recomendados--hardening--ergonomia)
- [🟢 NICE-TO-HAVE — opcional/roadmap](#-nice-to-have--opcionalroadmap)
- [📋 Checklist final go-live](#-checklist-final-go-live)
- [📚 Referências cruzadas](#-referências-cruzadas)

---

## 🎯 TL;DR — Caminho happy path

Ordem sugerida pra deixar o CRM **100% conectado real** (WhatsApp + IA + emails + CI). Tempo total estimado: **~2h30 humano + ~30min propagação DNS**.

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

Depois disso: **prod 100% operacional**. Backlog de "nice-to-have" fica pra semanas seguintes.

---

## 📊 Estado atual da infra (verificado agora)

### ✅ Já pronto — não precisa mexer

| Componente | Estado | Detalhe |
|---|---|---|
| **Vercel — projeto** | ✅ Ativo | `prj_z1pt9zxdish8cmqM2oAaFRB0qSM7` (team `nogma1`), URL `https://crm-cavalcanti.vercel.app`, GitHub link ativo em `main`, `sourceless=true`, build config OK |
| **Vercel — env vars atuais** | ✅ 10 chaves | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWT_SECRET`, `WEBHOOK_HMAC_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` — todas em production+preview+development |
| **Vercel — deployment protection** | ✅ | Vercel Auth em previews + prod deployment URLs auto; URL primária permanece pública |
| **Supabase — projeto prod** | ✅ Ativo | `CRM-CAVALCANTI` (`bbtejxugeeccywwhfpoc`, `sa-east-1`, Postgres 17.6). 18 migrations aplicadas (incluindo 3 novas hoje). RLS + admin API operacional |
| **Supabase — Auth hardening** | ✅ | `disable_signup=true`, `password_min_length=12`, chars requeridos, reauth on password change, SSL enforced |
| **Supabase — Advisor security** | ✅ | 0 lints (verificado em 2026-09-04) |
| **GitHub — repo** | ✅ | `NogmaBR/CRM-CAVALCANTI` public, Secret scanning + Push protection + Dependabot enabled. Branch protection `main` ativa (PR obrigatório, no force-push) |
| **Security headers em prod** | ✅ 5/5 | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`, `HSTS: max-age=2y; includeSubDomains; preload` |
| **PWA manifest** | ✅ | `/manifest.webmanifest` 200 OK (`application/manifest+json`) — install prompt no mobile funciona |

### ⏳ Falta configurar/provisionar

| Componente | Estado | Bloqueio |
|---|---|---|
| **Email real (Resend)** | ⏳ Mock ativo | Precisa conta Resend + verificar domínio + `RESEND_API_KEY` + `EMAIL_PROVIDER=resend` no Vercel |
| **IA classifier (Anthropic)** | ⏳ Mock ativo | Precisa `ANTHROPIC_API_KEY` + `IA_PROVIDER=anthropic` + `pnpm add @anthropic-ai/sdk` + criar arquivo `AnthropicClassifier` |
| **WhatsApp (UAZAPI)** | ⏳ Rota pronta, sem provider | Precisa conta UAZAPI + instância + 3 env vars `UAZAPI_*` + configurar webhook inbound no dashboard UAZAPI |
| **n8n** | ⏳ Endpoint pronto, sem consumidor | Precisa instância n8n (cloud ou VPS) + criar workflow apontando pra `/api/webhooks/uazapi` ou consumindo webhooks outbound do CRM |
| **Staging Supabase** | ⏳ Scripts prontos | Precisa criar projeto staging via dashboard (Free tier permite 2 projetos), depois rodar scripts autônomos |
| **CI E2E (GitHub Actions)** | ⏳ Workflow local | Arquivo `.github/workflows/e2e.yml` existe local mas não foi pushado (OAuth do CLI sem workflow scope) — precisa PAT humano com `workflow` scope OU adicionar via GitHub UI |
| **Convites de usuários** | ⏳ Só admin criado | Equipe Cavalcanti precisa ser convidada via `/config/usuarios` |
| **Backups automáticos** | ⏳ Free plan | Free plan Supabase só tem backups manuais. Pro plan (US$25/mês) libera diários + PITR |
| **DNS custom (opcional)** | ⏳ Usando `.vercel.app` | Se quiser `crm.cavalcanti.com.br`, precisa CNAME no DNS |
| **GitHub 2FA org-level** | ⏳ | Só org admin (NogmaBR) pode forçar 2FA pra todos os membros |

---

## 🔴 BLOQUEADORES — precisam pra funcionalidade core

Nada. **O CRM já está operacional em prod** com todas as features CRUD, uploads, relatórios, auditoria, painel, categorias, apelidos, duplicatas, staging infra (código pronto), n8n webhooks outbound (endpoint pronto), notificações email (com provider mock), e classificação WhatsApp (com classifier mock).

Se você só quer usar o CRM pra gestão manual + emails simulados + WhatsApp fake, **não precisa fazer nada**. Login está em <https://crm-cavalcanti.vercel.app/login>.

---

## 🟠 CRÍTICOS — ativação de features principais

### 1. Resend — Emails reais

**Por quê:** hoje `EMAIL_PROVIDER=mock` (default). Emails de "Pagamento aguardando" e "Nova pendência WhatsApp" **são criados em `notificacoes_email` mas NÃO chegam na caixa de entrada**. Sem isso, gestores só vêem alertas se abrirem a tela `/notificacoes`.

**Passos:**

1. Criar conta em <https://resend.com/signup> (free tier: 100 emails/dia, 3k/mês — suficiente pro MVP).
2. Confirmar email da conta Resend.
3. Verificar domínio (recomendado — evita spam folder):
   - Dashboard Resend → **Domains** → **Add Domain** → `nogmacorp.com.br`
   - Copiar os 3 registros DNS (SPF, DKIM, DMARC).
   - Adicionar no provider DNS (Registro.br, Cloudflare, etc).
   - Aguardar propagação (~15-30min) até status **Verified**.
   - _Alternativa rápida sem domínio:_ usar `onboarding@resend.dev` (Resend gerencia; fica bom só pra teste).
4. Gerar API key:
   - Dashboard Resend → **API Keys** → **Create API Key** → nome `nogma-crm-prod`, permission `Full Access`.
   - Copiar `re_xxxxxxxxxxxxxxxxxxxxxxxx` (só aparece uma vez).
5. Adicionar 3 env vars no Vercel (Production + Preview + Development):

```powershell
# Via API (ou dashboard: vercel.com → project → Settings → Environment Variables)
$body = @{ key = "EMAIL_PROVIDER"; value = "resend"; type = "plain"; target = @("production","preview","development") } | ConvertTo-Json
Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/prj_z1pt9zxdish8cmqM2oAaFRB0qSM7/env?teamId=team_2A3cAOheq9LYalV1OoxEp47S" -Method POST -Headers @{ Authorization = "Bearer $env:VERCEL_TOKEN"; "Content-Type" = "application/json" } -Body $body

$body = @{ key = "EMAIL_FROM"; value = "Nogma Gestor de Obras <no-reply@nogmacorp.com.br>"; type = "plain"; target = @("production","preview","development") } | ConvertTo-Json
Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/prj_z1pt9zxdish8cmqM2oAaFRB0qSM7/env?teamId=team_2A3cAOheq9LYalV1OoxEp47S" -Method POST -Headers @{ Authorization = "Bearer $env:VERCEL_TOKEN"; "Content-Type" = "application/json" } -Body $body

$body = @{ key = "RESEND_API_KEY"; value = "re_xxxxxxxxxxxxxxxxxxxxxxxx"; type = "sensitive"; target = @("production","preview","development") } | ConvertTo-Json
Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/prj_z1pt9zxdish8cmqM2oAaFRB0qSM7/env?teamId=team_2A3cAOheq9LYalV1OoxEp47S" -Method POST -Headers @{ Authorization = "Bearer $env:VERCEL_TOKEN"; "Content-Type" = "application/json" } -Body $body
```

6. Redeploy Vercel: `git commit --allow-empty -m "trigger: activate resend" && git push` **OU** dashboard → **Deployments** → último → **Redeploy**.
7. Teste: criar um pagamento com `status_pagto='aguardando'` → dentro de 30s deve aparecer email na inbox do admin.
8. Espelhar as 3 vars no `.env.local` (pra dev local também mandar):

```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Nogma Gestor de Obras <no-reply@nogmacorp.com.br>
```

**Verificação em prod:**
- Ir em `/notificacoes` → última linha deve mostrar status **enviada** (verde) em vez de **simulada** (cinza).
- Header de resposta HTTP do Resend deve estar registrado em `notificacoes_email.contexto` (JSON).

**Fonte:** `docs/operacao/fase-10-emails.md`

---

### 2. Anthropic — API key IA classifier

**Por quê:** hoje `IA_PROVIDER=mock` (heurística determinística que sempre marca "confirmação pendente"). Sem ativar Claude, mensagens WhatsApp entram e ficam **paradas em `/pendentes` esperando gestor confirmar tudo manualmente**. Com Claude ativo, mensagens claras viram Pagamento automaticamente (`confidence >= 0.85`).

**Passos:**

1. Acessar <https://console.anthropic.com>.
2. Login (ou criar conta se ainda não tiver).
3. Sidebar → **API Keys** → **Create Key**.
4. Nome sugerido: `nogma-crm-classifier`.
5. Copiar `sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (aparece uma vez).
6. Adicionar créditos: **Settings → Billing** → adicionar cartão + créditos iniciais (US$5-10 já dá pra ~2k mensagens classificadas).
7. Adicionar env vars no Vercel (mesmo padrão da seção 1):

```
IA_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...
```

8. **Instalar SDK + implementar classifier real** (esta parte é código, mas depende da chave):

```powershell
cd C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA
pnpm --filter web add @anthropic-ai/sdk
```

Depois criar `apps/web/lib/ia/anthropic-classifier.ts` seguindo o template completo em `docs/operacao/fase-8-integracao.md` §Passo 3 (linhas 76-188). É ~120 linhas de código, copy-paste ready.

Ativar no factory `apps/web/lib/ia/classifier.ts`:

```ts
if (provider === 'anthropic') {
  const { AnthropicClassifier } = await import('./anthropic-classifier');
  return new AnthropicClassifier();
}
```

9. Commit + push + redeploy.

**Verificação:**
- Testar: `node scripts/test-webhook-uazapi.mjs text-simples --url https://crm-cavalcanti.vercel.app`
- Deve chamar Anthropic (ver Anthropic Console → Usage — deve incrementar contador)
- Mensagem completa (com valor + obra reconhecível) deve virar Pagamento direto em `/pagamentos`.

**Fonte:** `docs/operacao/fase-8-integracao.md` §Passo 2 e 3

**Custo estimado:** Claude Haiku 4.5 ~US$0.80/1M input + US$4/1M output. Mensagem típica com foto = ~2k input + 200 output tokens = ~US$0.002/msg. **1000 msgs/mês ≈ US$2**.

---

### 3. UAZAPI — Instância WhatsApp Business

**Por quê:** hoje o endpoint `/api/webhooks/uazapi` está pronto e valida HMAC, mas **nenhum provider está mandando mensagens**. Fluxo WhatsApp inteiro está em standby até UAZAPI conectar.

**Passos:**

1. Criar conta em <https://uazapi.com> (plano brasileiro, sem verificação Meta).
2. Provisionar instância — nome sugerido `nogma-cavalcanti-prod`.
3. **Escanear QR code** no WhatsApp Business (isso registra o número da empresa).
4. Coletar do dashboard:
   - **Instance ID** (ex: `abc123xyz`)
   - **Base URL** (ex: `https://free.uazapi.com` ou custom da instância)
   - **API token** outbound (pra enviar mensagens de resposta)
5. Configurar webhook inbound no dashboard UAZAPI:
   - **URL:** `https://crm-cavalcanti.vercel.app/api/webhooks/uazapi`
   - **Método:** POST
   - **Content-Type:** `application/json`
   - **Header custom:** `x-signature: <hmac-sha256-do-body-com-WEBHOOK_HMAC_SECRET>`
   - _Nota:_ se UAZAPI não suporta HMAC customizado nativamente, avaliar signature deles + adaptar `verifyHmacSignature` em `apps/web/app/api/webhooks/uazapi/route.ts`.
6. Adicionar 3 env vars no Vercel:

```
UAZAPI_BASE_URL=https://free.uazapi.com
UAZAPI_INSTANCE_ID=abc123xyz
UAZAPI_API_TOKEN=<token-outbound>
```

7. Redeploy.

**Verificação:**
- Enviar msg do WhatsApp pessoal pro número da instância → deve aparecer em `/whatsapp` em < 10s.
- Se Anthropic ativo: msg completa vira Pagamento; msg ambígua vira pendência em `/pendentes`.

**Fonte:** `docs/operacao/fase-8-integracao.md` §Passo 1

**Nota importante:** Fase 8 tem 2 sub-features ainda **não implementadas em código** (Passo 4 e 5 do doc):
- **Download+upload de mídia:** hoje `classifyAndPersist` não baixa a foto/PDF do UAZAPI, só passa MIME. Precisa ~40 linhas em `classify-and-persist.ts` (docs/operacao/fase-8-integracao.md §Passo 4 tem código pronto).
- **Envio de resposta outbound:** bot não responde `perguntaConfirmacao` no WhatsApp — hoje só cria pendência em `/pendentes` pra gestor resolver no painel. Se quiser bot conversacional real, ~30 linhas em novo `apps/web/lib/whatsapp/uazapi-client.ts` (docs/operacao/fase-8-integracao.md §Passo 5).

Isso é código, mas listei aqui porque **só faz sentido implementar depois que UAZAPI estiver contratada** (precisa da URL de mídia real pra testar).

---

### 4. Supabase STAGING — Projeto isolado pra E2E

**Por quê:** hoje testes E2E rodam contra prod (risco de sujar dados). Fase 15 preparou toda infra + scripts autônomos — só falta criar o projeto.

**Passos:**

1. Acessar <https://supabase.com/dashboard/projects> (login como `contato.nogma@gmail.com`).
2. **New Project**:
   - Organization: mesma da prod (Nogma).
   - Nome: `CRM-CAVALCANTI-STAGING`
   - Database password: gerar forte (32+ chars, salvar em cofre).
   - Region: `South America (São Paulo)` — `sa-east-1` (match com prod).
   - Plan: **Free** (org tem slot livre — Free permite 2 projetos).
3. Aguardar ~2 min até status **Healthy**.
4. Coletar (Settings → API):
   - Reference ID (ex: `xyzabc123`)
   - Project URL: `https://<ref>.supabase.co`
   - `anon` key (publishable)
   - `service_role` key
5. Copiar template e preencher:

```powershell
cp .env.staging.example .env.staging
# Editar .env.staging preenchendo os valores STAGING_*
notepad .env.staging
```

6. Aplicar migrations (script autônomo já pronto — aplica todas 18 em ordem):

```powershell
pnpm staging:apply-migrations
```

7. Criar usuário admin de teste no staging:
   - Dashboard staging → **Authentication → Users → Add user**
   - Email: `admin@nogmacorp.com.br`
   - Password: gerar forte, salvar em `.env.staging` como `AUTH_TEST_PASSWORD`
   - Auto Confirm User: ✅
   - Depois no **SQL Editor** rodar:
     ```sql
     UPDATE profiles SET papel = 'admin'
     WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@nogmacorp.com.br');
     ```
8. Desabilitar hCaptcha no staging (senão E2E trava):
   - Dashboard staging → **Authentication → Settings → hCaptcha** → **toggle off**
   - _Alternativa:_ deixar ativo mas usar test keys `10000000-ffff-ffff-ffff-000000000001` + secret `0x0000...000`.
9. Provisionar env vars do staging no scope **Preview** do Vercel (auto):

```powershell
pnpm staging:setup-vercel
```

10. Rodar E2E local contra staging pra validar:

```powershell
pnpm test:e2e:staging
```

**Verificação:** `pnpm test:e2e:staging` deve passar todos os testes. Se rodar contra prod (`pnpm test:e2e`), a suite também roda mas polui prod — evite.

**Fonte:** `docs/operacao/fase-15-staging.md`

---

### 5. GitHub — Adicionar workflow E2E + 6 secrets

**Por quê:** arquivo `.github/workflows/e2e.yml` existe local (10.5KB) mas **não foi pushado** — o OAuth token do CLI Claude não tem scope `workflow` (Push Protection do GitHub bloqueia). CI/CD de E2E em PRs precisa disso pra rodar.

**Passos:**

**Opção A — Via GitHub UI (mais rápido, sem CLI):**

1. Acessar <https://github.com/NogmaBR/CRM-CAVALCANTI/actions/new>
2. Clicar em **set up a workflow yourself**.
3. Renomear o arquivo pra `e2e.yml`.
4. Abrir `.github/workflows/e2e.yml` no VS Code local, **copiar TUDO** (10.5KB).
5. Colar no editor GitHub → **Commit changes** direto na main.

**Opção B — Via PAT com workflow scope (se quiser continuar via CLI):**

1. Gerar PAT em <https://github.com/settings/tokens/new>:
   - Nome: `claude-code-workflow`
   - Scopes: `repo` + `workflow`
   - Expiration: 90 days (renovar depois)
   - Copiar `ghp_...`
2. Configurar Git com o PAT:
   ```powershell
   git remote set-url origin https://<user>:ghp_XXX@github.com/NogmaBR/CRM-CAVALCANTI.git
   git add .github/workflows/e2e.yml
   git commit -m "ci: add e2e workflow"
   git push
   git remote set-url origin https://github.com/NogmaBR/CRM-CAVALCANTI.git  # restaurar
   ```

**Depois** (ambas opções), adicionar 6 secrets:

Acessar <https://github.com/NogmaBR/CRM-CAVALCANTI/settings/secrets/actions> → **New repository secret**:

| Secret | Valor (fonte) |
|---|---|
| `VERCEL_TOKEN` | `.env.local` do owner |
| `STAGING_AUTH_EMAIL` | `admin@nogmacorp.com.br` |
| `STAGING_AUTH_PASSWORD` | senha do admin criado no staging |
| `STAGING_SUPABASE_URL` | `https://<ref-staging>.supabase.co` |
| `STAGING_SUPABASE_ANON_KEY` | anon key do staging |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | service_role do staging |

**Verificação:** abrir um PR fake (branch → PR contra main) → **Actions tab** → workflow `e2e` deve rodar automaticamente e reportar pass/fail no PR.

**Fonte:** `docs/operacao/fase-15-staging.md` §7 e §8

---

### 6. Convidar equipe Cavalcanti

**Por quê:** hoje só existe 1 usuário admin (`operacao@nogmacorp.com.br`). Equipe Cavalcanti não consegue acessar até ser convidada.

**Passos** (pra cada pessoa):

1. Login em <https://crm-cavalcanti.vercel.app/login> como admin.
2. **Sidebar → Config → Usuários** (ou `/config/usuarios`).
3. Botão **Convidar usuário** (top-right).
4. Preencher:
   - **Email** da pessoa
   - **Nome completo**
   - **Papel** (dropdown):
     - `admin` — acesso total, inclusive gerenciar usuários
     - `gestor` — cria/edita obras, pagamentos, aprova
     - `financeiro` — visualiza + edita pagamentos/documentos
     - `leitura` — só visualização
5. **Enviar convite** — Supabase Auth dispara email com link PKCE.
6. Pessoa clica no link → tela `/definir-senha` → define senha forte → auto-login em `/painel`.

**Verificação:** ir em `/config/usuarios` → aparece com **último acesso** preenchido depois do primeiro login.

**Nota:** se Resend não estiver ativado (seção 1), o email de convite **não vai chegar**. Nesse caso, dá pra copiar o link direto do log em `notificacoes_email` (tabela `notificacoes_email.corpo`) e enviar por Slack/WhatsApp.

**Fonte:** `docs/TUTORIAL-COMPLETO.md` §3

---

## 🟡 RECOMENDADOS — hardening + ergonomia

### 7. n8n — Automações externas

**Por quê:** o CRM já dispara webhooks outbound HMAC (endpoint `/config/webhooks` funcional), mas ninguém está consumindo. n8n destrava automações custom: notificar Slack em pagamento > R$5k, exportar pra Google Sheets, sync docs pro OneDrive, lembretes WhatsApp automáticos.

**Passos:**

1. Escolher hosting:
   - **Cloud (recomendado):** <https://n8n.cloud> → **Starter** US$20/mês, 2500 executions/mês. Setup: 15min.
   - **Self-hosted:** Docker em VPS ou k8s. Setup: 1-2h. Grátis mas requer manutenção.
2. No CRM: `/config/webhooks` → **Novo webhook** → escolher eventos que interessam (ex: `pagamento_created`, `confirmacao_pendente_created`). **Copiar URL do n8n** que aparece.
3. No n8n:
   - **Credentials → Add** → **Supabase API** → Service Role Key (do `.env.local`).
   - **New Workflow** → primeiro node **Webhook** → colar mesma URL → adicionar validação HMAC (código de exemplo em `docs/operacao/n8n-integracao.md`).
   - Fazer o workflow (Slack node, Google Sheets node, HTTP Request node — depende do caso).
4. Voltar no CRM → botão **Testar webhook** → n8n deve receber payload assinado.

**Fonte:** `docs/operacao/n8n-integracao.md` (arquivo completo com 4 exemplos de workflows)

---

### 8. Backups Supabase — Ativar diários

**Por quê:** Free plan **só tem backup manual**. Com volume real, perda de dados = catástrofe.

**Passos:**

1. <https://supabase.com/dashboard/project/bbtejxugeeccywwhfpoc/settings/billing>
2. **Upgrade to Pro** (US$25/mês) → habilita:
   - Backups diários automáticos (7 dias de retenção)
   - **Point-in-Time Recovery** (PITR) — restore em qualquer segundo dos últimos 7 dias
   - Compute mais robusto (2GB RAM em vez de 500MB)
   - Sem pausar após 7 dias de inatividade

**Alternativa grátis:** rodar `pg_dump` manual toda semana e guardar num S3 privado. Script:

```powershell
$env:PGPASSWORD = "<db-password>"
pg_dump -h aws-0-sa-east-1.pooler.supabase.com -p 6543 -U postgres.bbtejxugeeccywwhfpoc -d postgres -F custom -f "backup-$(Get-Date -Format 'yyyy-MM-dd').dump"
```

---

### 9. GitHub — 2FA obrigatório na org

**Por quê:** Se qualquer conta de membro NogmaBR for comprometida sem 2FA, atacante pode fazer force push mesmo com branch protection.

**Passos** (só org owner pode fazer):

1. <https://github.com/organizations/NogmaBR/settings/security>
2. **Two-factor authentication** → **Require two-factor authentication**.
3. Confirmar — membros sem 2FA serão removidos automaticamente da org e precisam se reintegrar com 2FA ativo.

---

### 10. GitHub — Auditar colaboradores admin

**Por quê:** minimizar surface. Membros com papel `Owner` ou `Admin` em NogmaBR devem ser só quem precisa.

**Passos:**

1. <https://github.com/orgs/NogmaBR/people>
2. Filtrar por **Role: Owner** e **Role: Admin**.
3. Verificar cada um dos identificados nos docs:
   - `Tarsis59`
   - `Hugo6404`
   - `guilbmarcon`
4. Reduzir papel pra `Member` quem não precisa mais de acesso admin.

---

### 11. Rotacionar DB password Supabase

**Por quê:** senha DB atual tem 11 chars (fraca). Em produção com volume real, recomenda-se 32+ chars.

**Passos:**

1. <https://supabase.com/dashboard/project/bbtejxugeeccywwhfpoc/settings/database>
2. **Reset database password** → gerar forte → **salvar em cofre**.
3. Atualizar `SUPABASE_DB_URL` no Vercel (nova password no meio da string).
4. Atualizar `.env.local` também.
5. Redeploy Vercel.

**Cuidado:** ao resetar, TODAS as apps que usam Postgres direto quebram até vars atualizarem. Fazer fora de horário de pico.

---

### 12. Sentry OU Vercel Analytics — Error tracking

**Por quê:** hoje se algo dá erro em prod, só aparece nos logs Vercel (que caducam). Sentry centraliza + agrupa + notifica.

**Opção A — Sentry (recomendado):**
1. <https://sentry.io/signup> → free tier (5k events/mês).
2. Criar project **Next.js** → copiar DSN.
3. `pnpm --filter web add @sentry/nextjs`.
4. `pnpm --filter web exec sentry-wizard@latest -i nextjs` (wizard cria arquivos e configura).
5. Adicionar `SENTRY_AUTH_TOKEN` + `SENTRY_DSN` no Vercel.

**Opção B — Vercel Analytics + Speed Insights:**
1. Vercel dashboard → project → **Analytics** → **Enable** (US$0 no Hobby, US$10 no Pro).
2. `pnpm --filter web add @vercel/analytics @vercel/speed-insights`.
3. Adicionar `<Analytics />` no `app/layout.tsx`.

---

### 13. Rate limiting nos endpoints públicos

**Por quê:** `/api/webhooks/uazapi` e `/api/exports/*` estão abertos. Sem rate limit, DoS/scan pode saturar.

**Passos:**

1. <https://console.upstash.com> → criar Redis DB (free tier: 10k requests/dia).
2. Copiar `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` → adicionar no Vercel.
3. `pnpm --filter web add @upstash/ratelimit @upstash/redis`.
4. Adicionar guard em cada route handler (código: `docs/audit/AUDIT-CONSOLIDADO.md` §Recomendações).

---

## 🟢 NICE-TO-HAVE — opcional/roadmap

### 14. Domínio custom (`crm.cavalcanti.com.br`)

Se a Cavalcanti quiser URL branded em vez de `.vercel.app`:

1. Vercel dashboard → project → **Settings → Domains → Add**.
2. Digitar `crm.cavalcanti.com.br`.
3. Copiar instruções CNAME (aponta pra `cname.vercel-dns.com`).
4. No DNS do domínio Cavalcanti:
   - Tipo: `CNAME`
   - Nome: `crm`
   - Valor: `cname.vercel-dns.com`
5. Aguardar propagação (5-30min) → Vercel emite TLS automático (Let's Encrypt).
6. Atualizar `NEXT_PUBLIC_APP_URL` no Vercel pra novo domínio → redeploy.

### 15. Supabase Branching (staging por PR)

Se quiser DB isolado **por PR** (não só um staging fixo):

- Upgrade Supabase Pro → **Settings → Branches → Enable Branching**.
- Cada PR criado no GitHub gera automaticamente um branch DB (~2min).
- Vercel Preview já linka automaticamente.

Custa US$25/mês (mesmo do Pro plan) + ~US$0.01/hora de branch ativo.

### 16. Monitoring Grafana / DataDog

Pra observability profunda (query slow, RLS misses, memory usage). Só faz sentido depois de 1-2 meses de dados reais pra saber baseline.

### 17. LGPD compliance completo

Data export request + right to be forgotten. Endpoints públicos que o usuário aciona. Só implementar quando primeiro cliente pedir (ou quando ANPD abrir processo, o que preferir vir primeiro).

### 18. SOC 2 / ISO 27001

Se contrato Cavalcanti-cliente exigir. Estima ~R$50-100k pra auditoria + certificação. Só faz sentido em enterprise.

### 19. Runbook de disaster recovery

Documento com:
- Como fazer restore de backup Supabase (PITR ou dump).
- Como redeployar Vercel em outra região (failover).
- Contatos escalada (Nogma ops, Supabase support, Vercel support).
- Playbook: "site fora do ar", "dados corrompidos", "vazamento de secret".

Tempo pra escrever: 1-2h. Alto valor mas baixa prioridade até primeiro incidente.

### 20. Backlog de auditoria residual (7 items ainda em `docs/audit/AUDIT-CONSOLIDADO.md`)

Todos non-blockers, listados na consolidação da auditoria. Reproduzo aqui:

- Recharts lazy loading (perf de bundle)
- Action version pin em `.github/workflows/e2e.yml`
- CSP com nonces por-request (Recharts SVG + hCaptcha iframe quebram sem)
- Rate limiting `/api/exports` (design decision atual: OK sem)
- axe-core em CI
- LGPD data export (roadmap)
- SOC 2 / pentest terceirizado

---

## 📋 Checklist final go-live

Copie isso e vá riscando. Cada item = 1 ação humana fora do VS Code.

### Bloco crítico (~1h30)
- [ ] 1. Conta Resend criada + domínio `nogmacorp.com.br` verificado
- [ ] 2. API key Anthropic criada + créditos adicionados
- [ ] 3. Conta UAZAPI criada + instância provisionada (QR code escaneado)
- [ ] 4. UAZAPI webhook apontado pra `https://crm-cavalcanti.vercel.app/api/webhooks/uazapi`
- [ ] 5. Adicionadas 8 env vars no Vercel prod (`EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `IA_PROVIDER`, `ANTHROPIC_API_KEY`, `UAZAPI_BASE_URL`, `UAZAPI_INSTANCE_ID`, `UAZAPI_API_TOKEN`)
- [ ] 6. `AnthropicClassifier` implementado (código do §Passo 3 da fase-8) + `@anthropic-ai/sdk` instalado + commit + push
- [ ] 7. Redeploy Vercel disparado + status READY
- [ ] 8. Smoke test: enviar msg WhatsApp real → aparece em `/whatsapp` → classifica ou vai pra `/pendentes`

### Bloco CI / staging (~40min)
- [ ] 9. Projeto Supabase staging criado (dashboard) + `.env.staging` preenchido
- [ ] 10. `pnpm staging:apply-migrations` executado (todas 18 migrations)
- [ ] 11. Usuário admin criado no staging + hCaptcha off + `AUTH_TEST_PASSWORD` salvo
- [ ] 12. `pnpm staging:setup-vercel` executado (3 vars STAGING_* no Preview scope)
- [ ] 13. `.github/workflows/e2e.yml` commitado (via UI ou PAT)
- [ ] 14. 6 secrets GitHub adicionados (`VERCEL_TOKEN`, `STAGING_AUTH_*`, `STAGING_SUPABASE_*`)
- [ ] 15. PR de teste aberto → Actions rodou → passou

### Bloco equipe + docs (~30min)
- [ ] 16. Equipe Cavalcanti convidada em `/config/usuarios` (n pessoas × 5min)
- [ ] 17. Credenciais compartilhadas via 1Password/Bitwarden shared vault
- [ ] 18. Tech lead da Cavalcanti leu `docs/TUTORIAL-COMPLETO.md` end-to-end
- [ ] 19. Reunião de handoff feita (2-3h — walkthrough ao vivo com stakeholders)

### Bloco hardening (opcional, ~1h)
- [ ] 20. Backups Supabase Pro ativado (US$25/mês) OU rotina de `pg_dump` semanal
- [ ] 21. GitHub 2FA org-level forçado
- [ ] 22. Colaboradores GitHub auditados (só quem precisa como admin)
- [ ] 23. DB password Supabase rotacionada (32+ chars)
- [ ] 24. Sentry OU Vercel Analytics ativo
- [ ] 25. n8n instância criada + primeiro workflow funcional
- [ ] 26. Rate limiting Upstash ativo em endpoints públicos

### Bloco cosmético (opcional)
- [ ] 27. Domínio custom `crm.cavalcanti.com.br` no DNS + Vercel
- [ ] 28. Logo/manifest ícones em resolução 192x192 e 512x512 dedicada
- [ ] 29. Runbook de disaster recovery escrito

---

## 📚 Referências cruzadas

Cada item deste doc consolidou informação de:

| Documento | Escopo |
|---|---|
| `docs/PROJETO-STATUS.md` | Estado global inicial + secrets rotacionados |
| `docs/TUTORIAL-COMPLETO.md` | 18 seções de uso end-to-end (login, cadastros, WhatsApp, n8n, staging) |
| `docs/operacao/handoff-fase-0.md` | Hardening Auth Supabase inicial |
| `docs/operacao/setup-supabase.md` | Setup Supabase completo |
| `docs/operacao/setup-vercel.md` | Setup Vercel + env vars pattern |
| `docs/operacao/handoff-vercel-parceiro.md` | Passagem de ownership Vercel |
| `docs/operacao/fase-8-integracao.md` | UAZAPI + Anthropic Classifier (~150 linhas de código pronto) |
| `docs/operacao/fase-10-emails.md` | Resend setup + templates React Email |
| `docs/operacao/fase-11-auditoria.md` | LGPD audit triggers (já shipado) |
| `docs/operacao/fase-12-e2e.md` | Playwright infra |
| `docs/operacao/fase-13-usuarios.md` | Convites Supabase Auth (já shipado) |
| `docs/operacao/fase-14-preferencias.md` | Preferências user (email opt-in) |
| `docs/operacao/fase-15-staging.md` | **PRINCIPAL** pra CI + staging |
| `docs/operacao/n8n-integracao.md` | Workflows n8n consumindo webhooks HMAC |
| `docs/audit/AUDIT-CONSOLIDADO.md` | Timeline dos 13 fixes de segurança + backlog residual |
| `docs/audit/2026-09-08-audit-security.md` | 9 findings RLS+auth+secrets |
| `docs/audit/2026-09-08-audit-backend.md` | 21 findings server actions+services+APIs |
| `docs/audit/2026-09-08-audit-frontend-infra.md` | 16 findings XSS+CSRF+bundle+deploy |
| `.env.example` (root) | TODAS as env vars documentadas com fontes/URLs |
| `.env.staging.example` (root) | Vars específicas de staging (subset com prefixo STAGING_) |

---

## 🤝 Contatos

- **Cliente:** Cavalcanti Construções (Fernando Cavalcanti)
- **Fabricante:** Nogma (`operacao@nogmacorp.com.br`, WhatsApp +55 51 9285-6911)
- **Owner GitHub:** org `NogmaBR`
- **Suporte técnico:** operação Nogma via CLI Claude Code
- **Suporte Supabase:** <https://supabase.com/support> (Pro plan tem SLA melhor)
- **Suporte Vercel:** <https://vercel.com/help> (Pro plan tem SLA melhor)
- **Suporte Resend:** <https://resend.com/docs/support>
- **Suporte UAZAPI:** dashboard do provedor (docs em <https://docs.uazapi.com>)
- **Suporte Anthropic:** <https://support.anthropic.com>

---

**Última atualização:** 2026-09-08 (pós auditoria de segurança sessão 2)
**Commit prod atual:** `a8feb5d` (READY em <https://crm-cavalcanti.vercel.app>)
**Total de itens manuais identificados:** 29 (5 críticos + 6 recomendados + 6 nice-to-have + 12 checklist go-live)
