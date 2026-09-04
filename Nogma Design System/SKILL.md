---
name: nogma-design
description: Use this skill to generate well-branded interfaces and assets for Nogma (consultoria brasileira premium de automação e IA para PMEs), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference
- **Brand:** Nogma — automação & IA para PMEs. Voice: pt-BR, direct, pragmatic, confident (Apple/Stripe tone). Speaks as "a gente" to "você". Sells outcome, not tooling.
- **Colors:** Verde petróleo `#0C4651` (base escura) · Lime `#CCFF00` (accent — never long text) · Preto · Cinza `#A1A1A1` · Branco. Full scales in `tokens/colors.css`.
- **Type:** Agency (`--font-display`, títulos/logo/stats) + Raleway (`--font-sans`, hierarquia/UI/corpo, 300–900).
- **Corners:** subtle (10px controls). **No gradients.** Generous whitespace. Lucide icons, 2px stroke. Zero AI clichés.

## How to use
1. Link the design system: `<link rel="stylesheet" href="styles.css">` — this loads all tokens + fonts.
2. For React components, load `_ds_bundle.js` and read `const { Button, Card, ... } = window.NogmaDesignSystem_54b71f`. See each component's `.prompt.md`.
3. For icons, use `assets/icons.jsx` (`window.NogmaIcon`) or `lucide-react` in production.
4. Reference the UI kits in `ui_kits/` for full-screen composition patterns (NogmaOS app, marketing site).
5. Follow `readme.md` → CONTENT FUNDAMENTALS and VISUAL FOUNDATIONS for tone and visual rules.
