> **Recuperado do transcript da sessao de 2026-09-09** (VS Code fechou antes de consolidar).
> Agente: Agent "Auditar fidelidade design system" finished
> Custo: 153372 tokens, 33 tool calls

Auditoria completa. Nenhum arquivo foi alterado.

---

# Auditoria de fidelidade ao Nogma Design System

## Veredito geral

A **fundação está aderente**: `apps/web/styles/tokens/*.css` são cópias **byte-idênticas** de `Nogma Design System/tokens/*` (único delta: paths de fonte `../assets/fonts/` → `/fonts/`, correto). Os componentes `apps/web/components/nogma/*.css` (Button, Card, Input, Badge, Stat, Tabs) são **cópias verbatim** do CSS dos `.jsx` de referência. Fontes self-hosted OK, 3 temas OK, default `black` OK, sem FOUC.

O problema está **acima da fundação**: existe uma **segunda linguagem visual paralela** nos CSS de página (`app/(app)/**/*.css`, `components/data-table.css`, `styles/nos-chrome.css`), com vocabulário de tokens inventado (`--surface-1`, `--surface-2`) e paleta Tailwind default (`#22c55e`, `#ef4444`, `#eab308`, `#a3e635`). Esses arquivos ignoram quase toda a escala de raio, tipo, sombra e motion da marca.

**Aderente, em uma linha cada:**
- Tokens: `styles/tokens/*` = DS verbatim (diff limpo).
- Componentes DS: `components/nogma/{Button,Card,Input,Badge,Stat,Tabs}.css` = DS verbatim.
- Fontes: Agency.otf + 7 pesos Raleway em `apps/web/public/fonts/`, `@font-face` em `styles/tokens/fonts.css`.
- 3 temas: `light` (`:root`) / `black` (`[data-theme="black"]`) / `dark` petróleo (`[data-theme="dark"]`) em `styles/tokens/colors.css:100,136`; default `black` em `lib/theme.ts:5`.
- FOUC: resolvido — `app/layout.tsx:63` lê o cookie `nogma-theme` no server e estampa `data-theme` no `&lt;html&gt;` no SSR; cookie httpOnly em `app/api/theme/route.ts:21`.
- `tailwind.config.ts:8-47` mapeia cores/radii/shadows/easings para os tokens corretamente (mas quase não é usado — o app é CSS puro).
- Adoção dos componentes: 142 `Button`, 110 `Badge`, 82 `Stat`, 63 `Input`, 26 `Card`.

---

## Divergências, por gravidade visual

### 1. `--surface-1` e `--surface-2` NÃO EXISTEM — 78 usos → superfícies invisíveis
**(a) DS manda:** `--surface-card` / `--surface-raised` / `--surface-sunken` / `--bg-subtle` (`tokens/colors.css:65-67`). Não existe `--surface-1/2` em lugar nenhum do DS.
**(b) Código faz:** 29 usos de `var(--surface-1)` + 49 de `var(--surface-2)`, muitos **sem fallback** → a declaração vira inválida em computed-value time e o elemento fica sem fundo.
- `components/data-table.css:30` — `.nos-dt__scroll { background: var(--surface-1); }` → **toda tabela do CRM sem superfície**
- `components/data-table.css:47` — `.nos-dt__th { background: var(--surface-2, transparent); }` → header de tabela sem faixa
- `app/(app)/_shared/form-layout.css:21` — `.form-layout__section { background: var(--surface-1); }` → **toda seção de formulário sem card**
- `styles/nos-responsive.css:721,726` — `.obras-filter-tab:hover / .is-active { background: var(--surface-2); }` → aba ativa só com sublinhado (visível no screenshot `crm-cavalcanti-logado.png`)
- Também: `config/categorias/categorias.css:82,243,251,266`, `config/perfil/perfil.css:22,30,45`, `config/webhooks/webhooks.css:60,143,328,335,340,379`, `config/importar/importar.css:85,170,291`, `config/usuarios/usuarios.css:80,234`, `obras/obras-table.tsx:256,361`, `fornecedores/duplicatas/page.tsx:119,150,189`, `fornecedores/[id]/apelidos-section.tsx:48,147`, `config/webhooks/[id]/editar/page.tsx:182`

