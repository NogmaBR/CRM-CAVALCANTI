# Plano #1 — Fundações (Fases 0-3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar a aplicação Next.js 15 + Supabase + Vercel funcionando com login, layout global (sidebar + topbar + toggle de 3 temas), design system Nogma 100% aderente, schema Postgres inicial (obras, fornecedores, categorias, pagamentos, documentos, mensagens_whats, autorizados, profiles, audit_log) com RLS, e um usuário admin conseguindo logar e ver o painel vazio.

**Architecture:** Monorepo pnpm com `apps/web` (Next.js 15 App Router) e `packages/db|shared`. Supabase gerenciado provê Postgres + Auth + Storage. Deploy via Vercel (Git integration). Design tokens copiados verbatim de nogmacorp.com.br. Tema controlado via `data-theme` no `<html>` com persistência em cookie + localStorage.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, Tailwind CSS v4, shadcn/ui, @supabase/ssr, @supabase/supabase-js, pnpm workspaces, Biome, Vitest, Playwright.

**Spec de origem:** `docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md`

---

## Convenções deste plano

- **Working dir**: `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA` (chamado `<root>`)
- **Shell**: PowerShell no Windows 11. Comandos assumem que você está em `<root>`. Onde for específico de bash (WSL), aviso.
- **Node**: 20.x LTS ou 22.x LTS. Verifique com `node -v` antes.
- **pnpm**: 9.x ou superior. Instale com `npm i -g pnpm@latest` se não tiver.
- **Cadência de commit**: um commit por Task concluída (não por Step). Se uma Task tiver múltiplos arquivos, junta todos no commit final.
- **Convenção de commit**: Conventional Commits (`feat:`, `chore:`, `fix:`, `docs:`, `test:`).

---

## Fase 0 — Kickoff e repositório

### Task 0.1: Preparar working dir e verificar toolchain

**Files:**
- Nenhum (verificações + setup manual)

- [ ] **Step 1: Verificar Node e pnpm**

```powershell
node -v
pnpm -v
git --version
```

Expected: Node ≥ 20, pnpm ≥ 9, git ≥ 2.40. Se falhar, instale antes de continuar.

- [ ] **Step 2: Verificar que estamos no working dir correto**

```powershell
Get-Location
Get-ChildItem
```

Expected: caminho é `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA`. Deve listar `apresentacao-projeto-cavalcanti.pdf`, os 4 MDs, `.design-system/`, `docs/`, `.superpowers/`.

- [ ] **Step 3: Mover artefatos de brainstorming para não poluir o repo**

```powershell
New-Item -ItemType Directory -Force -Path ".artefatos-iniciais"
Move-Item "informacoes.md" ".artefatos-iniciais\"
Move-Item "base-de-estrutura.md" ".artefatos-iniciais\"
Move-Item "arquitetura.md" ".artefatos-iniciais\"
Move-Item "fases-construcao.md" ".artefatos-iniciais\"
Move-Item "apresentacao-projeto-cavalcanti.pdf" ".artefatos-iniciais\"
```

Os MDs originais e o PDF ficam preservados mas fora do topo do repo. O `docs/superpowers/specs/` é a fonte de verdade daqui pra frente.

### Task 0.2: Inicializar git e configurar `.gitignore`

**Files:**
- Create: `<root>/.gitignore`
- Create: `<root>/.gitattributes`

- [ ] **Step 1: `git init` e branch principal**

```powershell
git init -b main
git config core.autocrlf false
git config core.eol lf
```

- [ ] **Step 2: Escrever `.gitignore`**

Create `<root>/.gitignore`:

```
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

# Superpowers session state (não commitar mockups efêmeros)
.superpowers/

# Supabase local
supabase/.branches/
supabase/.temp/

# Docker
infra/docker/.env
```

- [ ] **Step 3: Escrever `.gitattributes`**

Create `<root>/.gitattributes`:

```
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

- [ ] **Step 4: Primeiro commit**

```powershell
git add .gitignore .gitattributes .design-system/ docs/ .artefatos-iniciais/
git commit -m "chore: initial repo setup with Nogma design system assets and spec"
```

### Task 0.3: Estrutura do monorepo (pnpm workspaces)

**Files:**
- Create: `<root>/package.json`
- Create: `<root>/pnpm-workspace.yaml`
- Create: `<root>/.npmrc`
- Create: `<root>/tsconfig.base.json`
- Create: `<root>/biome.json`
- Create: `<root>/README.md`

- [ ] **Step 1: `pnpm-workspace.yaml`**

Create `<root>/pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Root `package.json`**

Create `<root>/package.json`:

```json
{
  "name": "crm-nogma",
  "private": true,
  "version": "0.0.1",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm --filter web build",
    "start": "pnpm --filter web start",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter web test:e2e",
    "db:types": "pnpm --filter @nogma/db gen-types",
    "prepare": "husky || true"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "typescript": "^5.6.3"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  }
}
```

- [ ] **Step 3: `.npmrc` (força node_modules linear)**

Create `<root>/.npmrc`:

```
strict-peer-dependencies=false
auto-install-peers=true
shamefully-hoist=false
prefer-workspace-packages=true
```

- [ ] **Step 4: `tsconfig.base.json` compartilhado**

Create `<root>/tsconfig.base.json`:

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

Create `<root>/biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true, "ignore": [".next", "node_modules", "dist"] },
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
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
```

- [ ] **Step 6: README de onboarding**

Create `<root>/README.md`:

```markdown
# CRM Nogma — Gestor de Obras

Sistema de gestão financeira de obras para construtoras, com bot WhatsApp classificado por IA.

- **Cliente inicial:** Cavalcanti Construções
- **Fabricante:** Nogma (nogmacorp.com.br)
- **Spec:** [docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md](docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md)

## Requisitos
- Node ≥ 20
- pnpm ≥ 9
- Supabase CLI (para dev local) — `npm i -g supabase`
- Docker Desktop (para Fase 10+ com n8n/UAZAPI/Caddy)

## Setup local
\`\`\`bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# preencha as chaves do Supabase
pnpm dev
\`\`\`

Ver `docs/operacao/runbook.md` para operação em produção.
```

