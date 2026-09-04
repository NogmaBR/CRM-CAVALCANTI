# Nogma — Design System

> Consultoria brasileira premium de automação e IA para PMEs.

**Nogma** vem de **"nó"** (conexão, amarra, estrutura — o elo que une ideias, pessoas e processos) + **"gma"/pragma** (pragmatismo — foco no que é funcional, direto e eficaz). A marca vende **transformação e resultado**, não ferramenta nem método. Tom próximo de **Apple / Stripe / Uber**: sofisticado, direto, confiante.

O produto interno é o **NogmaOS** (Next.js 15 · React 19 · TypeScript · Tailwind · shadcn/ui) — o painel onde clientes acompanham automações, agentes de IA e indicadores.

## Sources provided
- Brand brief (cores, tipografia, marca, estética) — inlined below.
- Fonts: **Agency** (`.otf`, display/logo) + **Raleway** family (`.ttf`, 300–900) — uploaded, installed under `assets/fonts/`.
- Logo: `logo-22.png` (isologo "nogma", lime on transparent) — installed as `assets/logo-nogma-lime.png`; recolored variants + isotype derived programmatically.

No codebase or Figma link was supplied — component APIs follow the shadcn/ui conventions the product is built on, styled to the Nogma brand. Flag: if a NogmaOS repo or Figma exists, share it and these will be reconciled to the real source.

---

## CONTENT FUNDAMENTALS — how Nogma writes

**Language:** Brazilian Portuguese (pt-BR). Professional but warm; never stiff or corporate-jargony.

**Voice:** Confident, direct, pragmatic. Sells the *outcome*, not the mechanism. "Menos operação manual. Mais resultado." — short, punchy, benefit-first.

**Person:** Speaks to the client as **"você"** (singular, close). Refers to itself as **"a Nogma"** or **"a gente"** (approachable, not the formal "nós"). E.g. "Falar com a gente", "a gente cuida da engrenagem".

**Casing:** Sentence case everywhere in body and headlines. **UPPERCASE reserved** for Agency eyebrows/labels and stat context (letter-spaced). Never all-caps sentences.

**Tone devices:**
- Contrast pairs: "Transformação, não ferramenta." / "não vendeu uma ferramenta. Entregou a operação rodando."
- Concrete outcomes with numbers: "128h economizadas / mês", "+42% de produtividade".
- Anti-hype: "sem compromisso, sem jargão". Pragmatism is a value — say it plainly.

**Emoji:** Sparingly, only in-product and human moments (a single 👋 in "Bom dia, Ana 👋"). Never in marketing headlines or formal copy. A lime ✅ can punctuate a completed action in the agent chat.

**Punctuation motif:** The lime full-stop / marker — a period or key phrase highlighted in lime — is a signature ("gera resultado."). Use once per view, never as decoration.

**Do:** "Agendar diagnóstico", "Ver como funciona", "Conversar". Verbs, direct, low-friction.
**Avoid:** buzzwords ("sinergia", "disruptivo"), robot/brain/AI clichés, exclamation-heavy hype, long sentences.

---

## VISUAL FOUNDATIONS

