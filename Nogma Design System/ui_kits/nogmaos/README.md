# NogmaOS — UI Kit

Interactive recreation of the **NogmaOS** internal system: the premium automation & AI console Nogma builds for SME clients. Stack in production: Next.js 15 · React 19 · TypeScript · Tailwind · shadcn/ui.

## Screens (`index.html`, click-through)
1. **Login** — split layout: **black** brand panel (lime lettering + lime headline accent, white text, KPI proof) + clean sign-in card. Lime primary CTA.
2. **Dashboard** — **black sidebar** (lime active pill + isotype) with a light content area for data density; greeting, four KPI stats (Agency display numerals), active-automations table, agent card (petroleum accent) + activity feed.
3. **Automações** — line tabs (Ativas/Pausadas/Todas), full table with success-rate progress + lime switches to toggle.
4. **Agente** — chat with an AI agent (type + send, agent auto-replies), right rail with connected tools + weekly stats.

Flow: Login → Dashboard → open any row / agent card → Agente. Sidebar navigates; collapse via the menu button.

## Theme
Black is the **primary dark surface** (sidebar, login brand panel) — titles/marks in lime, body in white. Petroleum is kept as a **secondary accent surface** (agent card, chat user bubble). Content-dense areas (dashboard, tables) stay light for readability.

## Composition
Built from the design-system primitives (`window.NogmaDesignSystem_54b71f`): `Button, Input, Checkbox, Card, Stat, Badge, Switch, Progress, Avatar, Tabs`. App-specific chrome (Sidebar, TopBar, table, chat) lives in the kit files. Icons come from `assets/icons.jsx` (`window.NogmaIcon`, lucide paths).

## Files
- `index.html` — router + kit CSS (all `nos-*` classes)
- `Chrome.jsx` — Sidebar + TopBar
- `LoginScreen.jsx` — login
- `AppScreens.jsx` — Dashboard, Automations, Agent chat

## Notes
This is a visual/interaction recreation, not production code. Data is mocked inline. Sections *Relatórios* and *Equipe* are intentional stubs ("em construção") — no source design was provided for them.
