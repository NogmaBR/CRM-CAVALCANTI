# Auditoria 08 — Infraestrutura, Deploy, CI/CD e Prontidão Operacional

> **Data:** 2026-09-09 · **Auditor:** plataforma/SRE (Opus 5) · **Escopo:** repo `CRM-CONSTRUTORA-NOGMA`
> **Branch auditada:** `feat/alinhamento-cavalcanti-16-09` · **Remote:** `NogmaBR/CRM-CAVALCANTI`
> **Método:** execução real de build/lint/typecheck/test/audit + leitura de configs. Nenhuma alteração de código, nenhum comando de escrita remota.

---

## 1. Painel de prontidão operacional

| Dimensão | Status | Justificativa (uma linha) |
|---|:--:|---|
| **Build** | 🟢 | `next build` passa limpo em 62s, 46 rotas geradas, TypeScript compilado sem erro. |
| **Typecheck** | 🟢 | `pnpm -r typecheck` passa nos 2 workspaces em 28s, zero erros. |
| **Instalação reproduzível** | 🟢 | `pnpm install --frozen-lockfile` passa em 6,4s; lockfile íntegro e política de supply-chain verificada. |
| **Lint** | 🔴 | `pnpm lint` falha com **432 erros / 44 warnings** — 333 deles dentro de `apps/web`; o gate é inexequível hoje. |
| **Testes unitários** | 🔴 | `pnpm -r test` **falha**: `vitest` está no script mas **não existe no `package.json` nem no lockfile**. Zero testes unitários no repo. |
| **CI/CD** | 🔴 | `.github/` **nunca foi commitado** (`git log -- .github` vazio). Na prática **não existe CI**: nada roda em PR, nada bloqueia merge. |
| **Migrations** | 🔴 | Script `.mjs` que faz POST de SQL cru na Admin API; **sem tabela de controle, sem transação, sem rollback, sem detecção de drift**. |
| **Ambientes** | 🟡 | `.env.example` cobre bem o app, mas **staging não existe** (projeto Supabase nunca criado) e há 1 var usada e não documentada + 1 documentada e não usada. |
| **Região / latência** | 🔴 | Banco em `sa-east-1` (São Paulo) e **funções Vercel sem `regions`** → default `iad1` (Washington). ~110–130 ms de RTT em **cada query**. |
| **Backup / DR** | 🔴 | Supabase Free (só backup manual), **nenhum script ou doc de backup**; `README.md` linka `docs/operacao/backup-restore.md` que **não existe**. |
| **Observabilidade** | 🔴 | Nenhum health check, nenhum log estruturado (1 único `console.error` em todo `app/` + `lib/`), nenhum alerta de cron ou 5xx. |
| **Segredos** | 🟢 | `.env.local`, `.vercel/`, `.env.staging` corretamente ignorados; `pnpm audit` = **0 vulnerabilidades**. |
| **Higiene do repositório** | 🔴 | **~40.500 arquivos não rastreados** no working tree (`Cavalcanti enegenharia/` = 19.668, `__MACOSX/` = 20.870) + screenshot de sessão logada solto na raiz. |
| **Dependências** | 🟡 | Zero CVEs, mas specifier `^4.0.0-alpha.36` no Tailwind, Biome 1.x (2.x disponível), `@react-email/components` **deprecated**, 2 PRs Dependabot obsoletos abertos. |
| **DX / onboarding** | 🟡 | README aponta 3 caminhos inexistentes; sem seed de dev, sem `db:reset`/`dev:setup`. Dev novo trava. |

**Veredito:** o *artefato* está saudável (compila, tipa, deploya). A *operação* não está: não há CI, não há teste automatizado executável, não há backup, não há observabilidade e as migrations são aplicadas na unha contra produção. **Não recomendo tratar isto como "pronto para produção" no sentido operacional** — está "pronto para demo".

---

## 2. Evidências de execução

Todos os comandos rodados a partir da raiz do repo, Windows 11, Node 22.18, pnpm 11.7.0, em 2026-09-09.

### 2.1 `pnpm install --frozen-lockfile` — ✅ EXIT 0

```
Scope: all 3 workspace projects
✓ Lockfile passes supply-chain policies (verified 1d ago)
Lockfile is up to date, resolution step is skipped
Packages: -11
   Update available! 11.7.0 → 12.3.4.
Done in 6.4s using pnpm v11.7.0

real    0m7,194s
```

Lockfile íntegro. Nota: pnpm 12.3.4 disponível; `packageManager` fixa 11.7.0 (bom — reprodutível), mas `engines.pnpm` diz `>=9`, o que permite um dev rodar pnpm 9 e gerar lockfile incompatível.

### 2.2 `pnpm lint` — ❌ EXIT 1

```
Skipped 134 suggested fixes.
The number of diagnostics exceeds the number allowed by Biome.
Diagnostics not shown: 495.
Checked 309 files in 383ms. No fixes applied.
Found 432 errors.
Found 44 warnings.
[ELIFECYCLE] Command failed with exit code 1.

real    0m8,014s
```

Escopo restrito a código do projeto (`biome check apps/web packages scripts`) — ainda falha:

```
Checked 229 files in 351ms.
Found 333 errors.
Found 44 warnings.
```

Distribuição dos 333 erros em `apps/web`:

| Categoria | Ocorrências |
|---|---:|
| `format` (formatação/`organizeImports`) | 130 |
| `lint/style/noNonNullAssertion` | 44 (warnings) |
| `lint/a11y/*` | 26 |
| `lint/style/useTemplate` | 17 |
| `lint/suspicious/noArrayIndexKey` | 16 |
| `lint/style/useImportType` | 6 |
| `lint/style/noUnusedTemplateLiteral` | 5 |
| `lint/complexity/useLiteralKeys` | 5 |
| `lint/suspicious/noMisleadingCharacterClass` | 4 |
| `lint/complexity/noForEach` | 3 |
| outros (`useSelfClosingElements`, `useJsxKeyInIterable`, `useOptionalChain`) | 3 |

**Leitura:** ~130 são puramente cosméticos e resolvem com `pnpm format`. Os 26 de a11y e o `useJsxKeyInIterable` são reais. Os 99 restantes vêm da pasta `Cavalcanti enegenharia/` (app Vite alheio ao monorepo) que o Biome varre porque `useIgnoreFile: true` só respeita o `.gitignore` — e essa pasta **não está no `.gitignore`**.

### 2.3 `pnpm typecheck` — ✅ EXIT 0

```
Scope: 2 of 3 workspace projects
packages/db typecheck$ tsc --noEmit  → Done
apps/web typecheck$ tsc --noEmit     → Done

real    0m28,006s
```

### 2.4 `pnpm -r test` — ❌ EXIT 1

```
Scope: 2 of 3 workspace projects
apps/web test$ vitest run
apps/web test: 'vitest' não é reconhecido como um comando interno
apps/web test: Failed
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] web@0.0.1 test: `vitest run`
Exit status 1

real    0m5,746s
```

Causa raiz confirmada: `vitest` **não aparece em `apps/web/package.json`** nem em `pnpm-lock.yaml`. Não há `vitest.config.*` em lugar nenhum. Inventário completo de testes do repo:

```
apps/web/e2e/auth.spec.ts
apps/web/e2e/cross-flow.spec.ts
apps/web/e2e/obras-crud.spec.ts
apps/web/e2e/reports-download.spec.ts
```

4 specs Playwright que só rodam contra um staging que não existe. **Cobertura de teste automatizado efetivamente executável hoje: zero.**

### 2.5 `cd apps/web && pnpm build` — ✅ EXIT 0

```
Creating an optimized production build ...
✓ Compiled successfully in 26.1s
  Running TypeScript ...
  Finished TypeScript in 12.2s
✓ Generating static pages using 15 workers (31/31) in 2.1s
  Finalizing page optimization ...

real    1m2,912s
```

46 rotas. Apenas `/manifest.webmanifest` é estática (`○`); **todo o resto é `ƒ` dinâmico/SSR** — o que amplifica muito o achado de região (§3.1). Zero warnings de build.

### 2.6 `pnpm outdated -r` — EXIT 1 (há desatualizados)

```
┌─────────────────────────┬─────────┬────────────┬────────────────┐
│ Package                 │ Current │ Latest     │ Dependents     │
├─────────────────────────┼─────────┼────────────┼────────────────┤
│ @react-email/components │ 1.0.12  │ Deprecated │ web            │
│ @supabase/supabase-js   │ 2.115.0 │ 2.116.0    │ web            │
│ @biomejs/biome (dev)    │ 1.9.4   │ 2.5.12     │ crm-nogma      │
│ @tanstack/react-table   │ 8.21.3  │ 9.2.4      │ web            │
│ @types/node (dev)       │ 22.20.1 │ 26.5.0     │ web            │
│ sonner                  │ 1.7.4   │ 2.0.8      │ web            │
│ typescript (dev)        │ 5.9.3   │ 7.0.2      │ crm-nogma, web │
│ zod                     │ 3.25.76 │ 4.5.4      │ web            │
│ @supabase/ssr           │ 0.12.6  │ 0.12.7     │ web            │
│ lucide-react            │ 0.462.0 │ 1.43.0     │ web            │
└─────────────────────────┴─────────┴────────────┴────────────────┘
```

### 2.7 `pnpm audit` — ✅ EXIT 0

