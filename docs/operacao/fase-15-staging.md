# Fase 15 — Staging Supabase + CI E2E

Estado: **infra shipada, aguarda 1 passo manual do humano** (criação
do projeto Supabase staging).

Quando esse passo terminar, tudo o resto se auto-executa via scripts.
CI GitHub Actions passa a rodar em PRs contra staging.

## Por que não foi 100% automático

O PAT `SUPABASE_ACCESS_TOKEN` do usuário retorna **403 Forbidden**
ao tentar criar projeto via `POST /v1/projects`. Isso acontece porque:
- Free tier Supabase pode requerer payment method attached
- OU o PAT do usuário tem scope limitado (sem projects:create)

Solução: usuário cria projeto no dashboard (2min), me passa keys,
eu rodo o resto.

## Passo-a-passo pra ativar

### 1. Criar projeto staging (manual, 2 min)

1. Acesse <https://supabase.com/dashboard>
2. Clique **New Project** na org "NOGMA" (`deqjdoxicriynmkgesiw`)
3. Configure:
   - Name: `CRM-CAVALCANTI-STAGING`
   - Database password: gere um seguro (guarde!)
   - Region: **South America (São Paulo)** — `sa-east-1` (matches prod)
   - Plan: **Free** (org tem slot livre — só 1 projeto ativo hoje)
4. Aguarde ~2 min pra provisionar
5. Copie os valores em **Project Settings → API**:
   - Project URL: `https://<ref>.supabase.co`
   - Publishable key (novo formato) OU anon key (legacy JWT)
   - Secret key (novo formato) OU service_role key (legacy JWT)
6. Copie o **Reference ID** (URL slug, ex: `abcdefghijklmnop`)

### 2. Salvar credenciais localmente

```bash
cd C:/Users/User/Downloads/CRM-CONSTRUTORA-NOGMA
cp .env.staging.example .env.staging
```

Edite `.env.staging` (não vai pro git — já no .gitignore):

```
STAGING_SUPABASE_PROJECT_REF=<reference-id>
STAGING_SUPABASE_URL=https://<ref>.supabase.co
STAGING_SUPABASE_ANON_KEY=<anon-key-completa>
STAGING_SUPABASE_SERVICE_ROLE_KEY=<service-role-key-completa>
STAGING_SUPABASE_DB_PASSWORD=<db-password-que-voce-gerou>

# Auth test user — cria depois, deixa vazio por enquanto
AUTH_TEST_EMAIL=admin@nogmacorp.com.br
AUTH_TEST_PASSWORD=
```

### 3. Aplicar migrations no staging

```powershell
$env:STAGING_SUPABASE_PROJECT_REF="<ref>"
$env:STAGING_SUPABASE_ACCESS_TOKEN="<sbp_... do .env.local>"

pnpm staging:apply-migrations
```

Isso aplica todas as ~17 migrations em ordem. Se dar erro em alguma,
o script para e reporta o arquivo.

**Alternativa (recomendado se supabase CLI disponível):**

```powershell
supabase link --project-ref <ref> --password "<db-password>"
supabase db push
```

### 4. Criar usuário admin de teste no staging

Pelo dashboard:
1. Auth → Users → Add user
2. Email: `admin@nogmacorp.com.br`, senha forte
3. Depois de criar, ir em SQL Editor:
   ```sql
   UPDATE profiles SET papel = 'admin' WHERE user_id = (
     SELECT id FROM auth.users WHERE email = 'admin@nogmacorp.com.br'
   );
   ```
4. Salvar senha em `.env.staging` como `AUTH_TEST_PASSWORD`

### 5. Configurar hCaptcha no staging

Recomendação: **desabilitar hCaptcha no staging** pra E2E rodar sem
travas. Dashboard → Auth → Settings → hCaptcha → toggle off.

OU use o hCaptcha test key `10000000-ffff-ffff-ffff-000000000001`
com secret `0x0000000000000000000000000000000000000000` (ambos oficiais
de teste do hCaptcha).

### 6. Provisionar env vars Vercel Preview

```powershell
$env:VERCEL_TOKEN="vcp_..."   # do .env.local
$env:STAGING_SUPABASE_URL="https://<ref>.supabase.co"
$env:STAGING_SUPABASE_ANON_KEY="<anon-key>"
$env:STAGING_SUPABASE_SERVICE_ROLE_KEY="<service-role>"

pnpm staging:setup-vercel
```

Isso provisiona overrides no scope **Preview** (production intocado).
Após isso, qualquer PR gera Preview URL usando staging DB.

### 7. Configurar secrets GitHub Actions

No repo GitHub → Settings → Secrets and variables → Actions → New:

- `VERCEL_TOKEN` = `vcp_...` (do .env.local)
- `STAGING_AUTH_EMAIL` = `admin@nogmacorp.com.br`
- `STAGING_AUTH_PASSWORD` = senha do user staging
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_ANON_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`

### 8. Testar workflow

```powershell
# Rodar local contra staging DB (dev server local + staging Supabase)
pnpm test:e2e:staging
```

Depois abra um PR no GitHub — o workflow `.github/workflows/e2e.yml`
deve disparar automático, aguardar Preview READY, rodar 12 tests,
uploadar report se falhar.

## Arquitetura final

```
┌──────────────────┐         ┌─────────────────────┐
│   Production     │         │      Preview        │
│  (main branch)   │         │  (PRs / branches)   │
└────────┬─────────┘         └──────────┬──────────┘
         │                              │
         ├─ Vercel builds               ├─ Vercel builds
         ├─ NEXT_PUBLIC_SUPABASE_URL=   ├─ NEXT_PUBLIC_SUPABASE_URL=
         │  prod URL                    │  STAGING URL (override Preview)
         ├─ SERVICE_ROLE_KEY=prod       ├─ SERVICE_ROLE_KEY=STAGING
         │                              │
         v                              v
