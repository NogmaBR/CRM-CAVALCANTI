# Auditoria de Performance, Acessibilidade e Engenharia Front-end — CRM Nogma-Cavalcanti

> Redisparada em 2026-09-09 (Sonnet 5) para repor a rodada perdida no crash do VS Code.

**Escopo:** `apps/web` (Next.js 16 App Router, React 19). Auditoria read-only — nenhum arquivo foi alterado. Não duplica achados de `docs/audit/2026-09-09-opus5/07-fidelidade-design-system.md` (tokens/CSS) nem de `05-detalhes-produto-premium.md` (⌘K, masking, `error.tsx`/`loading.tsx`, `useOptimistic`, KPIs, formatters duplicados) — este documento foca no que ficou de fora: performance de renderização/dados, acessibilidade por teclado, responsividade real e duplicação de componentes.

## 1. Resumo executivo

A base é sólida em vários pontos que costumam falhar em CRMs internos: `focus-visible` global bem implementado (`styles/a11y.css`), skip-link funcional, labels de formulário corretamente associadas via `useId`/`htmlFor`, colunas de tabela memoizadas com `useMemo`, zero `console.*` de debug esquecido, zero `key` ausente em listas.

Os problemas reais estão em três frentes:

1. **Dados sem paginação no servidor** — `listObras`, `listPagamentos`, `listFornecedores`, `listDocumentos` não têm `.limit()`/`.range()`; toda a tabela é buscada do Postgres e serializada para o cliente a cada carregamento de página, e só então paginada em memória (10 linhas por vez). Isso degrada linearmente com o crescimento do banco — é o maior risco de performance da aplicação. (Confirma independentemente o F-02 da auditoria backend/DB desta mesma rodada.)
2. **Acessibilidade por teclado quebrada no componente mais reutilizado do app**: os cabeçalhos de coluna ordenável (`<th onClick>`) não são alcançáveis via Tab em nenhuma tabela do sistema — afeta `DataTable` (usado por Fornecedores, Pagamentos, Documentos) e sua cópia manual em Obras.
3. **Chamadas de rede redundantes ao Supabase Auth** — `UserMenu` (Server Component que chama `supabase.auth.getUser()`) é instanciado duas vezes por página (sidebar desktop + drawer mobile), sem memoização via `React.cache()`, resultando em 3 round-trips de auth por navegação (1 no middleware + 2 no `UserMenu`).

Nenhum dos 3 é visível no dia a dia com poucos dados/um usuário de teste — por isso escaparam de QA manual — mas todos são baratos de corrigir e têm impacto direto e crescente em produção.

---

## 2. Findings

### Alto impacto

**F-01. Nenhuma tabela tem paginação no servidor — dataset inteiro trafega e é mantido em memória no cliente**
`apps/web/lib/data/pagamentos.ts:21-49`, `apps/web/lib/data/obras.ts:14`, `apps/web/lib/data/fornecedores.ts:16`, `apps/web/lib/data/documentos.ts:18`
Nenhuma dessas 4 funções usa `.limit()` ou `.range()` — a query Supabase (`select('*')...`) devolve todas as linhas que passam pelo filtro de `deleted_at`. O resultado completo é serializado no payload RSC e entregue a `apps/web/components/data-table.tsx:34-44` (ou à cópia em `apps/web/app/(app)/obras/obras-table.tsx:103-190`), que só então aplica `getPaginationRowModel()` com `pageSize: 10` fixo — ou seja, a paginação é 100% cosmética/client-side. Diferente dos filtros (`obra_id`, `status`, `categoria_id` etc.), que corretamente viram query params e disparam novo fetch no servidor, o número da página nunca chega à URL nem ao Supabase.
Com meses de operação (o CRM já registra pagamentos recorrentes de obras via WhatsApp), isso significa buscar e transmitir milhares de linhas — todas as colunas (`select('*')`) — a cada visita a `/pagamentos`, `/documentos`, `/obras`, `/fornecedores`.
**Fix:** mover `page`/`pageSize` para `searchParams` (mesmo padrão já usado para os filtros), aplicar `.range((page-1)*pageSize, page*pageSize-1)` nas queries, e passar `pageCount`/`total` como props para o `DataTable` renderizar paginação server-driven em vez de `getPaginationRowModel()` client-side.