```
No known vulnerabilities found
```

### 2.8 Correção de uma premissa do escopo: Tailwind **não** é alpha em produção

O briefing supõe `tailwindcss@4.0.0-alpha` rodando em prod. **Verificado no lockfile — é falso:**

```
'@tailwindcss/postcss':
  specifier: ^4.0.0-alpha.36
  version: 4.3.3
tailwindcss:
  specifier: ^4.0.0-alpha.36
  version: 4.3.3
```

O *specifier* é alpha, a *versão instalada* é **4.3.3 estável**. O risco real não é "alpha em prod", é que `^4.0.0-alpha.36` é um range de pré-release: semanticamente confuso, e qualquer `pnpm update` ou resolução em máquina limpa pode puxar algo inesperado. **Corrigir o specifier para `^4.3.3`** — é uma edição de 2 linhas sem impacto funcional.

Outras versões efetivamente resolvidas: `next@16.3.4`, `react@19.2.8` / `react-dom@19.2.8` (o `react@19.2.18` e `react-dom@19.2.7` no lockfile são de subárvores transitivas; `react@0.462.0` é artefato do grep casando `lucide-react@0.462.0`).

---

## 3. Findings numerados

### 🔴 F-01 — O CI não existe: `.github/` nunca foi commitado

**Evidência:**
```
$ git status --porcelain
?? .github/
?? "Cavalcanti enegenharia/"
?? __MACOSX/
?? crm-cavalcanti-logado.png

$ git log --oneline -- .github
(vazio — nenhum commit toca .github)
```

`.github/workflows/e2e.yml` existe **apenas no disco local**. `docs/MANUAL-PENDENCIAS.md:` confirma a causa — *"Arquivo `.github/workflows/e2e.yml` existe local mas não foi pushado (OAuth do CLI sem workflow scope)"*.

**Consequência:** nenhum PR é verificado. Branch protection exige PR, mas **não há check para exigir**, então "PR obrigatório" hoje é só um clique de aprovação humana. Todo o valor da suíte E2E e do trabalho de staging está inerte.

**Correção:** commitar `.github/` com um PAT que tenha escopo `workflow`, ou colar os workflows pela UI do GitHub (Actions → new workflow). Depois marcar os jobs como *required status checks* em Settings → Branches → main. Workflows recomendados prontos em §5.1.

---

### 🔴 F-02 — `pnpm -r test` quebra: `vitest` não está instalado

**Evidência:** §2.4. `apps/web/package.json` declara `"test": "vitest run"` mas `vitest` não consta em `devDependencies` nem no `pnpm-lock.yaml`.

**Consequência:** o comando padrão de teste do monorepo falha em qualquer máquina limpa. Se o pipeline recomendado for adicionado sem corrigir isto, o CI ficará vermelho no primeiro run. E, mais grave: **não existe um único teste unitário** para lógica que claramente merece (`lib/reports/csv.ts`, `lib/schemas/*`, `lib/util/*`, os slugify/dateStamp de `api/exports`).

**Correção imediata (2 min):**
```bash
pnpm --filter web add -D vitest @vitejs/plugin-react
```
`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
});
```
Alternativa honesta se ninguém for escrever testes agora: trocar o script para `"test": "echo 'sem testes unitarios' && exit 0"` — pelo menos o comando não mente. Mas a recomendação é instalar e cobrir `lib/reports/csv.ts` e `lib/schemas/` primeiro (lógica pura, alto retorno).

---

### 🔴 F-03 — Funções Vercel em `iad1`, banco em `sa-east-1`: ~120 ms de RTT por query

**Evidência:** `apps/web/vercel.json` na íntegra:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/sweep-pending-documentos", "schedule": "0 3 * * *" }
  ]
}
```
Não há `"regions"`. Não há `"functions"`. `grep -rn -i "region|gru1|iad1"` em `docs/operacao/setup-vercel.md` e `vercel.json` retorna **zero** ocorrências de configuração — a única menção a região no repo é o `sa-east-1` do Supabase. Sem `regions`, a Vercel usa o default da conta, que é `iad1` (Washington, D.C.).

**Consequência mensurável:** RTT `iad1` ↔ `sa-east-1` fica na faixa de **110–130 ms**. O build mostra que **45 das 46 rotas são `ƒ` (SSR dinâmico)** — cada uma faz de 1 a N queries sequenciais ao Supabase. Uma página de detalhe com 4 queries encadeadas paga ~500 ms só de rede, antes de qualquer processamento. Mudar para `gru1` (São Paulo) derruba isso para ~5–15 ms.

**Correção (`apps/web/vercel.json`):**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["gru1"],
  "crons": [
    { "path": "/api/cron/sweep-pending-documentos", "schedule": "0 3 * * *" }
  ],
  "functions": {
    "app/api/exports/[tipo]/route.ts": { "maxDuration": 60, "memory": 1769 },
    "app/api/cron/sweep-pending-documentos/route.ts": { "maxDuration": 60 },
    "app/(app)/config/importar/page.tsx": { "maxDuration": 60 }
  }
}
```
> ⚠️ `regions` com região única e `maxDuration > 10s` exigem plano **Pro**. No Hobby, `regions` é ignorado e o teto é 10s (60s em Fluid Compute). Se o projeto está no Hobby, este finding vira um **argumento de negócio pelo upgrade Pro (US$20/mês)** — que também resolve F-06 (backups) e o limite de 1 cron/dia.

---

### 🔴 F-04 — `maxDuration` e `memory` não declarados nas rotas pesadas

**Evidência:** `grep -rn "maxDuration" apps/web` retorna **zero**. As rotas pesadas declaram apenas runtime:
```
app/api/exports/[tipo]/route.ts:24:  export const runtime = 'nodejs';
app/api/exports/[tipo]/route.ts:25:  export const dynamic = 'force-dynamic';
app/api/cron/sweep-pending-documentos/route.ts:6-7: idem
app/api/webhooks/uazapi/route.ts:14-15: idem
```

`app/api/exports/[tipo]/route.ts` faz `renderToBuffer` do `@react-pdf/renderer` sobre 4 tipos de relatório (`obra-completa`, `mes`, `fornecedor`, `atividade`) — renderização de PDF em memória é o caso clássico de estouro de timeout e de heap. A importação CSV (`app/(app)/config/importar/actions.ts`) roda como Server Action, sem limite de linhas visível no código.

**Consequência:** um relatório de obra grande estoura o default silenciosamente e o usuário vê um erro genérico. Sem `memory` declarado, o default (1024 MB) pode não bastar para o PDF.

**Correção:** o bloco `functions` de F-03, ou o export inline por rota:
```ts
export const maxDuration = 60; // topo de app/api/exports/[tipo]/route.ts
```

---

### 🔴 F-05 — Migrations sem controle: sem registro, sem transação, sem rollback, sem drift

**Evidência:** `scripts/apply-migration.mjs` (18 migrations em `supabase/migrations/`). O núcleo:
```js
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
```

Cinco problemas, todos verificáveis por leitura:

1. **Nenhum registro de estado.** Nada grava que a migration `X` foi aplicada. Não existe `supabase_migrations.schema_migrations`. Saber o que está em prod exige inspeção manual do schema.
2. **Idempotência é responsabilidade de cada arquivo.** Rodar duas vezes um `CREATE TABLE` sem `IF NOT EXISTS` falha; um `INSERT` duplica. Não há proteção sistêmica.
3. **Sem transação — apesar do comentário afirmando o contrário.** O cabeçalho de `apply-migrations-staging.mjs` diz *"cada migration ... é wrapped em BEGIN/END pra rollback automático se falhar no meio"*. **Isso não acontece no código** — não há `BEGIN`/`COMMIT` em lugar nenhum do script. Um arquivo com 5 statements que falha no terceiro deixa o banco pela metade. Esse comentário é ativamente perigoso porque induz falsa confiança.
4. **Sem rollback.** Não há `*.down.sql`. A recuperação de uma migration ruim é escrever SQL manual sob pressão.
5. **Drift indetectável.** Sem `supabase db diff`, não há como saber se alguém aplicou um hotfix pelo SQL Editor do dashboard — e, sabendo que o fluxo é manual, isso é provável.

**Correção:** ver §5.2 (processo mínimo confiável com `supabase db push` + detecção de drift em CI).

---

### 🔴 F-06 — Nenhum backup, nenhum plano de recuperação, doc fantasma no README

**Evidência:**
- `README.md` promete: `` `runbook.md` — troubleshooting e restart `` e `` `backup-restore.md` — backup e recuperação ``.
- `find docs -type f` → **nenhum dos dois arquivos existe**. São links quebrados para procedimentos inexistentes.
- Nenhum script de backup em `scripts/` (só `apply-migration`, `apply-migrations-staging`, `e2e-cleanup`, `setup-vercel-staging-env`, `test-webhook-uazapi`).
- `docs/MANUAL-PENDENCIAS.md` confirma: *"Backups automáticos — ⏳ Free plan. Free plan Supabase só tem backups manuais."*

**Consequência:** hoje, se o banco de produção for corrompido ou uma migration destrutiva rodar, **o dado se perde**. Não há RPO nem RTO — não há nem um backup a partir do qual medir. O bucket `documents` do Storage (comprovantes de pagamento — provavelmente o ativo de maior valor legal do sistema) não tem nenhuma cópia.