┌──────────────────┐         ┌─────────────────────┐
│  Supabase Prod   │         │  Supabase Staging   │
│ CRM-CAVALCANTI   │         │ CRM-CAVALCANTI-     │
│                  │         │      STAGING        │
└──────────────────┘         └─────────────────────┘
                                       ^
                                       │
                             ┌─────────┴──────────┐
                             │   GitHub Actions   │
                             │  runs E2E on PRs   │
                             │  against Preview   │
                             │  → staging DB      │
                             └────────────────────┘
```

## Arquivos criados nesta fase

- `scripts/apply-migrations-staging.mjs` — aplica migrations em ordem via
  Supabase SQL admin endpoint (idempotência via BEGIN/END)
- `scripts/setup-vercel-staging-env.mjs` — upsert de 3 env vars em Vercel
  Preview scope (production intocado)
- `.env.staging.example` — template pra `.env.staging`
- `.env.staging` no .gitignore (dados nunca commitados)
- `apps/web/playwright.config.ts` — carrega `.env.staging` quando
  `PLAYWRIGHT_ENV=staging` (override das vars normais)
- `.github/workflows/e2e.yml` — workflow completo (13 steps) — **existe
  local mas NÃO commitado** (GitHub OAuth push token do Claude não tem
  `workflow` scope). Ver seção "Adicionar workflow ao repo" abaixo.
- Scripts npm root: `test:e2e:staging`, `staging:apply-migrations`,
  `staging:setup-vercel`

## Adicionar workflow ao repo (uma vez)

O arquivo `.github/workflows/e2e.yml` está criado localmente mas GitHub
Push Protection bloqueia OAuth tokens de escrever em `.github/workflows/`
sem `workflow` scope. Duas opções:

**Opção A (git com PAT):**
1. Gere um Personal Access Token em <https://github.com/settings/tokens/new>
   com scope `workflow` (e `repo` também)
2. `git remote set-url origin https://<usuario>:<PAT>@github.com/NogmaBR/CRM-CAVALCANTI.git`
3. `git add .github/workflows/e2e.yml && git commit -m "ci: add e2e workflow" && git push`
4. Reverte a URL: `git remote set-url origin https://github.com/NogmaBR/CRM-CAVALCANTI.git`

**Opção B (via GitHub web):**
1. Abre o arquivo local `.github/workflows/e2e.yml` (não vai pro git ainda)
2. GitHub → Actions → New workflow → set up a workflow yourself
3. Cola conteúdo → Commit

## Custos

- **Free tier Supabase** cobre staging (2 projetos por org)
  - 500 MB DB storage
  - 1 GB file storage
  - 50k MAU
  - 5 GB bandwidth
- **Vercel Free** cobre Previews (300k build minutes/mês)
- **GitHub Actions Free** cobre CI (2000 min/mês pra repos private,
  ilimitado pra public)

**Total incremental**: R$0/mês.

Se ultrapassar free tier: Supabase Pro US$25/mês desbloqueia branching
automático (staging DB per PR sem provisionar manualmente).

## Extensões futuras (Fase 15.x)

- **Supabase Branching** (Pro): substitui staging estático por branch
  DB automático por PR (isolamento perfeito, mas $25/mo)
- **Reset staging on-demand**: script `pnpm staging:reset` que dropa
  todas as tabelas + reaplica migrations + seed
- **Nightly E2E on prod smoke**: cron GH Actions que roda subset dos
  tests contra prod URL (só read-only tests) pra detectar regressão
- **Load tests em staging**: k6 script contra staging endpoints
- **Screenshot diffs**: Percy/Chromatic pra detectar mudanças de UI
- **Migration drift detection**: cron que compara schema prod vs
  staging (detecta se alguém alterou prod fora do repo)

## Troubleshooting

**"HTTP 403" ao criar projeto**:
- Free tier requer payment method attached no dashboard
- Ou seu PAT não tem scope. Solução: criar via dashboard (não bloqueia)

**"pnpm staging:apply-migrations falha em migration X"**:
- Migration pode ter dependência de outra rodada primeiro (ordem alfabética
  do timestamp resolve isso; se falhar, checar filesystem)
- Pode ser conflito com schema existente — no staging fresh isso não
  acontece; se aconteceu, é bug na migration (fixar antes de prod)

**"E2E falha em CI mas passa local"**:
- Vercel Preview pode não ter terminado build — `wait-for-vercel-preview`
  action espera até 10min (`max_timeout: 600`)
- Env vars não propagadas — verificar Vercel dashboard scope Preview
- hCaptcha ativo em staging — desabilitar OU adicionar test key OU flag
  `PLAYWRIGHT_ALLOW_HCAPTCHA=1` já setada no workflow

**"Cleanup deixou lixo no staging"**:
- Rode manual: `pnpm e2e:cleanup` com `.env.staging` carregado
  (via `dotenv --env-file .env.staging -- pnpm e2e:cleanup` OU export das vars)

## Rollback

Pra desativar staging (não deletar, só desconectar):
1. Remover overrides de Preview no Vercel dashboard
2. Deletar `.env.staging` local
3. Remover workflow `.github/workflows/e2e.yml` OU disable no dashboard
4. Projeto Supabase staging fica dormant (free tier pausa após 7 dias sem uso)
