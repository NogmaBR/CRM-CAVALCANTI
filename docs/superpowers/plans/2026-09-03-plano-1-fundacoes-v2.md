# Plano #1 v2 — Fundações com Nogma DS integração direta

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` for tracking.

**Substitui:** `2026-09-03-plano-1-fundacoes.md` (v1). Motivo: usuário forneceu `Nogma Design System/` completo (tokens CSS + fontes + componentes JSX + UI kit NogmaOS + logos). Este plano usa esses assets como fonte canônica em vez de recriar via shadcn.

**Goal:** Aplicação Next.js 15 + Supabase + Vercel funcionando com login, layout global (Sidebar+TopBar do NogmaOS) e schema Postgres com RLS. Design 100% Nogma DS (tokens + componentes portados).

**Architecture:** Monorepo pnpm (apps/web, packages/db). Componentes Nogma DS portados de `.jsx` → `.tsx` em `apps/web/components/nogma/`, com CSS extraído para arquivos separados (SSR-safe). Chrome (Sidebar+TopBar) reproduz `Nogma Design System/ui_kits/nogmaos/Chrome.jsx`. Supabase gerenciado, deploy Vercel via Git.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Nogma Design System (fornecido), @supabase/ssr, lucide-react, pnpm workspaces, Biome, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md`
**Nogma DS:** `Nogma Design System/` (raiz do projeto — não editar; usar como fonte)
**Artefatos originais:** `ESTRUTURA DO PROJETO/` (informacoes.md, arquitetura.md, base-de-estrutura.md, fases-construcao.md, apresentacao-projeto-cavalcanti.pdf)

---

## Convenções

- **Working dir:** `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA` (`<root>`)
- **Shell:** PowerShell (comandos anotados quando bash-only)
- **Node** ≥ 20 (verificado: v22.18), **pnpm** ≥ 9 (v11.7), **git** (v2.50), **Docker** (v28.3) ✅
- Commit por task, Conventional Commits (`feat:`, `chore:`, `docs:`)
- **Nogma DS folder** (`Nogma Design System/`) é read-only — nunca editar; se precisar mudar, editar em `apps/web/` (a cópia adaptada)

---

## Fase 0 — Setup do repositório

### Task 0.1: Verificar estado inicial e mover artefatos legados

- [ ] **Step 1: Confirmar toolchain (já verificado)**

Nada a fazer — Node 22.18, pnpm 11.7, git 2.50, Docker 28.3 já confirmados pela controller antes de iniciar. Se subagente rodar isso e falhar, avise.

- [ ] **Step 2: Confirmar layout do repo**

```powershell
Get-ChildItem "C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA"
```

Expected: pastas `.design-system`, `.superpowers`, `docs`, `ESTRUTURA DO PROJETO`, `Nogma Design System`. Nenhum `.md` solto na raiz.

### Task 0.2: git init + .gitignore + .gitattributes

**Files:**
- Create `<root>/.gitignore`
- Create `<root>/.gitattributes`

- [ ] **Step 1: Init git**

```powershell
cd "C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA"
git init -b main
git config core.autocrlf false
git config core.eol lf
```

- [ ] **Step 2: `.gitignore`**

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
.env.local
.env.*.local
!.env.example

# Editors
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/

# OS
.DS_Store
Thumbs.db

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

# Superpowers session
.superpowers/

# Supabase local
supabase/.branches/
supabase/.temp/

# Docker
infra/docker/.env
```

- [ ] **Step 3: `.gitattributes`**

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.pdf binary
*.otf binary
*.ttf binary
*.woff binary
*.woff2 binary
```

- [ ] **Step 4: Commit inicial (só metadata + docs, ainda não add tudo)**

```powershell
git add .gitignore .gitattributes docs/
git commit -m "chore: initial repo scaffold with .gitignore and design spec"
```

- [ ] **Step 5: Segundo commit — Nogma DS + assets do design como source-of-truth de branding**

```powershell
git add ".design-system/" "Nogma Design System/" "ESTRUTURA DO PROJETO/"
git commit -m "chore: import Nogma Design System (tokens, components, ui_kits) + original artifacts"
```

### Task 0.3: Monorepo scaffold (pnpm workspaces)

**Files:**
- Create `<root>/package.json`
- Create `<root>/pnpm-workspace.yaml`
- Create `<root>/.npmrc`
- Create `<root>/tsconfig.base.json`
- Create `<root>/biome.json`
- Create `<root>/README.md`

- [ ] **Step 1: `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Root `package.json`**

```json
{
  "name": "crm-nogma",
  "private": true,
  "version": "0.0.1",
  "packageManager": "pnpm@11.7.0",
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm --filter web build",
    "start": "pnpm --filter web start",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter web test:e2e",
    "db:types": "pnpm --filter @nogma/db gen-types"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "typescript": "^5.6.3"
  },
  "engines": { "node": ">=20", "pnpm": ">=9" }
}
```

- [ ] **Step 3: `.npmrc`**

```
strict-peer-dependencies=false
auto-install-peers=true
shamefully-hoist=false
prefer-workspace-packages=true
```

- [ ] **Step 4: `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "allowJs": false,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 5: `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true, "ignore": [".next", "node_modules", "dist", "Nogma Design System"] },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "warn" },
      "style": { "noNonNullAssertion": "warn" }
    }
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "trailingCommas": "all", "semicolons": "always" }
  }
}
```

Nota: `Nogma Design System` está no ignore do Biome — não formatamos os assets da marca.

- [ ] **Step 6: `README.md`**