- [ ] **Step 7: Instalar deps root e commit**

```powershell
pnpm install
git add package.json pnpm-workspace.yaml .npmrc tsconfig.base.json biome.json README.md pnpm-lock.yaml
git commit -m "chore: monorepo scaffold with pnpm workspaces, biome, ts base"
```

### Task 0.4: Provisionar Supabase e Vercel (manual — instruções)

**Files:**
- Create: `docs/operacao/setup-supabase.md`
- Create: `docs/operacao/setup-vercel.md`

Estas Tasks precisam de ação humana em UIs web. Documente para o usuário.

- [ ] **Step 1: `docs/operacao/setup-supabase.md`**

Create com este conteúdo:

```markdown
# Setup Supabase (uma vez)

## Passo 1: Criar projeto
1. Vá em https://supabase.com/dashboard
2. Clique "New Project"
3. Nome: `crm-nogma-cavalcanti`
4. DB Password: gere um forte e SALVE no seu gerenciador
5. Região: `South America (São Paulo) sa-east-1`
6. Plano: Free (upgrade para Pro depois)

## Passo 2: Coletar credenciais
Em Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL` = URL do projeto
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public
- `SUPABASE_SERVICE_ROLE_KEY` = service_role (SECRETO — nunca no front)

Em Settings → Database → Connection string (URI):
- `SUPABASE_DB_URL` = connection string com senha

## Passo 3: Habilitar extensions
No SQL editor, rode:
\`\`\`sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\`\`\`

## Passo 4: Instalar Supabase CLI
\`\`\`bash
npm i -g supabase
supabase login
\`\`\`

## Passo 5: Linkar projeto local (após Task 3.1)
\`\`\`bash
cd <root>
supabase link --project-ref <PROJECT_REF>
\`\`\`
```

- [ ] **Step 2: `docs/operacao/setup-vercel.md`**

Create com:

```markdown
# Setup Vercel (uma vez)

## Passo 1: Criar conta e projeto
1. https://vercel.com — login com GitHub
2. Import project (só depois de você ter pushed o repo pro GitHub)
3. Root Directory: `apps/web`
4. Framework: Next.js (auto-detectado)
5. Build command: `cd ../.. && pnpm --filter web build`
6. Install command: `cd ../.. && pnpm install --frozen-lockfile`

## Passo 2: Variáveis de ambiente
Vercel dashboard → Settings → Environment Variables. Adicione para "Production" E "Preview":

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_APP_URL (URL final da Vercel)
- OPENAI_API_KEY (deixe vazio nesta fase)
- WEBHOOK_HMAC_SECRET (gere um: `openssl rand -hex 32`)

## Passo 3: Domain
- Custom domain (opcional agora): `crm.cavalcanti.com.br` — configurar CNAME no DNS.

## Passo 4: Deploy trigger
Vercel deploya automático em push para `main`. Para preview: em qualquer PR.
```

- [ ] **Step 3: Commit e AÇÃO MANUAL**

```powershell
git add docs/operacao/
git commit -m "docs: add Supabase and Vercel setup guides"
```

**AÇÃO MANUAL do usuário antes de continuar Fase 1:**
1. Criar projeto no Supabase seguindo `docs/operacao/setup-supabase.md`.
2. Criar repo `crm-nogma` no GitHub (privado) e fazer `git remote add origin ... && git push -u origin main`.
3. Importar no Vercel (não precisa deployar ainda — vai deployar sozinho depois do primeiro commit em `main`).

---

## Fase 1 — Design System (Nogma tokens + shadcn + 3 temas)

### Task 1.1: Bootstrap Next.js 15 no monorepo

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/styles/globals.css`

- [ ] **Step 1: Criar diretórios**

```powershell
New-Item -ItemType Directory -Force -Path "apps\web\app"
New-Item -ItemType Directory -Force -Path "apps\web\styles"
New-Item -ItemType Directory -Force -Path "apps\web\components\ui"
New-Item -ItemType Directory -Force -Path "apps\web\components\layout"
New-Item -ItemType Directory -Force -Path "apps\web\components\domain"
New-Item -ItemType Directory -Force -Path "apps\web\lib"
New-Item -ItemType Directory -Force -Path "apps\web\public\fonts"
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
    "react-dom": "19.0.0"
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
    "paths": {
      "@/*": ["./*"]
    },
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
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
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
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 7: `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="black"], [data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        petroleum: {
          50: 'var(--petroleum-050)',
          100: 'var(--petroleum-100)',
          200: 'var(--petroleum-200)',
          300: 'var(--petroleum-300)',
          500: 'var(--petroleum-500)',
          600: 'var(--petroleum-600)',
          700: 'var(--petroleum-700)',
          800: 'var(--petroleum-800)',
          900: 'var(--petroleum-900)',
          950: 'var(--petroleum-950)',
        },
        lime: {
          50: 'var(--lime-050)',
          100: 'var(--lime-100)',
          300: 'var(--lime-300)',
          500: 'var(--lime-500)',
          600: 'var(--lime-600)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        canvas: 'var(--bg-canvas)',
        'canvas-subtle': 'var(--bg-subtle)',
        'canvas-muted': 'var(--bg-muted)',
        surface: 'var(--surface-card)',
        'surface-raised': 'var(--surface-raised)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        border: 'var(--border-default)',
        'border-subtle': 'var(--border-subtle)',
        accent: 'var(--accent)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        lime: 'var(--shadow-lime)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 8: Instalar deps do web**

```powershell
pnpm install
```

Expected: instala Next 15, React 19, Tailwind v4. Sem erros.

### Task 1.2: Copiar tokens Nogma e criar `globals.css`

**Files:**
- Create: `apps/web/styles/nogma-tokens.css` (cópia de `.design-system/nogma-tokens.css`)
- Create: `apps/web/styles/globals.css`

- [ ] **Step 1: Copiar tokens verbatim**

```powershell
Copy-Item ".design-system\nogma-tokens.css" "apps\web\styles\nogma-tokens.css"
```

- [ ] **Step 2: `apps/web/styles/globals.css`**

```css
@import "tailwindcss";
@import "./nogma-tokens.css";

