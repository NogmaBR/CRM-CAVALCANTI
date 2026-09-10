> **Recuperado do transcript da sessao de 2026-09-09** (VS Code fechou antes de consolidar).
> Agente: Agent "Sweep remaining frontend routes" finished
> Custo: 93076 tokens, 28 tool calls

## Cross-cutting

- **Zero error boundaries in the whole app** — no `error.tsx` or `global-error.tsx` exists anywhere under `apps/web/app/`. Only 6 `loading.tsx` files (documentos, obras, pagamentos, painel, pendentes, relatorios). Any thrown data-layer error (`lib/data/*.ts` all `throw new Error(...)`) hits the Next.js default error screen.
- **No `useActionState` / `useFormStatus` anywhere** — every `&lt;form action={serverAction}&gt;` in the files reviewed has a plain submit button. Every one is double-clickable.
- `form-layout.css` and `detail-layout.css` are **route-local imports**, not global (`styles/globals.css:1-5` only pulls tailwind/nogma/nos-chrome/nos-responsive/a11y). Anything using `form-layout__*` or `detail-layout__*` must import them explicitly.

---

## `app/(app)/config/importar/importar-client.tsx`
- `importar-client.tsx:51-60` — `&lt;input type="file" required&gt;` is visually hidden (`importar-file-input`) and driven by a proxy button at :61-69. A hidden `required` control makes the browser abort submit with "An invalid form control … is not focusable"; the form silently does nothing in some paths.
- `:71-78`, `:184-195` — pending state exists (good), but implemented with `useState` + `setLoading`; no `useTransition`/`useActionState`, so the disable window is not tied to the action and React shows no `aria-busy`.
- `:325` — `role="alert"` banner is fine, but the phase transitions (upload→preview→done) have no `aria-live`; a screen reader user gets no announcement that 500 rows were parsed.
- `:304` — `commitImportCsv(preview.rows)` sends the entire parsed dataset back from the browser to the server. The whole preview payload round-trips twice and the server re-trusts client-shaped rows.
- `:213-221` — table headers have no `scope="col"`; no `&lt;caption&gt;`.
- `:155`, `:259` — `key={i}` index keys on error lists.
- `:101-232` (`PreviewRowCells`, `SummaryBadges`, `PreviewPhase` markup) is purely presentational and only exists in the client bundle because `'use client'` sits at :1 on the whole file.

## `app/(app)/fornecedores/fornecedor-form.tsx`
- `:146` — `&lt;Button type="submit"&gt;` with **no pending/disabled state**. `createFornecedor` (`fornecedores/actions.ts:27-64`) does a raw insert → double-click creates two fornecedores.
- **Form values lost on error**: `fornecedores/actions.ts:31-35` and `:73-79` do `redirect('/fornecedores/novo?error=…')`; `novo/page.tsx:12-21` passes only `error` and no `initial`, so every `defaultValue` at :47/:56/:65/:82/:124/:134 resets to empty. All typed input is discarded on any validation failure.
- `:33-37` — error banner is not associated with any field: no `aria-describedby`, no `aria-invalid`, and the `Input` component's `error` prop (`components/nogma/Input.tsx:13`) is never used. Note `Input.tsx:60-64` also renders the error text without an `id`, so `aria-describedby` isn't wireable even if passed.
- `:94-111` — hardcoded inline styles (`gap: 10`, `fontSize: 14`) and `:108` (`width: 16, height: 16`) instead of `form-layout` classes.
- `:78-81` — hardcoded `id="forn-categoria"`; collides if the form is ever rendered twice.
- CSS import is correct (`:7`).

