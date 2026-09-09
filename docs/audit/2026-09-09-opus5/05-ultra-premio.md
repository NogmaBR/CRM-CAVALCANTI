# Auditoria ULTRA PRÊMIO — CRM Nogma · Gestor de Obras

- **Data:** 2026-09-09
- **Auditor:** Principal Product Engineer + Design Engineer (Opus 5)
- **Pergunta desta auditoria:** não é *"está correto?"*. É **"isso é excelente? o que separa este produto de um produto que as pessoas amam usar?"**
- **Escopo:** spec original vs. entrega, fidelidade ao Nogma Design System, jornada real do gestor de obras, detalhes de acabamento, copy pt-BR, mobile.
- **Não coberto aqui de propósito:** segurança, RLS, races e bugs de backend — já auditados em `docs/audit/2026-09-08-*` e `AUDIT-CONSOLIDADO.md`. Esta auditoria é ortogonal àquelas.

**Base factual:** 18.807 linhas de TS/TSX em `apps/web/{app,components,lib}`, 51 rotas, 19 migrations, 13 CSS de página. Toda crítica abaixo tem `arquivo:linha`.

---

## 1. Veredito — o que este produto é hoje, em 3 frases

Este é um **cadastro de obras muito bem construído por dentro e inacabado por fora**: o schema, as server actions, o RLS, a auditoria e os relatórios PDF/CSV são de qualidade profissional, mas a camada que o gestor toca ainda é um CRUD genérico com a marca Nogma pintada por cima — e pintada com dois tokens de cor que não existem (78 usos de `--surface-1`/`--surface-2`, `apps/web/components/data-table.css:30`), o que literalmente apaga o fundo de toda tabela e toda seção de formulário do app.

O produto **não responde à única pergunta que um gestor de obras faz todo dia** — "esta obra está estourando o orçamento?" — porque `apps/web/app/(app)/obras/[id]/page.tsx:143` mostra o orçamento como número nu, sem gasto, sem saldo, sem percentual, sem lista de pagamentos; o percentual de orçamento existe no código, mas só dentro do PDF exportado (`apps/web/lib/data/reports.ts:110`).

E o produto **promete coisas que não faz**: a topbar exibe uma barra de busca com badge `⌘K` que é um input sem nenhum handler (`apps/web/components/layout/topbar.tsx:25-34`), o `sonner` está montado e nunca é chamado (`apps/web/app/(app)/layout.tsx:9`, zero `toast.` no repo), a área de upload tem borda tracejada mas não aceita arrastar arquivo (`apps/web/app/(app)/documentos/documento-form.tsx:70-85`), e uma mensagem de erro manda o gestor "editar manualmente em /whatsapp" (`apps/web/app/(app)/pendentes/actions.ts:52`) numa tela que é 100% somente-leitura. Promessa quebrada é pior que ausência.

---

## 2. Gap spec → entrega

Fonte: `docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md`. Verificado no código, item a item.

### 2.1 Entregue e sólido (uma linha cada)

| Prometido | Status |
|---|---|
| 6 telas principais + config + relatórios | ✅ 51 rotas, todas as telas existem |
| CRUD obras/fornecedores/categorias/pagamentos/documentos/usuários | ✅ completo, com soft-delete e restore |
| Schema §6.1–6.4 + RLS por papel §6.6 | ✅ 19 migrations, RLS em todas as tabelas |
| Auditoria com trigger + diff JSONB (§6.4) | ✅ `20260907160000_audit_triggers.sql` + tela `/auditoria/[id]` com diff |
| Relatórios PDF + CSV, 4 tipos (§7.2) | ✅ `@react-pdf/renderer`, `api/exports/[tipo]/route.ts` |
| Notificações email + templates (§Fase 15) | ✅ Resend + React Email, 3 templates |
| 3 temas via `data-theme`, default `black`, sem FOUC | ✅ `lib/theme.ts:5` + cookie lido no server em `app/layout.tsx:63` |
| Tokens Nogma verbatim | ✅ `apps/web/styles/tokens/*` byte-idênticos ao DS |
| Dedup fornecedor por CNPJ + merge | ✅ `/fornecedores/duplicatas` + RPC atômica |
| Dedup documento por SHA-256 | ✅ `documentos/actions.ts:58` + unique index |
| E2E Playwright golden path | ✅ 4 specs em `apps/web/e2e/` |

### 2.2 Prometido e AUSENTE

| # | Prometido (§) | Realidade no código |
|---|---|---|
| G-01 | `<CommandK>` busca global multi-entidade (§7.1, §7.3) | **Não existe.** `cmdk` não está no `package.json`. Existe apenas a *fachada*: `components/layout/topbar.tsx:25-34` renderiza `<input>` sem `onChange`/`onKeyDown`/`form` + `<kbd>⌘K</kbd>` decorativo. O `IconButton` de busca mobile (`:31`) e o sino "Alertas" (`:36`) também não têm `onClick`. |
| G-02 | `/obras/[id]` com 4 KPIs (Orçamento · Gasto · Saldo · Dias em Obra) e 4 abas (Gastos, Documentos, Timeline, Pendências) (§7.2) | **Nada disso.** `obras/[id]/page.tsx:139-168` é um cartão de leitura: Identificação, Financeiro & prazos (só orçamento e datas), Endereço, Extras, Metadados. `lib/data/obras.ts` não tem nenhuma agregação de gasto. |
| G-03 | `/obras` com colunas Gasto e % (barra inline) (§7.2) | Colunas entregues: Nome, Cliente, Status, Orçamento, Início (`obras/obras-table.tsx:126-161`). Sem Gasto, sem %, sem barra. |
| G-04 | `/pendentes` com 3 abas (Sem NF / Sem Comprovante / Aguardando) + filtro por obra + botão "Enviar Lembrete WhatsApp" (§7.2) | Só a terceira: `lib/data/pendentes.ts:38` lê apenas `confirmacoes_pendentes`. Sem abas, sem filtro de obra, sem lembrete. |
| G-05 | `/whatsapp` com 4 KPIs, row expandível, preview da mídia, JSON completo, **Reprocessar**, **Confirmar Manual**, **edição inline dos campos extraídos** (§7.2) | `whatsapp/page.tsx` é **read-only**: nenhum `<form>`, nenhuma `actions.ts` na pasta. Zero das 6 funcionalidades. A mídia é exibida como o texto do MIME type (`:127-133`) — o gestor vê `image/jpeg`, não a foto da nota. |
| G-06 | Feed realtime `<WhatsFeedLive>` no painel via Supabase Realtime (§7.2, §3) | **Não existe.** Zero `channel(` / `postgres_changes` no repo. O painel usa "Atividade recente" com fetch no server (`painel/page.tsx:180-230`). |
| G-07 | Views materializadas `mv_gasto_por_obra`, `mv_gasto_por_categoria`, `mv_evolucao_mensal` + `pg_cron` refresh 5min (§6.5) | **Zero `MATERIALIZED` e zero `cron.schedule` nas 19 migrations.** Os números do painel são calculados em query direta a cada request (`lib/data/painel.ts`). |
| G-08 | IA de classificação real (OpenAI GPT-4o-mini vision) (§8, Fase 12) | Só `MockClassifier` heurístico. `lib/ia/classifier.ts:11` declara `AnthropicClassifier`/`OpenAIClassifier` como "Fase 8.x". Nenhuma dependência de LLM no `package.json`. |
| G-09 | Loop de confirmação interativa via WhatsApp + auto-aprendizado de apelidos (§8.1, §8.2, Fase 13) | Tabela `confirmacoes_pendentes` existe e é lida; **nada escreve resposta de volta ao WhatsApp**. Nenhum envio outbound UAZAPI no código. |
| G-10 | Download e armazenamento da mídia do WhatsApp | `app/api/webhooks/uazapi/route.ts:77` grava literalmente `midia_storage_path: null` com o comentário "será preenchido no classifier". Não é. **A foto do comprovante nunca chega ao Storage.** |
| G-11 | Integração OneDrive (OAuth Graph + sync n8n, Fase 16, §7.2 "abrir OneDrive") | Só as colunas `onedrive_folder_id` / `onedrive_file_id` no schema. Zero código. |
| G-12 | `packages/ai` (prompts versionados + schemas Zod + prompt eval em CI com corte de 85%) (§8.3, §5) | Pasta não existe. |
| G-13 | `packages/shared` | Não existe. |
| G-14 | `infra/` (docker-compose n8n + uazapi + caddy, workflows JSON versionados) (§5) | Não existe no repo. Há `docs/N8N-COMPLETO.md` com JSONs em documentação, não versionados como infra. |
| G-15 | Vitest: formatters, dedup, prompts, 70% coverage (§10.1) | **`vitest` não está instalado** — `apps/web/package.json:10` declara `"test": "vitest run"` e o binário não existe. Zero testes unitários. `pnpm test` quebra. |
| G-16 | Rate limiting Upstash Redis (§9) | `@upstash/redis` não está no `package.json`. |
| G-17 | Sentry (§10.4) | Não instalado. |
| G-18 | `<Money>`, `<Cnpj>`, `<Cpf>`, `lib/formatters/` (§5, §7.3) | Não existem. No lugar: **11 cópias de `formatBRL` e 12 de `formatDateTime`** espalhadas pelas páginas. |
| G-19 | `components/domain/` com `<ObraCard>`, `<FornecedorRow>`, `<PendenciaBadge>`, `<WhatsMessageRow>` (§5) | Pasta existe e está **vazia**. |
| G-20 | Histórico de gerações de relatório (§7.2 `/relatorios`) | Não existe tabela nem tela. |
| G-21 | Ações em massa em `/obras`: Arquivar / **Exportar CSV** (§7.2) | Só Arquivar (`obras-table.tsx:245-296`). |
| G-22 | DataTable com densityToggle, columnResize, sticky header, virtualização >100 linhas (§7.3) | Nenhum dos quatro. `components/data-table.css` não tem `position:sticky`; `@tanstack/react-virtual` não instalado; `pageSize` fixo em 10 (`data-table.tsx:43`). |