**(c) Correção:** substituição global —
```css
var(--surface-1)  →  var(--surface-card)
var(--surface-2)  →  var(--bg-subtle)      /* ou var(--surface-sunken) em headers de tabela */
```

---

### 2. `html, body` com fundo hardcoded quebra os temas dark
**(a) DS manda:** `tokens/base.css:16` — `body { background: var(--bg-canvas); }`.
**(b) Código faz:** `styles/nos-chrome.css:1` — `html,body{ margin:0; height:100%; background:var(--neutral-100); ... }`. Como `nos-chrome.css` é importado **depois** de `nogma.css` (`styles/globals.css:2-3`), ele vence. Nos temas `black`/`dark` o canvas raiz continua cinza-claro (aparece em overscroll, atrás do drawer e na tela de login).
**(c) Correção:**
```css
html, body { margin:0; height:100%; background: var(--bg-canvas); font-family: var(--font-sans); color: var(--text-primary); }
```

---

### 3. Sidebar e aside do login pintados de petróleo apesar de `.on-black`
**(a) DS manda:** `readme.md:49` — *"o tratamento dark **primário** é `.on-black` — preto no fundo, títulos em lime, texto em branco"*. O screenshot de referência `Nogma Design System/screenshots/nogmaos-dash.png` mostra a sidebar **preta**, nav ativo em pill lime.
**(b) Código faz:** o markup declara o escopo correto — `components/layout/sidebar.tsx:7` (`className="nos-sidebar on-black"`) e `app/(auth)/login/page.tsx:16` (`nos-login__aside on-black"`) — mas o CSS sobrescreve com petróleo:
- `styles/nos-chrome.css:8` — `.nos-sidebar{ ... background:var(--petroleum-800); ...}`
- `styles/nos-chrome.css:97` — `.nos-login__aside{ background:var(--petroleum-800); ...}`
Confirmado no screenshot do app (`crm-cavalcanti-logado.png`): sidebar petróleo, não preta.
**(c) Correção:** deixar o escopo `.on-black` fazer o trabalho —
```css
.nos-sidebar     { background: var(--bg-canvas); color: var(--text-primary); }
.nos-login__aside{ background: var(--bg-canvas); color: var(--text-primary); }
```
(Se a intenção for mesmo petróleo, trocar a classe para `on-dark` nos dois `.tsx` — mas aí contraria o "preferred look" do readme.)

---

### 4. Paleta semântica Tailwind hardcoded em vez dos tokens da marca
**(a) DS manda:** `tokens/colors.css:50-55` — `--success #2FA36B`, `--warning #E8A317`, `--danger #D6483B`; accent `--lime-500 #CCFF00`.
**(b) Código faz:** verdes/vermelhos/amarelos do Tailwind, **sem `var()`**, portanto renderizados de fato:
- `config/categorias/categorias.css:40-42,46-48` — `#22c55e`, `#ef4444`
- `config/importar/importar.css:62-64,149-151,198,202,214,218,274-276,280-282` — `#ef4444`, `#eab308`, `#22c55e`
- `config/usuarios/usuarios.css:38-40,44-46,165` — idem
- `obras/obras-table.tsx:220` — `#a3e635` (lime-400 Tailwind, não `#CCFF00`); `:236` — `#f87171`
- `relatorios/relatorios.css:126` — fallback `#84cc16`
E dezenas de fallbacks errados: `var(--accent, #22c55e)` (`auditoria.css:47,67,173,283`), `var(--accent, #a3e635)` (`importar.css:33`, `usuarios.css:119`), `var(--danger, #ef4444)` (~20 ocorrências em CSS e `style={{}}` inline), `var(--warning, #eab308)` (`painel/page.tsx:145-146`, `nos-responsive.css:582`).
**(c) Correção:** `#22c55e`→`var(--success)`, `#ef4444`→`var(--danger)`, `#eab308`→`var(--warning)`, `#a3e635`/`#84cc16`→`var(--lime-500)`; e **remover todos os fallbacks** (`var(--danger, #ef4444)` → `var(--danger)`) — os tokens sempre existem, o fallback só mascara erro e propaga cor errada.

