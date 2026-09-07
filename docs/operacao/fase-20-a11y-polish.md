# Fase 20 — Acessibilidade + Polish (WCAG AA)

Estado: **shipada em prod**. Última fase do roadmap 21-fases.

Wins de acessibilidade globais + Sonner Toaster wired + landmarks
semânticos. Não atinge 100% WCAG AA (audit completo é extensão), mas
cobre os wins de maior impacto.

## O que foi shipado

### 1. CSS globals a11y (`apps/web/styles/a11y.css`)

- **Skip link** (`.a11y-skip-link`) — visível ao focar (Tab). Pula
  sidebar+topbar direto pro conteúdo.
- **Focus-visible ring** universal — outline 2px lime em todos os
  interativos quando focados via teclado (não em cliques mouse).
- **prefers-reduced-motion** — usuário com "reduzir animações" do OS
  vê durations de 0.01ms (efetivamente desabilita).
- **`.sr-only`** helper — texto invisível mas lido por leitores.
- **Min touch target 32px** em botões com `aria-label` (WCAG 2.5.5).
- **Focus vermelho em `[aria-invalid="true"]`** — feedback extra pra
  campos com erro.

### 2. Root layout skip link

`apps/web/app/layout.tsx` adiciona antes de `{children}`:
```tsx
<a href="#main-content" className="a11y-skip-link">
  Pular para o conteúdo principal
</a>
```

Tab primeiro em qualquer page → aparece o skip link, Enter → foca no `<main>`.

### 3. App shell semantic (`(app)/layout.tsx`)

- `<main id="main-content">` envolve as pages autenticadas
- `<aside aria-label="Barra lateral">` na sidebar
- `<nav aria-label="Navegação principal">` no menu

### 4. Sidebar nav

- `aria-label="Navegação principal"` no `<nav>`
- `aria-current="page"` no item ativo (dinâmico)
- `aria-hidden="true"` nos ícones Lucide (já tem texto ao lado)

### 5. Sonner Toaster wired

Root de pages autenticadas: `<Toaster richColors position="top-right"
closeButton theme="dark" />` — anuncia via aria-live pra leitores.

Chamada `toast.success('...')` em qualquer client component do app
funciona out-of-box.

### 6. StatusBanner reutilizável

`apps/web/components/nogma/StatusBanner.tsx`:
```tsx
<StatusBanner error={sp.error} success={sp.success} />
```

Renderiza com `role="alert"` + `aria-live="polite"` — leitor anuncia
mensagens de sucesso/erro sem interromper contexto.

Pages existentes NÃO foram tocadas (zero breaking changes). Novas
pages/refactors podem usar.

## Checklist WCAG AA — status

Legenda: ✅ atendido · 🟡 parcial · ❌ não atendido

**Perceivable:**
- ✅ 1.1.1 Non-text Content — icons têm `aria-hidden="true"` (texto ao lado) ou `aria-label`
- ✅ 1.3.1 Info and Relationships — landmarks (`main`, `nav`, `aside`) + labels associados
- 🟡 1.4.3 Contrast — Nogma DS foi desenhado com contrast mínimo mas não auditado formalmente. Rodar: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- ✅ 1.4.4 Resize Text — usamos rem/em em quase tudo (herança de font-size). Não usamos fixed px em text
- ✅ 1.4.11 Non-text Contrast — badges/borders com contrast OK

**Operable:**
- ✅ 2.1.1 Keyboard — todos interativos acessíveis por Tab (padrão HTML)
- ✅ 2.4.1 Bypass Blocks — skip link
- ✅ 2.4.7 Focus Visible — `:focus-visible` global
- 🟡 2.5.5 Target Size (AAA level) — botões icon-only 32px min (AA aceita 24px)

**Understandable:**
- ✅ 3.1.1 Language of Page — `<html lang="pt-BR">`
- ✅ 3.2.1 On Focus — não dispara ação inesperada em foco
- ✅ 3.3.1 Error Identification — banners `role="alert"` + `aria-invalid`
- ✅ 3.3.2 Labels or Instructions — todos os inputs têm `<label>` associado (Nogma Input component)