### 2.3 Entregue pela metade

- **Storage/preview**: upload, magic bytes, hash e signed URL funcionam (`lib/storage/documents.ts`), mas **nenhuma tela mostra o arquivo** — só metadados e botão baixar (`documentos/[id]/page.tsx`). Num produto cujo objeto central é a foto da nota fiscal, isso é meio produto.
- **PWA**: manifest existe (`app/manifest.ts`) → instalável. Sem service worker → zero offline. No canteiro com 4G ruim, instalar não ajuda.
- **Papéis**: 4 papéis no schema; o gate é por página com `notFound()` (`config/usuarios/page.tsx:177`) — um usuário de leitura que clica num link recebe **404**, não "sem permissão".

---

## 3. Fidelidade ao Nogma Design System

**A fundação é fiel; o andar de cima é outro prédio.** `apps/web/styles/tokens/*.css` são cópias byte-idênticas de `Nogma Design System/tokens/*` (único delta: paths de fonte). `components/nogma/{Button,Card,Input,Badge,Stat,Tabs}.css` são verbatim do DS. Fontes self-hosted OK (Agency + 7 pesos Raleway). 3 temas OK, default `black` OK, sem FOUC.

O problema: os 13 CSS de página (`app/(app)/**/*.css`), `components/data-table.css` e `styles/nos-chrome.css` foram escritos **contra um sistema de tokens que nunca existiu**.

### D-01 — 🔴 `--surface-1` e `--surface-2` não existem. 78 usos. As superfícies do app somem.

O DS define `--surface-card` / `--surface-raised` / `--surface-sunken` / `--bg-subtle` (`apps/web/styles/tokens/colors.css:65-67`). `--surface-1`/`--surface-2`: **zero definições**, 78 usos. Sem fallback, a declaração é inválida e o elemento fica sem fundo.

- `components/data-table.css:30` — `.nos-dt__scroll { background: var(--surface-1); }` → **toda tabela do CRM sem superfície**
- `components/data-table.css:47` — `.nos-dt__th { background: var(--surface-2, transparent); }` → header sem faixa
- `app/(app)/_shared/form-layout.css:21` — `.form-layout__section { background: var(--surface-1); }` → **toda seção de formulário sem card**
- `styles/nos-responsive.css:721,726` — aba de filtro ativa sem pill
- +70 em `config/*`, `fornecedores/duplicatas`, `obras-table.tsx:256,361`

Isso é visível no screenshot `crm-cavalcanti-logado.png`: a tabela de obras é uma caixa de borda fina flutuando num fundo branco, sem elevação e sem faixa de header — o app parece um wireframe, não um produto.

**Correção (30 minutos, transforma o app):**
```
var(--surface-1) → var(--surface-card)
var(--surface-2) → var(--bg-subtle)     /* --surface-sunken em header de tabela */
```

### D-02 — 🔴 `html, body` com fundo hardcoded quebra os temas escuros
`styles/nos-chrome.css:1` — `html,body{ background: var(--neutral-100) }`, importado **depois** de `nogma.css` (`styles/globals.css:2-3`), vence sobre `tokens/base.css:16`. Nos temas `black`/`dark` o canvas raiz continua cinza-claro (aparece no overscroll, atrás do drawer, no login).
→ `background: var(--bg-canvas)`.

### D-03 — 🟠 Sidebar petróleo onde o DS manda preto
`Nogma Design System/readme.md:49`: *"o tratamento dark primário é `.on-black` — preto no fundo, títulos em lime"*, e `screenshots/nogmaos-dash.png` mostra sidebar preta. O markup já declara o escopo certo (`components/layout/sidebar.tsx:7` → `nos-sidebar on-black`), mas `styles/nos-chrome.css:8` sobrescreve com `background: var(--petroleum-800)`. Idem `nos-chrome.css:97` no aside do login.

### D-04 — 🟠 Paleta Tailwind hardcoded no lugar dos tokens semânticos
DS: `--success #2FA36B`, `--warning #E8A317`, `--danger #D6483B`, accent `--lime-500 #CCFF00`.
Código: `#22c55e`, `#ef4444`, `#eab308`, `#a3e635`, `#84cc16` literais em `config/categorias/categorias.css:40-48`, `config/importar/importar.css:62-64,149-151`, `config/usuarios/usuarios.css:38-46`, `obras/obras-table.tsx:220,236`, `relatorios/relatorios.css:126`. Mais ~30 fallbacks errados do tipo `var(--danger, #ef4444)` e `var(--accent, #22c55e)` (`auditoria.css:47,67,173,283`) — o fallback nunca dispara, só mascara erro e propaga cor que não é da Nogma.

### D-05 — 🟠 Gráficos com cor fixa, invisíveis no tema default
`painel/charts/line-acumulado.tsx:62,63,84,88` usa `#0C4651` (petróleo) como stroke/fill. No tema `black` (default!) e no `dark` (canvas petróleo) a linha praticamente desaparece. `bar-serie-mensal.tsx:63` usa grid `rgba(255,255,255,0.06)` — some no tema light. `donut-categoria.tsx:67` tem fallback `#565B5B`.
→ `var(--lime-500)` / `var(--accent)` na série, `var(--border-subtle)` no grid.

### D-06 — 🟡 Título da topbar em lime no tema errado
`tokens/colors.css:112` define `--heading-color: var(--lime-500)` só no tema `black`; no `dark` é `--white` (`:147`). Mas `nos-responsive.css:598-601` força lime nos dois.
→ apagar as 4 linhas e usar `.nos-topbar__title { color: var(--heading-color) }`.

### D-07 — 🟡 Escalas abandonadas
- **Raios**: 89 valores em px cru vs 37 usos de token. `8px` e `12px` **não existem** na escala (`4/6/10/14/20/28/999`). Bônus: `var(--radius-lg, 12px)` em `data-table.css:29`, `form-layout.css:19`, `painel.css:7` — o token é 14px, o fallback está errado.
- **Tipografia**: ~180 `font-size` em px cru; `13px` e `15px` não existem na escala; há meio-pixels (`11.5px`, `13.5px`). Concentração em `nos-chrome.css` (35), `auditoria.css` (22), `webhooks.css` (18).
- **Espaçamento**: `--space-*` só é usado em `Card.css`. Valores fora do grid de 4 (`11px`, `13px`, `18px`, `22px`, `26px`).
- **Motion**: `nos-responsive.css:492-496` **inventa três easings** (`--ease-out-strong`, `--ease-in-out-strong`, `--ease-drawer`) e em `:500-508` **sobrescreve a transition do `.ng-btn` do DS** — o botão da marca deixa de usar a curva da marca. Mais 14 lugares com `ease` default do browser e durações fora da escala (280/320/480ms, `0.7s`, `0.15s`).
- **Sombras**: fora de `components/nogma/*`, existem **2** usos de `var(--shadow-*)` no app inteiro. No lugar, preto duro: `nos-responsive.css:51` (`rgba(0,0,0,0.55)`), `obras-table.tsx:258` (`rgba(0,0,0,0.4)`). O DS diz "nunca preto duro" — as sombras são petroleum-tinted. `--shadow-lime` está corretamente restrita ao hover do CTA (`Button.css:26`) — esse ponto está bom.

### D-08 — 🟡 Eyebrow com tracking inventado
`--eyebrow-tracking` = `0.08em`. Código: `.14em` (`nos-chrome.css:52`), `.16em` (`:99`), `.06em` (`:70`), `.05em` (`painel.css:15`), `.04em` (~10 labels). O painel usa a classe `.eyebrow` do DS corretamente (`painel/page.tsx:77`) — o resto reimplementa.

### D-09 — 🟡 Gradiente onde o DS proíbe, `::selection` sobrescrito
`readme.md:70`: *"campos de cor chapada — sem gradientes"*; exceção é o motivo `.mark-lime`. `nos-responsive.css:288` usa `linear-gradient` em `.nos-coming::before`. E `nos-responsive.css:525-533` sobrescreve o `::selection` lime sólido do DS por `color-mix` a 40/55% com `color:#000` hardcoded.