@layer base {
  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color-scheme: light dark;
  }
  html[data-theme="black"],
  html[data-theme="dark"] {
    color-scheme: dark;
  }
  body {
    background: var(--bg-canvas);
    color: var(--text-primary);
    font-family: var(--font-body);
    line-height: var(--body-leading);
  }
}
```

- [ ] **Step 3: Copiar fontes**

**AÇÃO MANUAL:** Baixe os arquivos de fonte da Nogma (Agency.otf + Raleway 300/400/500/600/700/800/900 TTF) e coloque em `apps/web/public/fonts/`. Se não conseguir imediatamente, `nogma-tokens.css` faz fallback para `system-ui` — o site funciona mas sem a personalidade Nogma. Você pode obtê-las de:
- Google Fonts (Raleway) — https://fonts.google.com/specimen/Raleway
- Agency FB é comercial; alternativa próxima gratuita: **Bebas Neue** ou **Oswald** (renomeie para `Agency.otf`) OU inspecione `nogmacorp.com.br/assets/fonts/` e baixe.

- [ ] **Step 4: Ajustar `nogma-tokens.css` para caminho relativo correto**

Edit `apps/web/styles/nogma-tokens.css` — mude todos os `url("../fonts/...")` para `url("/fonts/...")` (caminho absoluto público do Next).

Grep antes:

```powershell
Select-String -Path "apps\web\styles\nogma-tokens.css" -Pattern "url\("
```

Substituir com PowerShell:

```powershell
(Get-Content "apps\web\styles\nogma-tokens.css") -replace 'url\("\.\./fonts/', 'url("/fonts/' | Set-Content "apps\web\styles\nogma-tokens.css"
```

### Task 1.3: Root layout com `data-theme` no `<html>`

**Files:**
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/lib/theme.ts`

- [ ] **Step 1: `apps/web/lib/theme.ts`**

```typescript
import { cookies } from 'next/headers';

export type Theme = 'light' | 'black' | 'dark';
export const THEME_COOKIE = 'nogma-theme';
export const DEFAULT_THEME: Theme = 'black';

export async function getServerTheme(): Promise<Theme> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(THEME_COOKIE)?.value;
  if (raw === 'light' || raw === 'black' || raw === 'dark') return raw;
  return DEFAULT_THEME;
}
```