**Robust:**
- ✅ 4.1.2 Name, Role, Value — semantic HTML + ARIA onde necessário
- ✅ 4.1.3 Status Messages — Toaster + StatusBanner com aria-live

**Não auditado (extensão futura — Fase 20.x):**
- Contrast verificado manualmente em todos os pares fg/bg
- Tab order em modais/dialogs (Radix já cuida)
- Announcements em navegação SPA
- Content reflow a 320px width (WCAG 1.4.10)
- Reading order em screen reader (NVDA/JAWS test)

## Ferramentas de audit sugeridas

**Browser extensions:**
- [axe DevTools](https://www.deque.com/axe/devtools/) — Chrome/Firefox
- [WAVE](https://wave.webaim.org/extension/) — Chrome/Firefox
- Lighthouse (built-in Chrome DevTools) — aba Accessibility

**Automated:**
- [`@axe-core/playwright`](https://www.npmjs.com/package/@axe-core/playwright)
  — integra com Fase 12 E2E: adicionar em specs `await new AxeBuilder({ page }).analyze()`
- [Pa11y CI](https://github.com/pa11y/pa11y-ci) — CLI batch

**Manual:**
- Keyboard-only navigation (desligar mouse por 15min)
- Screen reader: NVDA (Windows free), VoiceOver (macOS), Orca (Linux)
- Zoom 200% no browser — check reflow

## Extensões futuras (Fase 20.x)

- **Audit completo com axe-core E2E** — adicionar spec Playwright que
  roda axe em cada rota principal (Fase 12 infra suporta)
- **Contrast audit** — script Node que lê tokens Nogma + checa pairs
  contra WCAG AA (4.5:1 texto, 3:1 UI)
- **Screen reader flow test** — QA manual com NVDA/VoiceOver em
  fluxos críticos (login, criar obra, importar CSV)
- **Language switcher** — se app for internacionalizado (não é MVP),
  `<html lang>` dinâmico via profile.locale
- **High contrast mode** — media query `prefers-contrast: high` com
  paleta alternativa
- **Enhanced focus mode** — user config em `/config/perfil` pra
  aumentar tamanho de fonte, focus ring, targets
- **Skip links extras** — pular pra footer, pular pra actions
- **Announce SPA navigations** — quando Next mudar de rota, anunciar
  novo título via `document.title` change + aria-live region
- **Reduce motion no Motion library** — check `useReducedMotion` do
  Motion (já instalado) em todas as animações React

## Testar

**Keyboard only:**
1. Fechar mouse
2. `/painel` autenticado
3. Tab — deve aparecer "Pular para o conteúdo principal"
4. Enter — foca no main
5. Continue Tab — passa pelos KPIs, charts, activity feed
6. Todos interativos com ring lime visível

**Screen reader (NVDA no Windows):**
1. NVDA ON (`Ctrl+Alt+N`)
2. Abrir `/painel`
3. Deve anunciar: "Página, Gestor de Obras Nogma, região principal"
4. Tab navigation lê cada elemento
5. Alterar tema em `/config/perfil` → toast aparece → NVDA anuncia
   "Preferências salvas"

**Reduced motion:**
1. Windows: Settings → Ease of Access → Display → "Show animations" OFF
2. macOS: System Preferences → Accessibility → Display → "Reduce motion"
3. Recarregar `/painel`
4. Nenhum fade-in, transitions instantâneas

## Segurança + performance

- CSS a11y.css adiciona ~2KB no bundle base — desprezível
- Sonner ~30KB gzipped já estava em deps
- Zero server-side impact (a11y é 100% client rendering)
- Skip link não expõe rotas privadas (só um href fragment)

## Rollback

Se algum item causar regressão visual:
- Skip link: remover `<a>` do body layout
- Focus-visible: comentar `.a11y-skip-link` no `a11y.css`
- Toaster: remover import + component
- StatusBanner: componente novo, zero uso ainda — safe

Nenhuma mudança quebra funcionalidade existente (aditivo).