```markdown
# CRM Nogma — Gestor de Obras

Sistema de gestão financeira de obras para construtoras, com bot WhatsApp classificado por IA.

- **Cliente inicial:** Cavalcanti Construções
- **Fabricante:** Nogma (nogmacorp.com.br)
- **Spec:** [docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md](docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md)
- **Design System (source of truth):** [Nogma Design System/readme.md](Nogma%20Design%20System/readme.md)

## Requisitos
- Node ≥ 20, pnpm ≥ 9
- Supabase CLI (`npm i -g supabase`)
- Docker Desktop (Fase 10+)

## Setup local

\`\`\`bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# preencher chaves Supabase
pnpm dev
\`\`\`

Ver `docs/operacao/` para setup Supabase/Vercel e runbook.
```

- [ ] **Step 7: Instalar deps + commit**

```powershell
pnpm install
git add package.json pnpm-workspace.yaml .npmrc tsconfig.base.json biome.json README.md pnpm-lock.yaml
git commit -m "chore: monorepo scaffold (pnpm workspaces, biome, ts base)"
```

### Task 0.4: Docs de setup manual (Supabase + Vercel)

**Files:**
- Create `docs/operacao/setup-supabase.md`
- Create `docs/operacao/setup-vercel.md`

- [ ] **Step 1: `docs/operacao/setup-supabase.md`**

```markdown
# Setup Supabase (uma vez)

## Passo 1: Criar projeto
1. https://supabase.com/dashboard → New Project
2. Nome: `crm-nogma-cavalcanti`
3. DB Password: gere forte, SALVE no gerenciador
4. Região: `South America (São Paulo) sa-east-1`
5. Plano: Free (upgrade para Pro após validar)

## Passo 2: Coletar credenciais
Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (SECRETO)

Settings → Database → Connection string:
- `SUPABASE_DB_URL`

## Passo 3: Extensions
SQL editor:
\`\`\`sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\`\`\`

## Passo 4: CLI
\`\`\`bash
npm i -g supabase
supabase login
\`\`\`

## Passo 5: Linkar (após Task 3.1)
\`\`\`bash
supabase link --project-ref <PROJECT_REF>
\`\`\`
```

- [ ] **Step 2: `docs/operacao/setup-vercel.md`**

```markdown
# Setup Vercel (uma vez)

## Passo 1: Projeto
1. https://vercel.com → import Git repo `crm-nogma`
2. Root Directory: `apps/web`
3. Framework: Next.js (auto)
4. Build: `cd ../.. && pnpm --filter web build`
5. Install: `cd ../.. && pnpm install --frozen-lockfile`

## Passo 2: Env vars (Production + Preview)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_APP_URL (URL final da Vercel)
- OPENAI_API_KEY (vazio nesta fase)
- WEBHOOK_HMAC_SECRET (`openssl rand -hex 32`)

## Passo 3: Deploy
Push em `main` = auto-deploy. PR = preview.
```

- [ ] **Step 3: Commit**

```powershell
git add docs/operacao/
git commit -m "docs: Supabase and Vercel setup guides"
```

**AÇÃO MANUAL DO USUÁRIO** (não bloqueia Fase 1, mas bloqueia Fases 2-3):
1. Criar projeto Supabase (`docs/operacao/setup-supabase.md`)
2. Criar repo `crm-nogma` no GitHub e `git remote add origin ... && git push -u origin main`
3. Importar no Vercel (`docs/operacao/setup-vercel.md`)

---

## Fase 1 — Design System (Nogma DS integração direta)

### Task 1.1: Bootstrap Next.js 15 no monorepo

**Files:**
- Create `apps/web/package.json`
- Create `apps/web/tsconfig.json`
- Create `apps/web/next.config.ts`
- Create `apps/web/next-env.d.ts`
- Create `apps/web/tailwind.config.ts`
- Create `apps/web/postcss.config.mjs`

- [ ] **Step 1: Estrutura de pastas**

```powershell
New-Item -ItemType Directory -Force -Path "apps\web\app"
New-Item -ItemType Directory -Force -Path "apps\web\components\nogma"
New-Item -ItemType Directory -Force -Path "apps\web\components\layout"
New-Item -ItemType Directory -Force -Path "apps\web\components\domain"
New-Item -ItemType Directory -Force -Path "apps\web\lib"
New-Item -ItemType Directory -Force -Path "apps\web\public\fonts"
New-Item -ItemType Directory -Force -Path "apps\web\public\logos"
New-Item -ItemType Directory -Force -Path "apps\web\styles"
```

- [ ] **Step 2: `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "15.0.3",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "lucide-react": "^0.462.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0-alpha.36",
    "@tailwindcss/postcss": "^4.0.0-alpha.36",
    "postcss": "^8.4.49",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 3: `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] },
    "noEmit": true,
    "allowJs": true,
    "incremental": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
};