**Correção:** procedimento completo em §5.3. Prioridade máxima: **rodar o `pg_dump` da §5.3 hoje**, antes de qualquer outra coisa desta auditoria.

---

### 🔴 F-07 — ~40.500 arquivos estranhos no working tree

**Evidência:**
```
$ find "Cavalcanti enegenharia" -type f | wc -l   → 19668
$ find __MACOSX -type f | wc -l                   → 20870
$ ls -la crm-cavalcanti-logado.png                → 60057 bytes

$ git check-ignore <path>
crm-cavalcanti-logado.png       NOT-IGNORED
__MACOSX                        NOT-IGNORED
Cavalcanti enegenharia          NOT-IGNORED
apps/web/e2e-report             IGNORED   ✓
.playwright-mcp                 IGNORED   ✓
.env.local                      IGNORED   ✓
.vercel                         IGNORED   ✓
```

`Cavalcanti enegenharia/` é um **app Vite/React independente** (`vite.config.js`, `router.jsx`, `package-lock.json`, `dist/` buildado) — não faz parte do monorepo pnpm, não está em `pnpm-workspace.yaml`, e mesmo assim é varrido pelo Biome (é a origem de 99 dos 432 erros de lint). `__MACOSX/` é lixo de descompactação de zip do macOS, com 20.870 arquivos.

**Consequência:** três danos concretos. (a) Um `git add -A` distraído commita 40k arquivos, incluindo `node_modules` de terceiros e um `dist/` de build. (b) O `pnpm lint` está permanentemente vermelho por causa de código que não é do projeto — o que treina a equipe a ignorar o linter. (c) `crm-cavalcanti-logado.png` é, pelo nome, um screenshot da aplicação **com sessão autenticada** — pode conter dados reais de cliente e, dependendo do enquadramento, tokens visíveis na UI. O repositório é **público** (`NogmaBR/CRM-CAVALCANTI`, confirmado em `MANUAL-PENDENCIAS.md`).

**Correção:** `.gitignore` corrigido em §5.5. `Cavalcanti enegenharia/` e `__MACOSX/` devem sair do diretório (mover para fora do repo, ou o Vite virar `apps/legacy-vite` de verdade — mas não ficar no limbo). O PNG deve ser **inspecionado antes de qualquer coisa** e, se contiver dado de cliente, apagado do disco, não apenas ignorado.

---

### 🔴 F-08 — Observabilidade zero: sem health check, sem log, sem alerta

**Evidência:**
```
$ grep -rl "health" apps/web/app        → (nenhum resultado)
$ grep -rc "console.error|console.log|console.warn" apps/web/app apps/web/lib | grep -v ":0"
apps/web/lib/data/usuarios.ts:1
```

**Um único** `console.*` em toda a aplicação. Nenhum endpoint de health. Nenhum Sentry, nenhum logger estruturado, nenhum alerta.

**Consequência:** o cron `sweep-pending-documentos` roda 1×/dia às 03:00 UTC. Se ele passar a falhar — token errado, RLS mudou, Supabase fora — **ninguém fica sabendo**. Órfãos acumulam silenciosamente. Da mesma forma, um 500 em `/api/exports` só chega ao time se o usuário reclamar por WhatsApp. Sem log estruturado, o debug pós-incidente é impossível: o painel da Vercel mostrará uma stack trace sem `request_id`, sem `user_id`, sem contexto.

**Correção:** health check + logger + alertas custo-zero em §5.4.

---

### 🟡 F-09 — Lint quebrado torna o gate inexequível

**Evidência:** §2.2. 333 erros dentro do próprio `apps/web`, sendo 130 puramente de formatação.

**Consequência:** não dá para adicionar `pnpm lint` ao CI hoje — ele reprovaria 100% dos PRs. E um gate que sempre falha é um gate que será desligado.

**Correção, em ordem:**
```bash
# 1. Excluir código alheio (ver .gitignore em §5.5) — mata 99 erros
# 2. Formatação automática — mata ~130
pnpm format
# 3. Fixes seguros do linter
pnpm exec biome check --fix apps/web packages scripts
# 4. Revisar À MÃO os 26 de a11y + useJsxKeyInIterable + noArrayIndexKey (são bugs reais)
# 5. SÓ ENTÃO adicionar `pnpm lint` como required check
```
Os 44 `noNonNullAssertion` já estão configurados como `warn` em `biome.json` e não bloqueiam.

---

### 🟡 F-10 — Divergências entre env vars usadas e documentadas

Cruzamento de `grep -rhoE "process\.env\.[A-Z][A-Z0-9_]+"` sobre `apps/web/app`, `apps/web/lib`, `apps/web/components`, `middleware.ts`, `e2e/`, `playwright.config.ts` e `scripts/` contra os `.env*.example`:

| Variável | Usada no código | `.env.example` | `.env.staging.example` | Situação |
|---|:--:|:--:|:--:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 15× | ✅ | ✅ | ok |
| `SUPABASE_SERVICE_ROLE_KEY` | 12× | ✅ | ✅ | ok |
| `NEXT_PUBLIC_APP_URL` | 4× | ✅ | ❌ | ok (só prod) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 3× | ✅ | ✅ | ok |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | 3× | ✅ | ❌ | ok |
| `WEBHOOK_HMAC_SECRET` | 2× | ✅ | ❌ | ok |
| `CRON_SECRET` | 1× | ✅ | ❌ | ok |
| `RESEND_API_KEY` / `EMAIL_PROVIDER` / `EMAIL_FROM` | 1× cada | ✅ | ❌ | ok |
| `IA_PROVIDER` | 1× | ✅ | ❌ | ok |
| **`SUPABASE_PROJECT_REF`** | 1× (`scripts/apply-migration.mjs`) | ❌ **AUSENTE** | ❌ | 🔴 **usada e não documentada** |
| **`ANTHROPIC_API_KEY`** | **0×** | ✅ | ❌ | 🟡 documentada e não usada |
| `STAGING_SUPABASE_*` (5 vars) | sim (scripts) | ❌ | ✅ | ok (arquivo separado) |
| `AUTH_TEST_EMAIL` / `_PASSWORD` | 2× cada | ✅ | ✅ | ok |
| `VERCEL_TOKEN` / `_PROJECT_ID` / `_TEAM_ID` | 1× cada | ✅ | ❌ | ok |
| `PLAYWRIGHT_*` (3 vars) | sim | ✅ | parcial | ok |

**Achados:**
- 🔴 **`SUPABASE_PROJECT_REF` está ausente de `.env.example`.** É a var que aponta o `apply-migration.mjs` para **produção**. Um operador que só leia o `.env.example` não sabe que ela existe — e o script falha com mensagem de erro em vez de silenciosamente destruir algo, o que é uma sorte, não um design.
- 🟡 `ANTHROPIC_API_KEY` documentada mas sem nenhuma referência no código (o classifier Anthropic ainda não foi escrito, confirmado em `MANUAL-PENDENCIAS.md`). Manter, mas marcar como *não implementado ainda*.
- ℹ️ `.env.local` tem 35 chaves — 17 a mais que o app precisa (`SUPABASE_DB_*`, `SUPABASE_JWT_SECRET`, `SUPABASE_MCP_TOKEN`, `OPENAI_API_KEY`, `VERCEL_TEAM_SLUG`...). São credenciais de ferramentaria pessoal misturadas com env de app. Funciona, mas amplia a superfície: um `.env.local` vazado entrega **também** o Personal Access Token do Supabase e o token da Vercel.
- ⚠️ `.env.local` traz `OPENAI_API_KEY` enquanto o `.env.example` documenta `ANTHROPIC_API_KEY` e `IA_PROVIDER=mock|anthropic`. Decidir o provider e alinhar.

**Correção:** acrescentar ao `.env.example`:
```bash
# -----------------------------------------------------------------------------
# MIGRATIONS — ref do projeto Supabase alvo dos scripts/apply-migration.mjs
# ⚠️ Sem --staging, este ref é PRODUÇÃO. Confira antes de rodar.
# -----------------------------------------------------------------------------
SUPABASE_PROJECT_REF=bbtejxugeeccywwhfpoc
```

---

### 🟡 F-11 — Staging não existe; a suíte E2E não tem onde rodar

**Evidência:** `docs/operacao/fase-15-staging.md` — *"Estado: infra shipada, aguarda 1 passo manual do humano (criação do projeto Supabase staging)"*, bloqueado por `403 Forbidden` no PAT. `docs/MANUAL-PENDENCIAS.md` confirma: *"Staging Supabase — ⏳ Scripts prontos"*.

**Consequência:** o workflow `e2e.yml` aponta para 6 secrets `STAGING_*` que não existem. Mesmo que o CI fosse commitado (F-01), o job falharia. E, sem staging, **migrations são testadas direto em produção** — que é exatamente o que torna o F-05 perigoso em vez de apenas feio.

**Correção:** os 10 minutos de dashboard descritos em `fase-15-staging.md` são, provavelmente, os 10 minutos de maior retorno de todo este relatório. Eles destravam F-01, F-05 e F-11 de uma vez.

---

### 🟡 F-12 — Qualidade do workflow E2E existente (revisão do arquivo local)

Revisando `.github/workflows/e2e.yml` como se fosse ser commitado amanhã:

**Bom:** cache de pnpm via `setup-node`, cache de browsers Playwright com chave em `pnpm-lock.yaml`, cleanup com `if: always()`, upload de artefatos só em falha com retenção curta, comentário no PR, `timeout-minutes` por step e por job. É um workflow bem pensado.

**Problemas:**

| # | Problema | Impacto |
|---|---|---|
| a | **Todas as actions em tag mutável** (`actions/checkout@v4`, `pnpm/action-setup@v3`, `setup-node@v4`, `cache@v4`, `upload-artifact@v4`, `github-script@v7`) | Supply chain: `v4` é uma tag que o mantenedor pode reapontar. Foi exatamente o vetor do incidente `tj-actions/changed-files` (mar/2025). Pinar por SHA. |
| b | **`patrickedqvist/wait-for-vercel-preview@v1.3.1`** — action de terceiro, autor individual, com acesso a `GITHUB_TOKEN` e `VERCEL_TOKEN` | Risco elevado. O próprio comentário no arquivo prevê a deprecação e traz um fallback em `curl`. **Usar o fallback**: menos uma dependência de terceiro no caminho dos secrets. |
| c | **`pnpm/action-setup@v3` com `version: "11"`** enquanto `packageManager` fixa `pnpm@11.7.0` | Duas fontes de verdade. Remover o `version:` e deixar a action ler o `packageManager` (comportamento padrão da v4). |
| d | **Único gatilho é `pull_request`** — nada roda em push para `main` | Um merge com conflito semântico não é detectado. |
| e | **Só E2E.** Faltam lint, typecheck, build, unit, `pnpm audit`, verificação de migrations | O pipeline não pega nada que não seja um bug de fluxo de UI. |
| f | Injeção de `${{ inputs.base_url }}` direto no `run:` do step "Resolve base URL" | Script injection em `workflow_dispatch`. Baixo risco (só quem já tem write dispara), mas é a correção de uma linha: passar via `env:` e usar `$BASE_URL`. |

---

### 🟡 F-13 — DX: README desatualizado, sem seed, sem scripts de bootstrap

**Evidência — o README aponta para 3 coisas que não existem:**
```
docs/operacao/runbook.md         → não existe
docs/operacao/backup-restore.md  → não existe
apps/web/.env.example            → não existe (o arquivo está na RAIZ)
infra/docker/                    → não existe (citado na árvore de "Estrutura")
```
Além disso diz *"apps/web/ # Next.js 15"* quando o `package.json` traz `next@16.3.4`.

**Seed:** `supabase/seed.sql` tem **440 bytes** — só 8 categorias:
```sql
INSERT INTO categorias (nome, cor, icone) VALUES
  ('Material', '#E8A317', 'package'), ... ('Outros', '#6B7280', 'more-horizontal')
ON CONFLICT (nome) DO NOTHING;
```
Zero obras, zero fornecedores, zero pagamentos, zero documentos.

**Scripts ausentes:** não há `db:reset`, `db:seed`, `dev:setup`. O `package.json` root tem `db:types`, mas ele depende de `supabase gen types --linked`, ou seja, de um `supabase link` prévio que o README não menciona.

**Consequência — tempo real para um dev novo ficar produtivo:** `pnpm install` (7s) → `cp apps/web/.env.example` **falha, arquivo não existe** → procurar → achar na raiz → preencher 10 chaves Supabase que exigem acesso ao dashboard de produção (ninguém dá isso a um dev novo no dia 1) → `pnpm dev` sobe → **login impossível** porque `disable_signup=true` no Supabase e não há usuário local → precisa que um admin o convide **em produção**. Estimativa realista: **meio dia, e depende de outra pessoa**. Com seed + staging: **15 minutos, sozinho**.

**Correção:** README corrigido + esboço de seed em §5.6.

---

### 🟢 F-14 — Higiene de dependências (não urgente, mas endereçar)

| Pacote | Situação | Recomendação |
|---|---|---|
| `tailwindcss` / `@tailwindcss/postcss` | specifier `^4.0.0-alpha.36` → resolve 4.3.3 estável | **Agora:** trocar specifier para `^4.3.3`. Zero risco funcional. |
| `@react-email/components@1.0.12` | **Deprecated** pelo upstream | **Investigar já:** deprecated não recebe patch de segurança. Migrar ou fixar deliberadamente. |
| `@supabase/supabase-js` 2.115→2.116, `@supabase/ssr` 0.12.6→0.12.7 | patch | **Agora.** Risco nulo. |
| `@biomejs/biome` 1.9.4 → 2.5.12 | major, muda regras | **Depois de F-09.** Subir com o lint vermelho é caos sobre caos. |
| `zod` 3.25.76 → 4.5.4 | major, API mudou | **Esperar.** Zod 3 está saudável. Migrar exige revisar todo `lib/schemas/`. Fora do caminho crítico. |
| `@tanstack/react-table` 8→9 | major | **Esperar.** |
| `sonner` 1.7.4 → 2.0.8 | major | **Esperar.** |
| `lucide-react` 0.462 → 1.43 | major (0.x→1.x) | **Esperar**, mas 0.462 é de nov/2024 — agendar. |
| `typescript` 5.9.3 → 7.0.2 | major | **Esperar.** Next 16 + TS 7 precisa de validação dedicada. |
| `@types/node` 22 → 26 | alinhar ao runtime | Vercel roda Node 22 hoje → **manter em 22**. `outdated` está errado aqui. |
| `motion@13.2.0` | não aparece no `outdated` | Está atualizado. Sem achado. |
| `next@16.3.4` / `react@19.2.8` | não aparecem no `outdated` | Atualizados. Sem achado. |
| **PRs Dependabot abertos** | `dependabot/npm_and_yarn/next-15.5.21` e `.../apps/web/next-15.5.21` | 🔴 **Fechar os dois.** Propõem *downgrade* para Next 15 num repo que já está no 16. Merge acidental = build quebrado. |

`pnpm audit`: **0 vulnerabilidades**. `engines.pnpm: ">=9"` deveria ser `">=11"` para casar com `packageManager: pnpm@11.7.0`.

---

## 4. Riscos que não são findings, mas merecem registro

- **`middleware.ts` roda em toda requisição** e chama `updateSession` (que valida sessão no Supabase). Combinado com F-03, isso é ida-e-volta `iad1`↔`sa-east-1` **antes** de cada página. Corrigir a região reduz a latência percebida do app inteiro, não só das queries de dados.
- **Cron 1×/dia (limite Hobby).** O próprio código comenta: *"limite Hobby Vercel: 1x/dia; upgrade Pro pra rodar a cada 15 min"*. Órfãos com `storage_path='pending'` ficam visíveis até 24h.
- **`supabase/config.toml` fixa `major_version = 17`** — casa com o Postgres 17.6 de prod. ✅
- **`supabase/.temp/` está no disco** mas corretamente ignorado. ✅

---

## 5. Entregáveis prontos pra colar

### 5.1 GitHub Actions — pipeline recomendado

Dois arquivos. O primeiro é o gate obrigatório e roda sempre; o segundo é o E2E existente, corrigido.

#### `.github/workflows/ci.yml` — gate de qualidade (NOVO)

```yaml
# ============================================================
# CI — gate obrigatório de qualidade
# Roda em todo PR e em todo push pra main.
# Marcar os jobs `quality` e `security` como required status
# checks em Settings → Branches → main.
#
# Actions pinadas por SHA (supply chain). Para atualizar:
#   gh api repos/actions/checkout/git/refs/tags/v4 --jq .object.sha
# ============================================================
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  quality:
    name: Lint · Typecheck · Test · Build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - name: Setup pnpm
        # Sem `version:` — a action lê `packageManager` do package.json
        uses: pnpm/action-setup@fe02b34f77f8bc703788d5817da081398fad5dd2 # v4.0.0

      - name: Setup Node.js
        uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
        with:
          node-version: '20'
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # ---- gates em ordem crescente de custo ----
      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm -r typecheck

      - name: Unit tests
        run: pnpm -r test

      - name: Build
        run: pnpm --filter web build
        env:
          # Build do Next só precisa das públicas; usa placeholders
          # pra não exigir secret real num PR de fork.
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
          NEXT_PUBLIC_APP_URL: https://crm-cavalcanti.vercel.app

  security:
    name: Audit · Segredos
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@fe02b34f77f8bc703788d5817da081398fad5dd2 # v4.0.0

      - name: Setup Node.js
        uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
        with:
          node-version: '20'
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: pnpm audit (falha em high/critical)
        run: pnpm audit --audit-level high

      - name: Gitleaks — varre segredos no diff
        uses: gitleaks/gitleaks-action@83373cf2f8c4db6e24b41c1a9b086bb9619e9cd3 # v2.3.7
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  migrations:
    name: Migrations · lint e drift
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@8a1c4a2b9d1c2f4d6f4e4d6d8b8f6c5a4e3d2c1b # v1.4.0
        with:
          version: latest

      # 1. Toda migration precisa aplicar limpa num Postgres zerado.
      #    Pega ordem quebrada, sintaxe inválida e dependência faltando
      #    ANTES de tocar em produção.
      - name: Aplicar migrations num Postgres limpo
        run: |
          supabase start --exclude studio,realtime,storage-api,imgproxy,inbucket
          supabase db reset --no-seed
          echo "✓ Todas as migrations aplicam limpo do zero"

      # 2. Nomes precisam ser <timestamp>_<slug>.sql — ordem é por nome.
      - name: Validar nomenclatura das migrations
        run: |
          fail=0
          for f in supabase/migrations/*.sql; do
            base=$(basename "$f")
            if ! echo "$base" | grep -qE '^[0-9]{14}_[a-z0-9_]+\.sql$'; then
              echo "::error file=$f::nome inválido — use <YYYYMMDDHHMMSS>_<slug_snake>.sql"
              fail=1
            fi
          done
          exit $fail

      # 3. Drift: o schema de STAGING bate com as migrations do repo?
      #    Só roda em push pra main (precisa dos secrets).
      - name: Detectar drift em staging
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.STAGING_SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.STAGING_SUPABASE_DB_PASSWORD }}
        run: |
          supabase link --project-ref "${{ secrets.STAGING_SUPABASE_PROJECT_REF }}"
          DIFF=$(supabase db diff --linked --schema public)
          if [ -n "$DIFF" ]; then
            echo "::warning::DRIFT detectado entre migrations e staging:"
            echo "$DIFF"
          else
            echo "✓ Sem drift"
          fi
```