### D-10 — 🟠 Tailwind: config completo, **zero classes usadas**
`apps/web/tailwind.config.ts` mapeia toda a paleta, radii, shadows e easings da Nogma para utilitários — e o app tem **0 classes Tailwind** e **280 `style={{...}}` inline**. Duas dependências (`tailwindcss`, `@tailwindcss/postcss`) e um `@import "tailwindcss"` (`globals.css:1`) carregados para nada. Ou adota, ou remove; manter os dois é o pior dos mundos, e é por isso que os 78 `--surface-1` passaram despercebidos: não há nenhuma barreira entre "cor da marca" e "cor inventada".

---

## 4. Matriz de atrito por fluxo

### (a) Pendência do WhatsApp → pagamento — **o fluxo mais importante do produto**

| Passo | Tela | Arquivo |
|---|---|---|
| 1 | Webhook grava mensagem | `app/api/webhooks/uazapi/route.ts:80` |
| 2 | Gestor abre `/whatsapp` | `app/(app)/whatsapp/page.tsx` |
| 3 | Clica "Confirmar em Pendentes" | `whatsapp/page.tsx:147` |
| 4 | `/pendentes` — card com valor, obra, fornecedor, confiança IA | `pendentes/page.tsx:129-193` |
| 5 | Clica "Confirmar" → pagamento criado | `pendentes/actions.ts:9,144` |

**2 cliques no caminho feliz.** É o fluxo menos atritado — quando a IA acerta.

**Onde trava:**
1. 🔴 **Beco sem saída.** Se falta `valor` ou `obra_id`, `pendentes/actions.ts:51-57` bloqueia com: *"Faltam dados obrigatórios (valor e obra). Use a mensagem original em /whatsapp para editar manualmente."* — **`/whatsapp` não tem edição nenhuma.** Nenhum `<form>`, nenhuma `actions.ts` na pasta. O gestor não confirma, não corrige, e a única saída é rejeitar e recadastrar à mão em `/pagamentos/novo`. O erro aponta para uma funcionalidade inexistente.
2. 🔴 **Não dá para editar antes de confirmar.** `pendentes/page.tsx:129-193` renderiza tudo em `<span>`. Se a IA leu R$ 2.350 como R$ 23.500, o gestor não tem como corrigir — só confirmar errado ou rejeitar.
3. 🔴 **A foto do comprovante nunca aparece.** `pendentes/page.tsx:114-119` mostra o MIME type. E `webhooks/uazapi/route.ts:77` nem baixa a mídia (`midia_storage_path: null`). O produto inteiro nasceu para tratar fotos de nota fiscal e nunca mostra uma.
4. 🟠 **Rejeitar é irreversível e sem confirmação** (`pendentes/page.tsx:202-213` → `actions.ts:147`). Não há "desrejeitar".
5. 🟠 **Reprocessar não existe.** Zero código de reclassificação — só um comentário (`actions.ts:62`).
6. 🟠 **A NF não vira documento.** O insert em `actions.ts:77-87` cria o pagamento e nada em `documentos`.
7. 🟡 O banner de sucesso fica preso na URL (`/pendentes?success=...`) e reaparece a cada F5.
8. 🟡 Sem badge de contagem em "Pendentes" no menu (`sidebar-nav.tsx:14`) — o gestor não sabe que tem pendência sem entrar na tela.

### (b) Cadastrar obra nova + primeiros fornecedores

| Passo | Ação | Arquivo |
|---|---|---|
| 1 | "Nova Obra" | `painel/page.tsx:70` ou `obras/page.tsx:37` |
| 2 | Preencher (só `nome` é obrigatório) e submeter | `obras/obra-form.tsx:39,181` |
| 3 | Redireciona para `/obras/{id}` sem mensagem de sucesso | `obras/actions.ts:58` |
| 4 | Sair, ir no menu → `/fornecedores` → "Novo Fornecedor" | `sidebar-nav.tsx:15` |

**Onde trava:**
1. 🔴 **Erro de validação apaga o formulário inteiro.** Nenhum form usa `useActionState`/`useFormState` (zero no repo). Toda action faz `redirect('...?error=msg')` (`obras/actions.ts:31`, `fornecedores/actions.ts:32`, `pagamentos/actions.ts:25`, `documentos/actions.ts:37`) e a página `novo` recarrega vazia. O gestor digita 15 campos, erra o CNPJ, e reescreve tudo. Em documentos, perde **também o arquivo selecionado**.
2. 🔴 **Impossível criar fornecedor sem abandonar o form.** `pagamento-form.tsx:88-103` e `documento-form.tsx:198-214` são `<select>` populados por props — sem "+ novo", sem modal, sem combobox creatable. Descobrir no meio do lançamento que o fornecedor não existe custa o formulário inteiro (não há rascunho).
3. 🟠 **`Input` tem prop `error` por campo (`components/nogma/Input.tsx:13,60-61`) e ela nunca é usada.** O erro vai para um banner genérico no topo, com o texto `${first.path.join('.')}: ${first.message}` (`obras/actions.ts:30`) — o gestor lê `endereco.cep: String must contain at most 9 character(s)`.
4. 🟠 **Nenhuma máscara.** CNPJ/CPF é texto com `maxLength={20}` e o hint admite o problema: *"Aceita com ou sem máscara"* (`fornecedor-form.tsx:67`). CEP é texto solto sem ViaCEP (`obra-form.tsx:124`) — rua, bairro, cidade e UF digitados à mão. Valor é `<input type="number" step="0.01">` (`pagamento-form.tsx:127-137`): o `placeholder="0,00"` mente, porque o input nativo só aceita ponto decimal.
5. 🟠 **Nenhum botão tem estado de pending.** `components/nogma/Button.tsx` não tem prop `loading`; nenhum form usa `useFormStatus` (exceto `definir-senha-form.tsx:10`). Dá para clicar "Criar obra" cinco vezes.
6. 🟡 Zero `autoFocus` no projeto inteiro. Todo formulário exige um clique antes de digitar.
7. 🟡 "Cancelar" é um `<Link>` que descarta sem aviso (`obra-form.tsx:178`).
8. 🟡 UF sem `<select>` — só `textTransform: uppercase` visual (`obra-form.tsx:139-145`); o valor gravado pode ser minúsculo.

### (c) Fechar o mês e gerar relatório

**2–3 cliques.** Menu → Relatórios → card "Fechamento Mensal" (já vem com o mês corrente, `relatorios-forms.tsx:126`) → "Baixar PDF". Fluxo bem desenhado.

**Onde trava:**
1. 🟠 **Zero feedback.** `DownloadLink` (`relatorios-forms.tsx:33-62`) é um `<a target="_blank">` puro. `renderToBuffer` roda no servidor para o mês inteiro; o gestor clica e fica olhando uma aba em branco por vários segundos, sem spinner e sem disabled.
2. 🟠 **Erro vira JSON cru numa aba nova**: `{"error":"obra não encontrada"}` (`api/exports/[tipo]/route.ts:159-167,177-179`).
3. 🟠 **Sem preview.** Não dá para conferir antes de baixar; se o mês estiver vazio, descobre abrindo o PDF.
4. 🟠 **Sem histórico de gerações** (prometido em §7.2). Não dá para saber se o fechamento de janeiro já foi feito, por quem.
5. 🟡 **Período inconsistente entre os 4 cards**: "Mensal" só aceita `<input type="month">` (`:147`) — não dá para fechar 21/01→20/02, que é como obra fecha competência; "Obra" não tem filtro de período nenhum (`:66-121`); "Atividade" exige De/Até.
6. 🟡 Botão desabilitado vira `href="#"` cinza e mudo (`:48-56`), sem dizer "selecione uma obra".
7. 🟡 Estado dos cards é `useState` local — a seleção não vai para a URL, não é compartilhável, não sobrevive a refresh.

### (d) Subir uma nota fiscal e vinculá-la

**3 cliques + diálogo do SO.** Menu → Documentos → Novo → arquivo → tipo/obra/pagamento/fornecedor → Salvar.

**Onde trava:**
1. 🔴 **A borda tracejada mente.** `documento-form.tsx:70-85` é `<input type="file">` com `border: 1px dashed` e **nenhum `onDrop`/`onDragOver`**. Parece dropzone, não é.
2. 🔴 **Uma NF por vez.** Sem `multiple` (`:70-75`). Fechar o mês com 40 notas = 40 vezes o formulário inteiro.
3. 🔴 **Duplicata perde tudo.** A detecção é reativa via constraint (`documentos/actions.ts:86-92`) e o erro vira `redirect('/documentos/novo?error=...')` (`:93-100`): arquivo, tipo, obra, NF — tudo refeito. A mensagem diz *"Verifique documentos anteriores"* **sem linkar o documento duplicado**, tendo o hash em mãos para achá-lo.
4. 🔴 **Nenhum preview do arquivo, em lugar nenhum.** `documentos/[id]/page.tsx` só tem metadados e "Baixar" via signed URL de 60s. Conferir uma NF contra um pagamento exige baixar o JPG e abrir na galeria do celular.
5. 🟠 **Vinculação a pagamento é um `<select>` gigante sem busca** com label `"{data} · {valor}"` (`documento-form.tsx:192`) — sem obra, sem fornecedor, sem número de NF. E **não filtra pela obra já escolhida no campo acima**. Com 300 pagamentos é uma lista de datas indistinguíveis.
6. 🟠 **Sem barra de progresso.** Um PDF de 10 MB sobe com a tela congelada e o botão ainda clicável.
7. 🟡 Não dá para trocar o arquivo depois: *"arquive este documento e crie um novo"* (`:105-107`).