- [ ] **Step 2: `apps/web/app/layout.tsx`**

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
    <html lang="pt-BR" data-theme={theme === 'light' ? undefined : theme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: `apps/web/app/page.tsx` (home smoke test)**

```typescript
export default function HomePage() {
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 800, margin: '0 auto' }}>
      <p className="eyebrow">Nogma Design System</p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-5xl)' }}>
        Gestor de <span className="mark-lime">Obras</span>
      </h1>
      <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
        Se você está lendo isso com fonte serifada e sem cor lime, faltam as fontes.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Rodar dev**

```powershell
pnpm dev
```

Abra `http://localhost:3000`. Expected: fundo preto (tema black default), heading em lime, palavra "Obras" com highlight lime.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/ .gitignore
git commit -m "feat: bootstrap Next.js 15 + Nogma tokens + default black theme"
```

### Task 1.4: Instalar shadcn/ui e componentes base

**Files:**
- Create: `apps/web/components.json`
- Create: `apps/web/lib/utils.ts`
- Create: `apps/web/components/ui/button.tsx`
- Create: `apps/web/components/ui/card.tsx`
- Create: `apps/web/components/ui/dropdown-menu.tsx`

- [ ] **Step 1: Instalar utilitários**

```powershell
pnpm --filter web add class-variance-authority clsx tailwind-merge tailwindcss-animate lucide-react
pnpm --filter web add -D @radix-ui/react-slot @radix-ui/react-dropdown-menu
```

- [ ] **Step 2: `apps/web/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: `apps/web/components.json`** (shadcn config)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 4: `apps/web/components/ui/button.tsx`** (shadcn button adaptado aos tokens Nogma)

```typescript
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-[var(--dur-base)] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] shadow-lime',
        secondary: 'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-muted)]',
        ghost: 'text-[var(--text-primary)] hover:bg-[var(--bg-muted)]',
        danger: 'bg-[var(--danger)] text-white hover:opacity-90',
        link: 'text-[var(--accent)] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
```

- [ ] **Step 5: `apps/web/components/ui/card.tsx`**

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-lg font-extrabold tracking-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';
```

- [ ] **Step 6: `apps/web/components/ui/dropdown-menu.tsx`**

Copie o padrão shadcn oficial adaptado. Como referência canônica, gere via CLI:

```powershell
pnpm --filter web dlx shadcn@latest add dropdown-menu
```

Ele vai gerar `apps/web/components/ui/dropdown-menu.tsx`. Verifique que ele usa nossas variáveis CSS via classes Tailwind (`bg-canvas`, `text-text-primary` etc). Se gerar hardcoded (`bg-white`), ajuste.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/
git commit -m "feat: install shadcn/ui with Nogma tokens (Button, Card, DropdownMenu)"
```

### Task 1.5: Theme toggle (A/B/C) com persistência

**Files:**
- Create: `apps/web/components/layout/theme-toggle.tsx`
- Modify: `apps/web/app/page.tsx` (adicionar toggle na demo)
- Create: `apps/web/app/api/theme/route.ts`

- [ ] **Step 1: `apps/web/app/api/theme/route.ts`** (server action para setar cookie)

```typescript
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { theme } = await req.json();
  if (theme !== 'light' && theme !== 'black' && theme !== 'dark') {
    return NextResponse.json({ error: 'invalid theme' }, { status: 400 });
  }
  const cookieStore = await cookies();
  cookieStore.set('nogma-theme', theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: `apps/web/components/layout/theme-toggle.tsx`**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Waves } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

type Theme = 'light' | 'black' | 'dark';

const ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun className="h-4 w-4" />,
  black: <Moon className="h-4 w-4" />,
  dark: <Waves className="h-4 w-4" />,
};

const LABELS: Record<Theme, string> = {
  light: 'Claro',
  black: 'Escuro (Nogma)',
  dark: 'Petróleo',
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('black');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') ?? 'light';
    setTheme((current === 'black' || current === 'dark' ? current : 'light') as Theme);
  }, []);

  async function change(next: Theme) {
    document.documentElement.setAttribute('data-theme', next === 'light' ? '' : next);
    if (next === 'light') document.documentElement.removeAttribute('data-theme');
    setTheme(next);
    await fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Tema atual: ${LABELS[theme]}`}>
          {ICONS[theme]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(['light', 'black', 'dark'] as Theme[]).map((t) => (
          <DropdownMenuItem key={t} onClick={() => change(t)}>
            <span className="mr-2 inline-flex">{ICONS[t]}</span>
            {LABELS[t]}
            {theme === t && <span className="ml-auto text-[var(--accent)]">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Adicionar toggle na home**

Modify `apps/web/app/page.tsx`:

```typescript
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-16">
      <header className="mb-8 flex items-center justify-between">
        <p className="eyebrow">Nogma Design System</p>
        <ThemeToggle />
      </header>
      <h1 className="font-display text-5xl">
        Gestor de <span className="mark-lime">Obras</span>
      </h1>
      <p className="mt-4 text-[var(--text-secondary)]">
        Alterne o tema no ícone acima. A escolha persiste em cookie.
      </p>
      <div className="mt-8 flex gap-3">
        <Button variant="primary">CTA Primária</Button>
        <Button variant="secondary">Secundária</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Rodar e testar**

```powershell
pnpm dev
```

Abra `http://localhost:3000`. Clique no toggle. Alterne Claro → Escuro → Petróleo. Recarregue a página — o tema deve persistir.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/
git commit -m "feat: theme toggle A/B/C with cookie persistence"
```

### Task 1.6: Shell (Sidebar + Topbar + rota autenticada stub)

**Files:**
- Create: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/app/(app)/painel/page.tsx`
- Create: `apps/web/components/layout/sidebar.tsx`
- Create: `apps/web/components/layout/topbar.tsx`
- Create: `apps/web/components/layout/user-menu.tsx`

- [ ] **Step 1: `apps/web/components/layout/sidebar.tsx`**

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  FileText,
  MessageSquare,
  AlertCircle,
  Users,
  Settings,
  FileBarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
      <div className="p-6">
        <span className="font-display text-2xl font-bold tracking-tight text-[var(--accent)]">
          NOGMA
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-[color:color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-muted)]',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border-subtle)] px-3 py-3 space-y-1">
        {SECONDARY.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: `apps/web/components/layout/user-menu.tsx`** (stub — email virá da sessão em Fase 2)

```typescript
export function UserMenu({ name = 'Usuário', papel = 'Convidado' }: { name?: string; papel?: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-text)]">
        {initials}
      </div>
      <div className="text-sm">
        <div className="font-semibold text-[var(--text-primary)]">{name}</div>
        <div className="text-xs text-[var(--text-secondary)]">{papel}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `apps/web/components/layout/topbar.tsx`**

```typescript
import { Search, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './theme-toggle';

export function Topbar({ title }: { title: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-6">
      <h1 className="font-display text-xl font-extrabold tracking-tight">{title}</h1>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Buscar">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: `apps/web/app/(app)/layout.tsx`**

```typescript
import { Sidebar } from '@/components/layout/sidebar';
import { UserMenu } from '@/components/layout/user-menu';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      {/* NOTE: UserMenu placeholder — em Fase 2 vira parte real da Sidebar com sessão */}
    </div>
  );
}
```

Nota: colocamos o UserMenu embutido na Sidebar em Task futura de Auth (Fase 2). Por enquanto, o layout é suficiente para a navegação.

- [ ] **Step 5: `apps/web/app/(app)/painel/page.tsx` (stub)**

```typescript
import { Topbar } from '@/components/layout/topbar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function PainelPage() {
  return (
    <>
      <Topbar title="Painel" />
      <div className="p-6">
        <p className="eyebrow mb-2">Visão geral</p>
        <h2 className="font-display text-3xl font-extrabold">Bem-vindo ao Gestor de Obras</h2>
        <p className="mt-2 text-[var(--text-secondary)]">Sem dados ainda. Configure o Supabase e crie a primeira obra.</p>
        <div className="mt-8 grid grid-cols-4 gap-4">
          {['Obras Ativas', 'Gasto no Mês', 'Total Acumulado', 'Pendentes NF'].map((label) => (
            <Card key={label}>
              <CardHeader>
                <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
                <CardTitle>—</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Redirect da home**

Modify `apps/web/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/painel');
}
```

- [ ] **Step 7: Rodar e testar**

```powershell
pnpm dev
```

Abra `http://localhost:3000`. Redireciona pra `/painel`. Sidebar aparece com Nogma em lime, navegação com estado ativo, topbar com toggle. Alterne temas — tudo respeitando os tokens.

- [ ] **Step 8: Commit**

```powershell
git add apps/web/
git commit -m "feat: app shell with Sidebar + Topbar + Painel stub"
```

---

## Fase 2 — Autenticação Supabase e perfis

### Task 2.1: Adicionar deps Supabase e clients

**Files:**
- Modify: `apps/web/package.json` (adicionar deps)
- Create: `apps/web/lib/supabase/client.ts`
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/supabase/middleware.ts`
- Create: `apps/web/.env.example`

- [ ] **Step 1: Instalar deps**

```powershell
pnpm --filter web add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: `apps/web/.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 3: `apps/web/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 4: `apps/web/lib/supabase/server.ts`**

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
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from Server Component — cookies immutable, OK
          }
        },
      },
    },
  );
}
```

- [ ] **Step 5: `apps/web/lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
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
  if (user && isAuthRoute && url.pathname !== '/') {
    url.pathname = '/painel';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)'],
};
```

- [ ] **Step 7: Copiar `.env.example` para `.env.local` e preencher**

```powershell
Copy-Item "apps\web\.env.example" "apps\web\.env.local"
```

**AÇÃO MANUAL:** abra `apps/web/.env.local` e preencha as chaves reais do Supabase (do dashboard).

### Task 2.2: Tela de login

**Files:**
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(auth)/login/actions.ts`
- Create: `apps/web/components/ui/input.tsx`
- Create: `apps/web/components/ui/label.tsx`