## `app/(app)/pendentes/page.tsx`
- `:202-213` and `:215-225` — Rejeitar/Confirmar submit buttons, **no pending/disabled**. Destructive + irreversible, and the page is a server component so `useFormStatus` isn't even available without extracting a client submit button.
- `lib/data/pendentes.ts:42-60` — `listPendentes()` has **no `.limit()`**; every unresolved pendência is fetched and rendered as a full card (`:105-227`).
- `:54` — `role="progressbar"` with no accessible name (`aria-label`/`aria-labelledby` missing); the label is a sibling span at :53.
- `:80-90` — banners driven by `?error=`/`?success=`; correct roles, but they render above the fold with no focus management.
- Empty state present at `:92-99` (good). No `error.tsx` for the route.

## `app/(app)/whatsapp/page.tsx`
- `:65-66` — **correctness bug**: `listMensagens(200)` then `.filter()` in JS. The "Erro" / "Confirmadas" tabs only search inside the newest 200 messages, so older matches are invisible. Filtering belongs in the query (`lib/data/mensagens.ts:19-26`).
- `:124` — `aria-label` on a non-interactive `&lt;span&gt;`; ignored by most AT.
- `:91`, `:99`, `:120`, `:125`, `:131`, `:145`, `:149` — inline `opacity`/`marginBottom: 8`/`listStyle`/`padding: 0`/`verticalAlign` despite `whatsapp.css` already being imported at `:6`.
- Empty state present `:89-97`. No `loading.tsx`, no `error.tsx`.

## `app/(app)/notificacoes/page.tsx`
- `:96-102` — "Reenviar" submit button, **no pending/disabled state** → double-click sends the email twice.
- `:96` — `&lt;form style={{ display: 'contents' }}&gt;`; `display:contents` drops the element from the accessibility tree in several engines.
- `lib/data/notificacoes.ts:116` — `.limit(200)` hardcoded in the data layer with **no pagination UI** on the page; the list is silently truncated with no indication.
- `:159`, `:160`, `:167` — inline `opacity`/`margin`/`listStyle` instead of `notificacoes.css` (imported at `:6`).
- Empty state present `:157-165`. No error boundary.

## `app/(app)/auditoria/page.tsx`
- `:208` + `:211-232` — `page?: string` searchParam is declared and destructured but **never used**; `listAuditLog(..., 200)` returns a hard 200 rows with no pagination controls anywhere. Records beyond 200 are unreachable.
- `:123` — `type="submit"` present (good) but no pending state; low risk since it's a GET nav.
- `:126` — raw `&lt;a href="/auditoria"&gt;` instead of `Link` → full document reload for "Limpar".
- Filter form correctly preserves values via `defaultValue` (`:63`, `:76`, `:104`, `:117`) — this is the one form in the set that does **not** lose input.
- `:167`, `:190`, `:254` — inline `verticalAlign`/`listStyle`/`padding`/`margin` styles despite `auditoria.css` at `:17`.
- Empty state present `:248-252`. No error boundary.

## `app/(app)/config/page.tsx`
- Clean server component, no interactivity, no issues. Only note: it's a live sidebar destination rendering a `ComingSoon` placeholder (`:9-19`) while `/config/usuarios`, `/config/categorias`, `/config/webhooks`, `/config/perfil` all exist — the hub page doesn't link to any of them.

## `app/(app)/config/usuarios/page.tsx`
- `:116`, `:133`, `:140`, `:150` — four action submit buttons (Arquivar / Reenviar convite / Cancelar / Restaurar), **all without pending/disabled state**. "Reenviar convite" double-fires two invite emails.
- `:114`, `:131`, `:138`, `:148` — `&lt;form style={{ display: 'contents' }}&gt;` again.
- `:187-194` — `listUsuarios(true)` fetches **all** profiles (`lib/data/usuarios.ts:59`, no limit) plus `admin.auth.admin.listUsers({ perPage: 1000 })` (`usuarios.ts:67`), then filters in JS at `:189-194`. Three tabs = three full fetches of everything.
- `:202-206` — `&lt;Link&gt;` wrapping a `&lt;Button&gt;` → nested `&lt;a&gt;&lt;button&gt;`; invalid HTML and a double tab-stop. Same anti-pattern at `documentos/page.tsx:68-73` and `fornecedores/page.tsx:37-43`.
- `:123` — `var(--text-muted, #888)` hardcoded hex fallback; `:202`, `:242`, `:243` inline styles.
- `:253-269` — table with no `&lt;caption&gt;` and no `scope="col"` on the `&lt;th&gt;`s (`:256-261`).
- Empty state present `:240-250`. Non-admins get `notFound()` (`:178`), which is fine.

