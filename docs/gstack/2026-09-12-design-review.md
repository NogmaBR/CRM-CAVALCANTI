# Design review ao vivo — CRM Cavalcanti — 2026-09-12

> Auditoria do time virtual gstack (designer sênior), em modo degradado: sem Aside, sem
> mockups, sem AskUserQuestion. Navegador: Playwright do repo (`@playwright/test`,
> chromium-1243, headless) contra `http://localhost:3000` ligado ao banco de produção,
> **somente leitura** (nenhum formulário submetido). Scripts e screenshots em
> `.playwright-mcp/gstack-design/` (gitignored): `audit.mjs` (telas + métricas em
> `metrics.json`), `contrast.mjs` (WCAG por texto visível, `contrast.json`),
> `fullpage.mjs` (página inteira — o app rola dentro de `.nos-app-shell > main`, então o
> `fullPage` normal só pega a dobra; o script injeta CSS **só no navegador** para
> desdobrar). Alvo da auditoria: PR #20 (`docs/PLANO-FRONTEND-PREMIUM.md`).
>
> Aviso de concorrência: durante a auditoria outro agente alterou no working tree
> `styles/tokens/colors.css` (`--text-muted` claro: `#a1a1a1` → `#6b7070`),
> `painel/page.tsx`, `pendentes/page.tsx`, `pagamentos-table.tsx` e `lib/data/pendentes.ts`.
> Todas as medições abaixo são de **antes** dessas mudanças (o navegador ainda media
> `#a1a1a1`). Onde a mudança já resolve o achado, está marcado.

## 0. Primeira impressão (painel, tema claro, 1440)

O site comunica **competência sóbria**: sidebar azul-marinho do cliente, título centrado,
saudação grande, faixa de alertas, quatro KPIs em cartão com sparkline. Meu olho vai para
(1) "Boa tarde, Admin" em 48px, (2) a faixa âmbar de alertas, (3) "R$ 453.500". A
hierarquia mente um pouco: o maior elemento da tela é a saudação, que não decide nada; o
que decide (2 mensagens aguardando, 50 pagamentos sem nota) está em 13px na faixa. Em uma
palavra: **limpo**. Trunk test desktop: PARTIAL (trilho de ícones sem rótulo — escudo,
círculo com "!", prancheta não se nomeiam sozinhos); celular: PASS (tabbar com rótulos).

## 1. Nota por tela (0–10)

Método: cada tela começa em 10; achado alto −1,5, médio −0,75, polimento −0,25; e a nota
responde "o que falta para ser 10" na justificativa. Screenshots em
`.playwright-mcp/gstack-design/`.