---

### 5. Gráficos com cores fixas — ilegíveis fora do tema em que foram feitos
**(a) DS manda:** cores por token, com flip de tema.
**(b) Código faz:**
- `painel/charts/line-acumulado.tsx:62,63,84,88` — `#0C4651` (petróleo) como stroke/fill da linha. No tema `black` (default) e no `dark` (canvas petróleo) fica praticamente invisível.
- `painel/charts/bar-serie-mensal.tsx:80` — `fill="#CCFF00"`; `:63` `stroke="rgba(255,255,255,0.06)"` (grid branco → some no tema light); `:77` `cursor={{fill:'rgba(204,255,0,0.06)'}}`
- `painel/charts/donut-categoria.tsx:67` — fallback `#565B5B` (= `--neutral-500` hardcoded)
- `line-acumulado.tsx:66` — mesmo grid branco fixo
**(c) Correção:** `stroke="var(--lime-500)"` / `fill="var(--lime-500)"` para a série principal, `stroke="var(--border-subtle)"` no `CartesianGrid`, `fill="var(--neutral-500)"` no fallback do donut. Para a área acumulada, usar `var(--accent)` com `stopOpacity` em vez de petróleo fixo.

---

### 6. Escala de raios praticamente abandonada — 89 valores em px vs 37 tokens
**(a) DS manda:** `tokens/spacing.css:38-45` — `4 / 6 / 10 / 14 / 20 / 28 / 999px`. `readme.md:61`: *"Controles/cards 10px (`--radius-md`); superfícies maiores 14–28px; pill só para chips, avatares, switches"*.
**(b) Código faz:** 36× `8px`, 20× `12px`, 13× `99px`, 5× `6px`, além de `7px`, `9px`, `5px`, `3px`, `2px`. **`8px` e `12px` não existem na escala.** Amostra: `auditoria.css:13,35,63,84,116,189,210,240,297`; `config/categorias/categorias.css:14,33,57,69,144,164,187,242`; `config/usuarios/usuarios.css:12,31,55,67,157,201,232`; `config/webhooks/webhooks.css:6,29`; `_shared/form-layout.css:10`; `a11y.css:14`; `nos-chrome.css:44,83,119,127,139`; `nos-responsive.css:300,549,710`.
**(c) Correção:** `8px`→`var(--radius-sm)` (6px) ou `var(--radius-md)` (10px) conforme o alvo; `12px`→`var(--radius-lg)` (14px); `99px`/`999px`→`var(--radius-pill)`; `50%` só em avatar/dot.
Bônus: `var(--radius-lg, 12px)` em `components/data-table.css:29`, `_shared/form-layout.css:19` e `painel/painel.css:7` traz **fallback errado** (o token é 14px) — remover o fallback.

---

