# Auditoria Frontend + Infraestrutura — CRM Nogma-Cavalcanti
**Data:** 2026-09-08
**Escopo:** XSS/CSRF · Bundle · Env Vars · Deploy · A11y · Performance
**Revisado por:** Claude Code (claude-sonnet-4-6)
**Branch:** main · commit ff16552

---

## Legenda
| Icone | Severidade | Acao |
|-------|-----------|------|
| CRIT | Exploracao imediata possivel | Fix antes de producao |
| HIGH | Risco real, superficie exposta | Fix neste sprint |
| MED | Qualidade/hardening | Fix proxima milestone |
| INFO | Observacao positiva ou melhoria menor | Backlog |

---

## 1. XSS

### CHECK PASS — innerHTML unsafe
**Resultado:** Nenhuma ocorrencia encontrada em todo `apps/web`.
Diff viewer (Fase 11) e analytics nao utilizam innerHTML unsafe.

---

### HIGH — iframe sem allow-scripts bloqueado (email preview)

**Arquivo:** `app/(app)/notificacoes/[id]/page.tsx:115-120`

```tsx
<iframe
  className="notif-preview-iframe"
  srcDoc={notif.corpo}
  title={`Preview do email: ${notif.assunto}`}
  sandbox="allow-same-origin"
/>
```

**Problema:** `sandbox="allow-same-origin"` sem `allow-scripts` impede execucao de JS inline no HTML do email — correto. Porem, `allow-same-origin` em `srcDoc` e **perigoso**: o documento carregado trata-se como mesma origem, podendo acessar `document.cookie`, `localStorage` e chamar `fetch` para a mesma origem. O vetor real: corpo de email malicioso com HTML que acessa dados da sessao via DOM (nao JS, apenas CSS + referencia de formulario ou meta-refresh). A pratica recomendada para previews de email e omitir `allow-same-origin` inteiramente.

**Recomendacao:** Substituir `sandbox="allow-same-origin"` por `sandbox=""` (nenhum privilegio) ou `sandbox="allow-popups"` apenas se links externos forem necessarios. Testar que o preview visual continua funcional (estilos inline e imagens ainda carregam sem `allow-same-origin`).

---

### CHECK PASS — href dinamico / open redirect
`components/layout/sidebar-nav.tsx` — hrefs vem de array estatico de rotas, nao de user input. Sem risco.

---

### CHECK PASS — URL params ecoados sem escape (?error= / ?success=)
`StatusBanner.tsx` recebe os valores ja como strings tipadas de Server Actions. O componente renderiza via React (nao innerHTML). React escapa automaticamente. Sem risco de XSS.

---

### CHECK PASS — Imagens dinamicas de avatar
`Avatar.tsx:49` — usa `<img>` nativo. `src` vem de URLs do Supabase Storage (dominio controlado, nao user input direto). Sem risco de XSS via `src`, mas ver Performance secao 8 para otimizacao.

---

## 2. CSRF

### CHECK PASS — Server Actions Next.js
Server Actions em Next.js 15/16 incluem protecao CSRF built-in por design: somente `POST` com `Content-Type: application/x-www-form-urlencoded` ou `multipart/form-data` sao aceitos; requisicoes cross-origin sem `Origin` correto sao bloqueadas pelo runtime. Nenhuma action custom de CSRF e necessaria.

---

### CHECK PASS — Webhooks — HMAC substitui CSRF
`app/api/webhooks/uazapi/route.ts` verifica `HMAC-SHA256` via `verifyHmacSignature()` antes de processar payload. Correto — webhooks sao endpoints publicos por design; HMAC e o mecanismo adequado.

---

### CHECK PASS — Cron endpoint — protegido por CRON_SECRET
`app/api/cron/sweep-pending-documentos/route.ts:23-25` valida `Authorization: Bearer CRON_SECRET`. Vercel injeta o header automaticamente. Correto.

---

### MED — Cookie de tema sem flag Secure

**Arquivo:** `app/api/theme/route.ts:13`
O cookie de tema usa `sameSite: 'lax'` mas nao seta `secure: true` explicitamente. Em producao (HTTPS) o cookie funciona, mas sem a flag `secure` o cookie poderia ser enviado em contextos HTTP em caso de misconfiguration de proxy.

**Recomendacao:** Adicionar `secure: process.env.NODE_ENV === 'production'` ao set-cookie do tema.

---

### INFO — Supabase-SSR cookies
A lib `@supabase/ssr` gerencia os cookies de sessao com `SameSite=Lax` por padrao, adequado para um app SPA-like com server actions. Nenhum ajuste necessario.