- [ ] **Step 1: `apps/web/components/ui/input.tsx`**

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
```

- [ ] **Step 2: `apps/web/components/ui/label.tsx`**

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium text-[var(--text-primary)]', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
```

- [ ] **Step 3: `apps/web/app/(auth)/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: `apps/web/app/(auth)/login/actions.ts`**

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Email e senha obrigatórios' };
  }

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

- [ ] **Step 5: `apps/web/app/(auth)/login/page.tsx`**

```typescript
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { login } from './actions';

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <p className="eyebrow">Nogma</p>
        <CardTitle className="font-display text-3xl">Entrar</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={login} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" variant="primary" size="lg">
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Rodar e testar**

```powershell
pnpm dev
```

Abra `http://localhost:3000/painel` sem sessão → redireciona para `/login`. Vá pro dashboard do Supabase e crie um usuário test em Authentication → Users → Add user (email + senha). Volte à tela de login, faça login. Deve ir pro `/painel`.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/
git commit -m "feat: Supabase auth with login form and middleware guard"
```

### Task 2.3: Logout button no UserMenu real

**Files:**
- Modify: `apps/web/components/layout/user-menu.tsx`
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: `apps/web/components/layout/user-menu.tsx` (real, buscando profile)**

```typescript
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/(auth)/login/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export async function UserMenu() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? 'convidado@exemplo';
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-[var(--bg-muted)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-text)]">
          {initials}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <div className="truncate font-semibold text-[var(--text-primary)]">{email}</div>
          <div className="text-xs text-[var(--text-secondary)]">Administrador</div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <form action={logout}>
          <DropdownMenuItem asChild>
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Ajustar Sidebar (Sidebar era 'use client'; vamos separar em Server+Client)**

Modify `apps/web/components/layout/sidebar.tsx`:

```typescript
import { UserMenu } from './user-menu';
import { SidebarNav } from './sidebar-nav';

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
      <div className="p-6">
        <span className="font-display text-2xl font-bold tracking-tight text-[var(--accent)]">
          NOGMA
        </span>
      </div>
      <SidebarNav />
      <div className="border-t border-[var(--border-subtle)] p-3">
        <UserMenu />
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Extrair a nav para `sidebar-nav.tsx` (client)**

Create `apps/web/components/layout/sidebar-nav.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  FileText,
  MessageSquare,
  AlertCircle,
  Users,
  Settings,
  FileBarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-[color:color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-muted)]',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-[var(--border-subtle)] px-3 pt-3 space-y-1">
        {SECONDARY.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Testar login e logout**

Login → veja seu email no UserMenu → clique → Sair → volta pro /login.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/
git commit -m "feat: UserMenu with logout and profile display"
```

---

## Fase 3 — Schema Postgres inicial + RLS

### Task 3.1: Instalar Supabase CLI e linkar

**Files:**
- Create: `supabase/config.toml` (gerado)

- [ ] **Step 1: Instalar CLI e login**

```powershell
npm i -g supabase
supabase login
```

Abre browser, autoriza.

- [ ] **Step 2: Inicializar Supabase local**

```powershell
supabase init
```

Cria `supabase/config.toml` e `.gitignore` local.

- [ ] **Step 3: Linkar ao projeto remoto**

```powershell
supabase link --project-ref <SEU_PROJECT_REF>
```

Vai pedir a senha do banco (a que você salvou na Task 0.4).

### Task 3.2: Migration inicial — enums, extensions, trigger updated_at

**Files:**
- Create: `supabase/migrations/20260903100000_init.sql`

- [ ] **Step 1: Escrever migration**

Create `supabase/migrations/20260903100000_init.sql`:

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigger genérico updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Papel dos usuários
CREATE TYPE papel_usuario AS ENUM ('admin','gestor','financeiro','leitura');

-- Preferência de tema
CREATE TYPE tema_preferido AS ENUM ('light','black','dark');

-- Origem de fornecedor
CREATE TYPE origem_fornecedor AS ENUM ('manual','auto_detectado');

-- Documento tipo
CREATE TYPE documento_tipo AS ENUM ('cnpj','cpf');

-- Obra tipo/status
CREATE TYPE obra_tipo AS ENUM ('nova','reforma');
CREATE TYPE obra_status AS ENUM ('ativa','pausada','concluida','arquivada');

-- Pagamento origem/status
CREATE TYPE pagamento_origem AS ENUM ('whatsapp','manual','importado');
CREATE TYPE pagamento_status AS ENUM ('confirmado','aguardando','erro');

-- Documento tipo (anexo)
CREATE TYPE anexo_tipo AS ENUM ('nota_fiscal','comprovante','contrato','outro');

-- Mensagem WhatsApp
CREATE TYPE msg_tipo AS ENUM ('texto','imagem','pdf','audio');
CREATE TYPE msg_status AS ENUM ('recebida','processando','classificada','confirmada','erro');
```

- [ ] **Step 2: Push migration para o Supabase remoto**

```powershell
supabase db push
```

Expected: aplica sem erro. Verifique no dashboard Supabase → Database → Types que os enums aparecem.

- [ ] **Step 3: Commit**

```powershell
git add supabase/
git commit -m "feat(db): initial migration with extensions, updated_at trigger, enums"
```

### Task 3.3: Migration — profiles, autorizados, categorias

**Files:**
- Create: `supabase/migrations/20260903100100_profiles_autorizados_categorias.sql`

- [ ] **Step 1: Escrever migration**

Create `supabase/migrations/20260903100100_profiles_autorizados_categorias.sql`:

```sql
-- Profiles (1:1 com auth.users)
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  papel papel_usuario NOT NULL DEFAULT 'leitura',
  telefone TEXT,
  avatar_url TEXT,
  tema_preferido tema_preferido DEFAULT 'black',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger de auto-criação de profile ao criar auth.user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (user_id, nome, papel)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)), 'leitura');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Equipe autorizada (números que podem mandar WhatsApp)
CREATE TABLE autorizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone_whats TEXT UNIQUE NOT NULL,
  papel_obra TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE TRIGGER trg_autorizados_updated BEFORE UPDATE ON autorizados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT UNIQUE NOT NULL,
  cor TEXT,
  icone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE TRIGGER trg_categorias_updated BEFORE UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 2: Push**

```powershell
supabase db push
```

- [ ] **Step 3: Commit**

```powershell
git add supabase/
git commit -m "feat(db): profiles, autorizados, categorias with auto-profile trigger"
```

### Task 3.4: Migration — obras, fornecedores, apelidos

**Files:**
- Create: `supabase/migrations/20260903100200_obras_fornecedores.sql`

- [ ] **Step 1: Escrever migration**

```sql
CREATE TABLE obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cliente TEXT,
  tipo obra_tipo,
  orcamento NUMERIC(12,2),
  status obra_status DEFAULT 'ativa',
  data_inicio DATE,
  data_prevista_fim DATE,
  endereco JSONB,
  apelidos TEXT[] DEFAULT '{}',
  onedrive_folder_id TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_obras_status ON obras(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_obras_apelidos_gin ON obras USING GIN(apelidos);
CREATE TRIGGER trg_obras_updated BEFORE UPDATE ON obras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  razao_social TEXT,
  documento TEXT,
  documento_tipo documento_tipo,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  telefone TEXT,
  email TEXT,
  origem origem_fornecedor DEFAULT 'manual',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_fornecedores_doc_unique ON fornecedores(documento)
  WHERE documento IS NOT NULL AND deleted_at IS NULL;
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON fornecedores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE fornecedor_apelidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  apelido TEXT NOT NULL,
  criado_por_ia BOOLEAN DEFAULT false,
  vezes_visto INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_apelidos_fornecedor ON fornecedor_apelidos(fornecedor_id);
CREATE INDEX idx_apelidos_texto ON fornecedor_apelidos(lower(apelido));
```

- [ ] **Step 2: Push**

```powershell
supabase db push
```

- [ ] **Step 3: Commit**

```powershell
git add supabase/
git commit -m "feat(db): obras, fornecedores, fornecedor_apelidos"
```

### Task 3.5: Migration — pagamentos, documentos, mensagens_whats

**Files:**
- Create: `supabase/migrations/20260903100300_pagamentos_documentos_mensagens.sql`

- [ ] **Step 1: Escrever migration**

```sql
-- mensagens_whats primeiro (pagamentos referencia)
CREATE TABLE mensagens_whats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_id_uazapi TEXT UNIQUE NOT NULL,
  telefone_from TEXT NOT NULL,
  autorizado_id UUID REFERENCES autorizados(id) ON DELETE SET NULL,
  tipo msg_tipo NOT NULL,
  texto_bruto TEXT,
  midia_storage_path TEXT,
  midia_mime TEXT,
  recebida_em TIMESTAMPTZ NOT NULL,
  status msg_status NOT NULL DEFAULT 'recebida',
  dados_extraidos JSONB,
  confianca_ia NUMERIC(4,3),
  erro_msg TEXT,
  pagamento_id UUID,  -- FK adicionada depois (circular)
  documento_id UUID,  -- FK adicionada depois
  tentativas_reprocessamento INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_msgs_status ON mensagens_whats(status);
CREATE INDEX idx_msgs_recebida_em ON mensagens_whats(recebida_em DESC);
CREATE TRIGGER trg_msgs_updated BEFORE UPDATE ON mensagens_whats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE RESTRICT,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  data_pagamento DATE NOT NULL DEFAULT current_date,
  origem pagamento_origem NOT NULL,
  status_pagto pagamento_status DEFAULT 'confirmado',
  criado_por_user_id UUID REFERENCES profiles(user_id),
  criado_via_msg_id UUID REFERENCES mensagens_whats(id) DEFERRABLE INITIALLY DEFERRED,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_pagamentos_obra_data ON pagamentos(obra_id, data_pagamento DESC);
CREATE INDEX idx_pagamentos_fornecedor ON pagamentos(fornecedor_id);
CREATE INDEX idx_pagamentos_status ON pagamentos(status_pagto);
CREATE TRIGGER trg_pagamentos_updated BEFORE UPDATE ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id UUID REFERENCES pagamentos(id) ON DELETE SET NULL,
  obra_id UUID REFERENCES obras(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  tipo anexo_tipo NOT NULL,
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho_bytes BIGINT,
  storage_path TEXT NOT NULL,
  onedrive_file_id TEXT,
  numero_nf TEXT,
  chave_acesso_nf TEXT,
  hash_sha256 TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_documentos_chave_nf ON documentos(chave_acesso_nf)
  WHERE chave_acesso_nf IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_documentos_hash ON documentos(hash_sha256)
  WHERE hash_sha256 IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_documentos_pagamento ON documentos(pagamento_id);
CREATE INDEX idx_documentos_obra ON documentos(obra_id);
CREATE INDEX idx_documentos_fornecedor ON documentos(fornecedor_id);
CREATE TRIGGER trg_documentos_updated BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Agora adicionamos FKs em mensagens_whats
ALTER TABLE mensagens_whats
  ADD CONSTRAINT fk_msgs_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE mensagens_whats
  ADD CONSTRAINT fk_msgs_documento FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE confirmacoes_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id UUID NOT NULL REFERENCES mensagens_whats(id) ON DELETE CASCADE,
  pergunta_enviada TEXT NOT NULL,
  msg_id_pergunta_uazapi TEXT,
  respondida_em TIMESTAMPTZ,
  resposta_bruta TEXT,
  resolvida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 2: Push**

```powershell
supabase db push
```

- [ ] **Step 3: Commit**

```powershell
git add supabase/
git commit -m "feat(db): pagamentos, documentos, mensagens_whats, confirmacoes"
```

### Task 3.6: Migration — audit_log e suporte

**Files:**
- Create: `supabase/migrations/20260903100400_audit_notif_lembretes.sql`

- [ ] **Step 1: Migration**

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('insert','update','delete')),
  diff JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_entidade ON audit_log(entidade, entidade_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);

CREATE TABLE notificacoes_email (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo TEXT NOT NULL,
  enviada_em TIMESTAMPTZ,
  erro TEXT,
  contexto JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lembretes_agendados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  alvo_id UUID,
  cron_expressao TEXT NOT NULL,
  ultima_execucao TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 2: Push e commit**

```powershell
supabase db push
git add supabase/
git commit -m "feat(db): audit_log, notificacoes_email, lembretes_agendados"
```

### Task 3.7: Migration — RLS policies

**Files:**
- Create: `supabase/migrations/20260903100500_rls_policies.sql`

- [ ] **Step 1: Migration**

```sql
-- Habilitar RLS em todas as tabelas de negócio
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedor_apelidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_whats ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmacoes_pendentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE lembretes_agendados ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se user tem papel
CREATE OR REPLACE FUNCTION has_role(roles papel_usuario[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND papel = ANY(roles)
  );
$$;

-- Profiles: cada um lê o seu; admin lê todos
CREATE POLICY profiles_self_select ON profiles FOR SELECT
  USING (user_id = auth.uid() OR has_role(ARRAY['admin']::papel_usuario[]));
CREATE POLICY profiles_self_update ON profiles FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY profiles_admin_all ON profiles FOR ALL
  USING (has_role(ARRAY['admin']::papel_usuario[]));

-- Padrão para tabelas de negócio (autorizados, categorias, obras, fornecedores, fornecedor_apelidos, pagamentos, documentos, mensagens_whats, confirmacoes_pendentes)
-- SELECT: qualquer autenticado
-- INSERT/UPDATE: admin, gestor, financeiro
-- DELETE: admin

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['autorizados','categorias','obras','fornecedores','fornecedor_apelidos','pagamentos','documentos','mensagens_whats','confirmacoes_pendentes']::TEXT[])
  LOOP
    EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (auth.uid() IS NOT NULL);', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON %I FOR INSERT WITH CHECK (has_role(ARRAY[''admin'',''gestor'',''financeiro'']::papel_usuario[]));', t, t);
    EXECUTE format('CREATE POLICY %I_update ON %I FOR UPDATE USING (has_role(ARRAY[''admin'',''gestor'',''financeiro'']::papel_usuario[]));', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON %I FOR DELETE USING (has_role(ARRAY[''admin'']::papel_usuario[]));', t, t);
  END LOOP;
END $$;

-- audit_log: só admin lê; sistema (service_role) escreve
CREATE POLICY audit_admin_select ON audit_log FOR SELECT
  USING (has_role(ARRAY['admin']::papel_usuario[]));

-- notificacoes_email e lembretes: só admin
CREATE POLICY notif_admin ON notificacoes_email FOR ALL
  USING (has_role(ARRAY['admin']::papel_usuario[]));
CREATE POLICY lembretes_admin ON lembretes_agendados FOR ALL
  USING (has_role(ARRAY['admin']::papel_usuario[]));
```

- [ ] **Step 2: Push**

```powershell
supabase db push
```

- [ ] **Step 3: Testar RLS manualmente**

No SQL editor do Supabase, rode como service_role:

```sql
-- Crie um profile admin pro seu usuário test
UPDATE profiles SET papel = 'admin' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'seu_email@ex.com');
```

Depois, no seu app (autenticado como esse user), tente ler e escrever — deve funcionar. Deslogue e tente acessar rota `/painel` sem login — deve redirecionar.

- [ ] **Step 4: Commit**

```powershell
git add supabase/
git commit -m "feat(db): RLS policies for all business tables"
```

### Task 3.8: Seed inicial

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Migration**

Create `supabase/seed.sql`:

```sql
-- Categorias base (conforme análise dos MDs)
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
```

- [ ] **Step 2: Aplicar seed**

```powershell
supabase db reset --linked
```

**ATENÇÃO:** `db reset` APAGA todos os dados. Só rode se estiver ok perder o que estiver lá. Alternativa segura:

```powershell
Get-Content supabase\seed.sql | supabase db execute
```

- [ ] **Step 3: Verificar no dashboard**

Supabase → Table Editor → categorias → deve ter 8 linhas.

- [ ] **Step 4: Commit**

```powershell
git add supabase/seed.sql
git commit -m "feat(db): seed with 8 base categorias"
```

### Task 3.9: Gerar tipos TS e criar pacote `@nogma/db`

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/types.ts` (gerado)

- [ ] **Step 1: Criar diretório**

```powershell
New-Item -ItemType Directory -Force -Path "packages\db\src"
```

- [ ] **Step 2: `packages/db/package.json`**

```json
{
  "name": "@nogma/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts"
  },
  "scripts": {
    "gen-types": "supabase gen types typescript --linked > src/types.ts",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "@supabase/supabase-js": "^2"
  }
}
```

- [ ] **Step 3: `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Gerar tipos**

```powershell
pnpm -w install
pnpm --filter @nogma/db gen-types
```

Isso cria `packages/db/src/types.ts` com todas as tabelas tipadas.

- [ ] **Step 5: `packages/db/src/index.ts`**

```typescript
export type { Database } from './types';
```

- [ ] **Step 6: Consumir no web**

Modify `apps/web/package.json` — adicione em `dependencies`:

```json
"@nogma/db": "workspace:*"
```

Rode `pnpm install`.

Modify `apps/web/lib/supabase/server.ts` e `client.ts` — importe `Database`:

```typescript
import type { Database } from '@nogma/db';
// ... no createServerClient/createBrowserClient adicione o generic <Database>
```

Exemplo para `server.ts`:

```typescript
return createServerClient<Database>( /* ... */ );
```

- [ ] **Step 7: Typecheck**

```powershell
pnpm typecheck
```

Expected: sem erros.

- [ ] **Step 8: Commit**

```powershell
git add packages/ apps/web/
git commit -m "feat: @nogma/db package with generated Supabase types"
```

### Task 3.10: Testar Painel real (contar linhas do banco)

**Files:**
- Modify: `apps/web/app/(app)/painel/page.tsx`

- [ ] **Step 1: Substituir stub por consulta real**

Modify `apps/web/app/(app)/painel/page.tsx`:

```typescript
import { Topbar } from '@/components/layout/topbar';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

export default async function PainelPage() {
  const supabase = await createClient();
  const [obras, pagamentos, docs, msgs] = await Promise.all([
    supabase.from('obras').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('pagamentos').select('valor', { count: 'exact' }).is('deleted_at', null),
    supabase.from('documentos').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('mensagens_whats').select('id', { count: 'exact', head: true }).eq('status', 'recebida'),
  ]);

  const totalGasto = (pagamentos.data ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0);
  const kpis = [
    { label: 'Obras Ativas', valor: String(obras.count ?? 0) },
    { label: 'Gasto Acumulado', valor: totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    { label: 'Documentos', valor: String(docs.count ?? 0) },
    { label: 'Mensagens na fila', valor: String(msgs.count ?? 0) },
  ];

  return (
    <>
      <Topbar title="Painel" />
      <div className="p-6">
        <p className="eyebrow mb-2">Visão geral</p>
        <h2 className="font-display text-3xl font-extrabold">Gestor de Obras — Cavalcanti</h2>
        <div className="mt-8 grid grid-cols-4 gap-4">
          {kpis.map(({ label, valor }) => (
            <Card key={label}>
              <CardHeader>
                <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
                <CardTitle className="font-display text-3xl text-[var(--accent)]">{valor}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Rodar e verificar**

```powershell
pnpm dev
```

Acesse `/painel` autenticado. KPIs mostram zeros (tudo vazio). Sem erros de console. Tipo `Database` inferido corretamente.

- [ ] **Step 3: Commit**

```powershell
git add apps/web/
git commit -m "feat: Painel with real KPI counts from Supabase"
```

---

## Encerramento do Plano #1

### Task 4.1: Deploy final e smoke test em produção

**Files:** Nenhum (verificações)

- [ ] **Step 1: Push para main**

```powershell
git push origin main
```

Vercel detecta e deploya automaticamente.

- [ ] **Step 2: Verificar deploy Vercel**

Abra o dashboard Vercel. Deploy deve estar green. Abra a URL de produção.

- [ ] **Step 3: Smoke test em prod**
- Redireciona `/` → `/login` (sem sessão) ✓
- Login funciona ✓
- Após login: `/painel` mostra sidebar Nogma, KPIs com zeros, toggle A/B/C funciona e persiste ✓
- Logout volta pra `/login` ✓

- [ ] **Step 4: Documentar issues encontrados**

Se algo quebrou, criar issues no GitHub e priorizar Plano #2.

### Task 4.2: Escrever changelog e handoff para Plano #2

**Files:**
- Create: `docs/CHANGELOG.md`

- [ ] **Step 1: `docs/CHANGELOG.md`**

```markdown
# Changelog

## Plano #1 — Fundações (concluído YYYY-MM-DD)

### Adicionado
- Monorepo pnpm com apps/web + packages/db
- Design system Nogma (tokens verbatim, 3 temas via `data-theme`)
- shadcn/ui: Button, Card, Input, Label, DropdownMenu (com tokens Nogma)
- Layout global: Sidebar, Topbar, UserMenu, ThemeToggle
- Autenticação Supabase (login/logout com middleware guard)
- Schema Postgres inicial: profiles, autorizados, categorias, obras, fornecedores, fornecedor_apelidos, pagamentos, documentos, mensagens_whats, confirmacoes_pendentes, audit_log, notificacoes_email, lembretes_agendados
- RLS habilitado em todas as tabelas com policies por papel
- Seed com 8 categorias base
- Tipos TS gerados via `supabase gen types`
- Painel com KPIs reais (contadores do banco)
- Deploy Vercel automático em push para `main`

### Próximo
- Plano #2 — CRUD Base (Fases 4-9): Obras, Fornecedores, Pagamentos manuais, Documentos, Painel completo, Pendências.
```

- [ ] **Step 2: Commit final**

```powershell
git add docs/CHANGELOG.md
git commit -m "docs: changelog for Plano #1 (Fundações) completion"
git push
```

---

## Notas para próximos planos

- **Plano #2 (CRUD Base)** vai precisar de:
  - `@nogma/shared` pra tipos comuns (não temos ainda — criar quando precisarmos do primeiro type compartilhado entre packages/apps)
  - `<DataTable>` reusável baseado em TanStack Table (Task grande — reservar 1 dia)
  - Server Actions padronizadas com validação Zod
- **Fontes Agency + Raleway** — se ainda não copiou, faça antes de fechar Plano #1 pra ver o look final.
- **Backup:** vale fazer um snapshot do Supabase agora (dashboard → Database → Backups) — antes de começar a receber dados de teste.

---

## Self-review (feito antes de entregar)

- ✅ **Spec coverage**: todas as seções do spec relevantes a Fundações estão cobertas (§4 design system, §5 estrutura repo, §6 schema, §9 RLS/auth, parte do §11 fases 0-3)
- ✅ **Placeholder scan**: sem TBD/TODO/vago
- ✅ **Type consistency**: enums `papel_usuario`, `msg_status` etc consistentes entre migrations e uso; `Theme` = `'light' | 'black' | 'dark'` consistente em `theme.ts`, `theme-toggle.tsx` e API
- ✅ **Circular FK** tratado (DEFERRABLE INITIALLY DEFERRED em `criado_via_msg_id` e `fk_msgs_pagamento`/`fk_msgs_documento`)
- ⚠️ **Nota assumida**: fontes Agency/Raleway precisam ser fornecidas manualmente (Step 3 da Task 1.2 documenta isso claramente)
- ⚠️ **Nota assumida**: `supabase db reset` na Task 3.8 é destrutivo — alternativa não-destrutiva incluída
- ⚠️ **Nota assumida**: Vercel monorepo build command precisa ser confirmado (`cd ../.. && pnpm --filter web build`) — Vercel geralmente detecta pnpm workspaces sozinho, mas se falhar, o comando está documentado em `docs/operacao/setup-vercel.md`