**F-02. `supabase.auth.getUser()` é chamado 2x por página, sem memoização — 3 round-trips de auth por navegação**
`apps/web/components/layout/user-menu.tsx:15`, `apps/web/components/layout/sidebar.tsx:22`, `apps/web/components/layout/topbar.tsx:19`, `apps/web/lib/supabase/server.ts:5-28`
`UserMenu` é um Server Component `async` que chama `supabase.auth.getUser()` (que sempre revalida o JWT contra o servidor Auth — não lê de cache local, é o comportamento documentado do `@supabase/ssr`). Ele é montado duas vezes por página: uma vez dentro de `<Sidebar>` (`sidebar.tsx:22`) e outra passada como prop para `<MobileNav userMenu={<UserMenu />}>` dentro de `<TopBar>` (`topbar.tsx:19`), que é usado por 37 páginas. Some-se a chamada de `getUser()` já feita pelo middleware (`apps/web/lib/supabase/middleware.ts:31`) para o auth guard, e toda navegação autenticada faz 3 chamadas de rede ao Supabase Auth em vez de 1. `createClient()` (`lib/supabase/server.ts:5`) não é envolvida em `React.cache()`, então não há dedupe automático de request dentro do mesmo render tree.
**Fix:** buscar o usuário uma única vez em `app/(app)/layout.tsx` (Server Component pai) e passar `user`/`nome`/`email` como props para `Sidebar` e `TopBar`, eliminando o segundo `<UserMenu />`; ou envolver a leitura do usuário em `React.cache()` para dedupe automático dentro do mesmo request.

### Médio impacto