| Tela | Nota | Em uma linha (o que falta para 10) | Prova |
|---|---|---|---|
| /login | 6 | Pitch bonito, mas os três números são fixos no JSX e um deles é falso (124 documentos; a tela Documentos tem 0) | `login-light-1440.png`, `login-light-390.png`, `login-black-1440.png`, `login-dark-390.png` |
| /painel | 7 | Hierarquia certa na ordem errada: saudação 48px acima dos alertas 13px; legendas 2,6:1; "Gasto por categoria" vazio sem ação | `painel-light-1440-full.png`, `painel-black-1440.png`, `painel-dark-1440.png`, `painel-light-390-full.png` |
| /obras | 7,5 | Tabela limpa; coluna de checkbox sem ação em lote visível; cabeçalhos 2,4:1; badge "Ativa" ×10 sem sinal | `obras-light-1440.png`, `obras-light-390.png`, `obras-black-390.png` |
| /obras/novo | 7 | Seções com legenda funcionam; input Nome com 884px (medida longa demais); só Pagamentos marca obrigatório com `*` | `obras-novo-light-1440.png`, `obras-novo-light-390-full.png` |
| /obras/[id] | — | **Não capturado** (500 do dev server, ver §5) | — |
| /pagamentos | 7 | Total filtrado é o acerto da tela; três camadas de filtro; selects de filtro com 21px; no cartão mobile o valor vem em 4º | `pagamentos-light-1440.png`, `pagamentos-light-390-full.png` |
| /pagamentos/novo | 7,5 | Melhor formulário do app (asterisco, `inputmode=decimal`, default Confirmado); `type=number` aceita mal a vírgula do pt-BR | `pagamentos-novo-light-1440.png`, `pagamentos-novo-light-390.png` |
| /pagamentos/[id] | — | Renderizou uma vez (h1 "R$ 3.450,00", 82 palavras, 5 alvos <44px) e o screenshot foi sobrescrito por um 500 posterior | métrica em `metrics.json` |
| /fornecedores | 7,5 | Filtro de categoria com cor de borda é legenda útil; duas linhas de chips; badge "Ativo" ×8 | `fornecedores-light-1440.png`, `fornecedores-light-390-full.png` |
| /documentos | 5,5 | **Duas buscas** na mesma tela + três modos de lista + filtro de obra: quatro controles competindo | `documentos-light-1440.png`, `documentos-light-390.png` |
| /pendentes | 6,5 | Núcleo do contrato: Confirmar/Rejeitar claros, mas "Raciocínio da IA: MockClassifier…" vaza para o gestor e Confirmar fica ativo com obra "não identificada" | `pendentes-light-1440-full.png`, `pendentes-light-390-full.png`, `pendentes-dark-1440-full.png` |
| /relatorios | 8 | Quatro cartões, botões desabilitados até escolher a obra — mindless; ícone de cartão sem propósito | `relatorios-light-1440.png`, `relatorios-light-390-full.png` |
| /config | 8 | Hub agrupado em três seções, cartões nomeáveis em 2s; títulos de seção 12px/2,6:1 | `config-light-1440.png`, `config-light-390-full.png` |
| /config/autorizados | 7 | Alerta vermelho exato como o CLAUDE.md pede; estado vazio sem botão (o CTA só existe no topo) | `config-autorizados-light-1440.png`, `config-autorizados-light-390-full.png` |
| /config/automacoes | 5,5 | JSON cru em textarea para o gestor; botões Salvar/Ligar 22px; no celular a tabela estoura horizontal | `config-automacoes-light-1440.png`, `config-automacoes-light-390.png` |
| /config/perfil | 7,5 | Limpo; nomes de tema internos ("Preto (padrão Nogma)", "Petróleo (dark alt)") vazam para o cliente | `config-perfil-light-1440-full.png`, `config-perfil-light-390-full.png` |
| /config/usuarios | 7,5 | Correto; e-mail em monospace sem motivo; "(você)" como única "ação" | `config-usuarios-light-1440-full.png` |
| /config/filas | 7 | Admin-only; nomes mono cabem; dois estados vazios explicativos (bom) | `config-filas-light-1440.png` |
| /whatsapp | 6,5 | Erro cru "MockClassifier…"; seta de "Confirmar em Pendentes →" quebra sozinha; no celular os filtros viram 5 linhas | `whatsapp-light-1440-full.png`, `whatsapp-light-390.png` |
| /auditoria | 5,5 | Muro de cartões idênticos, 14.029px de altura em 1440, nomes de coluna crus ("criado_por_user_id"); 211 alvos <44px | `auditoria-light-1440.png`, `auditoria-light-390.png` |
| 404 (/obras/nao-existe) | — | **Não capturado** (500 do dev server, ver §5) | `404-light-1440.png` mostra o overlay de erro do Next |
| Sidebar (hover) | 8 | Expande para 252px, itens 46px, ativo em lime; **falta "Pagamentos"** no menu; "Sair" 32px | `sidebar-hover-light-1440.png`, `sidebar-hover-black-1440.png` |
| Paleta ⌘K | 8 | Abre, navega, fecha; busca "cav" ficou em "Buscando…" >1,2s sem resultado (latência iad1↔sa-east-1) | `cmdk-vazio-light-1440.png`, `cmdk-busca-light-1440.png`, `cmdk-light-390.png` |
| Drawer mobile | 8 | Itens 46px, tema e usuário no rodapé; "Sair" 32px | `drawer-light-390.png`, `drawer-black-390.png` |
| Tabbar | 8 | 5 itens de 78×63, badge em Pendentes, ativo colorido; rótulo 11px | `tabbar-light-390.png`, `painel-topo-light-390.png` |
| Tabela em 390px | 8 | Vira cartão com rótulo por célula (obras e pagamentos); checkbox solto no canto do cartão | `obras-light-390.png`, `pagamentos-light-390-full.png` |

**Média das 22 telas/estados avaliados: 7,1.** Design score no método A–F: **B−**
(hierarquia B, tipografia B, espaçamento B+, cor/contraste C, estados de interação B−,
responsivo B+, conteúdo C+, AI-slop A−, motion B, performance percebida B−).
AI Slop Score: **A−** — não há grid de 3 features, gradiente roxo nem hero genérico;
o único tell é o trio de números grandes no login (item A1).

## 2. Achados, por impacto