> **Pinagem por SHA:** os SHAs de `checkout`, `setup-node` e `pnpm/action-setup` acima são reais e correspondem às versões comentadas. **Os de `gitleaks-action` e `supabase/setup-cli` são placeholders** — resolva antes de usar:
> ```bash
> gh api repos/gitleaks/gitleaks-action/git/refs/tags/v2 --jq .object.sha
> gh api repos/supabase/setup-cli/git/refs/tags/v1     --jq .object.sha
> ```
> Depois de commitar, ative o Dependabot para `github-actions` (`.github/dependabot.yml` com `package-ecosystem: "github-actions"`) — ele atualiza os SHAs por PR, o que dá pinagem **e** manutenção.

#### `.github/workflows/e2e.yml` — correções pontuais no existente

Manter a estrutura atual (que é boa) e aplicar 4 patches:

```yaml
# PATCH 1 — adicionar no topo, depois de `name:`
concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write   # necessário pro step 12 (comentário no PR)

# PATCH 2 — pinar TODAS as actions por SHA (mesmos SHAs do ci.yml):
#   actions/checkout@v4       → @11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
#   pnpm/action-setup@v3      → @fe02b34f77f8bc703788d5817da081398fad5dd2 # v4.0.0  (e remover `with: version: "11"`)
#   actions/setup-node@v4     → @39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
#   actions/cache@v4          → resolver via gh api
#   actions/upload-artifact@v4→ resolver via gh api
#   actions/github-script@v7  → resolver via gh api

# PATCH 3 — trocar a action de terceiro `patrickedqvist/wait-for-vercel-preview@v1.3.1`
# pelo fallback em curl que o próprio arquivo já documenta (menos uma
# dependência externa com acesso a VERCEL_TOKEN e GITHUB_TOKEN):
      - name: Wait for Vercel Preview
        id: wait-for-preview
        if: github.event_name != 'workflow_dispatch' || inputs.base_url == ''
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}
          COMMIT_SHA: ${{ github.event.pull_request.head.sha || github.sha }}
        run: |
          for i in $(seq 1 20); do
            URL=$(curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" \
              "https://api.vercel.com/v6/deployments?limit=1&teamId=$VERCEL_TEAM_ID&meta-githubCommitSha=$COMMIT_SHA" \
              | jq -r '.deployments[0] | select(.state=="READY") | .url // empty')
            if [ -n "$URL" ]; then
              echo "url=https://$URL" >> "$GITHUB_OUTPUT"
              echo "✓ Preview pronto: https://$URL"
              exit 0
            fi
            echo "Aguardando Vercel... tentativa $i/20"
            sleep 30
          done
          echo "::error::Vercel preview não ficou READY em 10 min"
          exit 1

# PATCH 4 — eliminar script injection no step "Resolve base URL":
      - name: Resolve base URL
        id: base-url
        env:
          MANUAL_URL: ${{ inputs.base_url }}
          PREVIEW_URL: ${{ steps.wait-for-preview.outputs.url }}
        run: |
          if [ -n "$MANUAL_URL" ]; then
            echo "url=$MANUAL_URL" >> "$GITHUB_OUTPUT"
          else
            echo "url=$PREVIEW_URL" >> "$GITHUB_OUTPUT"
          fi
```

**Required status checks a marcar em Settings → Branches → main:**
`Lint · Typecheck · Test · Build`, `Audit · Segredos`, `Migrations · lint e drift`.
(O E2E fica opcional até staging existir; promover a required depois.)

---

### 5.2 Migrations — processo mínimo confiável

**Alvo:** migrations versionadas, aplicadas na ordem, registradas, testadas em staging antes de prod, com drift detectável.

#### Migrar para o fluxo padrão do Supabase CLI (uma vez)

```bash
# 1. Linkar o projeto de PRODUÇÃO (leitura, ainda não escreve nada)
supabase link --project-ref bbtejxugeeccywwhfpoc

# 2. O banco de prod já tem as 18 migrations aplicadas na mão e
#    NÃO tem a tabela de controle. Registrar as existentes como
#    "já aplicadas" sem re-executar (é o ponto crítico da migração):
supabase migration repair --status applied \
  20260903100000 20260903100100 20260903100200 20260903100300 \
  20260903100400 20260903100500 20260905120000 20260906120000 \
  20260906130000 20260907120000 20260907140000 20260907150000 \
  20260907160000 20260907170000 20260907180000 20260907190000 \
  20260908100000 20260908110000 20260908120000

# 3. Conferir que local e remoto convergem
supabase migration list --linked
#    Esperado: toda linha com Local e Remote preenchidos.

# 4. Confirmar que não há drift (schema real == migrations)
supabase db diff --linked --schema public
#    Saída VAZIA = repo e prod estão sincronizados.
#    Saída NÃO-VAZIA = alguém mexeu pelo dashboard; capturar antes de seguir:
#      supabase db diff --linked --schema public \
#        -f 20260909120000_captura_drift_manual
```

#### Fluxo diário a partir daí

```bash
# Criar migration nova (gera o arquivo com timestamp correto)
supabase migration new adiciona_indice_pagamentos_obra

# Testar localmente do zero — pega ordem quebrada e SQL inválido
supabase db reset

# Aplicar em STAGING primeiro. Sempre.
supabase link --project-ref $STAGING_SUPABASE_PROJECT_REF
supabase db push

# Só depois, produção — e só a partir de main, depois do CI verde
supabase link --project-ref bbtejxugeeccywwhfpoc
supabase db push --dry-run   # mostra o que VAI rodar
supabase db push
```

#### O que ganha em relação ao `apply-migration.mjs`

| Aspecto | Script `.mjs` hoje | `supabase db push` |
|---|---|---|
| Registro do aplicado | ❌ nenhum | ✅ `supabase_migrations.schema_migrations` |
| Ordem garantida | ⚠️ só se o operador acertar o nome | ✅ ordena e pula o já aplicado |
| Transação | ❌ **nenhuma** (apesar do comentário afirmar que sim) | ✅ por migration |
| Idempotência | ⚠️ por arquivo | ✅ pelo registro |
| Dry-run | ❌ | ✅ `--dry-run` |
| Detecção de drift | ❌ impossível | ✅ `supabase db diff` |
| Aplicar em prod por engano | 🔴 default é PROD | 🟡 exige `link` explícito |

#### Manter o `.mjs` como quebra-galho, com uma trava

Se o script continuar existindo, adicione confirmação explícita quando o alvo for produção (não estou aplicando esta mudança — é recomendação):

```js
// scripts/apply-migration.mjs — inserir antes do fetch
if (!useStaging && process.env.I_KNOW_THIS_IS_PROD !== 'yes') {
  console.error('✋ Alvo é PRODUÇÃO (ref=%s).', ref);
  console.error('   Prefira: supabase link --project-ref %s && supabase db push', ref);
  console.error('   Para forçar mesmo assim: I_KNOW_THIS_IS_PROD=yes node scripts/apply-migration.mjs ...');
  process.exit(1);
}
```
E **corrigir o comentário mentiroso** de `apply-migrations-staging.mjs` que promete BEGIN/END inexistente — ou implementar o wrap de verdade:
```js
body: JSON.stringify({ query: `BEGIN;\n${sql}\nCOMMIT;` }),
```

#### Rollback

Adotar a convenção `supabase/migrations/<timestamp>_<slug>.down.sql` para toda migration destrutiva (DROP, ALTER que perde dado, RENAME). Não é automático no CLI, mas dá ao operador um SQL pronto às 3h da manhã em vez de improviso.

---

### 5.3 Backup e restore — procedimento mínimo

> **Contexto:** Supabase Free não tem backup automático. Enquanto o plano não subir para Pro (backup diário + PITR de 7 dias, US$25/mês), **o backup é manual e responsabilidade do operador**.

#### Pré-requisitos

```bash
# psql/pg_dump 17 (precisa casar com o major_version do supabase/config.toml)
# Windows:  winget install PostgreSQL.PostgreSQL.17
# macOS:    brew install postgresql@17

# Connection string: Dashboard → Project Settings → Database → Connection string → URI
export PGURI="postgresql://postgres.bbtejxugeeccywwhfpoc:<DB_PASSWORD>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

#### `scripts/backup.sh` — backup completo (rodar semanalmente, no mínimo)

```bash
#!/usr/bin/env bash
# Backup completo do CRM: schema + dados + Storage.
# Uso:  PGURI=... SUPABASE_SERVICE_ROLE_KEY=... ./scripts/backup.sh
set -euo pipefail

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="${BACKUP_DIR:-./backups}/$STAMP"
mkdir -p "$DEST"