### 7. ~180 `font-size` em px cru — a escala `--text-*` não é usada fora dos componentes DS
**(a) DS manda:** `tokens/typography.css:25-35` — `--text-2xs 11px` … `--text-6xl clamp(3.25rem,…,5.5rem)`.
**(b) Código faz:** 51× `13px`, 39× `12px`, 24× `11px`, 18× `14px`, mais `10/15/16/17/18/19/20/24/28/30/38px` e meio-pixels (`11.5`, `12.5`, `13.5`, `14.5px`). **`13px` e `15px` não existem na escala.** Concentração: `nos-chrome.css` (35 ocorrências), `auditoria.css` (22), `config/webhooks/webhooks.css` (18), `config/importar/importar.css` (13), `notificacoes.css` (12), `nos-responsive.css` (12).
**(c) Correção:** `11px`→`var(--text-2xs)`, `12px`→`var(--text-xs)`, `13px`/`14px`→`var(--text-sm)`, `15px`/`16px`→`var(--text-base)`, `18px`→`var(--text-lg)`, `20px`→`var(--text-xl)`, `28px`→`var(--text-3xl)`, `38px`→`var(--text-4xl)`. Eliminar meio-pixels.

---

### 8. Easings da marca substituídos por curvas inventadas + `ease` do browser
**(a) DS manda:** `tokens/spacing.css:61-62` — `--ease-out: cubic-bezier(0.22,1,0.36,1)` e `--ease-in-out: cubic-bezier(0.65,0,0.35,1)`.
**(b) Código faz:**
- `styles/nos-responsive.css:493-496` define **três easings fora do DS** — `--ease-out-strong: cubic-bezier(0.23,1,0.32,1)`, `--ease-in-out-strong: cubic-bezier(0.77,0,0.175,1)`, `--ease-drawer: cubic-bezier(0.32,0.72,0,1)` — e em `:503-508` **sobrescreve a transition do `.ng-btn` do DS** para usar `--ease-out-strong`. Ou seja: o botão da marca deixa de usar a curva da marca. Idem `:614`, `:622-625`, `:680-683`.
- 14 lugares com `ease` default do browser: `nos-responsive.css:716` (`transition: all 120ms ease`), `:734`, `_shared/detail-layout.css:10`, `_shared/form-layout.css:74,104`, `components/data-table.css:67,108`, `config/categorias/categorias.css:246`, `config/perfil/perfil.css:24,119`, `config/webhooks/webhooks.css:83,330`, `config/importar/importar.css:37`, `relatorios/relatorios.css:79,112`, `pendentes/pendentes.css:152`, `a11y.css:20` (`0.15s ease-out`).
**(c) Correção:** remover o bloco `:root{--ease-*-strong}` de `nos-responsive.css:492-496` e o override de `.ng-btn` em `:500-508`; trocar todo `120ms ease` por `var(--dur-fast) var(--ease-out)` e `transition: all` por lista explícita de propriedades.

---

### 9. Durações fora da escala 120/200/360ms
**(a) DS manda:** `tokens/spacing.css:63-65` — `--dur-fast 120ms`, `--dur-base 200ms`, `--dur-slow 360ms`.
**(b) Código faz:** `nos-responsive.css:52` `280ms`; `:398` `480ms` + `:399` delay `90ms`; `:507,683` `120ms` literal (token existe); `:609` `320ms`; `:624` `180ms`; `pendentes.css:152` `300ms`; `importar.css:309` `0.7s`; `a11y.css:20` `0.15s`.
**(c) Correção:** `280ms`/`320ms`→`var(--dur-slow)`; `180ms`→`var(--dur-base)`; `120ms`→`var(--dur-fast)`; `480ms` do fade-up → `var(--dur-slow)` com stagger de `60ms`.

---