## `app/(app)/fornecedores/duplicatas/merge-buttons.tsx`
- `:28-33` — gating a server action with `window.confirm` inside `onSubmit`. Blocking, non-accessible, unstyled, and fragile against React's action dispatch. Should be a dialog + explicit confirm state.
- `:39-58` — submit button for an **irreversible merge** with no pending/disabled state; double-click fires `mergeFornecedoresAction` twice.
- `:41-54` and `:72` — everything hardcoded inline: `padding: '7px 12px'`, `fontSize: 12`, `fontWeight: 600`, `borderRadius: 8`, `gap: 6/8`. There is no `.css` file for this route at all.
- `'use client'` at `:1` — the only client-needed part is the confirm; `MergeButtons` (`:63-89`) is pure layout that could stay on the server.
- `duplicatas/page.tsx:10-18` — `ScoreBadge` receives `motivo` and never uses it (dead prop). `:64-75` and following also use hardcoded `var(--brand, #a3e635)` inline banners.

## `app/(app)/fornecedores/[id]/apelidos-section.tsx`
- `'use client'` at `:1` is **unnecessary** — the component has no state, no handlers, no hooks; it's two server-action forms plus a list. It ships the whole thing to the browser for nothing. Should be a server component.
- `:156-172` (Adicionar) and `:89-106` (Remover) — submit buttons with no pending/disabled state → duplicate apelidos / duplicate deletes on double-click.
- **No error surface at all**: `apelido-actions.ts` failures redirect with `?error=`, but this component renders no banner and no `aria-live`; validation errors are invisible here, and the typed apelido at `:134-154` has no `defaultValue`, so it's lost.
- `:120-133` — hardcoded `id="apelido-input"`; duplicated ids if the section is rendered more than once on a page.
- `:86` — `&lt;form style={{ display: 'contents' }}&gt;`.
- **Everything is inline-styled**: `:15`, `:19-24`, `:31-38`, `:43-52`, `:59-71`, `:78-82`, `:92-103`, `:116`, `:122-130`, `:143-153`, `:158-169`. Hardcoded hex fallbacks at `:67`, `:68`, `:164` (`var(--brand, #a3e635)`) and a raw `color: '#000'` at `:165`.
- `:134-154` — the input has no `aria-describedby` to the hint/placeholder and no error linkage.

## `app/(app)/documentos/documentos-table.tsx`
- `'use client'` at `:1` receives three **unbounded** arrays from `documentos/page.tsx:38-50`: `listDocumentos` (`lib/data/documentos.ts:18-42`, no `.limit()`), `listObras({includeArchived:true})` (`obras.ts:14-36`, no limit), `listFornecedores({includeArchived:true})` (`fornecedores.ts:16-43`, no limit). All three are serialized into the RSC payload.
- `:42-43` — `obras`/`fornecedores` exist only to build lookup maps. That join belongs on the server; the client only needs `obra_nome`/`fornecedor_nome` per row. Currently two entire tables are shipped to render two text columns.
- `components/data-table.tsx:44` paginates at 10 rows/page client-side, so the full dataset is in memory regardless.
- `:101` — header cell renders a `&lt;span&gt;` with `textAlign`; no `scope`, and the alignment is inline rather than a CSS class.
- `:53`, `:54`, `:77`, `:87`, `:105-106`, `:119-123` — inline styles (`gap: 8`, `opacity: 0.6`, `color: var(--text-secondary)`).
- Empty state exists via `emptyMessage` (`:138`).