### Color
- **Verde petróleo `#0C4651`** — the base. Confiança, profundidade, estratégia. Default dark surface (sidebars, hero panels, footers, CTA text). Full derived scale in `tokens/colors.css` (`--petroleum-050…950`).
- **Lime `#CCFF00`** — the accent. Energia, inovação, atitude. **Never a base for long text.** Used for: primary CTA fills, **headings on the black theme**, one highlighted phrase/marker per view, stat numerals on dark, active nav pill, switch-on state, isotype on petroleum.
- **Neutras** — Preto `#000000` (text on lime, contrast), Cinza `#A1A1A1` (`--neutral-400`; secondary text, borders), Branco `#FFFFFF` (light base). Neutral ramp is cool-leaning to sit with petroleum.
- **Semantic status** — success `#2FA36B`, warning `#E8A317`, danger `#D6483B`, each with a tint background. Info reuses petroleum.
- **Two-surface rule:** a view is either light (white/neutral-50 base, petroleum text) or dark. The **primary dark treatment is `.on-black`** — **preto no fundo, títulos em lime, texto em branco** (the brand's preferred look). `.on-dark` (petroleum base) remains available as an alternate dark surface. Semantic aliases + heading color flip automatically in each scope; add `class="on-black"` (or `data-theme="black"`) to any container.

### Type
- **Agency** (`--font-display`) — logo-adjacent headlines, big stat numerals, uppercase letter-spaced eyebrows. Impact and personality.
- **Raleway** (`--font-sans`) — everything else. Hierarchy via weight: **ExtraBold 800** for H1/H2, **Bold 700** for H3, **SemiBold 600** for UI, **Regular 400** for body, **Light 300** for large lead. Tight tracking on headings (`-0.02em`), relaxed line-height (1.65) on body.
- Fluid scale (`--text-2xl…6xl`) clamps mobile→desktop. Mobile-first target **375px**.

### Spacing & layout
- 4px base grid (`--space-*`). **Generous whitespace is a signature** — bias to larger steps; sections breathe (`--section-y` ≈ 3.5–7rem).
- Containers cap at 1200px; page gutter 20px mobile / 32px desktop.

### Corners — "cantos sutis"
- Subtle, never bubbly. Controls/cards **10px** (`--radius-md`); larger surfaces 14–28px; **pill only** for chips, avatars, switches, and the primary CTA is `md` (not pill). Buttons are `10px`.

### Elevation / shadows
- Soft, cool-tinted (petroleum-based rgba), never harsh black. `--shadow-xs…xl`. On `.on-dark` surfaces shadows are dropped (borders carry separation instead). One special **`--shadow-lime`** glow appears on primary-CTA hover only.

### Borders
- Hairline `1px` (`--border-hair`) for dividers/cards; `1.5px` (`--border-thin`) for inputs/buttons. Light context uses neutral borders; `.on-dark` uses white-alpha borders.

### Backgrounds
- Flat color fields — **no gradients** (explicitly banned on the mark; avoided generally). Petroleum panels for contrast blocks; white/neutral-50 for content. No stock imagery, no textures, no patterns. The only "graphic" is the isotype and the lime marker motif.

### Motion
- Purposeful, quick, never bouncy-cartoonish. `--ease-out` (cubic-bezier(.22,1,.36,1)) for enters; durations 120/200/360ms. Buttons: press = `translateY(1px) scale(.985)`. Dialogs: fade + subtle pop-up (8px, .98→1). No infinite decorative loops.

### Interaction states
- **Hover:** lighten (lime→lime-300) or subtle neutral fill for ghosts; cards lift 2px + stronger shadow.
- **Press/active:** slight shrink/translate; darker fill on solids.
- **Focus:** 3px ring via `--ring` (petroleum-alpha on light, lime-alpha on dark). Always visible, never removed.
- **Disabled:** ~45% opacity, pointer-events off.

### Transparency & blur
- Sticky nav uses `color-mix` white 82% + `backdrop-filter: blur(12px)`. On-dark surfaces layer white-alpha (`color-mix #fff 6–16%`) for raised cards. Used sparingly and functionally.

### Cards
- White surface, hairline border, `--shadow-sm`, radius `lg` (14px). `interactive` adds hover lift. `accent` adds a 3px lime top border. Petroleum "feature" cards drop shadow and go borderless.

---

## ICONOGRAPHY
- **System:** [Lucide](https://lucide.dev) — the icon set shadcn/ui ships with, matching the product stack. Consistent **2px stroke**, rounded caps/joins, 24px grid, no fills.
- **Delivery:** a curated inline-SVG subset (lucide paths, ISC-licensed) lives in `assets/icons.jsx` as `window.NogmaIcon` — robust and offline, no CDN timing issues. Component cards that need a fuller set load `lucide` from CDN. For production, import `lucide-react` directly.
- **Usage:** line icons only, `currentColor`, sized 16–24px. Icons sit in soft-tinted rounded tiles (petroleum-050) for feature contexts, or bare inline for UI. **No emoji as UI icons** (emoji only for rare human punctuation — see Content). No hand-drawn/one-off SVGs, no AI-cliché imagery (robots, brains, circuit boards).
- **Brand marks** are not icons: the **isotype** (knotted "n") is the only brand glyph used at icon scale — favicon, avatar, app tile — under strict contrast rules (see `guidelines/brand-*`).

---

## INDEX — what's in this system

**Root**
- `styles.css` — global entry (import this). `@import`s all tokens + base.
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skill wrapper.

**`tokens/`** — `fonts.css` (@font-face: Agency, Raleway), `colors.css`, `typography.css`, `spacing.css` (space/radii/shadow/motion), `base.css` (resets + brand helpers).

**`assets/`** — `logo-nogma-{lime,petroleum,black,white}.png`, `isotype-n-{lime,petroleum,black,white}.png`, `fonts/`, `icons.jsx` (`NogmaIcon`).

**`components/`** (React primitives — `window.NogmaDesignSystem_54b71f`)
- `buttons/` — **Button**, **IconButton**
- `forms/` — **Input**, **Textarea**, **Select**, **Checkbox**, **Switch**, **RadioGroup**
- `data-display/` — **Card**, **Badge**, **Tag**, **Avatar**, **Stat**
- `feedback/` — **Alert**, **Progress**, **Tooltip**, **Dialog**
- `navigation/` — **Tabs**

**`guidelines/`** — foundation specimen cards (Colors, Type, Spacing, Brand) shown in the Design System tab.

**`ui_kits/`**
- `nogmaos/` — internal app: Login, Dashboard, Automações, Agente (interactive).
- `site/` — marketing landing page.

Each component ships `.jsx` + `.d.ts` (props) + `.prompt.md` (usage) and a directory `@dsCard`. Full APIs in the individual `.prompt.md` files.