Formato: tela · evidência · por que importa para o gestor · correção (arquivo + trecho).
**[SEGURO ANTES DE 16/09]** = só CSS/copy, sem tocar em dado ou fluxo.
**[DEPOIS DE 16/09]** = muda componente, dado ou comportamento.

### Alto

**A1. Login promete números que não existem** — `/login` ·
`login-light-1440.png` · `app/(auth)/login/page.tsx:31-44` tem `10 obras ativas`,
`R$ 453k investido`, `124 documentos` fixos no JSX. Documentos está vazia (0 resultados).
É a primeira tela que o Fernando vê; um número inventado na porta corrói a confiança
antes de entrar. Também é o tell "três números grandes sob o hero".
Correção **[SEGURO ANTES DE 16/09]**: remover o bloco `.nos-login__stats` inteiro (o
pitch "Sua obra controlada no WhatsApp" já carrega a tela). Se quiser manter números,
só depois de 16/09, lidos do banco por service_role na página (não é dado sensível: são
contagens).

**A2. "Pagamentos" não está na sidebar** — casca · `sidebar-hover-light-1440.png`,
`drawer-light-390.png` · `components/layout/sidebar-nav.tsx:10-22` lista Painel, Obras,
Documentos, WhatsApp, Pendentes, Fornecedores, Auditoria, Relatórios, Perfil, Config.
A tabbar mobile (`mobile-tabbar.tsx:24`) e a ⌘K têm Pagamentos; o desktop não. O objeto
central do CRM financeiro só se alcança por Obras, ⌘K ou URL. Trunk test falha na
pergunta "quais são as seções".
Correção **[SEGURO ANTES DE 16/09]** (é uma linha de config de nav, sem lógica):
```tsx
// sidebar-nav.tsx, logo após Obras
{ href: '/pagamentos', label: 'Pagamentos', icon: Receipt },
```
e trocar Auditoria de lugar (vai para o grupo de baixo, com Relatórios) para o grupo
principal ficar com 7 itens operacionais.

**A3. Texto interno da IA e do mock aparecem para o gestor** — `/pendentes`, `/whatsapp`
· `pendentes-light-1440-full.png` ("RACIOCÍNIO DA IA: MockClassifier: valor=1250,
obra=?, fornecedor=?"), `whatsapp-light-1440-full.png` ("Erro: MockClassifier: sem texto
e sem mídia relevante"). O cliente pediu para esconder a métrica de confiança (CLAUDE.md
§6); o raciocínio cru é a mesma categoria de informação, e "MockClassifier" entrega que
a IA está em modo de teste na demo de 16/09.
Correção **[SEGURO ANTES DE 16/09]** (copy/render): em
`app/(app)/pendentes/page.tsx:180-183`, não renderizar o bloco quando
`de.raciocinio` começar com `MockClassifier`; melhor, só renderizar para
`IA_PROVIDER !== 'mock'`. Em `/whatsapp`, trocar a linha de erro por texto humano:
"Não consegui entender esta mensagem. Abra em Pendentes para lançar manualmente."
com o erro técnico no `title`.