echo "→ Backup em $DEST"

# 1. SCHEMA (DDL puro) — restaura estrutura sem dado
pg_dump "$PGURI" --schema-only --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  -f "$DEST/schema.sql"

# 2. DADOS (formato custom, comprimido, restore seletivo por tabela)
pg_dump "$PGURI" --data-only --no-owner --no-privileges \
  --schema=public --schema=auth \
  -Fc -f "$DEST/data.dump"

# 3. ROLES E GRANTS — RLS depende disso; um restore sem eles deixa o app sem acesso
pg_dumpall "$PGURI" --roles-only -f "$DEST/roles.sql" 2>/dev/null || \
  echo "  (aviso: pg_dumpall roles indisponível no Free tier — RLS/grants vêm nas migrations)"

# 4. STORAGE — bucket `documents` (comprovantes: o ativo de maior valor legal)
mkdir -p "$DEST/storage"
node - <<'NODE'
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const dest = process.env.DEST + '/storage';
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function walk(prefix = '') {
  const { data, error } = await sb.storage.from('documents').list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) { await walk(path); continue; }   // é pasta
    const { data: blob, error: dErr } = await sb.storage.from('documents').download(path);
    if (dErr) { console.error(`  ✗ ${path}: ${dErr.message}`); continue; }
    const out = join(dest, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
    console.log(`  ✓ ${path}`);
  }
}
await walk();
NODE

# 5. Checksums — detecta corrupção silenciosa do próprio backup
( cd "$DEST" && find . -type f ! -name SHA256SUMS -exec sha256sum {} + > SHA256SUMS )

# 6. Compactar
tar -czf "$DEST.tar.gz" -C "$(dirname "$DEST")" "$STAMP" && rm -rf "$DEST"

echo "✓ $DEST.tar.gz ($(du -h "$DEST.tar.gz" | cut -f1))"
echo "→ Copie para armazenamento OFF-SITE (Drive/S3/B2). Backup no mesmo laptop não é backup."
```

#### Restore

```bash
# --- CENÁRIO A: restore total num projeto NOVO (banco perdido) ---
# 1. Criar projeto Supabase novo, mesma região sa-east-1, Postgres 17
# 2. Reconstruir estrutura pelas MIGRATIONS (preferível ao schema.sql —
#    garante que repo e banco nascem sincronizados):
supabase link --project-ref <NOVO_REF>
supabase db push

# 3. Restaurar dados
tar -xzf backups/20260909T120000Z.tar.gz -C /tmp
pg_restore --data-only --no-owner --no-privileges \
  --disable-triggers \
  -d "$PGURI_NOVO" /tmp/20260909T120000Z/data.dump

# 4. Restaurar Storage
#    (upload recursivo de /tmp/<stamp>/storage/** para o bucket `documents`)

# 5. Repontar as env vars da Vercel para o novo ref e redeploy
#    (Dashboard → Settings → Environment Variables)

# --- CENÁRIO B: restaurar UMA tabela (dado apagado por engano) ---
pg_restore --data-only --table=pagamentos --disable-triggers \
  -d "$PGURI" /tmp/<stamp>/data.dump

# --- CENÁRIO C: inspecionar o backup antes de restaurar ---
pg_restore --list /tmp/<stamp>/data.dump | head -50
```

#### Testar o restore — inegociável

> **Um backup nunca testado não é um backup.** Uma vez por trimestre: restaure o dump mais recente num Postgres local (`supabase start` + `pg_restore`), suba o app apontando para ele e faça login. Anote o tempo — esse é o seu RTO real.

#### Metas propostas

| Métrica | Hoje | Com este procedimento | Com Supabase Pro |
|---|---|---|---|
| **RPO** (dado perdido no pior caso) | ♾️ **tudo** | 7 dias (backup semanal) | 24 h, ou ~2 min com PITR |
| **RTO** (tempo até voltar) | ♾️ indefinido | ~2 h (manual) | ~30 min |

**Recomendação de negócio:** dado que este sistema guarda comprovantes de pagamento de obra — documento com valor contábil e potencialmente fiscal — **US$25/mês pelo Supabase Pro é seguro barato**. O mesmo upgrade resolve F-03 (região), F-04 (`maxDuration`) e o limite de 1 cron/dia.

---

### 5.4 Observabilidade mínima — custo zero

#### Health check — `apps/web/app/api/health/route.ts` (NOVO)

```ts
import 'server-only';
import { NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Database } from '@nogma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health check público e barato — alvo de uptime monitor externo
 * (UptimeRobot / BetterStack free tier, 5 min de intervalo).
 *
 * Contrato:
 *   200 {status:"ok"}        → app e banco respondendo
 *   503 {status:"degraded"}  → banco inacessível ou env faltando
 *
 * NÃO expõe versão, env var, nem detalhe de erro — só o suficiente
 * pra um monitor decidir se acorda alguém. Sem auth de propósito:
 * um health que exige segredo não pode ser monitorado de fora.
 */