**F-03. Cabeçalhos de coluna ordenável são inacessíveis por teclado em toda tabela do sistema**
`apps/web/components/data-table.tsx:69-72`, duplicado em `apps/web/app/(app)/obras/obras-table.tsx:316-322`
```tsx
<th
  key={header.id}
  className={header.column.getCanSort() ? 'nos-dt__th nos-dt__th--sortable' : 'nos-dt__th'}
  onClick={header.column.getToggleSortingHandler()}
  aria-sort={...}
>
```
`<th>` não é focável nativamente e não tem `tabIndex`, `role="button"` nem `onKeyDown` (Enter/Space) — só responde a clique de mouse. `aria-sort` está correto para leitor de tela, mas ninguém usando teclado ou switch device consegue *acionar* a ordenação (só consegue ler o estado atual). Isso reprovaria WCAG 2.1.1 (Keyboard) para qualquer coluna ordenável em Obras, Pagamentos, Fornecedores e Documentos — ou seja, praticamente todas as listagens do CRM. O CSS global de foco (`styles/a11y.css:32-48`) nem chega a se aplicar aqui porque o elemento nunca recebe foco.
**Fix:** trocar `<th onClick>` por um `<button type="button">` interno ocupando `.nos-dt__th-inner` (mantendo o `<th>` só como container semântico), ou adicionar `tabIndex={0}`, `role="button"` e `onKeyDown` que dispare `getToggleSortingHandler()` em `Enter`/`Space`. Corrigir nos dois arquivos (a duplicação do #F-12 significa que qualquer fix precisa ser feito duas vezes).

**F-04. `MobileNav` (Radix Dialog completo) é hidratado em toda página, mesmo em desktop, onde é só `display:none`**
`apps/web/components/layout/topbar.tsx:19`, `apps/web/components/layout/mobile-nav.tsx:1-61`, `apps/web/styles/nos-responsive.css:19-25`
`<TopBar>` (Server Component usado por 37 páginas) sempre renderiza `<MobileNav userMenu={<UserMenu />} />`, que é `'use client'` e importa `@radix-ui/react-dialog` + `@radix-ui/react-visually-hidden`. A visibilidade em desktop é resolvida só via CSS (`nos-responsive.css:19-25` — `display:none` até 767.98px), não por lógica de componente/viewport. Ou seja: todo usuário desktop baixa, parseia e hidrata o Dialog completo (overlay, portal, focus-trap) de um menu que nunca pode abrir na tela dele.
**Fix:** usar `useMediaQuery`/`matchMedia` para não montar `<Dialog.Root>` acima de `md`, ou (mais simples) usar `next/dynamic` com um wrapper que só renderiza o drawer quando o trigger é clicado a primeira vez.

**F-05. Fontes self-hosted em `.ttf` (TrueType) em vez de `.woff2` — payload ~3-4x maior que o necessário**
`apps/web/styles/tokens/fonts.css:7-63`, `apps/web/public/fonts/*.ttf`
As 7 variações de Raleway (`Raleway-Light.ttf` … `Raleway-Black.ttf`, ~164KB cada) e `Agency.otf` (~29KB) são servidas em formato não comprimido. `font-display: swap` está corretamente configurado (evita FOIT), mas cada peso de fonte realmente usado numa página baixa o arquivo `.ttf` inteiro em vez de um `.woff2` equivalente, que tipicamente reduz 60-70% do tamanho para o mesmo glyph set latino.
**Fix:** converter para `.woff2` (ex.: `fonttools` ou Google Fonts' `woff2_compress`), adicionar como primeira opção em `src` com fallback `.ttf`/`.otf` opcional.

**F-06. `Sidebar` não passa `priority` no logo acima da dobra (LCP)**
`apps/web/components/layout/sidebar.tsx:10,12`
Os dois `<Image>` do logo (isotype + wordmark), sempre visíveis, sem scroll, em todas as 37 páginas autenticadas, não têm `priority`. O Next lazy-carrega por padrão qualquer `<Image>` sem esse prop, competindo por prioridade de rede com o restante do carregamento da página. A página de login (`app/(auth)/login/page.tsx:23`) já faz isso corretamente — o padrão só não foi replicado na sidebar do app autenticado, que é renderizada com muito mais frequência.
**Fix:** adicionar `priority` aos dois `<Image>` de `sidebar.tsx`.

**F-07. Flash de ícone/tema incorreto no `ThemeToggle` — estado inicial ignora o cookie que o servidor já leu**
`apps/web/components/layout/theme-toggle.tsx:14,16-19`, `apps/web/lib/theme.ts:7-12`
```tsx
const [theme, setTheme] = useState<Theme>('black'); // sempre 'black' no primeiro render
useEffect(() => {
  const cur = document.documentElement.getAttribute('data-theme') ?? '';
  setTheme((cur === 'black' || cur === 'dark' ? cur : 'light') as Theme);
}, []);
```
`getServerTheme()` já lê o cookie `nogma-theme` no servidor (usado em `app/layout.tsx` para estampar `data-theme` no `<html>` sem FOUC). Mas `ThemeToggle`, um componente-filho renderizado dentro do mesmo request, não recebe esse valor como prop — ele redescobre o tema no cliente via `useEffect`, mostrando por um instante o ícone de Lua ("Escuro (Nogma)") e o `aria-label` errado para qualquer usuário em tema `light` ou `dark` (petróleo), até o efeito rodar após a hidratação.
**Fix:** `TopBar` já é Server Component — chamar `getServerTheme()` ali e passar `initialTheme` como prop para `ThemeToggle`, eliminando o `useState('black')` fixo.

### Baixo impacto

**F-08. `Tabs` não implementa navegação por setas (WAI-ARIA APG Tabs pattern)**
`apps/web/components/nogma/Tabs.tsx:49-64`
`role="tablist"`/`role="tab"`/`aria-selected` estão corretos e o elemento é um `<button>` nativo (então Tab+Enter funciona), mas falta o padrão de "roving tabindex" com `ArrowLeft`/`ArrowRight`/`Home`/`End` que o WAI-ARIA Authoring Practices recomenda para grupos de abas. Não é um bloqueio de WCAG 2.1 AA (foco nativo funciona), mas é uma lacuna de conformidade ARIA se o app crescer em auditorias mais rígidas (ou AAA).
**Fix:** adicionar handler de `onKeyDown` no `.ng-tabs__list` movendo foco entre os botões.

**F-09. `Button`/`IconButton` não default para `type="button"`**
`apps/web/components/nogma/Button.tsx`, `apps/web/components/nogma/IconButton.tsx:22-47`
Nenhum dos dois componentes define `type` por padrão — herdam o `type="submit"` nativo do `<button>` HTML quando usados dentro de um `<form>`. Hoje o código é disciplinado (ex.: `obras-table.tsx:279` passa `type="button"` explicitamente no botão "Cancelar seleção"), mas é um contrato frágil: a primeira vez que alguém esquecer o `type="button"` num botão secundário dentro de um `<form>`, ele vai submeter o formulário silenciosamente.
**Fix:** `type = 'button'` como default nos dois componentes (quem quiser submit explicita `type="submit"`).

**F-10. `DataTable` não tem nenhuma regra responsiva — depende só de `overflow-x: auto`, sem coluna fixa**
`apps/web/components/data-table.css:1-124` (zero `@media` no arquivo inteiro)
Em 375px, a tabela rola horizontalmente inteira (padrão aceitável para dados tabulares), mas como não há nenhuma coluna "congelada" (nem a de identificação — nome da obra/fornecedor), ao rolar para ver colunas à direita (valor, status, data) o usuário perde de vista a qual linha elas pertencem. Combinado com a ausência de sticky header já registrada no doc05 (item 15), a experiência de tabela em mobile fica difícil de usar em qualquer listagem com mais de ~4 colunas (Pagamentos tem 7+).
**Fix:** `position: sticky; left: 0` na primeira coluna de cada tabela abaixo do breakpoint mobile, com sombra sutil indicando o corte, ou considerar um layout de "cards" empilhados abaixo de 480px (padrão comum para tabelas em mobile).

**F-11. Padrão "aba de filtro" (`<nav><Link key aria-current>`) duplicado independentemente em 9 páginas**
`app/(app)/config/categorias/page.tsx:162-174`, `app/(app)/config/usuarios/page.tsx:223-231`, `app/(app)/documentos/page.tsx:77-85`, `app/(app)/fornecedores/page.tsx:48-98` (2x, status e categoria), `app/(app)/notificacoes/page.tsx:140-148`, `app/(app)/obras/page.tsx:46-54`, `app/(app)/pagamentos/page.tsx:150-158`, `app/(app)/whatsapp/page.tsx:72-80`
Mesmo JSX (`<nav aria-label="..."><Link key={opt.value} className={active ? '...is-active' : '...'} aria-current={...}>`) reimplementado em cada página, cada uma com sua própria classe CSS (`categorias-filter-tab`, `usuarios-filter-tab`, `obras-filter-tab`, `notif-filter-tab`, `whatsapp-filter-tab`) — mesmo comportamento e acessibilidade corretos em todos, mas qualquer ajuste visual (ex.: os fixes de `--surface-2` do doc07, item 1) precisa ser replicado manualmente em 9 lugares.
**Fix:** extrair `<FilterTabs items={FILTER_OPTIONS} active={...} basePath="..." />` para `components/nogma/` ou `components/domain/`, reduzindo a superfície de manutenção e unificando o CSS.

**F-12. `obras-table.tsx` é uma cópia manual de ~200 linhas de `data-table.tsx` — evidência concreta do custo da duplicação**
`apps/web/app/(app)/obras/obras-table.tsx:103-403` vs `apps/web/components/data-table.tsx`
Já registrado no doc05 (item 15) como problema de arquitetura; esta auditoria encontra a prova direta do custo: o bug de teclado do F-03 existe fisicamente em dois arquivos porque a lógica de sort foi copiada, não reutilizada. Qualquer correção de acessibilidade, performance ou comportamento em `DataTable` precisa ser replicada manualmente em `obras-table.tsx` (e será esquecida em algum momento).
**Fix:** dar a `DataTable` um slot de seleção de linha (`enableRowSelection` + toolbar de ações em massa) genérico o suficiente para Obras usar o componente compartilhado.

**F-13. Dependência `motion` (~13.2.0) instalada e nunca importada**
`apps/web/package.json:26`
Zero ocorrências de `from 'motion'`/`motion/react` em `app/**` ou `components/**`. Não afeta bundle (tree-shaking evita incluir o que não é importado), mas é peso morto no lockfile/instalação e sinaliza uma feature de animação planejada e nunca implementada.
**Fix:** remover do `package.json` se não há plano de uso, ou usar para as oportunidades de motion do design system (transições de drawer, sparklines).

---

## 3. Pontos positivos (para não reportar como achado por engano)

- `styles/a11y.css` é um baseline de acessibilidade genuinamente bom: skip-link funcional (`app/layout.tsx:71` aponta corretamente para `#main-content` em `app/(app)/layout.tsx:8`), `:focus-visible` universal, `prefers-reduced-motion`, `.sr-only`, tamanho mínimo de alvo de toque.
- `components/nogma/Input.tsx` e `Checkbox.tsx` associam label/id corretamente via `React.useId()`.
- Colunas de `data-table` são `useMemo`-izadas em todas as 3 tabelas que a usam (`documentos-table.tsx:45`, `pagamentos-table.tsx:49`, `obras-table.tsx:103`), evitando recriação da tabela a cada render.
- `sidebar-nav.tsx` é exemplar: `aria-current="page"`, ícones `aria-hidden`, `nav` semântico.
- Nenhum `console.log`/`console.warn` de debug esquecido no código de produção (só 1 `console.error` legítimo em `lib/data/usuarios.ts:197`, dentro de um catch).
- Nenhuma `key` ausente encontrada em nenhum `.map()` renderizado (90 ocorrências verificadas).
- `getKpisResumo`/`getGastoPorCategoria`/`getAtividadeRecente` em `lib/data/painel.ts` paralelizam corretamente suas próprias sub-queries com `Promise.all` — não há waterfall de fetch dentro da camada de dados, só a ausência de `Suspense` (já coberta no doc05) para transformar isso em streaming.

---

## 4. Tabela de prioridades

| # | Finding | Área | Severidade | Esforço | Arquivo(s) principal(is) |
|---|---|---|---|---|---|
| F-01 | Sem paginação server-side (dataset inteiro trafega) | Performance | **Alto** | Médio | `lib/data/{pagamentos,obras,fornecedores,documentos}.ts` |
| F-02 | `getUser()` duplicado, sem `React.cache()` | Performance | **Alto** | Baixo | `user-menu.tsx`, `sidebar.tsx`, `topbar.tsx` |
| F-03 | `<th onClick>` inacessível por teclado (toda tabela) | Acessibilidade | Médio | Baixo | `data-table.tsx:69-72`, `obras-table.tsx:316-322` |
| F-04 | `MobileNav`/Radix Dialog hidratado sempre, mesmo em desktop | Performance | Médio | Médio | `mobile-nav.tsx`, `topbar.tsx:19` |
| F-05 | Fontes `.ttf` em vez de `.woff2` | Performance | Médio | Baixo | `styles/tokens/fonts.css`, `public/fonts/*` |
| F-06 | Logo da sidebar sem `priority` (LCP) | Performance | Médio | Trivial | `sidebar.tsx:10,12` |
| F-07 | Flash de ícone errado no `ThemeToggle` | Performance/UX | Médio | Baixo | `theme-toggle.tsx:14,16-19` |
| F-08 | `Tabs` sem navegação por setas (WAI-ARIA APG) | Acessibilidade | Baixo | Baixo | `Tabs.tsx:49-64` |
| F-09 | `Button`/`IconButton` sem `type="button"` default | Robustez | Baixo | Trivial | `Button.tsx`, `IconButton.tsx` |
| F-10 | `DataTable` sem regras responsivas / coluna fixa | Responsividade | Baixo | Médio | `data-table.css` |
| F-11 | "Filter tabs" duplicado em 9 páginas | Duplicação | Baixo | Médio | 9 arquivos, ver F-11 |
| F-12 | `obras-table.tsx` cópia manual de `data-table.tsx` | Duplicação | Baixo (arquitetural) | Alto | `obras-table.tsx` |
| F-13 | Dependência `motion` não usada | Housekeeping | Trivial | Trivial | `package.json:26` |

**Ordem sugerida de ataque:** F-02 e F-06 (triviais, alto retorno) → F-01 (maior risco de escala, mas requer mudar contrato URL↔fetch↔DataTable) → F-03 (acessibilidade real, baixo esforço) → F-05/F-04/F-07 → o restante como débito técnico incremental.