### (e) Primeiro acesso de um usuário convidado

Admin: Config → Usuários → Convidar → email/nome/papel (`config/usuarios/actions.ts:43`). O convite **é enviado** via `inviteUserByEmail` (`lib/data/usuarios.ts:129`), com `redirectTo=/definir-senha`. O convidado define a senha (`definir-senha-form.tsx:27-50`).

**Onde trava:**
1. 🔴 **A boas-vindas nunca aparece.** `definir-senha/actions.ts:42` redireciona para `/painel?success=Senha definida. Bem-vindo ao Gestor de Obras.` — mas `painel/page.tsx:38` é `PainelPage()` **sem `searchParams`** e não lê `success` em lugar nenhum. A única boa-vinda do produto é silenciosamente descartada.
2. 🔴 **Não existe dia 1.** Zero onboarding, tour, checklist ou dados de exemplo (`seed.sql` só tem 8 categorias). O convidado cai num painel com "Bom dia, Operacao", quatro KPIs zerados, três gráficos vazios e "Nenhuma atividade nas ultimas 48h." Nada indica que o primeiro passo é criar uma obra.
3. 🟠 **Email de convite é o template padrão do Supabase** — sem marca Nogma/Cavalcanti, sem explicar o que é o produto. Existem 3 templates React Email lindos no repo (`lib/email/templates/`, inclusive `boas-vindas.tsx`) que **não são usados no convite**.
4. 🟠 **"Esqueci a senha" está desativado**: `login-form.tsx:62-64` é um `<span title="Em breve">`. Link expirado = depender de um admin.
5. 🟠 **Login trava se o hCaptcha não carregar**: `login-form.tsx:73` tem `disabled={!captchaToken}`. Sem `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`, o widget não renderiza e o botão fica permanentemente desabilitado, sem explicação.
6. 🟠 Erro de login em inglês cru: `redirect('/login?error=' + error.message)` (`login/actions.ts:26`) → *"Invalid login credentials"*.
7. 🟡 Papel sem permissão retorna **404** (`config/usuarios/page.tsx:177`) em vez de "você não tem acesso".

### Atritos transversais

| # | Atrito | Evidência |
|---|---|---|
| T-1 | **`sonner` montado e nunca chamado** — zero `toast.` no repo | `app/(app)/layout.tsx:9-17` |
| T-2 | **117 `redirect('?success=' / '?error=')`** — feedback via URL, sem auto-dismiss, preso no F5, compartilhável por engano | grep em `app/**/actions.ts` |
| T-3 | **`/pagamentos` não está no menu** — a tela central do produto financeiro só é alcançável digitando a URL ou clicando num item do feed | `components/layout/sidebar-nav.tsx:9-24` |
| T-4 | **`/pagamentos`, `/documentos`, `/fornecedores` não leem `?success`/`?error`** — redirects como `pagamentos/actions.ts:145` produzem **erro invisível** | `pagamentos/page.tsx:31-36`, `documentos/page.tsx:25`, `fornecedores/page.tsx:18` |
| T-5 | **Arquivar sem confirmação e sem undo** em obra, pagamento, documento, fornecedor e usuário — um clique acidental arquiva | `obras/[id]/page.tsx:111`, `pagamentos/[id]/page.tsx:105`, `documentos/[id]/page.tsx:86`, `config/usuarios/page.tsx:114` |
| T-6 | **Busca, ordenação e página das tabelas perdidas no refresh e no "voltar"** — `useState` puro | `components/data-table.tsx:31-32,44` |
| T-7 | **Zero `error.tsx`, zero `not-found.tsx`, zero `<Suspense>`** — 20 `throw new Error('Falha ao listar X: ' + msg)` na camada de dados viram a tela de crash do Next, em inglês, fora do shell | `lib/data/obras.ts:34` e 19 irmãos |
| T-8 | **6 `loading.tsx` de ~20 segmentos.** Sem nada: `fornecedores/*` (inclusive `duplicatas`, a query mais lenta), `whatsapp`, `auditoria`, `notificacoes`, `config/*` inteiro | `find app -name loading.tsx` |
| T-9 | **Erros do Supabase em inglês na tela**: `Erro ao convidar: A user with this email address has already been registered` | `config/usuarios/actions.ts:69,98,128,151,170`; `definir-senha/actions.ts:39` |
| T-10 | **Fuso horário ausente.** Nenhum dos 12 `formatDateTime` passa `timeZone`. Na Vercel o runtime é **UTC** — um pagamento das 22h de São Paulo aparece com a data do dia seguinte. A preferência de fuso do usuário existe (`config/perfil/page.tsx:163`) e **nunca é lida na formatação** | grep `timeZone` em `apps/web` |

---

## 5. Copy e microcopy pt-BR

### 5.1 O pior problema: o app fala português quebrado

**254 ocorrências de palavras com acento removido em strings de interface.** Isso não é detalhe: é a primeira coisa que um brasileiro nota, e faz o produto parecer traduzido por máquina. Confirmado no screenshot do app rodando (`crm-cavalcanti-logado.png`): o menu diz **"Notificacoes"** e a tabela vazia diz **"para comecar."**

| Arquivo:linha | Atual | Correto |
|---|---|---|
| `components/layout/sidebar-nav.tsx:20` | `Notificacoes` | `Notificações` |
| `painel/page.tsx:68` | `Visao geral da operacao` | `Visão geral da operação` |
| `painel/page.tsx:155` | `Analises` | `Análises` |
| `painel/page.tsx:159,166` | `ultimos 12 meses` / `ultimos 3 meses` | `últimos 12 meses` / `últimos 3 meses` |
| `painel/page.tsx:187,192` | `Ultimas 48h` / `Nenhuma atividade nas ultimas 48h.` | `Últimas 48h` / `Nenhuma atividade nas últimas 48 horas.` |
| `painel/page.tsx:97,113` | `Tendencia obras ultimos 8 meses` (aria-label) | `Tendência de obras nos últimos 8 meses` |
| `obras/obras-table.tsx:350` | `Nenhuma obra encontrada. Clique em 'Nova Obra' para comecar.` | ver 5.3 |
| `obras/obras-table.tsx:200-206` | `Arquivar N obra(s)? A acao e reversivel...` | `Arquivar N obras? Você pode restaurá-las depois no filtro "Arquivadas".` |
| `pendentes/page.tsx:52` | `Confianca IA: N%` | `Confiança da IA: N%` |
| `pendentes/page.tsx:74` | `Mensagens de WhatsApp aguardando sua confirmacao` | `Mensagens do WhatsApp aguardando sua confirmação` |
| `pendentes/page.tsx:95` | `Nenhuma pendencia no momento` | `Nenhuma pendência no momento` |
| `auditoria/page.tsx:238` | `Historico de alteracoes no sistema` | `Histórico de alterações no sistema` |
| `notificacoes/page.tsx:126,163` | `Notificacoes` / `Historico de emails` / `Nenhuma notificacao registrada ainda.` | `Notificações` / `Histórico de e-mails` / `Nenhum e-mail enviado ainda.` |
| `config/usuarios/page.tsx:199,245,256` | `Usuarios` / `Nenhum usuario ativo no momento.` | `Usuários` / `Nenhum usuário ativo.` |
| `config/usuarios/page.tsx:261`, `config/categorias/page.tsx:196`, `config/webhooks/page.tsx:237` | `Acoes` (cabeçalho de coluna) | `Ações` |
| `config/webhooks/novo/page.tsx:90` | `Ex: Notificacoes n8n producao` | `Ex.: Notificações n8n produção` |
| `config/categorias/nova/page.tsx:68` | `Nome do icone Lucide (ex: 'wrench')` | ver 5.2 |
| `config/usuarios/actions.ts:151,170` | `Erro ao arquivar usuario` | `Não foi possível arquivar o usuário.` |

Correção mecânica, ~4 horas, risco zero, e é a mudança que mais muda a percepção de "produto caro" por real investido.

### 5.2 Jargão técnico vazando para o gestor de obras