export async function GET() {
  const started = Date.now();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { status: 'degraded', db: 'env-missing' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const supabase = createSbClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Query mais barata possível que ainda prova conectividade + RLS ativo.
    const { error } = await supabase
      .from('categorias')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (error) {
      console.error(JSON.stringify({
        level: 'error', event: 'health.db_error',
        code: error.code, message: error.message,
      }));
      return NextResponse.json(
        { status: 'degraded', db: 'error', latency_ms: Date.now() - started },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      {
        status: 'ok',
        db: 'ok',
        latency_ms: Date.now() - started,
        region: process.env.VERCEL_REGION ?? 'local',
        ts: new Date().toISOString(),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error(JSON.stringify({
      level: 'error', event: 'health.exception',
      message: e instanceof Error ? e.message : String(e),
    }));
    return NextResponse.json(
      { status: 'degraded', db: 'unreachable', latency_ms: Date.now() - started },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
```

> **Importante:** `middleware.ts` intercepta tudo que não seja asset. Adicionar `api/health` à exclusão do matcher para o health não gastar um round-trip de sessão a cada ping:
> ```ts
> '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/health|robots.txt|...).*)'
> ```

#### `latency_ms` como métrica de F-03

Depois de publicar o health, o campo `latency_ms` mede diretamente o custo da região errada. Antes de mover para `gru1`, espere ~120–200 ms. Depois, ~10–30 ms. **É a evidência mensurável que o finding F-03 pede** — e sai de graça.

#### Logger estruturado — `apps/web/lib/util/logger.ts` (NOVO)

```ts
import 'server-only';

/**
 * Logger estruturado JSON. A Vercel indexa JSON no log drain, então
 * cada campo vira filtrável — ao contrário de console.log("erro: " + e).
 *
 * Uso:
 *   log.error('export.pdf_failed', { tipo, obraId, err: e });
 *   log.info('cron.sweep_done', { deleted: 3 });
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const { err, ...rest } = fields;
  const line = {
    level,
    event,
    ts: new Date().toISOString(),
    env: process.env.VERCEL_ENV ?? 'local',
    region: process.env.VERCEL_REGION,
    ...rest,
    ...(err instanceof Error
      ? { error: err.message, stack: err.stack?.split('\n').slice(0, 5).join('\n') }
      : err !== undefined
        ? { error: String(err) }
        : {}),
  };
  const out = level === 'error' || level === 'warn' ? console.error : console.log;
  out(JSON.stringify(line));
}

export const log = {
  debug: (e: string, f?: Record<string, unknown>) => emit('debug', e, f),
  info:  (e: string, f?: Record<string, unknown>) => emit('info', e, f),
  warn:  (e: string, f?: Record<string, unknown>) => emit('warn', e, f),
  error: (e: string, f?: Record<string, unknown>) => emit('error', e, f),
};
```

**Onde instrumentar primeiro** (5 lugares, ~30 min de trabalho): `api/exports/[tipo]` (falha de PDF), `api/cron/sweep-pending-documentos` (sucesso **e** falha), `api/webhooks/uazapi` (HMAC inválido), `config/importar/actions.ts` (linhas rejeitadas), e o `catch` de toda server action que grava.

> ⚠️ Nunca logar `email`, CPF/CNPJ, valor de pagamento ou qualquer campo de `documentos`. Logue **IDs**, não conteúdo.

#### Alertas — três, todos free

| Alerta | Ferramenta | Setup |
|---|---|---|
| **App fora do ar / banco inacessível** | UptimeRobot (50 monitores free) ou BetterStack (10 free) | Monitor HTTP em `https://crm-cavalcanti.vercel.app/api/health`, 5 min, alerta se ≠ 200 ou se `latency > 3s`. Notificação por e-mail + WhatsApp. |
| **Cron falhou ou não rodou** | Healthchecks.io (20 checks free) | Criar check com *period* 1 dia e *grace* 2 h. No fim do handler do cron, após sucesso: `await fetch(process.env.HEALTHCHECK_CRON_URL!).catch(() => {})`. **Se o cron não rodar, o Healthchecks avisa por ausência de sinal** — que é justamente o caso que hoje passa despercebido. |
| **Pico de 5xx** | Vercel Log Drains + Observability (free tier) | Vercel → Observability → Alerts: "Error rate > 5% em 5 min". Alternativa mais rica: Sentry free (5k eventos/mês) via `@sentry/nextjs`. |

Adicionar `HEALTHCHECK_CRON_URL=` ao `.env.example` e à Vercel.

---

### 5.5 `.gitignore` corrigido

```gitignore
# Dependencies
node_modules/
.pnpm-store/
.pnpm-debug.log*

# Build outputs
.next/
out/
dist/
build/
*.tsbuildinfo

# Env
.env
.env.*
!.env.example
!.env.staging.example
.env.local
.env.*.local
.env.staging

# Editors
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/

# OS
.DS_Store
Thumbs.db
# Lixo de descompactação de zip do macOS (20.870 arquivos hoje no working tree)
__MACOSX/
._*

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Testing
coverage/
playwright-report/
test-results/
.playwright/
e2e-report/
e2e-results/
apps/web/e2e/.auth/
.playwright-mcp/

# Superpowers session
.superpowers/

# Claude Code local session state
.claude/

# Vercel link (projectId/orgId — não secret, mas project-specific)
.vercel/

# Supabase local
supabase/.branches/
supabase/.temp/

# Docker
infra/docker/.env

# ---------------------------------------------------------------------------
# ADIÇÕES DESTA AUDITORIA (finding F-07)
# ---------------------------------------------------------------------------

# Screenshots de sessão autenticada — podem conter dado real de cliente.
# Repositório é PÚBLICO. Nunca commitar.
*-logado.png
screenshots/
*.session.png

# App Vite legado, fora do monorepo pnpm. Ignorado aqui como rede de segurança,
# mas a solução correta é MOVER a pasta pra fora do repositório
# (ou promovê-la a apps/legacy-vite de verdade).
/Cavalcanti enegenharia/

# Backups locais do banco — contêm TODOS os dados de produção.
backups/
*.dump
*.sql.gz

# Artefatos de auditoria com output bruto de comando
.audit-tmp/
```

**Ações complementares (não são `.gitignore`):**

```bash
# 1. Inspecionar o screenshot ANTES de qualquer coisa
#    Se contiver dado de cliente ou token visível: apagar do disco.
#    Se não: mover pra docs/ com nome neutro.
start crm-cavalcanti-logado.png    # Windows

# 2. Tirar as pastas alheias do working tree
mv "Cavalcanti enegenharia" ../cavalcanti-vite-legado
rm -rf __MACOSX

# 3. Confirmar que o working tree ficou limpo
git status --porcelain    # esperado: apenas .github/ (que vai ser commitado)

# 4. Como o repo é PÚBLICO, confirmar que nada disso já vazou no histórico:
git log --all --oneline -- "crm-cavalcanti-logado.png" "__MACOSX" "Cavalcanti enegenharia"
#    (vazio = nunca foi commitado. Se retornar algo, é incidente:
#     rotacionar segredos e reescrever histórico com git-filter-repo.)
```

---

### 5.6 Seed de desenvolvimento e scripts de DX

#### `supabase/seed.sql` — expandido (esboço)

O seed atual tem 440 bytes e só cria categorias. Proposta — dados realistas, todos com prefixo `dev_` para nunca colidirem com produção nem com o prefixo `e2e_test_` do cleanup:

```sql
-- ===========================================================================
-- SEED DE DESENVOLVIMENTO — nunca rodar em produção.
-- Todo registro leva prefixo `dev_` no nome para identificação e limpeza.
-- Aplicado por `supabase db reset` (roda seed.sql automaticamente).
-- ===========================================================================

-- 1. CATEGORIAS (mantém as 8 atuais — são dados de referência, não de teste)
INSERT INTO categorias (nome, cor, icone) VALUES
  ('Material', '#E8A317', 'package'),
  ('Elétrica', '#3B82F6', 'zap'),
  ('Hidráulica', '#0EA5E9', 'droplet'),
  ('Limpeza', '#10B981', 'sparkles'),
  ('Entulho', '#78716C', 'trash-2'),
  ('Mão de obra', '#8B5CF6', 'users'),
  ('Equipamentos', '#EC4899', 'wrench'),
  ('Outros', '#6B7280', 'more-horizontal')
ON CONFLICT (nome) DO NOTHING;

-- 2. USUÁRIO ADMIN LOCAL
--    Resolve o bloqueio de onboarding: `disable_signup=true` no Supabase
--    impede o dev novo de criar conta. Aqui ele nasce pronto.
--    Senha: dev123456789 (só local — o banco local nunca é exposto)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'dev@localhost.test',
  crypt('dev123456789', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nome":"Dev Local"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, nome, email, papel)
VALUES ('00000000-0000-0000-0000-000000000001', 'Dev Local', 'dev@localhost.test', 'admin')
ON CONFLICT (id) DO NOTHING;

-- 3. OBRAS — três estados diferentes para exercitar filtros e o dashboard
INSERT INTO obras (id, nome, endereco, status, orcamento_previsto) VALUES
  ('10000000-0000-0000-0000-000000000001', 'dev_Residencial Aurora',  'Rua das Flores, 100 — Porto Alegre/RS', 'em_andamento', 850000.00),
  ('10000000-0000-0000-0000-000000000002', 'dev_Edifício Horizonte',  'Av. Ipiranga, 2200 — Porto Alegre/RS',  'em_andamento', 2400000.00),
  ('10000000-0000-0000-0000-000000000003', 'dev_Reforma Sede',        'Rua Sarmento Leite, 45 — Porto Alegre/RS', 'concluida', 120000.00)
ON CONFLICT (id) DO NOTHING;

-- 4. FORNECEDORES — inclui um par quase-duplicado de propósito,
--    pra exercitar a tela /fornecedores/duplicatas sem montar caso à mão.
INSERT INTO fornecedores (id, nome, documento, telefone) VALUES
  ('20000000-0000-0000-0000-000000000001', 'dev_Depósito Central Materiais', '11222333000144', '+5551999990001'),
  ('20000000-0000-0000-0000-000000000002', 'dev_Deposito Central Materiais LTDA', '11222333000144', '+5551999990001'),
  ('20000000-0000-0000-0000-000000000003', 'dev_Elétrica Silva & Filhos',   '55666777000188', '+5551999990003'),
  ('20000000-0000-0000-0000-000000000004', 'dev_Locadora Máquinas Sul',     '99888777000122', '+5551999990004')
ON CONFLICT (id) DO NOTHING;

-- 5. PAGAMENTOS — 24 registros nos últimos 6 meses, espalhados por
--    obra/fornecedor/categoria, com valores variados. Volume suficiente
--    pra os gráficos do /painel e os 4 relatórios de /api/exports
--    renderizarem algo reconhecível.
INSERT INTO pagamentos (obra_id, fornecedor_id, categoria_id, valor, descricao, data_pagamento, status)
SELECT
  (ARRAY['10000000-0000-0000-0000-000000000001',
         '10000000-0000-0000-0000-000000000002',
         '10000000-0000-0000-0000-000000000003']::uuid[])[1 + (i % 3)],
  (ARRAY['20000000-0000-0000-0000-000000000001',
         '20000000-0000-0000-0000-000000000003',
         '20000000-0000-0000-0000-000000000004']::uuid[])[1 + (i % 3)],
  (SELECT id FROM categorias ORDER BY nome LIMIT 1 OFFSET (i % 8)),
  round((random() * 18000 + 400)::numeric, 2),
  'dev_Pagamento de exemplo #' || i,
  (current_date - ((i * 7) || ' days')::interval)::date,
  CASE WHEN i % 5 = 0 THEN 'pendente' ELSE 'pago' END
FROM generate_series(1, 24) AS i;

-- 6. NOTIFICAÇÕES — 3 não lidas, pra o badge do sino não ficar vazio
INSERT INTO notificacoes (usuario_id, titulo, corpo, lida)
SELECT '00000000-0000-0000-0000-000000000001',
       'dev_Notificação de exemplo ' || i,
       'Corpo da notificação de desenvolvimento número ' || i,
       false
FROM generate_series(1, 3) AS i;
```

> ⚠️ Os nomes de coluna acima são inferidos das migrations e das rotas; **valide contra `packages/db/src/types.ts`** antes de usar. O valor aqui é a estrutura e o volume, não o SQL literal.

#### Scripts a adicionar no `package.json` da raiz

```jsonc
{
  "scripts": {
    // ... existentes ...

    // Sobe Postgres local, aplica TODAS as migrations do zero e roda o seed.
    // É o botão de "voltar ao estado limpo".
    "db:reset": "supabase db reset",

    // Só o seed, sem derrubar o banco (rápido, pra repovoar depois de testar).
    "db:seed": "supabase db reset --no-seed && psql \"$SUPABASE_DB_URL\" -f supabase/seed.sql",

    // Diff entre as migrations do repo e o banco linkado. Detecta drift (F-05).
    "db:diff": "supabase db diff --linked --schema public",

    // Estado das migrations local vs remoto.
    "db:status": "supabase migration list --linked",

    // ONE-LINER de onboarding: instala, sobe Supabase local, migra, semeia.
    // Meta: dev novo produtivo em <15 min, sem depender de ninguém.
    "dev:setup": "pnpm install && supabase start && supabase db reset && node scripts/dev-setup-env.mjs",

    // Verifica que .env.local tem todas as chaves do .env.example.
    "env:check": "node scripts/check-env.mjs"
  }
}
```

#### `scripts/check-env.mjs` (NOVO — evita "faltou uma var em prod")

```js
#!/usr/bin/env node
/**
 * Compara as chaves de .env.example com as de .env.local (ou --file <path>).
 * Falha se faltar alguma. Rodar em `dev:setup` e como step opcional do CI.
 */
import { readFileSync, existsSync } from 'node:fs';

const keys = (p) => existsSync(p)
  ? new Set(readFileSync(p, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => l.split('=')[0].trim()))
  : null;

const target = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : '.env.local';

const expected = keys('.env.example');
const actual = keys(target);

if (!expected) { console.error('✗ .env.example não encontrado'); process.exit(1); }
if (!actual)   { console.error(`✗ ${target} não encontrado — rode: cp .env.example ${target}`); process.exit(1); }

// Vars que só interessam a CI/E2E/scripts — não travam o dev local.
const OPCIONAIS = new Set([
  'AUTH_TEST_EMAIL', 'AUTH_TEST_PASSWORD', 'PLAYWRIGHT_BASE_URL',
  'PLAYWRIGHT_ENV', 'PLAYWRIGHT_ALLOW_HCAPTCHA',
  'VERCEL_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_TEAM_ID',
  'RESEND_API_KEY', 'ANTHROPIC_API_KEY', 'NEXT_PUBLIC_HCAPTCHA_SITE_KEY',
]);

const faltando = [...expected].filter((k) => !actual.has(k) && !OPCIONAIS.has(k));
const extras   = [...actual].filter((k) => !expected.has(k));

if (extras.length) {
  console.warn(`⚠ Em ${target} mas não documentadas em .env.example:`);
  for (const k of extras) console.warn(`   ${k}`);
}
if (faltando.length) {
  console.error(`✗ Faltando em ${target}:`);
  for (const k of faltando) console.error(`   ${k}`);
  process.exit(1);
}
console.log(`✓ ${target} tem todas as chaves obrigatórias de .env.example`);
```

#### Correções no `README.md`

```diff
- - Node ≥ 20 (usando v22.18)
- - pnpm ≥ 9 (usando v11.7)
+ - Node ≥ 20 (usando v22.18)
+ - pnpm 11.7.0 (fixado em `packageManager`; use `corepack enable`)

  ## Setup local
  ```bash
- pnpm install
- cp apps/web/.env.example .env.local
- # preencha as chaves Supabase seguindo docs/operacao/setup-supabase.md
- pnpm dev
+ corepack enable
+ pnpm dev:setup          # instala, sobe Supabase local, migra e semeia
+ pnpm dev
+ # Login local: dev@localhost.test / dev123456789
  ```
+ Setup manual (sem Docker), apontando pra Supabase remoto:
+ ```bash
+ pnpm install
+ cp .env.example .env.local   # o arquivo fica na RAIZ, não em apps/web/
+ pnpm env:check               # confere que não faltou chave
+ pnpm dev
+ ```

  ## Estrutura
- apps/web/            # Next.js 15 (frontend + API routes) — deploy Vercel
+ apps/web/            # Next.js 16 (frontend + API routes) — deploy Vercel
  packages/db/         # Tipos Postgres gerados
- infra/docker/        # docker-compose para VPS (Fase 10+)
  supabase/            # Migrations e seed
  docs/                # Specs, plans, operação

  ## Operação em produção
  - `setup-supabase.md` — provisionamento Supabase
  - `setup-vercel.md` — provisionamento Vercel
- - `runbook.md` — troubleshooting e restart de serviços
- - `backup-restore.md` — backup e recuperação
+ - `fase-15-staging.md` — provisionamento do ambiente de staging
+ - ⚠️ `runbook.md` e `backup-restore.md` ainda NÃO existem — ver
+   `docs/audit/2026-09-09-opus5/08-infra-deploy-ci.md` §5.3 pelo
+   procedimento de backup/restore enquanto não são escritos.
```

---

## 6. Tabela final priorizada

| # | Ação | Finding | Sev. | Esforço | Bloqueia | Ordem |
|---:|---|:---:|:---:|:---:|---|:---:|
| 1 | **Rodar o `pg_dump` da §5.3 hoje** e guardar off-site | F-06 | 🔴 | 30 min | — | **1º** |
| 2 | Inspecionar e remover `crm-cavalcanti-logado.png`; tirar `__MACOSX/` e `Cavalcanti enegenharia/` do working tree; aplicar `.gitignore` da §5.5 | F-07 | 🔴 | 20 min | #6 | **2º** |
| 3 | Criar o projeto Supabase **staging** (10 min de dashboard, passo a passo em `fase-15-staging.md`) | F-11 | 🔴 | 30 min | #4, #7, #8 | **3º** |
| 4 | **Commitar `.github/`** com PAT de escopo `workflow` (ou colar pela UI) + adicionar `ci.yml` da §5.1 | F-01 | 🔴 | 1 h | #6 | **4º** |
| 5 | Instalar `vitest` + `vitest.config.ts`; escrever os 3 primeiros testes (`lib/reports/csv.ts`, `lib/schemas/`) | F-02 | 🔴 | 2 h | #4 | **5º** |
| 6 | `pnpm format` + `biome check --fix`; corrigir à mão os 26 a11y; **só então** marcar `lint` como required check | F-09 | 🟡 | 3 h | #4 | **6º** |
| 7 | `supabase migration repair` + `db diff`; adotar `db push`; corrigir o comentário mentiroso sobre BEGIN/END; trava de prod no `.mjs` | F-05 | 🔴 | 2 h | — | **7º** |
| 8 | Adicionar `regions: ["gru1"]` + bloco `functions` com `maxDuration`/`memory` no `vercel.json` | F-03, F-04 | 🔴 | 15 min (+ upgrade Pro) | — | **8º** |
| 9 | Publicar `/api/health` + logger estruturado; ligar UptimeRobot e Healthchecks.io | F-08 | 🔴 | 2 h | — | **9º** |
| 10 | Adicionar `SUPABASE_PROJECT_REF` ao `.env.example`; marcar `ANTHROPIC_API_KEY` como não implementada; publicar `check-env.mjs` | F-10 | 🟡 | 30 min | — | 10º |
| 11 | Corrigir specifier do Tailwind (`^4.3.3`); subir patches Supabase; **fechar os 2 PRs Dependabot de downgrade do Next**; avaliar `@react-email/components` deprecated | F-14 | 🟡 | 1 h | — | 11º |
| 12 | Expandir `supabase/seed.sql`; adicionar `db:reset`/`db:seed`/`dev:setup`; corrigir os 4 links quebrados do README | F-13 | 🟡 | 3 h | — | 12º |
| 13 | Pinar as actions do `e2e.yml` por SHA; trocar a action de terceiro pelo fallback `curl`; corrigir o script injection | F-12 | 🟡 | 1 h | — | 13º |
| 14 | Avaliar **Supabase Pro (US$25/mês)** — resolve backup diário + PITR, e destrava região e `maxDuration` na Vercel Pro | F-03/04/06 | 🟡 | decisão | — | 14º |
| 15 | Escrever `docs/operacao/runbook.md` e `backup-restore.md` (o README já os promete) | F-06, F-13 | 🟢 | 2 h | — | 15º |
| 16 | Testar um restore de verdade num Postgres local e cronometrar o RTO | F-06 | 🟢 | 2 h | #1 | 16º |

**Caminho crítico até "operacionalmente pronto": itens 1 a 9 — cerca de 12 horas de trabalho.** Os itens 1 a 4 sozinhos (~2h30) já removem o risco de perda total de dados e ligam o primeiro portão de qualidade automatizado.

---

## 7. Comandos executados nesta auditoria

Para reprodução. Nenhum altera estado remoto.

```bash
pnpm install --frozen-lockfile      # ✅ exit 0 — 6,4s
pnpm lint                           # ❌ exit 1 — 432 erros / 44 warnings — 8,0s
pnpm exec biome check apps/web packages scripts   # ❌ 333 erros
pnpm typecheck                      # ✅ exit 0 — 28,0s
pnpm -r test                        # ❌ exit 1 — vitest não instalado — 5,7s
cd apps/web && pnpm build           # ✅ exit 0 — 62,9s — 46 rotas
pnpm outdated -r                    # exit 1 — 10 pacotes desatualizados
pnpm audit                          # ✅ exit 0 — 0 vulnerabilidades

git status --porcelain
git log --oneline -- .github        # vazio → CI nunca commitado
git check-ignore -q <paths>
git remote -v && git branch -a
grep -rhoE "process\.env\.[A-Z][A-Z0-9_]+" apps/web/{app,lib,components} apps/web/middleware.ts apps/web/e2e scripts
find "Cavalcanti enegenharia" -type f | wc -l   # 19668
find __MACOSX -type f | wc -l                   # 20870
grep -rc "console\.(error|log|warn)" apps/web/app apps/web/lib   # 1 ocorrência
```

---

*Auditoria de infraestrutura, deploy e CI/CD — 2026-09-09. Nenhum código-fonte foi alterado; nenhum commit foi criado; nenhum comando de escrita remota foi executado.*