---

## 3. Client Bundle

### CHECK PASS — Separacao client/server
`'use client'` encontrado em **24 arquivos** — todos sao componentes interativos legitimos (tabelas com filtros, formularios, charts, toggles de tema, nav mobile). Nenhum page.tsx principal usa `'use client'` diretamente.

**Checagem de vazamento:** `lib/services/*` e `lib/data/*` tem `import 'server-only'` em **todos os 32 modulos** verificados. O unico `'use client'` que importa de `lib/services` e `importar-client.tsx:8`:

```ts
import type { PreviewResult, PreviewRow } from '@/lib/services/import-pagamentos';
```

Isso importa **apenas tipos TypeScript** (removidos em build-time pelo compilador), nao codigo runtime. **Sem risco.**

---

### MED — Recharts em 3 chart components sem lazy loading

**Arquivos:**
- `app/(app)/painel/charts/line-acumulado.tsx`
- `app/(app)/painel/charts/donut-categoria.tsx`
- `app/(app)/painel/charts/bar-serie-mensal.tsx`

Recharts adiciona ~180KB (minified+gzipped ~60KB). Todos os tres sao `'use client'` e importam diretamente. Se o `/painel` e a landing page pos-login, o bundle principal carrega Recharts imediatamente.

**Recomendacao:** Envolver em `dynamic(() => import(...), { ssr: false })` em `painel/page.tsx` para split de chunk lazy. Impacto real: ~60KB a menos no initial load.

---

## 4. Env Vars

### CHECK PASS — NEXT_PUBLIC_* sao todos seguros para client
Vars publicas encontradas no `.env.example`:
| Var | Seguro? |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | OK — projetado para ser publico |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | OK — RLS protege os dados |
| `NEXT_PUBLIC_APP_URL` | OK — sem risco |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | OK — projetado para ser publico |

Nenhum secret (`SERVICE_ROLE_KEY`, `WEBHOOK_HMAC_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`) tem prefixo `NEXT_PUBLIC_`.

---

### MED — `.env.example` incompleto

**Arquivo:** `apps/web/.env.example`

Variaveis usadas no codigo mas **ausentes** do `.env.example`:
- `CRON_SECRET` (usado em `sweep-pending-documentos/route.ts`)
- `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` (usado em `login-form.tsx`)
- `RESEND_API_KEY` (provavel — `lib/email/resend-provider.ts` existe)

**Risco:** Desenvolvedor novo pode deployar sem `CRON_SECRET` — o cron ficaria sem auth. O codigo valida a ausencia e retorna 401, mas o `.env.example` deveria documentar todas as vars obrigatorias.

**Recomendacao:** Adicionar as tres vars ao `.env.example` com comentarios indicando obrigatoriedade vs opcional.

---

## 5. Vercel Config

### CHECK PASS — Cron configurado corretamente
`vercel.json` define um unico cron `0 3 * * *` (diario 03:00 UTC) para `/api/cron/sweep-pending-documentos`. Dentro dos limites do plano Hobby. Schema validado com `$schema`.

---

### CRIT — Security Headers ausentes em `next.config.ts`

**Arquivo:** `apps/web/next.config.ts`