| Arquivo:linha | Atual | Sugerido |
|---|---|---|
| `config/categorias/nova/page.tsx:68` e `[id]/editar/page.tsx:80` | `Nome do icone Lucide (ex: 'wrench', 'hard-hat'). Deixe vazio para sem icone.` | Trocar o campo de texto por um **seletor visual de ícones**. O gestor de obras não sabe o que é Lucide. |
| `whatsapp/page.tsx:127-133` | `image/jpeg` exibido ao lado de um clipe | `Foto` / `PDF` / `Documento` — e mostrar a miniatura |
| `whatsapp/page.tsx:133` | `Erro: {m.erro_msg}` (coluna crua do banco) | `Não conseguimos ler esta mensagem. [Tentar de novo]` |
| `notificacoes/[id]/page.tsx:111` | `Erro: {notif.erro}` (resposta HTTP crua) | `O e-mail não foi entregue. Motivo: <tradução>` |
| `config/usuarios/actions.ts:69` | `Erro ao convidar: A user with this email address has already been registered` | `Este e-mail já tem acesso ao sistema.` |
| `definir-senha/actions.ts:39` | `Falha ao definir senha: Password should be at least 6 characters` | `A senha precisa ter pelo menos 8 caracteres.` |
| `obras/actions.ts:30` | `endereco.cep: String must contain at most 9 character(s)` | Erro no campo, em português: `CEP deve ter 8 dígitos.` |
| `config/webhooks/actions.ts:93,134,157,196` | `Erro ao criar webhook. Tente novamente.` | Dizer **o quê** falhou e o que fazer |
| `lib/schemas/errors.ts:26` | `Erro ao processar. Tente novamente.` | Fallback aceitável, mas está sendo usado onde caberia mensagem específica |
| `documentos/actions.ts:88` | `Arquivo idêntico já existe (mesmo conteúdo). Verifique documentos anteriores.` | `Esta nota já foi enviada em <data>. [Ver o documento]` — com link |
| `pendentes/actions.ts:52` | `Faltam dados obrigatórios (valor e obra). Use a mensagem original em /whatsapp para editar manualmente.` | `Faltou o valor e a obra. [Completar agora]` — abrindo edição inline |
| `documento-form.tsx:105-107` | `Para trocar o arquivo, arquive este documento e crie um novo.` | Permitir substituir o arquivo |

### 5.3 Estados vazios que não ajudam

Todos os vazios de tabela são **uma linha de texto centrada dentro de uma caixa vazia gigante**, sem ícone e sem botão — e quatro deles **mandam o usuário procurar um botão em vez de serem o botão**:

- `obras/obras-table.tsx:350` — *"Nenhuma obra encontrada. Clique em 'Nova Obra' para comecar."*
- `pagamentos/pagamentos-table.tsx:164`, `fornecedores/fornecedores-table.tsx:123`, `documentos/documentos-table.tsx:138` — mesma fórmula
- `components/data-table.tsx:29` — default `Nenhum resultado.`

Pior: **não distinguem banco vazio de filtro sem resultado.** Digitar `zzz` na busca de obras devolve *"Clique em 'Nova Obra' para começar"* — conselho errado.

Os três decentes (ícone + título + explicação, ainda sem CTA): `pendentes/page.tsx:93-100`, `config/webhooks/page.tsx:220-225`, `fornecedores/duplicatas/page.tsx:107-108`.

### 5.4 Inconsistências de nomenclatura e tom

- **"Pendentes" (menu) vs "Pendência" (conteúdo) vs "Confirmação" (banco)** — três nomes para a mesma coisa.
- **"Bom dia" a qualquer hora** (`painel/page.tsx:85`, hardcoded). Às 16h o app dá bom dia.
- **Nome derivado do e-mail** (`painel/page.tsx:53-55`): `operacao@nogmacorp.com.br` → *"Bom dia, Operacao"*. O campo `profiles.nome` existe e não é usado.
- **Duas buscas na mesma tela** (ver screenshot): a global da topbar, que não funciona, e a da tabela, que funciona. O gestor vai tentar a de cima primeiro.
- **Descrição dos 4 papéis despejada em bloco** (`config/usuarios/convidar/page.tsx:94-101`) — mostra todos sempre, em vez de descrever o selecionado.

---

## 6. Mobile — o gestor está no canteiro, com uma mão, no sol

A sidebar tem drawer (`components/layout/mobile-nav.tsx`, Radix Dialog) e existe uma folha responsiva séria (`styles/nos-responsive.css`, 744 linhas, breakpoints 640/768/900/1024/1280). Não é um desktop-only jogado no celular. Mas o cenário real não é atendido:

1. 🔴 **O upload não usa a câmera.** Se o gestor quer registrar uma nota que está na mão dele, o caminho é `<input type="file">` sem `capture` e sem `accept="image/*"` (`documento-form.tsx:70-75`) — no celular isso abre o seletor de arquivos, não a câmera. O produto que nasceu de "tire foto do comprovante" não deixa tirar foto.
2. 🔴 **Tabelas com scroll horizontal.** `components/data-table.css:30` (`.nos-dt__scroll`, `overflow-x: auto`) e sem `position: sticky` no header — a 390px o gestor arrasta a tabela lateralmente e perde o cabeçalho. **Não existe variante card para mobile** de obras, pagamentos, documentos, fornecedores.
3. 🔴 **Sem service worker.** O manifest torna o app instalável (`app/manifest.ts`), mas com 4G ruim no canteiro não há cache nem fila offline. Instalar dá um ícone e nada mais.
4. 🟠 **Teclado errado.** Existe **um único `inputMode` em todo o app** (`pagamento-form.tsx:136`). Telefone, CEP, CNPJ, número do endereço e número da NF abrem teclado alfabético.
5. 🟠 **Sem ação primária ao alcance do polegar.** O CTA vive na topbar (`painel/page.tsx:70`), fora da zona de toque de uma mão. Não há FAB nem bottom bar.
6. 🟠 **Contraste no sol.** O tema default é `black` (`lib/theme.ts:5`) — escuro puro sob luz direta tem menos legibilidade que um tema claro de alto contraste. Vale oferecer o toggle de forma óbvia no mobile ou detectar luminosidade; hoje o `ThemeToggle` está na topbar comprimida.
7. 🟠 **Alvos de toque abaixo de 44px** em ícones de ação de linha e nos `IconButton` da topbar (`size={19}` dentro de botões sem altura mínima declarada).
8. 🟡 **`/relatorios`, `/auditoria` e `/config/webhooks` não servem no mobile** — são densos por natureza e não têm layout alternativo. Aceitável: não é uso de canteiro.

**Prioridade mobile-first:** (1) `capture="environment"` + `accept="image/*"` no upload; (2) variante card das listas abaixo de 768px; (3) `inputMode`/`type` corretos; (4) FAB de ação primária; (5) sticky header nas tabelas.

---

## 7. Os 10 itens de OURO — ordenados por impacto ÷ esforço

Escala de impacto: 1–10 (percepção do cliente). Esforço em horas de dev.

| # | Item | Impacto | Esforço | Razão |
|---|---|---|---|---|
| 1 | Consertar os 78 `--surface-1/2` | 8 | 1h | **8,0** |
| 2 | Acentuação e microcopy pt-BR | 7 | 4h | **1,8** |
| 3 | Toasts + Desfazer (o `sonner` já está montado) | 9 | 6h | **1,5** |
| 4 | A obra com dinheiro na tela | 10 | 10h | **1,0** |
| 5 | Preview da nota fiscal e da foto do WhatsApp | 9 | 10h | **0,9** |
| 6 | Estados vazios com direção + primeiro dia | 6 | 7h | **0,86** |
| 7 | Formulário que não apaga o que você digitou | 9 | 12h | **0,75** |
| 8 | `lib/format.ts` único + máscaras BR + fuso | 8 | 11h | **0,73** |
| 9 | Pendência editável + reprocessar (fim do beco sem saída) | 8 | 12h | **0,67** |
| 10 | ⌘K de verdade (ou tirar a mentira da topbar) | 7 | 12h | **0,58** |

---

### OURO 1 — Consertar os 78 `--surface-1` / `--surface-2` · 1h · impacto 8

**O que é.** Dois tokens que nunca existiram estão sendo usados em 78 lugares. Onde não há fallback, a declaração é inválida e o elemento perde o fundo.

**Por que o usuário sente.** É a razão pela qual o app parece um wireframe no screenshot: a tabela de obras é uma caixa de borda fina no branco, o header de tabela não tem faixa, as seções de formulário não são cards, a aba ativa não tem pill. Uma hora de trabalho separa "protótipo" de "produto".

**Onde mexer.** `components/data-table.css:30,47`; `app/(app)/_shared/form-layout.css:21`; `styles/nos-responsive.css:721,726`; `config/{categorias,perfil,webhooks,importar,usuarios}/*.css`; `obras/obras-table.tsx:256,361`; `fornecedores/duplicatas/page.tsx:119,150,189`; `fornecedores/[id]/apelidos-section.tsx:48,147`.

**Esboço.**
```bash
# Substituição global (revisar header de tabela caso a caso)
grep -rl 'surface-1\|surface-2' apps/web --include=*.css --include=*.tsx \
  | xargs sed -i 's/var(--surface-1)/var(--surface-card)/g; s/var(--surface-2[^)]*)/var(--bg-subtle)/g'
```
Depois, adicionar elevação da marca (hoje há 2 usos de `--shadow-*` no app inteiro):
```css
.nos-dt__scroll, .form-layout__section {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
:root[data-theme="dark"] .nos-dt__scroll,
:root[data-theme="dark"] .form-layout__section { box-shadow: none; }
.nos-dt__th { background: var(--surface-sunken); position: sticky; top: 0; z-index: 1; }
```
**Guarda-corpo:** adicionar ao CI um grep que quebre o build se aparecer `var(--` com nome que não exista em `styles/tokens/*.css`. Foi a ausência dessa checagem que deixou 78 usos passarem.

---

### OURO 2 — Acentuação e microcopy pt-BR · 4h · impacto 7

**O que é.** 254 strings de interface com acento removido, visíveis no menu ("Notificacoes"), no painel ("Visao geral da operacao", "Analises", "Ultimas 48h") e nos vazios ("para comecar").