## `app/(app)/documentos/documentos-filters.tsx`
- **`:54` uses `form-layout__select` but neither this file nor `documentos/page.tsx` imports `app/(app)/_shared/form-layout.css`.** The full list of importers is: `relatorios/relatorios-forms.tsx:8`, `fornecedores/fornecedor-form.tsx:7`, `obras/obra-form.tsx:5`, `pagamentos/pagamento-form.tsx:8`, `config/categorias/{nova,[id]/editar}`, `config/webhooks/{novo,[id]/editar}`, `config/usuarios/{convidar,[id]/editar}`, `config/perfil`. `/documentos` is not among them → **the obra filter renders as an unstyled native select.**
- `:53` — `onChange` → `router.push` navigates on every change. Keyboard users arrowing through the options fire a navigation per option, and there is no submit fallback (breaks with JS disabled). No pending indicator during the navigation.
- `useSearchParams()` at `:4`/`:16` inside a client component that `documentos/page.tsx:94` renders without a `&lt;Suspense&gt;` boundary — CSR-bailout risk on this route.
- `:30-37`, `:38`, `:41-47` — hardcoded inline layout/typography (`marginTop: 16`, `gap: 12/4`, `fontSize: 11`, `letterSpacing`).

## `app/(app)/fornecedores/fornecedores-table.tsx`
- Same shape as documentos-table: `'use client'` at `:1` receiving unbounded `fornecedores` + `categorias` from `fornecedores/page.tsx:24-31` (`listFornecedores` has no `.limit()`), serialized whole into the client payload.
- `:20-24` — `catMap` is a server-side join executed in the browser; only `categoria_nome`/`cor` per row need to cross the wire.
- `:51`, `:53`, `:56-61`, `:66-73`, `:104-108` — inline styles; the swatch's `width: 8, height: 8, borderRadius: 2` at `:68-71` are hardcoded rather than tokens (the `background: cat.cor` itself is DB-driven, that's fine).
- Empty state via `emptyMessage` (`:123`). Icon-only edit link has `aria-label` at `:103` (good).

## `app/(app)/_shared/detail-primitives.tsx`
- **Uses `detail-layout__*` classes (`:14`, `:15`, `:16`, `:66`, `:68-69`) and `obras-row-link` (`:56`) but imports no CSS.** It relies entirely on each consumer importing `_shared/detail-layout.css` — currently only `fornecedores/[id]/page.tsx:4`, `obras/[id]/page.tsx:9`, `documentos/[id]/page.tsx:14`, `pagamentos/[id]/page.tsx:13`. Any new consumer renders completely unstyled with no error. (`obras-row-link` is safe — it's global via `styles/nos-responsive.css:730`.)
- `:14` — template literal produces a trailing space in `className` when `span !== 2`.
- `:41-53` — swatch dimensions hardcoded inline (`width: 10`, `height: 10`, `borderRadius: 3`, `marginRight: 8`).
- `:15` — hardcoded `&lt;h3&gt;` regardless of surrounding heading level; on pages whose `TopBar` renders an `h1`, an `h2` is skipped.
- Correctly a server component otherwise.

## `app/api/exports/[tipo]/route.ts`
- **Yes, it checks auth.** `:121-124` calls `supabase.auth.getUser()` and `:126-128` returns `401 { error: 'não autenticado' }` before any data access. The middleware exemption at `lib/supabase/middleware.ts:38-41` (`url.pathname.startsWith('/api/exports/')`) is therefore compensated for in the handler.
- Caveat 1: **no role check.** Any authenticated user (including `leitura`) can export any obra/fornecedor/month by guessing/holding a UUID. Authorization rests entirely on RLS inside `getObraCompletaData` / `getFornecedorData` / `getMesData` / `getAtividadeData`.
- Caveat 2: because middleware skips the login redirect, an expired session produces a raw JSON 401 in a new tab instead of bouncing to `/login` — the download link just appears broken to the user.
- Caveat 3: `:207-236` (`mes`) and `:277-306` (`atividade`) have no 404 path — an empty range renders an empty PDF/CSV rather than reporting "no data".