export default nextConfig;
```

- [ ] **Step 5: `apps/web/next-env.d.ts`**

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 6: `apps/web/postcss.config.mjs`**

```javascript
export default { plugins: { '@tailwindcss/postcss': {} } };
```

- [ ] **Step 7: `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="black"], [data-theme="dark"], .on-black, .on-dark'],
  theme: {
    extend: {
      colors: {
        petroleum: {
          50: 'var(--petroleum-050)', 100: 'var(--petroleum-100)', 200: 'var(--petroleum-200)',
          300: 'var(--petroleum-300)', 500: 'var(--petroleum-500)', 600: 'var(--petroleum-600)',
          700: 'var(--petroleum-700)', 800: 'var(--petroleum-800)', 900: 'var(--petroleum-900)',
          950: 'var(--petroleum-950)',
        },
        lime: {
          50: 'var(--lime-050)', 100: 'var(--lime-100)', 300: 'var(--lime-300)',
          500: 'var(--lime-500)', 600: 'var(--lime-600)',
        },
        canvas: 'var(--bg-canvas)',
        'canvas-subtle': 'var(--bg-subtle)',
        surface: 'var(--surface-card)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        border: 'var(--border-default)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        xs: 'var(--radius-xs)', sm: 'var(--radius-sm)', DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)', sm: 'var(--shadow-sm)', md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)', xl: 'var(--shadow-xl)', lime: 'var(--shadow-lime)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)', 'in-out': 'var(--ease-in-out)',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 8: Instalar deps**

```powershell
pnpm install
```

Expected: instala Next 15, React 19, Tailwind v4, lucide-react. Sem erros.

- [ ] **Step 9: Commit**

```powershell
git add apps/web/
git commit -m "feat: bootstrap Next.js 15 + React 19 + Tailwind v4 in apps/web"
```

### Task 1.2: Copiar assets Nogma DS (tokens, fontes, logos, ícones)

**Files:**
- Copy `Nogma Design System/tokens/*.css` → `apps/web/styles/tokens/`
- Copy `Nogma Design System/styles.css` → `apps/web/styles/nogma.css` (edit imports)
- Copy `Nogma Design System/assets/fonts/*` → `apps/web/public/fonts/`
- Copy `Nogma Design System/assets/logo-nogma-*.png` → `apps/web/public/logos/`
- Copy `Nogma Design System/assets/isotype-n-*.png` → `apps/web/public/logos/`
- Copy `Nogma Design System/assets/icons.jsx` → `apps/web/lib/nogma-icons.tsx` (adapt to TSX)
- Create `apps/web/styles/globals.css`

- [ ] **Step 1: Copiar tokens**

```powershell
New-Item -ItemType Directory -Force -Path "apps\web\styles\tokens"
Copy-Item "Nogma Design System\tokens\base.css" "apps\web\styles\tokens\"
Copy-Item "Nogma Design System\tokens\colors.css" "apps\web\styles\tokens\"
Copy-Item "Nogma Design System\tokens\fonts.css" "apps\web\styles\tokens\"
Copy-Item "Nogma Design System\tokens\spacing.css" "apps\web\styles\tokens\"
Copy-Item "Nogma Design System\tokens\typography.css" "apps\web\styles\tokens\"
```

- [ ] **Step 2: Ajustar `fonts.css` para caminhos Next public**

Edit `apps/web/styles/tokens/fonts.css` — substitua todos `url("../assets/fonts/` por `url("/fonts/`.

PowerShell:

```powershell
(Get-Content "apps\web\styles\tokens\fonts.css") -replace 'url\("\.\./assets/fonts/', 'url("/fonts/' | Set-Content "apps\web\styles\tokens\fonts.css"
```

- [ ] **Step 3: Copiar fontes**

```powershell
Copy-Item "Nogma Design System\assets\fonts\*.otf" "apps\web\public\fonts\"
Copy-Item "Nogma Design System\assets\fonts\*.ttf" "apps\web\public\fonts\"
```

- [ ] **Step 4: Copiar logos**

```powershell
Copy-Item "Nogma Design System\assets\logo-nogma-*.png" "apps\web\public\logos\"
Copy-Item "Nogma Design System\assets\isotype-n-*.png" "apps\web\public\logos\"
```

- [ ] **Step 5: Criar `apps/web/styles/nogma.css` (entry — imita `Nogma Design System/styles.css`)**

```css
/* Nogma DS entry — imita Nogma Design System/styles.css */
@import "./tokens/fonts.css";
@import "./tokens/colors.css";
@import "./tokens/typography.css";
@import "./tokens/spacing.css";
@import "./tokens/base.css";
```

- [ ] **Step 6: `apps/web/styles/globals.css`**

```css
@import "tailwindcss";
@import "./nogma.css";

@layer base {
  html {
    color-scheme: light dark;
  }
  html[data-theme="black"], html[data-theme="dark"], .on-black, .on-dark {
    color-scheme: dark;
  }
}
```

- [ ] **Step 7: Copiar ícones (JSX → TSX)**

Copy `Nogma Design System/assets/icons.jsx` → `apps/web/lib/nogma-icons.tsx`. Nota: o arquivo original expõe `window.NogmaIcon` — na versão TSX, exporte como componente React normal:

```typescript
// apps/web/lib/nogma-icons.tsx
// SUBSTITUA o padrão window.NogmaIcon por named export:
// export function NogmaIcon({ name, size = 20, color = 'currentColor' }: { name: string; size?: number; color?: string }) { ... }
// Mantenha o mesmo mapa de paths SVG do original.
```

**PORÉM**, dado que já instalamos `lucide-react`, preferimos usar `lucide-react` diretamente. O arquivo `nogma-icons.tsx` fica como fallback opcional (não usado por padrão).

Se subagente considerar overhead, pode **pular Step 7** e apenas usar `lucide-react`. Registrar decisão.

- [ ] **Step 8: Testar imports**

Crie um `apps/web/app/layout.tsx` mínimo pra validar que `globals.css` carrega:

```typescript
import '@/styles/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="black">
      <body>{children}</body>
    </html>
  );
}
```

E `apps/web/app/page.tsx`:

```typescript
export default function Page() {
  return (
    <main style={{ padding: 48 }}>
      <p className="eyebrow">Nogma Design System</p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-5xl)' }}>
        Gestor de <span className="mark-lime">Obras</span>
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>
        Se o heading está em lime sobre fundo preto e a palavra "Obras" tem highlight lime, os tokens carregaram OK.
      </p>
    </main>
  );
}
```

- [ ] **Step 9: Rodar e validar**

```powershell
pnpm dev
```

Abra `http://localhost:3000`. Expected: fundo preto (`--bg-canvas` no `.on-black`/`data-theme="black"`), heading em lime (`.mark-lime`), fontes Raleway/Agency carregadas (verifique DevTools → Network → filter fonts).

- [ ] **Step 10: Commit**

```powershell
git add apps/web/
git commit -m "feat: import Nogma DS tokens, fonts, logos, icons into apps/web"
```

### Task 1.3: Root layout com `data-theme` + cookie persistence

**Files:**
- Create `apps/web/lib/theme.ts`
- Create `apps/web/app/api/theme/route.ts`
- Update `apps/web/app/layout.tsx`

- [ ] **Step 1: `apps/web/lib/theme.ts`**

```typescript
import { cookies } from 'next/headers';

export type Theme = 'light' | 'black' | 'dark';
export const THEME_COOKIE = 'nogma-theme';
export const DEFAULT_THEME: Theme = 'black';

export async function getServerTheme(): Promise<Theme> {
  const store = await cookies();
  const raw = store.get(THEME_COOKIE)?.value;
  if (raw === 'light' || raw === 'black' || raw === 'dark') return raw;
  return DEFAULT_THEME;
}
```

- [ ] **Step 2: `apps/web/app/api/theme/route.ts`**

```typescript
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { theme } = await req.json();
  if (theme !== 'light' && theme !== 'black' && theme !== 'dark') {
    return NextResponse.json({ error: 'invalid theme' }, { status: 400 });
  }
  const store = await cookies();
  store.set('nogma-theme', theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Atualizar `apps/web/app/layout.tsx`**

```typescript
import type { Metadata } from 'next';
import { getServerTheme } from '@/lib/theme';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Gestor de Obras · Nogma',
  description: 'CRM de gestão financeira de obras com bot WhatsApp',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getServerTheme();
  return (
    <html
      lang="pt-BR"
      data-theme={theme === 'light' ? undefined : theme}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```powershell
git add apps/web/
git commit -m "feat: server-rendered theme via cookie (default=black)"
```

### Task 1.4: Portar componentes Nogma DS (Button, Card, Stat, Input, Badge, Avatar, Checkbox, Switch)

**Estratégia:** cada `.jsx` da Nogma DS vira um `.tsx` em `apps/web/components/nogma/`. O CSS inline (padrão `useInjected`) é extraído para um `.css` co-localizado (SSR-safe). Props/APIs preservadas exatamente.

**Files (uma para cada):**
- Create `apps/web/components/nogma/Button.tsx` + `Button.css`
- Create `apps/web/components/nogma/IconButton.tsx` + `IconButton.css`
- Create `apps/web/components/nogma/Card.tsx` + `Card.css`
- Create `apps/web/components/nogma/Stat.tsx` + `Stat.css`
- Create `apps/web/components/nogma/Badge.tsx` + `Badge.css`
- Create `apps/web/components/nogma/Avatar.tsx` + `Avatar.css`
- Create `apps/web/components/nogma/Input.tsx` + `Input.css`
- Create `apps/web/components/nogma/Checkbox.tsx` + `Checkbox.css`
- Create `apps/web/components/nogma/Switch.tsx` + `Switch.css`
- Create `apps/web/components/nogma/Tabs.tsx` + `Tabs.css`
- Create `apps/web/components/nogma/index.ts` (barrel)

Componentes menos usados no MVP (Tag, Alert, Dialog, Progress, Tooltip, RadioGroup, Select, Textarea): **portar sob demanda** quando primeira tela precisar.

- [ ] **Step 1 (por componente): ler original, portar para TSX**

Fluxo aplicado a cada componente:

1. Ler `Nogma Design System/components/<grupo>/<Nome>.jsx`
2. Ler `Nogma Design System/components/<grupo>/<Nome>.d.ts` (tipos)
3. Ler `Nogma Design System/components/<grupo>/<Nome>.prompt.md` (docs)
4. Portar:
   - `import React from "react"` → `import * as React from 'react'` (padrão TS)
   - Extrair `const CSS = ...` para arquivo `.css` co-localizado
   - Substituir `useInjected("<id>", CSS)` por `import './<Nome>.css'`
   - Adicionar tipos completos das props (baseado no `.d.ts`)
   - `export function` mantida
5. Adicionar `'use client'` se o componente usar hooks/state (Button não; Checkbox sim)
6. Testar visualmente numa página de kitchen sink

**Exemplo aplicado — Button.tsx:**

```typescript
import * as React from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'solid' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  as?: 'button' | 'a';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  leadingIcon,
  trailingIcon,
  as: Tag = 'button',
  className = '',
  ...props
}: ButtonProps) {
  const cls = [
    'ng-btn',
    `ng-btn--${variant}`,
    `ng-btn--${size}`,
    block ? 'ng-btn--block' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <Tag className={cls} {...(props as any)}>
      {leadingIcon ? <span className="ng-btn__icon" aria-hidden="true">{leadingIcon}</span> : null}
      {children}
      {trailingIcon ? <span className="ng-btn__icon" aria-hidden="true">{trailingIcon}</span> : null}
    </Tag>
  );
}
```

`Button.css` = conteúdo do `const CSS` do original (linhas 6-40 do `Button.jsx`) copiado verbatim.

- [ ] **Step 2: Kitchen sink de validação**

Crie `apps/web/app/(dev)/kitchen-sink/page.tsx`:

```typescript
'use client';
import { Button } from '@/components/nogma/Button';
import { Card } from '@/components/nogma/Card';
import { Stat } from '@/components/nogma/Stat';
import { Input } from '@/components/nogma/Input';
import { Checkbox } from '@/components/nogma/Checkbox';
import { Badge } from '@/components/nogma/Badge';
import { Avatar } from '@/components/nogma/Avatar';

export default function KitchenSink() {
  return (
    <main style={{ padding: 48, display: 'grid', gap: 32 }}>
      <section>
        <p className="eyebrow">Buttons</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <Button variant="primary">Primary</Button>
          <Button variant="solid">Solid</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
      </section>
      <section>
        <p className="eyebrow">Stat</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Stat label="Horas economizadas / mês" value="128h" trend={{ direction: 'up', value: '+18%' }} context="vs. junho" />
          <Stat label="Processos ativos" value="24" trend={{ direction: 'up', value: '+3' }} context="este mês" />
          <Stat label="Taxa de sucesso" value="95%" trend={{ direction: 'up', value: '+1,2pp' }} context="média 30 dias" />
          <Stat label="Execuções / semana" value="6.4k" trend={{ direction: 'down', value: '-2%' }} context="vs. semana anterior" />
        </div>
      </section>
      <section>
        <p className="eyebrow">Form</p>
        <div style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
          <Input label="E-mail" placeholder="voce@exemplo.com" />
          <Input label="Senha" type="password" />
          <Checkbox label="Manter conectada" defaultChecked />
        </div>
      </section>
    </main>
  );
}
```

Abra `/kitchen-sink` — todos devem renderizar idênticos aos previews em `Nogma Design System/components/**/*.card.html`.

- [ ] **Step 3: Barrel export**

`apps/web/components/nogma/index.ts`:

```typescript
export { Button, type ButtonProps } from './Button';
export { IconButton, type IconButtonProps } from './IconButton';
export { Card, type CardProps } from './Card';
export { Stat, type StatProps } from './Stat';
export { Badge, type BadgeProps } from './Badge';
export { Avatar, type AvatarProps } from './Avatar';
export { Input, type InputProps } from './Input';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { Switch, type SwitchProps } from './Switch';
export { Tabs, type TabsProps } from './Tabs';
```

- [ ] **Step 4: Commit**

```powershell
git add apps/web/
git commit -m "feat(nogma-ds): port Button, IconButton, Card, Stat, Badge, Avatar, Input, Checkbox, Switch, Tabs to TSX"
```

### Task 1.5: Chrome (Sidebar + TopBar) portado do NogmaOS

**Files:**
- Create `apps/web/components/layout/sidebar.tsx` (server component)
- Create `apps/web/components/layout/sidebar-nav.tsx` (client — usePathname)
- Create `apps/web/components/layout/topbar.tsx`
- Create `apps/web/components/layout/theme-toggle.tsx`
- Create `apps/web/components/layout/user-menu.tsx` (stub; ganha sessão em Fase 2)
- Create `apps/web/styles/nos-chrome.css` (extraído de `ui_kits/nogmaos/index.html`)
- Update `apps/web/styles/globals.css` (import nos-chrome.css)

- [ ] **Step 1: Extrair CSS `nos-*` do UI kit**

Abra `Nogma Design System/ui_kits/nogmaos/index.html`. Localize o bloco `<style>` (deve ter classes `.nos-sidebar`, `.nos-brand`, `.nos-nav`, `.nos-navitem`, `.nos-topbar`, `.nos-search`, `.nos-iconbtn`, `.nos-userpill`, etc). Copie **todo o CSS `nos-*`** para `apps/web/styles/nos-chrome.css`.

**Se o CSS estiver em JS/inline no HTML**, extraia via regex. Manter comentários.

Import em `globals.css`:

```css
@import "tailwindcss";
@import "./nogma.css";
@import "./nos-chrome.css";
```

- [ ] **Step 2: `apps/web/components/layout/sidebar.tsx`**

```typescript
import Image from 'next/image';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

export function Sidebar() {
  return (
    <aside className="nos-sidebar on-black">
      <div className="nos-brand">
        <span className="nos-brand__mark">
          <Image src="/logos/isotype-n-lime.png" alt="Nogma" width={28} height={28} />
        </span>
        <Image
          className="nos-brand__word"
          src="/logos/logo-nogma-lime.png"
          alt="nogma"
          width={100}
          height={24}
        />
      </div>
      <SidebarNav />
      <div className="nos-side-foot">
        <UserMenu />
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: `apps/web/components/layout/sidebar-nav.tsx`** (client)

Baseado em `Nogma Design System/ui_kits/nogmaos/Chrome.jsx:5-11`, com nossos itens do CRM:

```typescript
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, FileText, MessageSquare,
  AlertCircle, Users, Settings, FileBarChart,
} from 'lucide-react';

const NAV = [
  { href: '/painel', label: 'Painel', icon: LayoutDashboard },
  { href: '/obras', label: 'Obras', icon: Building2 },
  { href: '/documentos', label: 'Documentos', icon: FileText },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { href: '/pendentes', label: 'Pendentes', icon: AlertCircle },
  { href: '/fornecedores', label: 'Fornecedores', icon: Users },
] as const;

const SECONDARY = [
  { href: '/relatorios', label: 'Relatórios', icon: FileBarChart },
  { href: '/config', label: 'Configurações', icon: Settings },
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  return (
    <nav className="nos-nav">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={'nos-navitem' + (isActive(href) ? ' is-active' : '')}
        >
          <Icon size={19} />
          <span className="nos-navitem__label">{label}</span>
        </Link>
      ))}
      <div className="nos-nav__sep" />
      {SECONDARY.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={'nos-navitem' + (isActive(href) ? ' is-active' : '')}
        >
          <Icon size={19} />
          <span className="nos-navitem__label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: `apps/web/components/layout/theme-toggle.tsx`** (client)

```typescript
'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon, Waves } from 'lucide-react';
import { IconButton } from '@/components/nogma/IconButton';

type Theme = 'light' | 'black' | 'dark';
const LABEL: Record<Theme, string> = {
  light: 'Claro',
  black: 'Escuro (Nogma)',
  dark: 'Petróleo',
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('black');

  useEffect(() => {
    const cur = document.documentElement.getAttribute('data-theme') ?? '';
    setTheme((cur === 'black' || cur === 'dark' ? cur : 'light') as Theme);
  }, []);

  async function cycle() {
    const next: Theme = theme === 'light' ? 'black' : theme === 'black' ? 'dark' : 'light';
    if (next === 'light') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
    await fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    });
  }

  const Icon = theme === 'light' ? Sun : theme === 'black' ? Moon : Waves;
  return (
    <IconButton aria-label={`Tema: ${LABEL[theme]} — clique para trocar`} onClick={cycle}>
      <Icon size={18} />
    </IconButton>
  );
}
```

- [ ] **Step 5: `apps/web/components/layout/topbar.tsx`**

```typescript
import { Menu, Bell } from 'lucide-react';
import { IconButton } from '@/components/nogma/IconButton';
import { ThemeToggle } from './theme-toggle';

export function TopBar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="nos-topbar">
      <div className="nos-topbar__left">
        <IconButton variant="ghost" aria-label="Menu"><Menu size={20} /></IconButton>
        <div>
          <h1 className="nos-topbar__title">{title}</h1>
          {subtitle ? <div className="nos-topbar__sub">{subtitle}</div> : null}
        </div>
      </div>
      <div className="nos-topbar__right">
        <label className="nos-search">
          <input placeholder="Buscar obras, fornecedores, pagamentos..." />
          <kbd>⌘K</kbd>
        </label>
        <IconButton variant="ghost" aria-label="Alertas">
          <Bell size={19} />
        </IconButton>
        <ThemeToggle />
        {actions}
      </div>
    </header>
  );
}
```

- [ ] **Step 6: `apps/web/components/layout/user-menu.tsx`** (stub — Fase 2 troca por real)

```typescript
import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/nogma/Avatar';

export function UserMenu() {
  return (
    <div className="nos-userpill">
      <Avatar name="Fernando Cavalcanti" size="sm" />
      <div className="nos-userpill__meta">
        <div className="nos-userpill__name">Fernando Cavalcanti</div>
        <div className="nos-userpill__org">Administrador</div>
      </div>
      <LogOut size={16} color="var(--petroleum-300)" />
    </div>
  );
}
```

- [ ] **Step 7: `apps/web/app/(app)/layout.tsx`**

```typescript
import { Sidebar } from '@/components/layout/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-canvas)' }}>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 8: `apps/web/app/(app)/painel/page.tsx`** (stub inicial estilo NogmaOS dashboard)

```typescript
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Stat } from '@/components/nogma/Stat';
import { Plus } from 'lucide-react';

export default function PainelPage() {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).toUpperCase();

  return (
    <>
      <TopBar
        title="Painel"
        subtitle="Visão geral da operação"
        actions={<Button variant="primary" leadingIcon={<Plus size={16} />}>Nova Obra</Button>}
      />
      <div style={{ padding: '32px 40px' }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>{hoje}</p>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-4xl)', fontWeight: 800 }}>
          Bom dia, <span className="mark-lime">Fernando 👋</span>
        </h2>
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Stat label="Obras Ativas" value="—" context="10 total" />
          <Stat label="Gasto no Mês" value="—" context="0 pagamentos" />
          <Stat label="Total Acumulado" value="—" context="Todas as obras" />
          <Stat label="Pendentes NF" value="—" context="0 sem comprovante" />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 9: Redirect da home**

`apps/web/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
export default function HomePage() { redirect('/painel'); }
```

- [ ] **Step 10: Rodar e testar**

```powershell
pnpm dev
```

Abra `http://localhost:3000`. Redireciona para `/painel`. Você deve ver **exatamente o layout do screenshot NogmaOS**: sidebar preta com logo lime, nav com pill lime em "Painel", top bar com search + bell + theme toggle + botão lime "+ Nova Obra", eyebrow com data em Agency caps, greeting "Bom dia, Fernando 👋" com marker lime, e 4 Stat cards com traço no lugar do valor.

- [ ] **Step 11: Commit**

```powershell
git add apps/web/
git commit -m "feat: chrome (Sidebar + TopBar) portado do NogmaOS + Painel stub"
```

---

## Fase 2 — Autenticação Supabase

**PRÉ-REQUISITO:** Task 0.4 concluída pelo usuário (Supabase provisionado, credenciais em mão).

### Task 2.1: Supabase clients (browser + server + middleware)

**Files:**
- Install deps
- Create `apps/web/.env.example`
- Create `apps/web/lib/supabase/client.ts`
- Create `apps/web/lib/supabase/server.ts`
- Create `apps/web/lib/supabase/middleware.ts`
- Create `apps/web/middleware.ts`

- [ ] **Step 1: Install**

```powershell
pnpm --filter web add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 3: `client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 4: `server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}
```

- [ ] **Step 5: `middleware.ts` (do lib)**

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const url = request.nextUrl.clone();
  const isAuthRoute = url.pathname.startsWith('/login') || url.pathname === '/';
  const isPublicApi = url.pathname.startsWith('/api/webhooks/');

  if (!user && !isAuthRoute && !isPublicApi) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && url.pathname === '/login') {
    url.pathname = '/painel';
    return NextResponse.redirect(url);
  }
  return response;
}
```

- [ ] **Step 6: `apps/web/middleware.ts`**

```typescript
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|logos/|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)'],
};
```

- [ ] **Step 7: Copiar `.env.example` → `.env.local` (usuário preenche)**

```powershell
Copy-Item "apps\web\.env.example" "apps\web\.env.local"
```

**AÇÃO USUÁRIO:** abrir `apps/web/.env.local` e preencher as chaves reais do Supabase.

- [ ] **Step 8: Commit**

```powershell
git add apps/web/
git commit -m "feat(auth): Supabase clients + middleware guard"
```

### Task 2.2: Login screen (LoginScreen NogmaOS)

**Files:**
- Create `apps/web/app/(auth)/layout.tsx`
- Create `apps/web/app/(auth)/login/page.tsx`
- Create `apps/web/app/(auth)/login/actions.ts`
- Extract CSS `.nos-login*` de `Nogma Design System/ui_kits/nogmaos/index.html` para `apps/web/styles/nos-login.css` e import em `globals.css`

- [ ] **Step 1: Extrair CSS `.nos-login*`**

De `Nogma Design System/ui_kits/nogmaos/index.html`, extrair todas classes começando com `.nos-login*` e `.nos-mark` (usado no eyebrow), e salvar em `apps/web/styles/nos-login.css`. Adicionar `@import "./nos-login.css";` em `globals.css`.

- [ ] **Step 2: `apps/web/app/(auth)/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: `apps/web/app/(auth)/login/actions.ts`**