**Por que o usuário sente.** É a primeira coisa que um brasileiro nota. Um produto que erra o próprio idioma não passa a sensação de caro — passa a de improvisado. E é a correção com melhor risco/retorno de toda esta lista.

**Onde mexer.** Tabela completa em §5.1. Concentração: `components/layout/sidebar-nav.tsx:20`, `painel/page.tsx:68,97,113,155,159,166,187,192`, `pendentes/page.tsx:52,74,95`, `auditoria/page.tsx:238`, `notificacoes/page.tsx:126,163`, `config/usuarios/page.tsx:199,245,256,261`, `config/categorias/page.tsx:196`, `config/webhooks/page.tsx:237`, `obras/obras-table.tsx:200,350`.

**Esboço.** Correção manual (sed cego quebra identificadores). Junto, resolver três copy bugs de baixo custo:
```tsx
// painel/page.tsx — saudação por hora e nome de verdade
const h = Number(new Intl.DateTimeFormat('pt-BR',
  { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()));
const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
const { data: perfil } = await supabase.from('profiles').select('nome').eq('user_id', user.id).single();
const primeiroNome = perfil?.nome?.split(' ')[0] ?? 'você';
```
**Guarda-corpo:** regra de lint que rejeite, em JSX, palavras de uma lista fechada (`Notificacoes`, `Analises`, `Visao`, `Acoes`, `Usuario`, `Historico`, `pendencia`, `confirmacao`, `ultimos`…).

---

### OURO 3 — Toasts + Desfazer · 6h · impacto 9

**O que é.** O `sonner` está instalado, montado com `richColors` e `closeButton` (`app/(app)/layout.tsx:9-17`) e **nunca é chamado**. Todo feedback são 117 `redirect('?success=…' / '?error=…')` que renderizam banners presos na URL. E arquivar obra, pagamento, documento, fornecedor e usuário não tem confirmação **nem desfazer** — um clique acidental arquiva (`obras/[id]/page.tsx:111`, `pagamentos/[id]/page.tsx:105`, `documentos/[id]/page.tsx:86`, `config/usuarios/page.tsx:114`).

**Por que o usuário sente.** Hoje o gestor cria uma obra e cai numa tela de leitura sem uma palavra de confirmação (`obras/actions.ts:58`). E se arquiva por engano, precisa **saber** que existe um filtro "Arquivadas" para desfazer. Desfazer em toast é o padrão que substitui modal de confirmação sem perder segurança — e é mais rápido para quem age 200 vezes por dia.

**Onde mexer.** `components/nogma/Toast.tsx` (novo), `app/(app)/*/actions.ts` (todas), `components/layout/*`.

**Esboço.**
```tsx
// components/flash.tsx — ponte entre ?success/?error e sonner, 1 arquivo, sem tocar nas actions
'use client';
export function Flash() {
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname();
  useEffect(() => {
    const ok = sp.get('success'), err = sp.get('error'), undo = sp.get('undo');
    if (!ok && !err) return;
    if (ok) toast.success(ok, undo ? { action: { label: 'Desfazer', onClick: () => restaurar(undo) } } : undefined);
    if (err) toast.error(err);
    router.replace(path, { scroll: false });   // limpa a URL — o banner deixa de ficar preso no F5
  }, [sp]);
  return null;
}
```
Nas actions destrutivas, devolver o id para o undo:
```ts
// obras/actions.ts — archiveObra
redirect(`/obras?success=${encodeURIComponent('Obra arquivada.')}&undo=obra:${id}`);
```
`restaurar(token)` chama a `restoreObra`/`restorePagamento`/… que **já existem** (`obras/actions.ts:147`, `pagamentos/actions.ts:160`, `documentos/actions.ts:207`, `fornecedores/actions.ts:128`). Custo real: a ponte, não a lógica.

Enquanto isso, corrigir T-4: `pagamentos/page.tsx`, `documentos/page.tsx` e `fornecedores/page.tsx` **não leem `?success`/`?error`** — hoje há erros literalmente invisíveis. Montar o `<Flash />` no `app/(app)/layout.tsx` resolve as três de uma vez.

---

### OURO 4 — A obra com dinheiro na tela · 10h · impacto 10

**O que é.** `/obras/[id]` mostra "Orçamento: R$ 800.000,00" e **nada mais de financeiro** (`obras/[id]/page.tsx:143`). Sem gasto, sem saldo, sem percentual, sem os pagamentos daquela obra, sem os documentos, sem as pendências. A tabela `/obras` também não tem coluna Gasto nem barra de % (`obras-table.tsx:126-161`). O percentual de orçamento **já é calculado** — mas só dentro do PDF (`lib/data/reports.ts:110-111`).

**Por que o usuário sente.** É a pergunta que o gestor de obras faz todo dia e a única razão de o produto existir. Hoje, para saber se uma obra estourou, ele precisa ir em Relatórios, escolher a obra, baixar um PDF e abrir. Isso não é um CRM de obras — é um cadastro com exportador.

**Onde mexer.** `lib/data/obras.ts` (novo agregado), `app/(app)/obras/[id]/page.tsx`, `app/(app)/obras/obras-table.tsx`, `app/(app)/painel/page.tsx` (alerta de estouro).

**Esboço.**
```ts
// lib/data/obras.ts
export async function getObraFinanceiro(obraId: string) {
  const { data } = await supabase.from('pagamentos')
    .select('valor, data_pagamento, categoria_id')
    .eq('obra_id', obraId).eq('status_pagto', 'confirmado').is('deleted_at', null);
  const gasto = (data ?? []).reduce((s, p) => s + Number(p.valor), 0);
  return { gasto, saldo: orcamento - gasto, pct: orcamento ? gasto / orcamento : null };
}
```
```tsx
// obras/[id]/page.tsx — 4 KPIs no topo, antes de qualquer campo de cadastro
<div className="nos-kpi-grid">
  <Stat label="Orçamento" value={brl(obra.orcamento)} />
  <Stat label="Gasto"     value={brl(f.gasto)} caption={`${n(f.qtde)} pagamentos`} />
  <Stat label="Saldo"     value={brl(f.saldo)} direction={f.saldo < 0 ? 'down' : 'up'}
        delta={f.saldo < 0 ? 'Estourou o orçamento' : undefined} />
  <Stat label="Dias em obra" value={diasDesde(obra.data_inicio)}
        caption={obra.data_prevista_fim ? `Previsão: ${d(obra.data_prevista_fim)}` : undefined} />
</div>
<OrcamentoBar pct={f.pct} />   {/* verde <80% · âmbar 80–100% · --danger >100% */}
```
Abas abaixo: **Gastos** (a tabela de pagamentos já existe em `pagamentos-table.tsx` — reusar filtrada por obra), **Documentos** (idem `documentos-table.tsx`), **Pendências**, **Histórico** (`lib/data/auditoria.ts` já filtra por entidade).

Na lista: coluna `Gasto` + barra inline de `%`, com a linha em `--danger` quando passa de 100%.
No painel: `<AlertaTopo>` prometido em §7.2 — *"2 obras passaram do orçamento"* com link, renderizado só quando > 0. Hoje o painel não menciona orçamento em lugar nenhum.

**Nota de performance:** faça isso com uma view materializada (`mv_gasto_por_obra`, §6.5 da spec, nunca criada) ou uma RPC agregada — não com N+1 no server component.

---

### OURO 5 — Preview da nota fiscal e da foto do WhatsApp · 10h · impacto 9

**O que é.** Nenhuma tela do produto mostra um arquivo. `documentos/[id]/page.tsx` tem metadados e um botão "Baixar" (signed URL de 60s). `whatsapp/page.tsx:127-133` exibe o texto `image/jpeg` ao lado de um clipe. E `app/api/webhooks/uazapi/route.ts:77` grava `midia_storage_path: null` — **a mídia do WhatsApp nem é baixada**.

**Por que o usuário sente.** A proposta de valor do produto é "o zelador tira foto do comprovante". Se o gestor não vê a foto, ele confirma no escuro — ou baixa cada JPG para a pasta Downloads do celular e abre na galeria. É o maior descompasso entre o que o produto promete e o que entrega.

**Onde mexer.** `app/api/webhooks/uazapi/route.ts` (baixar a mídia), `lib/storage/documents.ts` (já tem `createSignedUrl`, `:59`), `components/nogma/FilePreview.tsx` (novo), `documentos/[id]/page.tsx`, `documentos/documentos-table.tsx` (thumbnail), `pendentes/page.tsx`, `whatsapp/page.tsx`.