### 10. Sombras petroleum-tinted quase não usadas; sombras pretas genéricas no lugar
**(a) DS manda:** `tokens/spacing.css:53-58` — `--shadow-xs…xl` todas em `rgba(4,31,37,α)` (petróleo), e `--shadow-lime: 0 8px 24px rgba(163,204,0,0.35)`. `readme.md:64`: *"nunca preto duro"*.
**(b) Código faz:** fora de `components/nogma/*`, existem **apenas 2** usos de `var(--shadow-*)` em todo o app (`nos-responsive.css:245` e `relatorios.css:126`). No lugar:
- `styles/nos-responsive.css:51` — `box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.55)` no drawer
- `obras/obras-table.tsx:258` — `boxShadow: '0 4px 16px rgba(0,0,0,0.4)'` no dropdown
- `nos-responsive.css:628` — `0 4px 12px -6px color-mix(... lime 20% ...)` (glow lime ad-hoc)
- Cards de tabela e seções de formulário: **nenhuma elevação** (só borda).
**(c) Correção:** `rgba(0,0,0,0.55)`/`rgba(0,0,0,0.4)` → `var(--shadow-xl)` / `var(--shadow-lg)`; aplicar `box-shadow: var(--shadow-sm)` em `.nos-dt__scroll` e `.form-layout__section` (e `none` sob `[data-theme="dark"]`, como faz `Card.css:13`). `--shadow-lime` está corretamente restrita ao hover do CTA primário (`Button.css:26`).

---

### 11. Eyebrow com tracking fora do token
**(a) DS manda:** `tokens/typography.css:49,63` — `--tracking-wider: 0.08em` é *"Agency uppercase eyebrows/labels"*; `--eyebrow-tracking: var(--tracking-wider)`.
**(b) Código faz:**
- `styles/nos-chrome.css:52` — `.nos-eyebrow{ ... letter-spacing:.14em; ...}` (nem `wider` 0.08 nem `widest` 0.16)
- `styles/nos-chrome.css:99` — `.nos-login__eyebrow{ ... letter-spacing:.16em; ...}` (= `widest`, não `wider`)
- `styles/nos-chrome.css:70` — `.nos-table th{ letter-spacing:.06em }`; `painel/painel.css:15` — `.05em`; ~10 labels uppercase com `.04em` (`auditoria.css:28,266,326`, `usuarios.css:91,127,252`, `categorias.css:93,167`, `importar.css:181`, `data-table.css:45`, `form-layout.css:29`)
**(c) Correção:** `letter-spacing: var(--tracking-wider)` (0.08em) em todos os eyebrows/labels uppercase. Usar a classe `.eyebrow` do DS (`tokens/base.css:42-49`) em vez de reimplementar — o painel já faz isso certo (`painel/page.tsx:77`).

---

### 12. Tracking de heading fora do token
**(a) DS manda:** `tokens/typography.css:59` — `--heading-tracking: var(--tracking-tight)` = **-0.015em**. (Nota: `readme.md:53` diz "-0.02em" — conflito interno do próprio DS; o token manda.)
**(b) Código faz:** `nos-chrome.css:55` `-.02em`; `:64` `-.01em`; `:101` `-.025em`; `:104` `-.01em`; `:108` `-.02em`; `nos-responsive.css:117` `-0.01em`; `:422` `-0.01em`. Corretos: `nos-chrome.css:36`, `nos-responsive.css:227,319`.
**(c) Correção:** `letter-spacing: var(--tracking-tight)` em todos.

---

### 13. Título da topbar em lime no tema `dark` (petróleo) — deveria ser branco
**(a) DS manda:** `tokens/colors.css:112` — no tema `black`, `--heading-color: var(--lime-500)`; `tokens/colors.css:147` — no tema `dark` (petróleo), `--heading-color: var(--white)`.
**(b) Código faz:** `styles/nos-responsive.css:598-601` aplica lime nos **dois**:
```css
:root[data-theme='black'] .nos-topbar__title,
:root[data-theme='dark']  .nos-topbar__title { color: var(--lime-500); }
```
**(c) Correção:** apagar essas 4 linhas e usar `.nos-topbar__title { color: var(--heading-color); }` — o token já resolve os três temas.

---

### 14. `::selection` da marca sobrescrito
**(a) DS manda:** `tokens/base.css:38` — `::selection { background: var(--lime-500); color: var(--petroleum-950); }` (lime sólido).
**(b) Código faz:** `styles/nos-responsive.css:525-533` sobrescreve com `color-mix(... lime-500 40% ...)` no light e 55% + `color:#000` (preto hardcoded) nos dark.
**(c) Correção:** remover o bloco e deixar o do DS; se a variante dark for desejada, usar `var(--black)` em vez de `#000`.