O arquivo **nao define nenhum HTTP security header**. Em particular, estao ausentes:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: (ver abaixo)
```

**Impacto:**
- **Clickjacking:** Sem `X-Frame-Options` ou CSP `frame-ancestors`, a aplicacao pode ser embarcada em iframes por terceiros — vetor de clickjacking para acoes administrativas.
- **MIME Sniffing:** Sem `X-Content-Type-Options: nosniff`, browsers podem interpretar respostas como tipos diferentes do declarado.
- **CSP ausente:** Sem Content-Security-Policy, qualquer JS injetado (via extensao, supply chain) executa sem restricao.

**Recomendacao:** Adicionar bloco `async headers()` ao `next.config.ts`:

```ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: "camera=(), microphone=(), geolocation=()" },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://js.hcaptcha.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://*.supabase.co",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "frame-src https://hcaptcha.com https://*.hcaptcha.com",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    },
  ];
},
```

> Nota: `'unsafe-inline'` em `script-src` e necessario enquanto Recharts e outros injetam estilos inline. Migrar para hashes ou nonces em Fase futura para CSP nivel 3.

---

### CHECK PASS — Middleware matcher correto
`middleware.ts` exclui `_next/static`, `_next/image`, `favicon.ico`, `fonts/`, `logos/`, e extensoes de imagem. Assets estaticos nao passam pelo middleware de auth. Correto.

---

## 6. GitHub Actions

### CHECK PASS — Secrets via `${{ secrets.* }}` — sem hardcode
Todos os secrets em `e2e.yml` usam `${{ secrets.NOME }}`. Nenhum valor hardcoded encontrado.

---

### MED — Action de terceiro sem SHA pinned

**Arquivo:** `.github/workflows/e2e.yml:117`

```yaml
uses: patrickedqvist/wait-for-vercel-preview@v1.3.1
```

Actions de terceiros referenciadas por tag semantica (`@v1.3.1`) em vez de SHA de commit sao vulneraveis a tag mutation (supply chain attack). As actions oficiais (`actions/checkout@v4`, etc.) seguem politica de SHA imutavel por tag, mas actions de terceiros nao tem essa garantia.

**Recomendacao:** Substituir por SHA do commit correspondente, ou usar a implementacao inline em shell ja documentada no comentario das linhas 99-111 do proprio arquivo.

---

### INFO — Actions oficiais com versoes fixas
`actions/checkout@v4`, `actions/setup-node@v4`, `actions/cache@v4`, `actions/upload-artifact@v4`, `actions/github-script@v7` — todas com versoes major fixas. Adequado.

---

## 7. Acessibilidade (A11y)

### CHECK PASS — Skip link funcional
`app/layout.tsx:19` — `<a href="#main-content" className="a11y-skip-link">` presente.
`styles/a11y.css` — `.a11y-skip-link` com `top: -100px` e `:focus { top: 8px }`. Correto e funcional.

---

### CHECK PASS — focus-visible global
`styles/a11y.css:31-48` — `focus-visible` aplicado globalmente com outline de 2px em `--border-focus`. Usa `:focus-visible` nao `:focus`, portanto nao afeta cliques mouse. Correto.

---

### CHECK PASS — prefers-reduced-motion
`styles/a11y.css:54-63` — `@media (prefers-reduced-motion: reduce)` desativa animacoes longas. Correto.

---

### CHECK PASS — Botoes icon-only com aria-label
`IconButton.tsx:43` — `aria-label={label}` sempre presente (prop obrigatoria por tipo TypeScript). Todos os usos auditados passam label explicito. Correto.

---

### CHECK PASS — Landmarks semanticos
`app/(app)/layout.tsx:7` — `<main id="main-content">` presente.
`app/layout.tsx` — `<html lang="pt-BR">`. Correto.

---

### MED — Avatar com alt text verbose em contexto decorativo

**Arquivo:** `components/nogma/Avatar.tsx:49`

```tsx
{src ? <img src={src} alt={name} /> : <span>{initials(name)}</span>}
```

Quando o Avatar e decorativo (nome ja aparece ao lado na UI), `alt={name}` faz o leitor de tela anunciar "imagem de Joao Silva" redundantemente.

**Recomendacao:** Avaliar contexto de uso. Se o nome aparece visualmente ao lado do avatar, usar `alt=""`. Se o avatar e o unico identificador visual, manter `alt={name}`.

---

### MED — StatusBanner ecoa valor raw de ?error= (message injection)

**Arquivo:** `components/nogma/StatusBanner.tsx:26`

O componente renderiza `{error ?? success}` como texto React (seguro contra XSS via React escaping), mas os valores chegam de query params que qualquer usuario pode manipular. Um atacante pode craftar links `?error=<mensagem+enganosa>` e enviá-los para outros usuarios (phishing por social engineering).

**Recomendacao:** Definir whitelist de mensagens de erro por chave (`?error=invalid_token` mapeado para texto localizado) em vez de ecoar o valor raw do query param.

---

### INFO — `sr-only` e min touch target implementados
`styles/a11y.css:66-87` — `.sr-only` e `min-width/height 32px` para `button[aria-label]`. Correto.

---

## 8. Performance

### MED — Nenhum `loading.tsx` em nenhuma rota

**Resultado:** Glob `**/loading.tsx` → 0 arquivos encontrados.

Next.js suporta `loading.tsx` como Suspense boundary automatico para cada segmento de rota. Sem esses arquivos, o usuario ve tela em branco enquanto o servidor esta fazendo fetch de dados. Afeta especialmente `/painel`, `/pagamentos`, `/relatorios` que tem queries pesadas.

**Recomendacao:** Adicionar `loading.tsx` minimos nas rotas principais com skeleton ou spinner.

---

### MED — Nenhum empty state em tabelas

**Resultado:** Nenhum componente `EmptyState` encontrado na codebase.

Tabelas renderizadas pelo `data-table.tsx` quando vazias exibem tabela com zero linhas sem mensagem orientando o usuario. Afeta onboarding de novos tenants.

**Recomendacao:** Adicionar prop `emptyMessage` ao `data-table.tsx` e renderizar estado visual quando `data.length === 0`.

---

### CHECK PASS — next/image usado corretamente
Imagens de logo e login usam `Image from 'next/image'`. O unico `<img>` nativo e o `Avatar.tsx` (foto circular, aceitavel). `next.config.ts` define `remotePatterns` para `**.supabase.co`. Correto.

---

### CHECK PASS — Font display: swap
`styles/tokens/fonts.css` — todos os `@font-face` (8 pesos de Raleway + Agency.otf) definem `font-display: swap`. Correto.

---

## 9. PWA / Meta

### HIGH — Sem manifest.json / PWA

**Resultado:** `public/` contem apenas `fonts/` e `logos/`. Nenhum `manifest.json` ou `manifest.webmanifest`.

**Impacto:** Sem manifest, o app nao pode ser instalado como PWA. Para gestores de obras que usam o CRM em campo (uso mobile frequente), isso e impacto real na experiencia.

**Recomendacao:** Criar `public/manifest.json` minimo com `name`, `short_name`, `icons` (192x192 e 512x512), `theme_color`, `display: standalone`. Adicionar `<link rel="manifest">` em `app/layout.tsx`.

---

### HIGH — Sem OpenGraph / meta tags sociais

**Arquivo:** `app/layout.tsx:5-8`

Metadata define apenas `title` e `description`. Nenhum `openGraph`, `twitter`, `icons`, ou `viewport` definido. Ao compartilhar links do CRM via WhatsApp/Slack, nao havera preview card.

**Recomendacao:** Expandir o objeto `metadata` com `icons`, `openGraph`, e `viewport` basicos no root layout.

---

### INFO — Favicon excluido do middleware
`middleware.ts` exclui `favicon.ico` de autenticacao. Correto.

---

## Resumo de Findings

| ID | Severidade | Categoria | Titulo |
|----|-----------|-----------|--------|
| F-01 | CRIT | Infra/Deploy | Security Headers ausentes (X-Frame-Options, CSP, nosniff) |
| F-02 | HIGH | XSS | iframe email preview com `allow-same-origin` perigoso |
| F-03 | HIGH | PWA/Meta | Sem manifest.json e sem OpenGraph tags |
| F-04 | MED | CSRF/Cookies | Cookie de tema sem flag `secure` |
| F-05 | MED | Env Vars | `.env.example` incompleto (faltam CRON_SECRET, HCAPTCHA_SITE_KEY, RESEND_API_KEY) |
| F-06 | MED | Bundle | Recharts sem lazy loading em `/painel` |
| F-07 | MED | CI/CD | Action de terceiro `patrickedqvist/wait-for-vercel-preview` sem SHA pinned |
| F-08 | MED | A11y | Avatar decorativo com alt text verbose |
| F-09 | MED | A11y | StatusBanner ecoa valor raw de ?error= (message injection) |
| F-10 | MED | Performance | Sem loading.tsx em nenhuma rota (blank screen durante fetch) |
| F-11 | MED | Performance | Sem empty states em tabelas |
| F-12 | INFO | A11y | Reduced-motion, focus-visible, skip-link, sr-only — todos corretos |
| F-13 | INFO | Bundle | server-only guard em todos os 32 modulos lib/data e lib/services |
| F-14 | INFO | XSS | Sem innerHTML unsafe em toda a codebase |
| F-15 | INFO | CSRF | Server Actions CSRF built-in + HMAC em webhooks + CRON_SECRET em cron |
| F-16 | INFO | Performance | Font display:swap em todos @font-face, next/image em logos |

---

## Prioridade de Execucao

### Imediato (antes do proximo deploy producao)
1. **F-01** — Adicionar security headers em `next.config.ts` (30 min, impacto maximo)
2. **F-02** — Remover `allow-same-origin` do iframe email preview (5 min)

### Proximo sprint
3. **F-03** — Criar manifest.json + OpenGraph metadata (1h)
4. **F-05** — Completar `.env.example` com vars faltantes (15 min)
5. **F-10** — Adicionar `loading.tsx` nas 5 rotas principais (2h)

### Backlog
6. **F-06** — Lazy load Recharts com `next/dynamic` (30 min)
7. **F-07** — Pin SHA da action de terceiro ou substituir por shell inline (15 min)
8. **F-04** — Adicionar flag `secure` ao cookie de tema (10 min)
9. **F-09** — Whitelist de mensagens de erro em StatusBanner (1h)
10. **F-11** — Empty states em data-table (2h)