**Esboço.**
```tsx
// components/nogma/FilePreview.tsx — server component, signed URL de 5min
export async function FilePreview({ path, mime }: { path: string; mime: string }) {
  const url = await signedUrl(path, 300);
  if (mime.startsWith('image/')) return <img src={url} alt="" className="ng-preview" loading="lazy" />;
  if (mime === 'application/pdf')
    return <iframe src={`${url}#toolbar=0`} className="ng-preview" title="Pré-visualização do documento" />;
  return <FileGeneric mime={mime} />;
}
```
No card de pendência (`pendentes/page.tsx:114`), colocar a miniatura **ao lado dos dados extraídos** — o gestor compara foto e valor na mesma tela e confirma com um clique, sem sair. Esse é o momento em que o produto "clica" para o cliente.
Em `documentos-table.tsx`, thumbnail de 40px na primeira coluna: uma tabela de notas fiscais com miniaturas parece um produto caro; uma lista de nomes de arquivo parece um FTP.

---

### OURO 6 — Estados vazios com direção + o primeiro dia · 7h · impacto 6

**O que é.** Todos os vazios são uma linha de texto dentro de uma caixa gigante, quatro deles mandando o usuário *procurar* um botão ("Clique em 'Nova Obra'"), e nenhum distingue **banco vazio** de **filtro sem resultado**. E não existe dia 1: banco zerado = painel com quatro KPIs em zero e três gráficos vazios, sem nenhuma direção.

**Por que o usuário sente.** O primeiro contato com o produto — o do gestor da Cavalcanti no dia da entrega — é exatamente esse: tudo vazio, nenhuma orientação. E o `?success=Senha definida. Bem-vindo…` que a action de convite envia (`definir-senha/actions.ts:42`) é **descartado**, porque `painel/page.tsx:38` não recebe `searchParams`.

**Onde mexer.** `components/nogma/EmptyState.tsx` (novo), `components/data-table.tsx:29,99-101`, as 4 tabelas, `painel/page.tsx`.

**Esboço.**
```tsx
export function EmptyState({ icon, title, description, action, variant = 'empty' }) { /* ícone + h3 + p + CTA */ }
```
```tsx
// data-table.tsx — dois vazios diferentes, nunca um só
{rows.length === 0 && (globalFilter
  ? <EmptyState variant="filtered" icon={<SearchX/>} title={`Nada encontrado para "${globalFilter}"`}
      description="Verifique a grafia ou limpe os filtros."
      action={<Button variant="secondary" onClick={clear}>Limpar busca</Button>} />
  : emptyState /* passado pela página, com o CTA real */)}
```
Painel dia 1 — substituir os gráficos zerados por um card de primeiros passos com estado real:
```tsx
<PrimeirosPassos passos={[
  { ok: temObras,        label: 'Cadastre sua primeira obra',        href: '/obras/novo' },
  { ok: temFornecedores, label: 'Cadastre os fornecedores recorrentes', href: '/fornecedores/novo' },
  { ok: temAutorizados,  label: 'Autorize quem manda comprovante no WhatsApp', href: '/config' },
  { ok: temPagamentos,   label: 'Lance o primeiro pagamento',         href: '/pagamentos/novo' },
]} />
```
E fazer `PainelPage` receber `searchParams` para a boas-vindas finalmente aparecer (resolvido de graça pelo `<Flash />` do OURO 3).

---

### OURO 7 — Formulário que não apaga o que você digitou · 12h · impacto 9

**O que é.** Nenhum form usa `useActionState`. Toda action erra com `redirect('?error=…')` e a página recarrega vazia (`obras/actions.ts:31`, `fornecedores/actions.ts:32`, `pagamentos/actions.ts:25`, `documentos/actions.ts:37,93`). O `Input` tem prop `error` por campo (`components/nogma/Input.tsx:13,60-61`) que **nunca é usada**. Nenhum botão tem estado de pending.

**Por que o usuário sente.** Digitar 15 campos, errar o dígito do CNPJ e recomeçar do zero é a experiência que faz alguém abandonar um software. No upload é pior: perde o arquivo junto.

**Onde mexer.** `components/nogma/Button.tsx` (prop `pending`), os 5 forms de domínio, as 5 `actions.ts`.

**Esboço.**
```ts
// obras/actions.ts — devolver estado em vez de redirecionar no erro
export async function createObra(prev: State, fd: FormData): Promise<State> {
  const parsed = obraSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors, values: Object.fromEntries(fd) };
  }
  // ... sucesso continua com redirect
}
```
```tsx
// obra-form.tsx
const [state, action, pending] = useActionState(createObra, {});
<Input name="nome" defaultValue={state.values?.nome ?? initial?.nome} error={state.fieldErrors?.nome?.[0]} autoFocus />
<Button type="submit" pending={pending}>Criar obra</Button>
```
Três ganhos de uma vez: valores preservados, erro **no campo** em vez de banner com `endereco.cep: String must contain at most…`, e botão que não aceita duplo clique. Adicionar `autoFocus` no primeiro campo de cada form (zero ocorrências hoje) custa 5 linhas e é sentido em todo lançamento.

---

### OURO 8 — `lib/format.ts` único + máscaras BR + fuso · 11h · impacto 8

**O que é.** Não existe módulo de formatação. Existem **11 cópias de `formatBRL`** e **12 de `formatDateTime`** espalhadas pelas páginas, duas versões divergentes de `formatTelefone` (`pendentes/page.tsx:8` devolve `+55 11 98765-4321`, `whatsapp/page.tsx:31` devolve `+55 (11) 98765-4321`), nenhum formatter de CEP, e **nenhuma máscara de entrada** em CNPJ/CPF/telefone/CEP/moeda.

**Por que o usuário sente.** Dois motivos, um cosmético e um grave.
Cosmético: o mesmo telefone aparece com dois formatos em duas telas.
**Grave:** nenhum dos 12 `formatDateTime` passa `timeZone`. Na Vercel o runtime é UTC — **um pagamento lançado às 22h de São Paulo aparece com a data do dia seguinte**. E a preferência de fuso do usuário existe (`config/perfil/page.tsx:163`, `lib/schemas/perfil.ts:15-21`) e nunca é lida na renderização. É um bug de dado, não de estilo, num sistema financeiro.

**Onde mexer.** `apps/web/lib/format.ts` (novo), 23 call sites, os 5 forms.

**Esboço.**
```ts
// lib/format.ts — instâncias reusadas, fuso explícito
const TZ = 'America/Sao_Paulo';
const brl  = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dt   = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ });
const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: TZ });

export const formatBRL = (v: number | string) => brl.format(Number(v));
export const formatDataHora = (iso: string) => dt.format(new Date(iso));
export const formatData = (iso: string) => data.format(new Date(`${iso}T12:00:00`)); // evita off-by-one em DATE
export const formatDoc = (raw: string) => /* CNPJ 00.000.000/0000-00 · CPF 000.000.000-00 */;
export const formatTelefone = (raw: string) => /* (11) 98765-4321 — uma única versão */;
export const formatCep = (raw: string) => raw.replace(/(\d{5})(\d{3})/, '$1-$2');
```
Máscaras controladas (sem biblioteca, ~60 linhas):
```tsx
<MaskedInput mask="cnpj-cpf" name="documento" />   {/* formata enquanto digita, envia só dígitos */}
<MoneyInput name="valor" />                        {/* R$ 1.234,56 na tela, 1234.56 no submit  */}
```
Trocar `<input type="number">` por `MoneyInput` (`pagamento-form.tsx:127-137`, `obra-form.tsx:90-98`) resolve de uma vez: separador de milhar, vírgula decimal, sem spinner, teclado numérico no celular.
**Bônus de 1h dentro deste item:** autofill de endereço por CEP (ViaCEP) em `obra-form.tsx:124` — hoje rua, bairro, cidade e UF são todos digitados à mão.
**Guarda-corpo:** com o módulo central, escrever os testes Vitest prometidos na spec §10.1 (hoje `vitest` nem está instalado e `pnpm test` quebra).

---

### OURO 9 — Pendência editável + reprocessar · 12h · impacto 8

**O que é.** O card de pendência é 100% `<span>` (`pendentes/page.tsx:129-193`). Se a IA errou ou faltou dado, não há correção — e `pendentes/actions.ts:52` manda o gestor "editar manualmente em /whatsapp", tela que **não tem nenhum `<form>`**. Reprocessar não existe.

**Por que o usuário sente.** Este é o coração do produto e é onde ele quebra na vida real. Uma IA que acerta 85% significa que **1 em 7 pendências vira trabalho manual do zero** — o gestor rejeita e recadastra o pagamento à mão. O ganho de produtividade que justifica o CRM evapora exatamente onde deveria aparecer.

**Onde mexer.** `app/(app)/pendentes/pendente-card.tsx` (novo, client), `app/(app)/pendentes/actions.ts`, `app/(app)/whatsapp/actions.ts` (novo).

**Esboço.**
```tsx
// pendentes/pendente-card.tsx — mesmos dados, agora editáveis, com a foto ao lado
<form action={confirmarPendencia}>
  <input type="hidden" name="confirmacao_id" value={c.id} />
  <FilePreview path={m.midia_storage_path} mime={m.midia_mime} />   {/* OURO 5 */}
  <MoneyInput  name="valor"        defaultValue={de.valor} />
  <ObraSelect  name="obra_id"      defaultValue={de.obra_id} />
  <FornecedorSelect name="fornecedor_id" defaultValue={de.fornecedor_id} allowCreate />
  <Input name="descricao" defaultValue={de.descricao} />
  <Button type="submit" variant="primary" pending={pending}>Confirmar pagamento</Button>