**A4. Confirmar fica ativo com obra "não identificada"** — `/pendentes` ·
`pendentes-light-1440-full.png` (2º cartão: valor, data, obra e fornecedor todos "não
informado", e Confirmar azul ativo). Um "Confirmar" mindless que grava um pagamento sem
obra e sem valor é exatamente o falso-sim que o parser conservador tenta evitar do lado
do WhatsApp. Correção **[DEPOIS DE 16/09]** (muda comportamento): desabilitar Confirmar
enquanto `valor` ou `obra_id` faltarem e trocar o rótulo por "Completar e confirmar", que
abre `/pagamentos/novo` pré-preenchido. Antes de 16/09, **[SEGURO]**: tornar a lacuna
visível — `.pendente-extracted__value--empty` em `--warning` com ícone, não em cinza
itálico.

**A5. Contraste do texto secundário reprova em todas as telas claras** — todas ·
`contrast.json` · medido: `#a1a1a1` sobre `#ffffff` = **2,58:1** (mín. 4,5) em
`.kpi__caption`, `.nos-topbar__sub`, `.nos-section__hint`, `.config-hub__section-title`,
`.painel-chart-card__empty`, `.code`; `#a1a1a1` sobre `#f7f8f8` = **2,43:1** em
`.nos-dt__th-inner` (cabeçalho de toda tabela). O cinza `#a1a1a1` é cor de marca da
Nogma, mas foi usado como texto. O gestor lê "0 pagamentos confirmados" e "há mais de 7
dias" nesse cinza.
Correção **[SEGURO ANTES DE 16/09]**: **já em andamento no working tree** por outro
agente (`--text-muted: #6b7070` no tema claro = 5,0:1 no branco). Faltam dois
complementos: (a) tema petróleo, `#7fb9c3` sobre `#115965` = **3,65:1** em
`.kpi__caption` — trocar `--text-muted: var(--petroleum-300)` por `var(--petroleum-200)`
(`#b4d7dd`, ≈6,5:1) em `[data-theme="dark"]`; (b) o cabeçalho de tabela
`components/data-table.css:44-60` deve usar `var(--text-secondary)`, não `--text-muted`.

**A6. Badge de sucesso é ilegível e é a badge mais usada** — `/obras`, `/pagamentos`,
`/fornecedores`, `/config/usuarios` · `contrast.json`: `#2fa36b` sobre `#e7f5ee` =
**2,84:1** (12px) — ×10 por página, nos três temas (o par não muda por tema, então no
preto ele ainda é verde-claro-sobre-verde-pastel). "Aprovado"/"Ativa" é o status que
mais aparece no app.
Correção **[SEGURO ANTES DE 16/09]** em `components/nogma/Badge.css:14`:
```css
.ng-badge--success{ background:var(--success-bg); color:#1f7a4d; }          /* 5,2:1 */
[data-theme="black"] .ng-badge--success,
[data-theme="dark"]  .ng-badge--success{ background:color-mix(in srgb,var(--success) 18%,transparent); color:#6fd39a; }
```
Mesma revisão para `--warning` (âmbar sobre creme) e para o botão `ng-btn--danger`:
branco sobre `#d6483b` = **4,33:1** em "Rejeitar" (14px) — escurecer `--danger` para
`#c73f33` (≈4,9:1) em `styles/tokens/colors.css`.

**A7. Documentos tem duas buscas e três modos** — `/documentos` ·
`documentos-light-1440.png`. Linha 1: filtro de obra. Linha 2: "Buscar por arquivo, nº
da NF, fornecedor ou obra" + botão Buscar. Linha 3: abas Lista / Por fornecedor / Por
obra. Linha 4: "Buscar por nome ou número da NF…" + "0 resultados". Quatro controles
para chegar ao mesmo conjunto vazio. O gestor para e pensa "qual busca?" — falha da 1ª
lei. Correção **[DEPOIS DE 16/09]**: uma busca só (a de cima, que cobre mais campos),
abas de tipo (Notas, Comprovantes…) como estão, e "Por fornecedor / Por obra" viram um
`select` "Agrupar por" à direita da busca. Antes de 16/09 **[SEGURO]**: esconder a
segunda busca por CSS (`.docs-lista .ng-input--busca{display:none}`) já tira o
conflito.

**A8. Automações expõe JSON e alvos de 22px** — `/config/automacoes` ·
`config-automacoes-light-1440.png`, `config-automacoes-light-390.png`. Parâmetros
`{"limite_por_rodada":25,"dias_sem_documento":7}` em textarea mono de 11px; "Salvar" e
"Ligar" com 56×22 e 66×22 (`categorias-action-btn`, `padding:4px 10px`); no celular a
tabela `categorias-table` estoura para a direita e "Parâmetros" some da tela. É a tela
que o usuário vai usar para ligar a cobrança depois de 16/09 — sem ela é SQL.
Correção **[SEGURO ANTES DE 16/09]** para os alvos, em
`app/(app)/config/categorias/categorias.css:182`: `padding:10px 14px; min-height:40px;
font-size:13px;` (afeta Categorias também — para melhor). **[DEPOIS DE 16/09]**: um
campo por parâmetro (label humano "Máximo de cobranças por dia", "Dias sem nota"),
gerado a partir do schema Zod da regra; no celular, cartão por regra em vez de tabela.

### Médio

**M1. Saudação maior que o alerta** — `/painel` · `painel-light-1440-full.png`. "Boa
tarde, Admin" em 48px/900 é o elemento mais pesado; os dois alertas acionáveis estão em
13px dentro da faixa, com links de **234×16 px** (`.painel-alertas__link`). Correção
**[SEGURO]** em `app/(app)/painel/painel.css`: saudação para 28px/800
(`.painel-saudacao h2{font-size:var(--text-2xl)}`), e `.painel-alertas__link{display:
block; padding:10px 0; font-size:14px; font-weight:600}` para cada alerta virar uma
linha clicável inteira de ≥44px.

**M2. Alvos de toque abaixo de 44px em listas** — `/obras`, `/pagamentos`, `/fornecedores`
· `metrics.json` (`smallTargetsSample`): abas de filtro `obras-filter-tab` 37px de
altura (×5 a ×12 por tela), lápis de editar 36×36, link do nome da linha 16px de altura,
input de busca `ng-input__el` 26px (o wrapper tem 44, o campo não — o toque fora do
texto cai no wrapper, ok, mas o foco por teclado mostra 26px), `form-layout__select`
nos filtros de Pagamentos com **21px**. Correção **[SEGURO]**:
`styles/nos-responsive.css:713 .obras-filter-tab{padding:12px 14px; min-height:44px}`;
`.form-layout__select` dos filtros herdar a métrica de 44px do `Input` como o PR #20 fez
para formulários; lápis `a[aria-label^="Editar"]{width:44px;height:44px}`.

**M3. Cartão mobile de pagamento esconde o valor** — `/pagamentos` 390 ·
`pagamentos-light-390-full.png`. Ordem: Data → Obra/Fornecedor → Categoria/**Valor** →
Status. Para quem confere gasto no celular, valor e obra decidem; data é secundária.
Correção **[SEGURO]** (só CSS, `components/data-table.css` modo cartão):
`td[data-col="valor"]{order:-1; font-size:20px; font-weight:800}` e
`td[data-col="data"]{order:10; color:var(--text-secondary)}` — o cartão já é flex/grid
por `data-col`.

**M4. Lista de 50 "há 252 dias" em vermelho = fadiga de alarme** — `/pendentes` ·
`pendentes-light-1440-full.png` (50 linhas idênticas, todas com relógio vermelho); no
tema petróleo o vermelho `#d6483b` sobre `#0c4651` dá **2,41:1** (×50). Correção
**[SEGURO]**: vermelho só acima de 30 dias, âmbar entre 7 e 30, e no tema escuro usar
`#ff8a7a` (`app/(app)/pendentes/pendentes.css:247` — hoje herda `--text-muted` e o
modificador crítico põe `--danger`). **[DEPOIS]**: agrupar por fornecedor com contagem e
soma ("Votorantim · 12 pagamentos · R$ 187.500") — é assim que se cobra nota, por
fornecedor, não por linha.

**M5. `type="number"` para valor em R$** — `/pagamentos/novo` ·
`app/(app)/pagamentos/pagamento-form.tsx:134-140`. Placeholder "0,00", mas
`type=number` no Chrome/Android recusa "1.250,00" (ponto de milhar) e a vírgula depende
do locale do teclado. Correção **[DEPOIS DE 16/09]** (toca em validação): `type="text"
inputMode="decimal"` com máscara pt-BR e Zod aceitando `1.250,00`; a UI já tem
`inputmode` certo. Até lá, **[SEGURO]**: helper text "Use ponto para centavos:
1250.00".

**M6. Obrigatoriedade inconsistente entre formulários** — `/obras/novo` marca nada
(`Nome` é `required` no HTML, sem asterisco); `/pagamentos/novo` marca `Obra *`,
`Valor`, `Data`; `/relatorios` marca `Obra *`, `Mês *`. Correção **[SEGURO]**: em
`app/(app)/obras/obra-form.tsx:42` usar o mesmo `Label` com `required` que o formulário
de pagamento usa; e um rodapé "* obrigatório" único em `form-layout.css`.

**M7. Medida de linha longa demais nos formulários desktop** — `/obras/novo`,
`/config/perfil` · inputs de **884px** (Nome, Rua, Apelidos, Email). Um campo de texto
com 884px de largura em 16px lê ~110 caracteres por linha e faz o olho viajar até o
botão. Correção **[SEGURO]**: `.form-layout{max-width:720px}` (o `Salvar` continua à
direita do formulário, não da tela).

**M8. Filtros de WhatsApp e Fornecedores quebram em várias linhas no celular** —
`whatsapp-light-390.png` (5 linhas de abas), `fornecedores-light-390-full.png` (chips
de categoria em 3 linhas). Correção **[SEGURO]**: nos contêineres de abas,
`display:flex; overflow-x:auto; flex-wrap:nowrap; scroll-snap-type:x proximity;
-webkit-overflow-scrolling:touch; padding-bottom:4px` abaixo de 768px, com
`.obras-filter-tab{flex:none}`.

**M9. Auditoria é um muro sem escaneabilidade** — `auditoria-light-1440.png`. Cada
cartão repete "10/09/2026, 11:04 · Criação · Pagamentos · Ver registro → · Sistema ·
campos: categoria_id, created_at, criado_por_user_id, …" — os nomes de coluna são
ruído para o gestor (é tela de admin, mas o gestor a vê no menu). 14.029px de altura em
1440, 65.336px em 390 (sem paginação visível no viewport). Correção **[DEPOIS]**:
agrupar por dia, mostrar "Pagamento de R$ 3.450 em FAIHome criado pelo sistema" (o
diff já existe em "Ver diff"), esconder `campos:` atrás de "Ver diff", e paginar por
50. **[SEGURO]**: `.audit-row__campos{display:none}` e mover Auditoria para o grupo
inferior da sidebar (A2).

**M10. Estado vazio sem ação** — `/config/autorizados`
(`config-autorizados-light-1440.png`): "Cadastre os números da equipe…" sem botão; o
CTA está no canto superior direito. O PR #20 (item 19) prometeu "ícone, frase e
botão" — aqui falta o botão. Mesmo em `/painel` "Sem categorias com dados" e "Nenhuma
atividade nas últimas 48h" (esse tem frase de contexto, ok). Correção **[SEGURO]**:
passar `acao={{ href:'/config/autorizados/novo', label:'Autorizar número' }}` ao
`EmptyState` da página; para o gráfico vazio, `EmptyState` compacto com link "Registrar
pagamento".

**M11. Nomes internos de tema no perfil** — `/config/perfil` · "Preto (padrão Nogma)",
"Petróleo (dark alt)". O cliente não sabe o que é Nogma-padrão nem "dark alt".
Correção **[SEGURO]** (copy): "Claro", "Escuro", "Petróleo".

**M12. Latência da busca ⌘K** — `cmdk-busca-light-1440.png`: 1,2s depois de digitar
"cav", ainda "Buscando…" e `items: []`. É o custo iad1↔sa-east-1 (394ms por consulta,
CLAUDE.md) vezes três tabelas. Correção **[DEPOIS]**: uma RPC única `busca_global` (uma
viagem em vez de três) e resultados de navegação aparecendo imediatamente enquanto a
busca roda (hoje a lista "Ir para" some ao digitar). **[SEGURO]**: manter "Ir para"
visível filtrado pelo texto — é só não esconder o grupo.

### Polimento

- **P1.** Rótulo da tabbar em 11px (`.nos-tabbar__item{font-size:11px}`), abaixo do mínimo
  de 12px para caption. **[SEGURO]** `font-size:12px`.
- **P2.** Subtítulo da topbar (`.nos-topbar__sub`) em Agency 11px, caixa alta, tracking
  0,08em: a fonte display condensada em 11px com tracking vira textura, não texto. Se é
  eyebrow, 12px e sem depender dele para informação (hoje ele diz "Confirmações do
  WhatsApp e pagamentos sem documento", que é a explicação da tela). **[SEGURO]**.
- **P3.** "Sair" 32×32 na sidebar expandida e no drawer (`nos-userpill__logout`).
  **[SEGURO]** `width:44px;height:44px`.
- **P4.** `font-variant-numeric: tabular-nums` só em Pendentes; as colunas de valor em
  Obras/Pagamentos/Fornecedores medem `normal` (`metrics.json`, `tabularNums`).
  **[SEGURO]** `td[data-col="valor"], td[data-col="orcamento"], .kpi__valor
  {font-variant-numeric:tabular-nums}` — as cifras alinham por dígito.
- **P5.** Seta de "Confirmar em Pendentes →" quebra sozinha para a linha de baixo em
  `/whatsapp` (1440 e 390). **[SEGURO]** `white-space:nowrap` no link ou
  `&nbsp;→`.
- **P6.** E-mail em monospace em `/config/usuarios` sem razão (o resto da linha é
  Raleway). **[SEGURO]** remover a classe mono.
- **P7.** Coluna de checkbox em `/obras` sem ação em lote visível; no cartão mobile o
  checkbox fica solto no canto. Se não há ação em lote, **[SEGURO]** esconder a coluna
  (`--sem-selecao`) até existir.
- **P8.** Cartões de `/relatorios` têm ícone grande decorativo no topo (o tell
  "icon-tile-stack"); os títulos já dizem tudo. **[SEGURO]** reduzir o ícone para 20px
  inline com o título.
- **P9.** `.nos-app{height:100vh}` em `nos-chrome.css:3` é legado (o layout usa
  `.nos-app-shell` com `100dvh` em `nos-responsive.css:180`). Não afeta a tela; é
  candidato a remoção para ninguém reativar 100vh no iOS.
- **P10.** Cabeçalhos das tabelas em 11,5px caixa alta: com o contraste corrigido (A5)
  ficam bons; sem, somam dois problemas.

## 3. O que está bom e deve ser preservado

- **A casca do PR #20 funciona**: trilho de 72px sempre visível, expansão no hover em
  ~250ms, item ativo em lime sobre azul-marinho (contraste ≈13:1), `main` com
  `margin-left` do trilho. O drawer e a tabbar no celular são a navegação de um toque
  que o plano prometeu — 5 destinos, 63px, badge de pendências, safe-area.
- **Tabela → cartão abaixo de 768px** (`data-col`/`data-label`) é responsivo de verdade,
  não coluna empilhada. Preservar; só reordenar (M3).
- **Título centrado na topbar + subtítulo** responde "que página é esta" no trunk test em
  qualquer largura; as ações nunca somem (descem para a linha própria a 390px — provado
  em `painel-light-390.png`, `pagamentos-light-390.png`).
- **Três temas com tokens por tema**: gráficos em `--chart-1` (azul no claro, lime nos
  escuros), sidebar por tema, `color-scheme` correto (`light` no claro, `dark` nos dois
  escuros — medido). O tema preto é o mais bonito do app: KPIs brancos sobre `#0e0e0e`,
  lime só em título e série.
- **Foco visível** em todos os temas (`focus-tab3-light-1440.png`: anel de 3px no botão
  de busca; no preto o anel é lime 55%). Não há `outline:none` sem substituto.
- **Formulários com seções nomeadas** (Identificação / Financeiro & prazos / Endereço /
  Extras) e `select`/`textarea` com os 44px do `Input` — o item 13 do PR #20 está
  cumprido nos formulários (não nos filtros, M2).
- **Estado vazio de Filas** e **de Atividade recente**: frase que explica o que
  significa o vazio ("É o estado normal quando tudo está sendo processado na hora").
  É o tom certo; replicar em M10.
- **`/relatorios`**: botões desabilitados até a escolha obrigatória — o clique é
  mindless. **`/config` hub**: cada cartão se nomeia em 2s (teste de área: PASS).
- **Paleta ⌘K** com "Ir para" + rodapé de atalhos; o trigger na topbar diz "(⌘K)".
- **Zero strings sem acento** nas 22 telas (a varredura de `noAccent` voltou vazia) e
  zero "..." em vez de "…".
- **Vocabulário de status e ausência da métrica de confiança**: decisões do cliente,
  não tocar (CLAUDE.md §6).

## 4. Hierarquia de informação do painel (o que se vê 1º, 2º, 3º)

```
┌─ TOPBAR ──────────────────────────────────────────────────────────────────────┐
│ [≡/trilho]        Painel                     🔍  🔔(2)  ☀   [+ Nova Obra]     │
│                   VISÃO GERAL DA OPERAÇÃO                                      │
└────────────────────────────────────────────────────────────────────────────────┘
   ①  SÁBADO, 12 DE SETEMBRO                ← eyebrow 12px
      Boa tarde, Admin                      ← 48px/900: o MAIOR peso da tela, zero decisão
   ②  ⚠ 2 mensagens aguardando confirmação  ← faixa âmbar, 13px, link 16px de altura
      50 pagamentos sem nota há mais de 7d  ← a informação que exige ação está aqui
   ③  ┌ Obras ativas ┐ ┌ Gasto no mês ┐ ┌ Total acumulado ┐ ┌ Pend. WhatsApp ┐
      │ 10           │ │ R$ 0         │ │ R$ 453.500      │ │ 2              │  ← 40px/800
      │ não arquiv.  │ │ 0 confirmados│ │ todas as obras  │ │ aguardando…    │  ← 12,5px cinza 2,6:1
      │ ~sparkline~  │ │ ~sparkline~  │ │ ~sparkline~     │ │ ~sparkline~    │
      └──────────────┘ └──────────────┘ └─────────────────┘ └────────────────┘
   ④  Análises
      ┌ GASTOS MENSAIS — ÚLTIMOS 12 MESES ──────────────────────────────────────┐
      │ ▇ barras em --chart-1 (Dez/25, Fev/26, Mar/26)                          │
      └─────────────────────────────────────────────────────────────────────────┘
      ┌ GASTO POR CATEGORIA ── ┐ ┌ TOTAL ACUMULADO ──────────────────────────── ┐
      │  "Sem categorias com   │ │ área acumulada (sobe em Fev–Mar/26)          │
      │   dados" (texto solto) │ │                                              │
      └────────────────────────┘ └──────────────────────────────────────────────┘
   ⑤  Atividade recente                                            Últimas 48h
      ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
        💬  Nenhuma atividade nas últimas 48h — pagamentos, documentos e
            mensagens novas aparecem aqui                                 (bom)
      └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

Ordem que o olho segue hoje:  ① saudação → ② faixa → ③ R$ 453.500 → ④ barras
Ordem que o gestor precisa:   ② alertas (o que fazer) → ③ números (como estamos)
                              → ④ tendência → ① saudação (contexto) → ⑤ feed
Correção M1 inverte o peso de ① e ② sem mover nada de lugar.
Celular (390): mesma ordem em coluna única, KPIs de 1 por linha (4 telas de rolagem
até "Análises"); tabbar fixa embaixo com Pendentes(2). Ver painel-light-390-full.png.
```

## 5. Completion status (honesto)

**Fotografadas e medidas (22 telas/estados, 100+ PNGs):** login (3 temas × 2 larguras),
painel e obras (3 temas × 2 larguras, mais página inteira), obras/novo, pagamentos,
pagamentos/novo, fornecedores, documentos, pendentes (claro e petróleo, página inteira),
relatórios, config, config/autorizados, config/automacoes, config/perfil,
config/usuarios, config/filas, whatsapp, auditoria — todas em 1440 e 390 no tema claro;
sidebar em hover (claro e preto), ⌘K vazia e com busca (1440 claro/preto, 390 claro),
drawer pelo hambúrguer e pela tabbar (claro e preto), tabbar recortada, foco por
teclado, tabela de pagamentos e de obras em cartão a 390px. Contraste WCAG medido por
texto visível em 10 rotas × 3 temas (`contrast.json`). Nenhum formulário foi submetido;
nenhum dado tocado.

**Não conseguidas, e por quê:**
- **`/obras/[id]`, `/pagamentos/[id]` e a 404 (`/obras/nao-existe`)**: o dev server
  responde **500 "Jest worker encountered 2 child process exceptions, exceeding retry
  limit"** em toda rota dinâmica, com o overlay marcando "Next.js 16.3.4 (stale)
  Turbopack". Tentei em três momentos diferentes, 4 tentativas com espera de 5s cada,
  e também via `curl`. `/pagamentos/[id]` renderizou **uma** vez (métricas salvas: h1
  "R$ 3.450,00" 22px, subtítulo "Pagamento em 28/03/2026 · FAIHome", 82 palavras, 5
  alvos <44px), mas o PNG foi sobrescrito por uma tentativa posterior que deu 500.
  Causa provável: o servidor de desenvolvimento ficou "stale" com as edições simultâneas
  do outro agente (5 arquivos alterados no working tree durante a auditoria). Não é
  defeito do app em produção; precisa de um `pnpm dev` reiniciado para fotografar. O
  404 global em português (PR #20, item 4) fica **não verificado** por esta auditoria.
- **Estados de erro de validação**: não fotografados. O `/obras/novo` tem `required`
  nativo em Nome; o erro do Zod só aparece depois do submit (`actions.ts:29`), e
  submeter — mesmo vazio — passa pela action de produção. Fiquei do lado seguro.
- **Login com hCaptcha**: o widget mostra "Warning: localhost detected" e "chave
  incorreta" — é ambiente local, não achado. O estado de erro de senha não foi
  testado (exigiria submit).
- **Hover/active de botões e linhas**, `prefers-reduced-motion`, LCP/CLS: não
  medidos (fora do que dá para provar sem o Aside; `nos-shell.css:155,492` têm blocos
  de reduced-motion, lido, não testado).
- **Página inteira em 390 de auditoria/whatsapp/automações**: as versões `-full` desses
  três PNGs vieram da primeira rodada do `fullpage.mjs`, que tinha um artefato meu (a
  tabbar entrou no fluxo e espremeu o conteúdo). **Ignore-as**; as versões sem `-full`
  são as válidas.

**Quick wins (<30 min cada, todos [SEGURO ANTES DE 16/09]):** A1 (apagar os números do
login), A2 (uma linha na nav), A3 (esconder "Raciocínio da IA" no mock), A6 (cor da
badge), M1 (peso saudação/alerta), M2 (44px nas abas de filtro), M11 (nomes dos temas).
