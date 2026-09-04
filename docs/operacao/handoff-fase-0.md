# Handoff Fase 0 — Supabase + Vercel (roteiro completo, à prova de erro)

> **Objetivo:** encerrar os dois bloqueadores da Fase 0 (Supabase novo projeto + Vercel na org NogmaBR) de forma que, ao me passar as credenciais listadas no final, eu execute o restante via CLI + MCP **sem intervenção manual sua**.

Status Supabase em 04/set 08:18 UTC: **outage resolvido**, Project Lifecycle Actions re-habilitado 100%. Podemos prosseguir.

---

## Índice

- [Parte A — Supabase (você faz)](#parte-a--supabase-você-faz)
- [Parte B — Vercel (parceiro NogmaBR faz)](#parte-b--vercel-parceiro-nogmabr-faz)
- [Parte C — MCPs que eu preciso ativados](#parte-c--mcps-que-eu-preciso-ativados)
- [Parte D — Checklist final de credenciais para me entregar](#parte-d--checklist-final-de-credenciais-para-me-entregar)
- [Parte E — O que eu executo assim que receber tudo](#parte-e--o-que-eu-executo-assim-que-receber-tudo)
- [Anexos: como compartilhar segredos com segurança](#anexos)

---

## Parte A — Supabase

> ✅ **Já concluído em 2026-09-04.** Projeto `CRM-CAVALCANTI` criado
> (ref `bbtejxugeeccywwhfpoc`, região `sa-east-1`, Postgres 17.6), extensions
> `pgcrypto` + `uuid-ossp` habilitadas, chaves API coletadas e salvas em
> `.env.local` (gitignored). Ver §Segurança para hardening aplicado.
> As seções A.1–A.5 abaixo estão preservadas como **runbook** para
> reprovisionar em caso de disaster recovery. Pule para Parte B ou para
> §"Falta pegar" da Parte D se estiver retomando trabalho normal.

### A.1 · Criar/entrar na conta empresa

1. Abra <https://supabase.com/dashboard/sign-in>.
2. Faça login com o **email empresa** (idealmente `operacao@nogmacorp.com.br` ou similar da Nogma).
   - Se ainda não tem conta: **"Sign up"** → confirme email → volte ao dashboard.
3. Crie/entre numa **organização** chamada `Nogma` (não use "Personal Org", pra ficar limpo).
   - Botão canto superior esquerdo (dropdown de orgs) → **"New organization"**.
   - **Type:** Personal (o campo pergunta tipo — pode ser Personal, é só um label; mudamos pra "Team" só se assinar Pro).
   - **Plan:** Free (upgradamos pra Pro só quando precisar de pg_cron e daily backups).

### A.2 · Criar o projeto `crm-cavalcanti`

1. Dentro da org `Nogma`, clique **"New project"**.
2. Preencha exatamente assim:

   | Campo | Valor |
   |---|---|
   | **Name** | `crm-cavalcanti` |
   | **Database Password** | Clique **"Generate a password"** e cole em local seguro¹ |
   | **Region** | `South America (São Paulo)` — `sa-east-1` |
   | **Pricing Plan** | Free |

   ¹ **Salve a senha DB no seu password manager ANTES de clicar "Create new project"** — o Supabase mostra a senha só uma vez. Se perder, tem que resetar em Settings → Database → Reset database password.

3. Clique **"Create new project"**. Aguarde ~2min até status **"Healthy"**.

### A.3 · Habilitar extensões Postgres

Depois de ficar "Healthy":

1. Menu lateral esquerdo → **SQL Editor** → **"New query"**.
2. Cole e rode:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   -- pg_cron só habilita em Pro; deixa comentado por ora:
   -- CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```
3. Deve retornar `Success. No rows returned` (verde). Se `pg_cron` já der erro no Free plan, apenas ignora.

### A.4 · Criar Personal Access Token (para o **MCP Supabase**)

Isto é o que me dá poder de rodar comandos via MCP sem ficar dependendo de você aprovar cada `supabase db push`.

1. Abra <https://supabase.com/dashboard/account/tokens>.
2. Clique **"Generate new token"**.
3. **Name:** `claude-code-mcp` (ou o que quiser — pra você identificar depois).
4. Clique **"Generate token"** → **copie o token AGORA** (`sbp_xxxxxxxxxxxxxxxxxxxxxxxx`). Ele só aparece uma vez.
5. Salve num gerenciador de senhas (1Password / Bitwarden / arquivo local seguro).

### A.5 · Coletar as 4 credenciais do projeto

No dashboard do projeto `crm-cavalcanti`:

**Em Project Settings → API:**

| No dashboard | Vou chamar de | Uso |
|---|---|---|
| Project URL | `SUPABASE_URL` | público (frontend + backend) |
| Project API keys → **anon** `public` | `SUPABASE_ANON_KEY` | público (frontend) |
| Project API keys → **service_role** `secret` | `SUPABASE_SERVICE_ROLE_KEY` | 🔒 backend only |
| Reference ID (topo da página) | `SUPABASE_PROJECT_REF` | ex: `abcdefghijkl` |

**Em Project Settings → Database → Connection string → URI:**

| Campo | Vou chamar de |
|---|---|
| URI (versão "Connection Pooling **Session**" — porta 5432) | `SUPABASE_DB_URL` |

Copie a URI e **substitua `[YOUR-PASSWORD]` pela senha DB do passo A.2**. Fica algo tipo:
```
postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

> 💡 Prefira o "Session pooler" (5432) ao "Transaction pooler" (6543) para migrations — algumas migrations do Supabase precisam de session mode.

### A.6 · (Opcional) Criar usuário admin de teste

Só faça isso **depois** que eu tiver rodado as migrations (senão a tabela `profiles` não existe). Deixe pra depois — vou fazer na Fase 3 do plano.

---

## Parte B — Vercel (parceiro NogmaBR faz)

> **Copie e cole este bloco pro parceiro (dono da org GitHub `NogmaBR`).** Ele está self-contained.

---

### 📩 Para: parceiro dono da org GitHub `NogmaBR`

Oi! Precisamos criar o projeto Vercel do CRM que estamos construindo. A conta Vercel precisa ser a **sua** (ou uma equipe que você admin), porque o app GitHub "Vercel" precisa estar instalado na org `NogmaBR` pra disparar deploys em push.

Segue o roteiro completo. **Ao terminar, me manda 4 coisas** listadas no final.

#### B.1 · Login/criar conta Vercel

1. Abra <https://vercel.com/signup> (ou <https://vercel.com/login> se já tem conta).
2. Escolha **"Continue with GitHub"** e autentique com o usuário GitHub que administra `NogmaBR`.
3. Ao logar, aceite os termos.

#### B.2 · Criar/entrar no Team `NogmaBR`

1. Canto superior esquerdo → dropdown → **"Create Team"** (se já existir `NogmaBR`, pule pro B.3).
2. **Team Name:** `NogmaBR`.
3. **Team Slug:** `nogmabr` (esse vira o URL: `vercel.com/nogmabr`).
4. **Plan:** Hobby / Free (gratuito).
   - Nota: Hobby é pessoal; pra time compartilhado o Free equivalente é o "Pro Trial" ou aceitar convite. Se pedir upgrade, use "Hobby" mesmo por ora — resolvemos escalar depois.

#### B.3 · Instalar o GitHub App "Vercel" na org NogmaBR

1. No dashboard Vercel, vá em **Add New → Project**.
2. Se aparecer "No Git Repositories found" ou não listar a org `NogmaBR`: clique **"Adjust GitHub App Permissions"** (ou "Configure GitHub App").
3. GitHub abre em nova aba: selecione a org **`NogmaBR`**.
4. Em **Repository access**, escolha uma das duas:
   - **All repositories** (mais simples), OU
   - **Only select repositories** → adicione `CRM-CAVALCANTI`.
5. Clique **"Install & Authorize"**. Volta pro Vercel.

#### B.4 · Importar o repositório

1. Volte em **Add New → Project**.
2. Localize `NogmaBR/CRM-CAVALCANTI` e clique **"Import"**.
3. Configure exatamente assim:

   | Campo | Valor |
   |---|---|
   | **Project Name** | `crm-cavalcanti` |
   | **Framework Preset** | `Next.js` (auto-detectado — se não, escolha na mão) |
   | **Root Directory** | `apps/web` — clique **"Edit"** e digite; **importante** |
   | **Build Command** | `cd ../.. && pnpm --filter web build` |
   | **Install Command** | `cd ../.. && pnpm install --frozen-lockfile` |
   | **Output Directory** | `.next` (padrão, deixe em branco) |
   | **Node.js Version** | `22.x` |

   > ⚠️ Se `apps/web` ainda não existir no repo (a Fase 1 é quem cria), o import vai falhar. Nesse caso, **cancele o import** e me avisa — eu crio `apps/web` primeiro, dou push, e o parceiro tenta de novo.

4. **Environment Variables** — por enquanto **NÃO preencha nada** aqui. Eu vou popular via CLI depois (`vercel env add`), é mais seguro e rastreável.

5. Clique **"Deploy"**. O primeiro deploy vai falhar (não tem código Next.js ainda) — **isso é esperado**. Só precisamos do projeto criado.

#### B.5 · Criar Access Token pra CLI

1. Vá em <https://vercel.com/account/settings/tokens> (dropdown do avatar → Account Settings → Tokens).
2. **Create Token:**
   - **Name:** `claude-code-cli`
   - **Scope:** `NogmaBR` (o team que acabou de criar) — **não** deixe "Full Account"
   - **Expiration:** `No expiration` (ou 1 ano se preferir renovar)
3. Copie o token (`vercel_xxxx...`) — só aparece uma vez.

#### B.6 · Me mande 4 coisas

- ✅ **Vercel Access Token** (`vercel_...`)
- ✅ **Team ID** (encontrado em <https://vercel.com/nogmabr/settings> → "Team ID", formato `team_xxxx`)
- ✅ **Project ID** (em <https://vercel.com/nogmabr/crm-cavalcanti/settings> → "Project ID", formato `prj_xxxx`)
- ✅ **Project URL provisória** (algo como `https://crm-cavalcanti.vercel.app` ou `https://crm-cavalcanti-nogmabr.vercel.app`)

Se precisar mandar isso de forma segura, use um dos métodos do anexo no final deste doc.

**Fim do roteiro do parceiro.**

---

## Parte C — MCPs que eu preciso ativados

Você já tem o plugin `plugin_supabase_supabase` disponível na sessão. Basta autenticar. Vercel não tem MCP oficial ainda; uso Vercel CLI direto.

### C.1 · Autenticar MCP Supabase

Quando você me mandar o Personal Access Token do passo A.4, eu chamo internamente:

```
mcp__plugin_supabase_supabase__authenticate
mcp__plugin_supabase_supabase__complete_authentication  (com o token)
```

Você **não precisa** rodar nada. Só me passar o token `sbp_...`.

### C.2 · Autenticar Supabase CLI local (você faz uma vez)

Isto é útil pra rodar `supabase db push` a partir da sua máquina. O CLI atual está logado em `contato.nogma@gmail.com` — precisa trocar pra conta nova:

```powershell
supabase logout
supabase login
```

O `login` abre o browser. Autentique com a **conta nova** (mesma do passo A.1).

Verifique:
```powershell
supabase projects list
```

Deve aparecer `crm-cavalcanti` na lista. Se aparecer, ✅.

### C.3 · Autenticar Vercel CLI (com o token do parceiro)

Assim que você me mandar o Vercel Access Token, eu rodo daqui:

```powershell
vercel login --token <VERCEL_TOKEN>
# ou (equivalente, não interativo):
$env:VERCEL_TOKEN = "<VERCEL_TOKEN>"
vercel whoami
```

Você não precisa rodar nada — só me entregar o token.

---

## Parte D — Status das credenciais

Estado em 2026-09-04 (final da sessão de handoff):

### ✅ Já coletadas e salvas em `.env.local` (gitignored)

| Chave | Origem | Notas |
|---|---|---|
| `SUPABASE_PROJECT_REF` | dashboard URL | `bbtejxugeeccywwhfpoc` |
| `SUPABASE_URL` | Management API | público |
| `SUPABASE_ANON_KEY` | `/v1/projects/{ref}/api-keys` | legacy JWT, público |
| `SUPABASE_SERVICE_ROLE_KEY` | `/v1/projects/{ref}/api-keys` | legacy JWT, 🔒 secreto |
| `SUPABASE_PUBLISHABLE_KEY` | `/v1/projects/{ref}/api-keys` | novo formato, público |
| `SUPABASE_JWT_SECRET` | `/v1/projects/{ref}/postgrest` | 🔒 |
| `SUPABASE_ACCESS_TOKEN` | user forneceu | 🔒 Personal Access Token para MCP + Management API |
| `WEBHOOK_HMAC_SECRET` | regerado nesta sessão | 🔒 novo valor de 32 bytes; o antigo (`dcbb2015…`) foi queimado |

### ⏳ Falta pegar (manual, no dashboard)

| Chave | Como pegar | Por quê |
|---|---|---|
| `SUPABASE_DB_PASSWORD` | Dashboard → Project Settings → **Database** → botão **"Reset database password"** → copie a nova senha | A senha atual não é conhecida (Management API não a expõe); resetar dá senha nova e conhecida em 30s |
| `SUPABASE_SECRET_KEY` (novo formato `sb_secret_...`) | Dashboard → Project Settings → **API** → card "Secret key" → botão **"Reveal"** | Management API retorna a chave mascarada; só o dashboard reveia |

### ⏳ Vercel — parceiro NogmaBR ainda não subiu

| Chave | Como pegar |
|---|---|
| `VERCEL_TOKEN` | Parceiro faz Parte B.5 e me manda |
| `VERCEL_TEAM_ID` | <https://vercel.com/nogmabr/settings> após criar team |
| `VERCEL_PROJECT_ID` | <https://vercel.com/nogmabr/crm-cavalcanti/settings> após import |
| `VERCEL_PROJECT_URL` | Vercel gera após primeiro import |

### Como me passar os pendentes

Numa próxima mensagem, cola só o que faltou:

```
SUPABASE_DB_PASSWORD=<a senha que você resetou>
SUPABASE_SECRET_KEY=<sb_secret_...>
VERCEL_TOKEN=<vercel_...>
VERCEL_TEAM_ID=<team_...>
VERCEL_PROJECT_ID=<prj_...>
VERCEL_PROJECT_URL=<https://crm-cavalcanti.vercel.app>
```

Eu completo o `.env.local`, monto as connection strings, provisionio env vars na Vercel, e sigo pra Fase 1.

---

## Parte E — O que eu executo assim que receber tudo

Você me manda a próxima mensagem no formato:

> "Retomando CRM Nogma. Credenciais Fase 0 abaixo. Vamos executar a Fase 1."
>
> `<cola o bloco da Parte D>`

Eu então rodo, nesta ordem, tudo automatizado:

### E.1 · Handshake e verificação (30 s)
```powershell
# 1. Autentico MCP Supabase com SUPABASE_MCP_TOKEN
# 2. Configuro Vercel CLI:
$env:VERCEL_TOKEN = "<VERCEL_TOKEN>"
vercel whoami                                          # confirma auth
vercel link --yes --project crm-cavalcanti --scope nogmabr
# 3. Confirmo Supabase CLI:
supabase projects list                                 # confirma crm-cavalcanti visível
```

### E.2 · Provisionar env vars na Vercel (2 min)
Populo Production + Preview + Development de uma vez pra cada variável (sensíveis marcadas como Sensitive):
```powershell
"NEXT_PUBLIC_SUPABASE_URL",
"NEXT_PUBLIC_SUPABASE_ANON_KEY",
"SUPABASE_SERVICE_ROLE_KEY",       # sensitive
"SUPABASE_DB_URL",                 # sensitive
"NEXT_PUBLIC_APP_URL",
"WEBHOOK_HMAC_SECRET",             # sensitive
"OPENAI_API_KEY"                   # placeholder vazio por enquanto
| ForEach-Object { vercel env add $_ production, preview, development }
vercel env pull apps/web/.env.local     # baixa pro dev local
```

### E.3 · Popular `.env.local` local (10 s)
Se `apps/web/` ainda não existir, primeiro crio o skeleton Next.js (Task 1.1 do plano). O `vercel env pull` só funciona depois do link.

### E.4 · Executar Fase 1 do Plano #1 v2 — Tasks 1.1 a 1.5
Referência: `docs/superpowers/plans/2026-09-03-plano-1-fundacoes-v2.md`.

- Task 1.1: `apps/web/` Next.js 15 + App Router + TS + Tailwind + Nogma DS integrado
- Task 1.2: `packages/design-system/` (empacota `Nogma Design System/` como workspace package)
- Task 1.3: `packages/db/` (client Supabase tipado)
- Task 1.4: `packages/config/` (env schema com zod)
- Task 1.5: Chrome NogmaOS extraído em `styles/nos-chrome.css` + AppLayout

### E.5 · Fase 2 — Auth (Supabase Auth + middleware)

### E.6 · Fase 3 — Schema/RLS/Seed
```powershell
supabase link --project-ref <SUPABASE_PROJECT_REF>
# uso senha DB automaticamente via SUPABASE_DB_PASSWORD
supabase db push
# depois:
supabase gen types typescript --linked > packages/db/src/generated.ts
```

### E.7 · Deploy final
```powershell
git push origin main       # Vercel deploya sozinho
# ou:
vercel deploy --prod
```

Checkpoint automático a cada fase: rodo `pnpm typecheck && pnpm build`, se falhar, paro e te reporto antes de continuar.

---

## Anexos

### 🔒 Como me passar segredos com segurança

Ordem de preferência:

1. **Melhor:** Colar direto na sessão local do Claude Code — a sessão fica na sua máquina, nada vai pra fora além dos LLM calls (que são criptografados em trânsito e retidos ≤30 dias por padrão).
2. **Bom:** Salvar num arquivo local `.env.handoff` (nunca commitar; já está no `.gitignore` como `.env*`) e me pedir pra `Read` esse arquivo.
3. **Aceitável:** Password manager compartilhado (1Password vault "Nogma-CRM") — cria itens separados por serviço.
4. **Evitar:** Slack/WhatsApp/email sem criptografia.

### ❓ Perguntas que talvez apareçam no dashboard e como responder

| Pergunta | Resposta |
|---|---|
| Supabase: "Enable Point-in-Time Recovery?" | **Não** (custa; sobe pro Pro só quando precisar) |
| Supabase: "Enable Realtime?" | **Sim** (default). Vamos usar pra mensagens WhatsApp na Fase 4+. |
| Vercel: "Enable Vercel Analytics?" | **Sim** (Free tier basta) |
| Vercel: "Enable Speed Insights?" | **Sim** (Free tier basta) |
| Vercel: "Protect Preview Deployments with Password?" | **Sim** (dashboards internos não devem ficar públicos) |
| GitHub App Vercel: "Access to org?" | Selecione **`NogmaBR`** apenas |

### 🚨 Se algo der errado

- **Supabase project não fica "Healthy" em 5min:** delete e crie de novo. Free plan às vezes tem lentidão em provisioning.
- **Vercel import falha por "Root Directory not found":** o parceiro tentou importar antes da Fase 1 gerar `apps/web/`. Cancele, me chame.
- **`supabase db push` retorna "connection refused":** re-rode `supabase link` — o `.temp/pooler-url` pode ter cache errado.
- **CLI Vercel diz "not authenticated" mesmo com token:** provavelmente scope errado no token. Regenere com scope `NogmaBR`.

---

## Segurança — o que já foi aplicado no Supabase

Aplicado via Management API em 2026-09-04, no projeto `bbtejxugeeccywwhfpoc`:

### Auth hardening (endpoint `PATCH /v1/projects/{ref}/config/auth`)

| Config | Antes (default) | Depois | Racional |
|---|---|---|---|
| `disable_signup` | `false` | **`true`** | CRM interno — só admin cria usuário (via invite/admin API) |
| `password_min_length` | 6 | **12** | resiste dicionário |
| `password_required_characters` | `null` | **símbolo+MAI+min+num** | reduz força bruta comum |
| `security_update_password_require_reauthentication` | `false` | **`true`** | reset de senha exige re-login recente |
| `security_manual_linking_enabled` | `false` (já OK) | `false` | evita account-takeover por link manual |
| `refresh_token_rotation_enabled` | `true` (já OK) | `true` | rotaciona refresh token a cada uso |
| `mfa_totp_enroll_enabled` | `true` (já OK) | `true` | MFA TOTP disponível |
| `mfa_totp_verify_enabled` | `true` (já OK) | `true` | MFA TOTP verificável |
| `mailer_notifications_*` (7 tipos) | `false` | **todos `true`** | user avisado em mudança de senha, email, MFA, provider link |
| `jwt_exp` | 3600 (1h) | 3600 | mantido |

### SSL enforcement no DB (`PUT /v1/projects/{ref}/ssl-enforcement`)

```json
{"currentConfig":{"database":true},"appliedSuccessfully":true}
```

Todas as conexões ao Postgres agora exigem TLS. Cliente sem `ssl=require` é rejeitado.

### Segurança de funções — advisor limpo

O advisor de segurança flagava `public.rls_auto_enable()` (função Supabase built-in, event trigger para auto-habilitar RLS em novas tabelas) como executável por `anon`/`authenticated` via PostgREST RPC. Mesmo sendo inofensiva (só faz algo em contexto de event trigger), foi mitigada:

```sql
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
```

`GET /v1/projects/{ref}/advisors/security` retorna agora `total lints: 0`.

### Configurações pendentes (Free plan não permite)

Aplicar quando/se subirmos para Pro (US$ 25/mês/projeto):

- `password_hibp_enabled: true` — validar senha contra HaveIBeenPwned (Pro)
- `sessions_inactivity_timeout: 28800` (8h) — timeout de inatividade (Pro)
- `sessions_timebox: 604800` (7d) — expiração absoluta de sessão (Pro)
- Network restrictions no Pooler — hoje `0.0.0.0/0` (obrigatório com Vercel serverless sem IP fixo)
- Daily backups PITR

### Hardening que **você** deve fazer manualmente

1. **MFA na sua conta Supabase** (não é do projeto — é da conta owner):
   - <https://supabase.com/dashboard/account/security> → "Enable two-factor authentication" (TOTP)
2. **MFA no GitHub NogmaBR** (evita takeover do repo com deploys Vercel):
   - <https://github.com/settings/security>
3. **Rotate DB password** (higiene, mesmo o vazado sendo inerte):
   - Dashboard projeto → Settings → Database → **Reset database password**
   - Copie a nova, cole em `.env.local` no campo `SUPABASE_DB_PASSWORD` e nos `SUPABASE_DB_URL`/`SUPABASE_DB_POOLER_URL`

## Segurança do repositório público

Repo `NogmaBR/CRM-CAVALCANTI` é público. O que **NÃO** vai pro git:

- `.env.local` (raiz e por-app) — `.gitignore` cobre `.env` e `.env.*`
- `apps/web/.env.local` — populado por `vercel env pull`
- Nenhum arquivo com padrão `sbp_*`, `sb_secret_*`, `sb_publishable_*`, JWT `eyJ*`, `WEBHOOK_HMAC_SECRET=...` com valor real

Auditar antes de `git push` (roda automático em CI depois; por ora rodo eu):

```powershell
git grep -nE 'sbp_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_]+|eyJhbGciOi[A-Za-z0-9._-]+' HEAD
# esperado: nenhum resultado
```

Se o CI achar segredo antes do push, o commit é rejeitado.

## Rotação de credenciais — se algo vazar

| Credencial | Como rotacionar | Impacto |
|---|---|---|
| Supabase Personal Access Token | <https://supabase.com/dashboard/account/tokens> → delete + gerar novo → me passar | reautentico MCP + CLI |
| Supabase DB password | Dashboard → Settings → Database → Reset | reconectar CLI, atualizar Vercel env, redeploy |
| Supabase JWT signing key | Dashboard → Settings → API → Rotate JWT secret | invalida todas as sessões existentes; força logout global |
| `service_role` / `anon` / `sb_secret_` | Rotacionar JWT signing key regenera | ver acima |
| Vercel token | <https://vercel.com/account/settings/tokens> → delete + gerar novo | reautentico CLI |
| `WEBHOOK_HMAC_SECRET` | Regerar `openssl rand -hex 32` → atualizar `.env.local` + `vercel env` + redeploy | webhooks antigos rejeitados |

**Última atualização:** 2026-09-04 (Fase 0 concluída Supabase-side + hardening aplicado; Vercel pendente).