</form>
<form action={reprocessarMensagem}><Button variant="secondary">Classificar de novo</Button></form>
```
Em `confirmarPendencia`, ler os campos do `FormData` em vez de `dados_extraidos` — o gestor corrige e confirma **em um único envio**, e o guarda de idempotência que já existe (`actions.ts:64-75`) continua valendo. Sai o bloqueio de `actions.ts:51-57`: com os campos editáveis, valor e obra ausentes deixam de ser beco sem saída e viram simplesmente campos obrigatórios do form.
Adicionar confirmação em "Rejeitar" (hoje submete direto, `page.tsx:202-213`) e badge de contagem em "Pendentes" no menu (`sidebar-nav.tsx:14`).
**Pré-requisito real:** OURO 5, porque editar sem ver a foto é adivinhar.

---

### OURO 10 — ⌘K de verdade (ou tirar a mentira da topbar) · 12h · impacto 7

**O que é.** `components/layout/topbar.tsx:25-34` renderiza uma barra de busca com placeholder *"Buscar obras, fornecedores, pagamentos…"* e badge `⌘K`. O `<input>` **não tem nenhum handler**. O `IconButton` de busca mobile (`:31`) e o sino "Alertas" (`:36`) também não têm `onClick`. E há **duas buscas na mesma tela**: a de cima, morta, e a da tabela, viva.

**Por que o usuário sente.** Num CRM com 5 entidades, achar "aquela nota da FerroForte" hoje exige: escolher a tela certa, entrar, digitar na busca da tabela — e a busca da tabela só filtra as linhas já carregadas naquela página (`components/data-table.tsx:52-58`), então nem sempre acha. Mas o pior é a promessa quebrada: o gestor tenta a barra de cima, digita, nada acontece, e conclui que o app está com defeito. **Se não for implementar, remova o input e o `<kbd>` hoje** — 10 minutos, e o produto fica mais honesto.

**Onde mexer.** `components/layout/command-k.tsx` (novo), `app/api/search/route.ts` (novo), `components/layout/topbar.tsx:25-38`.

**Esboço.**
```ts
// app/api/search/route.ts — uma query, quatro entidades, sanitizada
// lib/util/search.ts:sanitizeSearchQuery já existe e já protege contra filter injection do PostgREST
const [obras, fornecedores, pagamentos, documentos] = await Promise.all([
  sb.from('obras').select('id,nome,cliente').ilike('nome', `%${q}%`).limit(5),
  sb.from('fornecedores').select('id,nome,documento').ilike('nome', `%${q}%`).limit(5),
  sb.from('pagamentos').select('id,descricao,valor,data_pagamento').ilike('descricao', `%${q}%`).limit(5),
  sb.from('documentos').select('id,nome_arquivo,numero_nf').ilike('nome_arquivo', `%${q}%`).limit(5),
]);
```
```tsx
// command-k.tsx — cmdk + Radix Dialog (Radix já é dependência)
useEffect(() => {
  const on = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o); }
  };
  document.addEventListener('keydown', on); return () => document.removeEventListener('keydown', on);
}, []);
```
Além de buscar, incluir **ações**: "Nova obra", "Novo pagamento", "Gerar fechamento do mês", "Ir para Pendentes (3)". É o que faz o ⌘K virar hábito em vez de curiosidade. E resolve de lambuja o T-3: `/pagamentos` não está no menu — pelo ⌘K passa a existir.

---

### Ganhos avulsos de custo quase zero (fora do top 10, mas faça no mesmo PR)

| Item | Onde | Esforço |
|---|---|---|
| Adicionar `/pagamentos` ao menu | `sidebar-nav.tsx:9-18` | 5 min |
| `capture="environment" accept="image/*,application/pdf"` no upload | `documento-form.tsx:70-75` | 10 min |
| `error.tsx` + `not-found.tsx` no grupo `(app)` — hoje **zero** no repo | `app/(app)/` | 1h |
| `loading.tsx` para `fornecedores`, `whatsapp`, `auditoria`, `notificacoes`, `config/*` | 5 arquivos | 1h |
| Persistir busca/ordenação/página das tabelas em querystring | `data-table.tsx:31-32,44` | 2h |
| Usar o template `boas-vindas.tsx` (que já existe!) no convite | `lib/data/usuarios.ts:129` | 1h |
| Ativar "Esqueci a senha" (hoje é um `<span title="Em breve">`) | `login-form.tsx:62-64` | 1h |
| Filtrar o `<select>` de pagamentos pela obra já escolhida | `documento-form.tsx:186-196` | 30 min |
| `@media print` para relatório e detalhe de obra — hoje zero no repo | `styles/print.css` | 2h |
| Sticky header nas tabelas | `components/data-table.css:47` | 15 min |

---

## 8. Cortes — o que existe e deveria sumir ou encolher

1. **A busca falsa da topbar.** `topbar.tsx:25-34` (input sem handler + `<kbd>⌘K</kbd>`) e o sino sem `onClick` (`:36`). Ou implementa (OURO 10) ou **remove hoje**. Interface que promete e não cumpre custa mais confiança do que interface ausente.
2. **Tailwind inteiro.** `tailwind.config.ts` (56 linhas mapeando toda a marca), `@import "tailwindcss"` (`globals.css:1`) e duas dependências — para **0 classes usadas**. Escolha: adotar de verdade (e aí os 78 `--surface-1` teriam sido pegos pelo IntelliSense) ou apagar os quatro artefatos.
3. **`components/domain/` vazia.** Pasta prometida na spec §5, criada e nunca preenchida.
4. **`app/(dev)/kitchen-sink/`.** Vitrine de componentes no bundle de produção, e um dos arquivos com mais texto sem acento do repo. Mover para Storybook ou proteger por env.
5. **Os 200 linhas duplicados de `obras-table.tsx`.** `obras/obras-table.tsx:150-350` é uma cópia manual de `components/data-table.tsx` (mesmo markup, mesmas classes `nos-dt__*`, mesmo texto de paginação) só para adicionar seleção de linha. Qualquer melhoria de tabela hoje precisa ser feita duas vezes. Extrair `enableRowSelection` como prop do `DataTable`.
6. **A sidebar de 11 itens.** Para um gestor de obras, `Notificações` (log de e-mails enviados) e `Auditoria` (trilha de alterações) são telas de operação da Nogma, não trabalho diário — devem viver dentro de `/config`. `Meu perfil` já está no rodapé da sidebar (avatar + nome) e não precisa de linha própria. Sobram 7 itens, e entra `Pagamentos`, que hoje não está lá.
7. **A seção "Metadados" do detalhe da obra** (`obras/[id]/page.tsx:163-170`: "Criada em / Última atualização / Arquivada em"). Ocupa espaço nobre com informação que o gestor nunca usa — e está ali onde deveria estar o gasto da obra. Mover para a aba Histórico.
8. **`/config/webhooks` com CRUD completo** (251 linhas de página + 220 de editar + `actions.ts`). Configurar endpoint, secret HMAC e ver contador de execuções é trabalho de integrador Nogma, não de gestor de obras. Manter, mas atrás de papel `admin` e fora do menu principal.
9. **O campo "ícone Lucide" nas categorias** (`config/categorias/nova/page.tsx:68`). Pedir a um gestor de obras que digite `hard-hat` é a definição de jargão vazando. Trocar por um seletor visual de 12 ícones.
10. **Os ~30 fallbacks de cor** do tipo `var(--danger, #ef4444)`, `var(--accent, #22c55e)`, `var(--radius-lg, 12px)`. Os tokens sempre existem; o fallback nunca dispara — só esconde erro e, quando dispara, pinta com uma cor que não é da Nogma e um raio que não é da escala.
11. **Os três easings inventados** em `nos-responsive.css:492-496` e o override do `.ng-btn` em `:500-508`. O botão da marca está usando uma curva que não é da marca.
12. **`"test": "vitest run"` sem vitest instalado** (`apps/web/package.json:10`). Ou instala e escreve os testes de formatter/dedup prometidos na spec §10.1, ou remove o script — hoje `pnpm test` quebra e dá a impressão falsa de que há suíte unitária.
13. **Lixo no raiz do repositório (não versionado):** `Cavalcanti enegenharia/` (um projeto Vite inteiro, com `node_modules`), `__MACOSX/`, `crm-cavalcanti-logado.png`. Mover para `docs/` ou `.gitignore`.

---

## 9. Fechamento

O trabalho de engenharia aqui é sério: 19 migrations com RLS por papel, triggers de auditoria com diff, RPCs atômicas, magic bytes no upload, dedup por SHA-256, PDFs de verdade, e-mails de verdade, E2E rodando. Duas auditorias anteriores já limparam segurança e races. **O que falta não é rigor — é acabamento e ponto de vista.**

Existem duas correções que, sozinhas, mudam a categoria do produto:

- **Uma hora de trabalho** trocando `--surface-1/2` pelos tokens reais faz o app deixar de parecer um wireframe.
- **Dez horas** colocando gasto, saldo e percentual de orçamento na tela da obra fazem o produto passar de "cadastro de obras" a "gestor de obras" — que é o nome dele.

Depois disso, o resto do caminho é o mesmo de sempre: o produto precisa mostrar a foto da nota, precisa não apagar o que o usuário digitou, precisa falar português com acento, e precisa cumprir as promessas que a própria interface faz.