---

### 15. Gradiente onde o DS proíbe
**(a) DS manda:** `readme.md:70` — *"Campos de cor chapada — **sem gradientes**"*. A única exceção do DS é o motivo `.mark-lime` (`tokens/base.css:57`).
**(b) Código faz:** `styles/nos-responsive.css:288` — `.nos-coming::before { background: linear-gradient(90deg, var(--lime-500) 0%, var(--lime-300) 60%, transparent 100%); }`. (O shimmer de `components/nogma/Skeleton.css:5` é convenção aceitável de loading.)
**(c) Correção:** `background: var(--lime-500);` chapado.

---

### 16. Branco hardcoded em vez de `var(--white)` / tokens de escopo
**(a) DS manda:** `--white` e os aliases `--text-on-dark`, `--surface-card`.
**(b) Código faz:** `nos-chrome.css:8,18,21,28,41,43,48,78,97,101,129,130` e `nos-responsive.css:46,78,532,686,687` usam `#fff`/`#ffffff` literais; `config/perfil/perfil.css:67,71,75` chega a hardcodar os três temas (`#ffffff`, `#0a0a0a`, `#0d3d40` — este último **nem é da paleta**, o petróleo escuro é `#041F25`/`#072C34`).
**(c) Correção:** `#fff`→`var(--white)`; `perfil.css:67-75` → `var(--neutral-0)` / `var(--bg-subtle)` / `var(--petroleum-800)`.

---

### 17. Dois sistemas de gutter concorrentes
**(a) DS manda:** `tokens/spacing.css:33-34` — `--gutter-mobile: 1.25rem`, `--gutter-desktop: 2rem`.
**(b) Código faz:** 37 páginas usam `.nos-page` (`nos-chrome.css:51`, `padding:28px` fixo, sem breakpoint) enquanto Painel e Obras usam `.nos-page-body` (`nos-responsive.css:209-221`, responsivo 16→28→40px). Nenhum dos dois usa os tokens de gutter. Resultado: padding de página inconsistente entre rotas e não-responsivo na maioria delas.
**(c) Correção:** unificar em `.nos-page-body` e definir `padding: var(--space-5) var(--gutter-mobile)` → `var(--space-8) var(--gutter-desktop)` no breakpoint md.

---

### 18. Escala de espaçamento `--space-*` não usada
**(a) DS manda:** `tokens/spacing.css:9-22`, grid de 4px.
**(b) Código faz:** fora de `components/nogma/Card.css:8,14`, todo `padding`/`gap`/`margin` do app é px cru — e frequentemente **fora do grid de 4** (`14px`, `18px`, `22px`, `26px`, `11px`, `13px`). Ex.: `nos-chrome.css:8,15,33,51,63,72`, `_shared/form-layout.css:9,20`, `auditoria.css:11`.
**(c) Correção:** snap para `var(--space-3|4|5|6|8)`.

---

## Onde concentrar o esforço

Itens **1, 2, 3** são os que mais mudam a percepção da marca e são correções pequenas e localizadas (uma substituição global de dois tokens + 3 linhas de CSS). Itens **4, 5** eliminam cores que não são da Nogma. Itens **6, 7, 8, 9** são varreduras mecânicas nos 13 CSS de página — candidatos a codemod, não a edição manual.

A causa raiz é arquitetural: `components/nogma/**` foi copiado corretamente do DS, mas os CSS de página (`app/(app)/**/*.css`, `components/data-table.css`, `styles/nos-chrome.css`) foram escritos à parte, contra um sistema de tokens que nunca existiu. Enquanto `--surface-1/2` não for aposentado, qualquer troca de tema deixa buracos visuais.