```typescript
'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email e senha obrigatórios' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/painel');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 4: `apps/web/app/(auth)/login/page.tsx`**

Baseado em `Nogma Design System/ui_kits/nogmaos/LoginScreen.jsx`, adaptado para nossos componentes + server action:

```typescript
import Image from 'next/image';
import { ArrowRight, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { Checkbox } from '@/components/nogma/Checkbox';
import { login } from './actions';

export default function LoginPage() {
  return (
    <div className="nos-login">
      <div className="nos-login__aside on-black">
        <Image
          className="nos-login__logo"
          src="/logos/logo-nogma-lime.png"
          alt="nogma"
          width={140}
          height={34}
        />
        <div className="nos-login__pitch">
          <div className="nos-login__eyebrow">GESTOR DE OBRAS</div>
          <h2>Sua obra <span className="nos-mark">controlada no WhatsApp</span>.</h2>
          <p>Pagamentos, comprovantes e notas fiscais organizados sozinhos.</p>
        </div>
        <div className="nos-login__stats">
          <div><strong>10</strong><span>obras ativas</span></div>
          <div><strong>R$ 453k</strong><span>investido</span></div>
          <div><strong>124</strong><span>documentos</span></div>
        </div>
      </div>

      <div className="nos-login__panel">
        <div className="nos-login__card">
          <h1>Entrar</h1>
          <p className="nos-login__hint">Acesse o painel da Cavalcanti.</p>
          <form action={login} className="nos-login__form">
            <Input
              label="E-mail"
              type="email"
              name="email"
              required
              autoComplete="email"
              leading={<Mail size={16} color="var(--text-muted)" />}
            />
            <Input
              label="Senha"
              type="password"
              name="password"
              required
              autoComplete="current-password"
              leading={<Lock size={16} color="var(--text-muted)" />}
            />
            <div className="nos-login__row">
              <Checkbox label="Manter conectada" defaultChecked />
              <a className="nos-login__link" href="/recuperar">Esqueci a senha</a>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              trailingIcon={<ArrowRight size={18} />}
            >
              Entrar
            </Button>
          </form>
          <div className="nos-login__foot">Nogma · Gestor de Obras</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Testar (após usuário preencher .env.local + criar user no dashboard)**

```powershell
pnpm dev
```

`/painel` sem login → redireciona `/login`. Preencher email/senha do user criado no dashboard Supabase → logar → chega no Painel.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/
git commit -m "feat(auth): login screen (NogmaOS style) with server action"
```

### Task 2.3: UserMenu real com logout

**Files:**
- Update `apps/web/components/layout/user-menu.tsx`

- [ ] **Step 1: Server component com sessão real + form de logout**

```typescript
import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/nogma/Avatar';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/(auth)/login/actions';

export async function UserMenu() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? 'convidado';
  const nome = email.split('@')[0] ?? 'Usuário';

  return (
    <form action={logout} className="nos-userpill" style={{ cursor: 'default' }}>
      <Avatar name={nome} size="sm" />
      <div className="nos-userpill__meta">
        <div className="nos-userpill__name">{nome}</div>
        <div className="nos-userpill__org">{email}</div>
      </div>
      <button type="submit" aria-label="Sair" style={{ background: 'transparent', border: 0, cursor: 'pointer' }}>
        <LogOut size={16} color="var(--petroleum-300)" />
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Testar login → logout ciclo completo**

- [ ] **Step 3: Commit**

```powershell
git add apps/web/
git commit -m "feat(auth): UserMenu with real session and logout"
```

---

## Fase 3 — Schema Postgres + RLS

**PRÉ-REQUISITO:** Supabase provisionado + linkado. Igual ao Plano v1 — sem mudança.

### Tasks 3.1 a 3.9

**INALTERADAS do v1** (`docs/superpowers/plans/2026-09-03-plano-1-fundacoes.md` §Fase 3, Tasks 3.1-3.9). Executar como escrito lá — todas as migrations SQL, RLS, seed, geração de tipos.

Copiar Tasks 3.1-3.9 do v1 para este plano seria pura duplicação. Subagentes: leiam `docs/superpowers/plans/2026-09-03-plano-1-fundacoes.md` §"Fase 3" e executem as Tasks 3.1 a 3.9 verbatim.

### Task 3.10: Painel real com contadores

**Substitui** o Task 3.10 do v1. Agora usa o `<Stat>` da Nogma DS que já portamos.

**Files:**
- Update `apps/web/app/(app)/painel/page.tsx`

- [ ] **Step 1: Substituir stub do Painel por consulta real**

```typescript
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Stat } from '@/components/nogma/Stat';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function PainelPage() {
  const supabase = await createClient();
  const [obrasR, pagsR, docsR, msgsR, userR] = await Promise.all([
    supabase.from('obras').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('pagamentos').select('valor', { count: 'exact' }).is('deleted_at', null).eq('status_pagto', 'confirmado'),
    supabase.from('documentos').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('mensagens_whats').select('id', { count: 'exact', head: true }).eq('status', 'recebida'),
    supabase.auth.getUser(),
  ]);

  const totalGasto = (pagsR.data ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0);
  const primeiroNome = (userR.data.user?.email ?? 'você').split('@')[0]!.split('.')[0]!;
  const primeiroNomeCap = primeiroNome[0]!.toUpperCase() + primeiroNome.slice(1);
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).toUpperCase();

  const brl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <>
      <TopBar
        title="Painel"
        subtitle="Visão geral da operação"
        actions={
          <Button variant="primary" leadingIcon={<Plus size={16} />}>Nova Obra</Button>
        }
      />
      <div style={{ padding: '32px 40px' }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>{hoje}</p>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-4xl)', fontWeight: 800 }}>
          Bom dia, <span className="mark-lime">{primeiroNomeCap} 👋</span>
        </h2>
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Stat label="Obras Ativas" value={String(obrasR.count ?? 0)} context="ativas + arquivadas" />
          <Stat label="Total Acumulado" value={brl(totalGasto)} context="confirmados" />
          <Stat label="Documentos" value={String(docsR.count ?? 0)} context="NFs + comprovantes" />
          <Stat label="Mensagens na fila" value={String(msgsR.count ?? 0)} context="aguardando classificação" />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Testar (autenticado)**

```powershell
pnpm dev
```

Login → Painel → veja greeting personalizado + KPIs com dados reais (zerados se banco vazio).

- [ ] **Step 3: Commit**

```powershell
git add apps/web/
git commit -m "feat(painel): dashboard real with Nogma Stat cards + auth-aware greeting"
```

---

## Task 4: Encerramento

### Task 4.1: Deploy final + smoke test

- [ ] **Step 1: Push para main**

```powershell
git push origin main
```

Vercel auto-deploy.

- [ ] **Step 2: Smoke test em prod**

- [ ] `/` → `/login` sem sessão ✓
- [ ] Login funciona ✓
- [ ] Painel: sidebar Nogma preto+lime, TopBar completa, greeting personalizado, 4 Stats ✓
- [ ] Toggle A→B→C persiste em cookie ✓
- [ ] Logout volta pra `/login` ✓

### Task 4.2: Changelog

Idêntico ao v1 Task 4.2, ajustando texto para refletir uso de Nogma DS direto.

**Files:** `docs/CHANGELOG.md`

```markdown
# Changelog

## Plano #1 v2 — Fundações Nogma DS (concluído YYYY-MM-DD)

### Adicionado
- Monorepo pnpm (apps/web + packages/db)
- **Nogma Design System integrado direto** — tokens verbatim de `Nogma Design System/tokens/*`, fontes Agency+Raleway servidas de `/public/fonts/`, logos Nogma em `/public/logos/`
- Componentes Nogma portados de `.jsx` → `.tsx`: Button, IconButton, Card, Stat, Badge, Avatar, Input, Checkbox, Switch, Tabs
- Chrome (Sidebar+TopBar) fiel ao NogmaOS: sidebar preta com pill lime, top bar com search+bell+theme+CTA
- 3 temas via cookie: Light / **Black (default)** / Petroleum Dark
- Autenticação Supabase (login/logout server actions + middleware guard)
- Schema Postgres completo: profiles, autorizados, categorias, obras, fornecedores, fornecedor_apelidos, pagamentos, documentos, mensagens_whats, confirmacoes_pendentes, audit_log, notificacoes_email, lembretes_agendados
- RLS por papel (admin/gestor/financeiro/leitura)
- Seed 8 categorias base
- Tipos TS gerados
- Painel com KPIs reais + greeting personalizado por sessão
- Deploy Vercel automático

### Próximo
- Plano #2 — CRUD Base (Fases 4-9): Obras, Fornecedores, Pagamentos manuais, Documentos, Pendências, Painel completo com gráficos.
```

---

## Self-review (v2)

- ✅ **Spec coverage**: cobre §4 (Design System — agora usando assets diretos), §5 (estrutura repo), §6 (schema), §9 (RLS/auth), fases 0-3 do §11
- ✅ **Placeholders**: nenhum TBD/TODO
- ✅ **Type consistency**: `Theme = 'light'|'black'|'dark'` consistente; enums Postgres consistentes
- ✅ **Nogma DS**: tokens copiados verbatim (mesmo conteúdo que teríamos baixado do site, mas agora fornecidos pelo usuário)
- ✅ **Fontes**: agora automáticas (usuário forneceu todos os arquivos)
- ✅ **CSS extraction**: `.nos-*` extraído de `ui_kits/nogmaos/index.html` — subagente precisa ler esse HTML na Task 1.5 Step 1 (documentado)
- ✅ **Circular FK**: `criado_via_msg_id` + `fk_msgs_pagamento`/`fk_msgs_documento` como DEFERRABLE INITIALLY DEFERRED (Task 3.5 do v1)
- ⚠️ **Nota**: `ui_kits/nogmaos/index.html` tem 210 linhas — precisamos extrair o CSS `.nos-*` na Task 1.5 e `.nos-login*` na Task 2.2. Se o CSS estiver embedded em `<style>` no HTML, extração é direta. Se estiver em `<script>` via JS injection, adaptar.
- ⚠️ **Dependency**: `IconButton` é usado em `theme-toggle.tsx` e `topbar.tsx` — precisa estar portado no Task 1.4 (adicionado à lista).
