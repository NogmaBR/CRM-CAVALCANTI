> **Recuperado do transcript da sessao de 2026-09-09** (VS Code fechou antes de consolidar).
> Agente: Agent "Auditar detalhes premium e formatação BR" finished
> Custo: 125459 tokens, 39 tool calls

Análise completa. Segue o relatório.

---

# Inventário: "detalhes que fazem um produto parecer caro"
**Projeto:** `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA` — `apps/web` (Next.js 16 App Router, React 19)

---

## 1. BUSCA GLOBAL ⌘K — **NÃO** (pior: existe a *fachada* dela)

Não existe `CommandK`, `cmdk`, `command palette` nem `components/layout/CommandK.tsx`. `cmdk` não está no `package.json`. Zero resultados para `cmdk|CommandK|CommandPalette|useHotkeys` em todo `apps/web`.

**O agravante:** a UI *promete* o ⌘K e não faz nada. Em `apps/web/components/layout/topbar.tsx:25-34`:

```tsx
&lt;label className="nos-search nos-search--desktop"&gt;
  &lt;Search size={15} color="var(--text-muted)" aria-hidden="true" /&gt;
  &lt;input placeholder="Buscar obras, fornecedores, pagamentos..." aria-label="Buscar" /&gt;
  &lt;kbd&gt;⌘K&lt;/kbd&gt;
&lt;/label&gt;
&lt;IconButton label="Buscar" icon={&lt;Search size={19} /&gt;} className="nos-search-trigger" /&gt;
```

O `&lt;input&gt;` é **descontrolado e sem nenhum handler** — sem `onChange`, `onKeyDown`, `onSubmit`, sem `form`. Você digita e nada acontece; o texto fica lá parado. O `&lt;kbd&gt;⌘K&lt;/kbd&gt;` (estilizado em `apps/web/styles/nos-chrome.css:43`) é decoração pura. O `IconButton` mobile (`apps/web/components/layout/topbar.tsx:31`) também não tem `onClick` — clica e não acontece nada (`IconButton` só repassa props, `apps/web/components/nogma/IconButton.tsx:43`). O sino "Alertas" (`topbar.tsx:36`) idem.

**Entidades cobertas: zero.** A única busca real é o filtro client-side *dentro de cada tabela* (`apps/web/components/data-table.tsx:52-58`), que só filtra as ~linhas já carregadas naquela página.

---

## 2. ATALHOS DE TECLADO — **NÃO**

Zero `keydown`/`keyup`/`keypress`/`metaKey`/`ctrlKey` em `apps/web/components/**` e `apps/web/app/**`. Nenhum `n` = novo, `/` = buscar, `Esc` = fechar. O único "atalho" acidental é o `Esc` nativo do `&lt;dialog&gt;`/Radix no `MobileNav`.

---

## 3. AUTOFOCO — **NÃO**

`grep -i autofocus` em `apps/web/app` e `apps/web/components`: **zero ocorrências**. Nenhum formulário foca o primeiro campo. Inclui o login (`apps/web/app/(auth)/login/login-form.tsx:29` — campo e-mail sem `autoFocus`), `obra-form.tsx:41`, `fornecedor-form.tsx:45`, `pagamento-form.tsx`.

---

## 4. SUBMIT COM ENTER — **SIM** (bem feito)

41 `&lt;form&gt;` nativos em 28 arquivos, todos com `action={serverAction}` — Enter submete corretamente. Ex.: `apps/web/app/(app)/obras/obra-form.tsx:26`, `apps/web/app/(app)/pagamentos/pagamento-form.tsx:53`, `apps/web/app/(app)/fornecedores/fornecedor-form.tsx:31`. Ações destrutivas usam `&lt;form action={...}&gt;` com botão submit, não divs com onClick (ex.: `apps/web/app/(app)/obras/[id]/page.tsx:104`).

**Ressalva grave (item de "produto caro"):** apenas **1 formulário em toda a app** tem estado de pendência no submit — `apps/web/app/(auth)/definir-senha/definir-senha-form.tsx:10` (`useFormStatus`). Nos outros 40, dá pra clicar "Criar obra" cinco vezes seguidas sem nenhum feedback: nenhum `useTransition`, `useActionState`, spinner ou `disabled` durante a submissão.

---

## 5. FORMATAÇÃO BR — **PARCIAL** (funciona, mas é copy-paste, e o fuso está errado)

**Não existe `apps/web/lib/format.ts`, `formatters.ts` nem `utils.ts`.** `ls apps/web/lib/` retorna só: `data/ email/ ia/ reports/ schemas/ services/ storage/ supabase/ theme.ts util/ webhooks/`. O `lib/util/` tem só `csv-parser.ts` e `search.ts`.

**O que existe, espalhado:**

| Helper | Onde | Situação |
|---|---|---|
| `formatBRL` | `apps/web/lib/schemas/pagamento.ts:68` (o "oficial") | `toLocaleString('pt-BR', {style:'currency', currency:'BRL'})` ✔ |
| `formatBRL` (cópias) | `obras-table.tsx:37`, `obras/[id]/page.tsx:33`, `pendentes/page.tsx:31`, `whatsapp/page.tsx:39`, `config/categorias/page.tsx:18`, `config/importar/importar-client.tsx:13`, `painel/charts/bar-serie-mensal.tsx:18`, `donut-categoria.tsx:9`, `line-acumulado.tsx:17`, `lib/reports/pdf/primitives.tsx:280`, `lib/data/painel.ts:178` e `:368` | **11 reimplementações independentes** |
| `formatDate` (dd/MM/yyyy) | `obras-table.tsx:46`, `pagamentos-table.tsx:27`, `documentos-table.tsx:21`, `pagamentos/[id]/page.tsx:16`, `obras/[id]/page.tsx:42`, `pendentes/page.tsx:35` | 6 cópias |
| `formatDateTime` | `auditoria/page.tsx:20`, `auditoria/[id]/page.tsx:19`, `config/usuarios/page.tsx:27`, `config/usuarios/[id]/editar/page.tsx:11`, `documentos/[id]/page.tsx:23`, `fornecedores/[id]/page.tsx:15`, `notificacoes/page.tsx:17`, `notificacoes/[id]/page.tsx:9`, `obras/[id]/page.tsx:49`, `pagamentos/[id]/page.tsx:23`, `pendentes/page.tsx:27`, `whatsapp/page.tsx:44` | **12 cópias** |
| `formatDocumento` (CNPJ/CPF) | `apps/web/lib/schemas/fornecedor.ts:122` | ✔ único, correto (`00.000.000/0000-00` e `000.000.000-00`) |
| `formatTelefone` | `pendentes/page.tsx:8` e `whatsapp/page.tsx:31` | 2 cópias **com formatos divergentes**: uma devolve `+55 11 98765-4321`, a outra `+55 (11) 98765-4321` |
| CEP | — | **não existe formatter** |

**`timeZone: 'America/Sao_Paulo'`: NÃO — em lugar nenhum da renderização.** Grep de `timeZone` em `apps/web` só acha: `apps/web/app/(app)/config/perfil/page.tsx:163` (o `&lt;select&gt;` de preferência do usuário), `apps/web/lib/schemas/perfil.ts:15-21` (a lista de opções) e `apps/web/playwright.config.ts:59`. **A preferência salva pelo usuário nunca é lida na formatação.** Todos os 12 `formatDateTime` chamam `d.toLocaleString('pt-BR', {...})` sem `timeZone`, o que no server component roda no fuso do runtime — **UTC na Vercel**. Em produção, um pagamento registrado às 22h de São Paulo aparece com data do dia seguinte.

`Intl.NumberFormat`/`Intl.DateTimeFormat` diretos: nenhum. Tudo via `Number#toLocaleString`/`Date#toLocaleString` (equivalente, porém sem reuso de instância — recria o formatter a cada célula da tabela).

---

## 6. MÁSCARA DE ENTRADA — **NÃO** (nenhum campo mascara enquanto digita)

Não há biblioteca de máscara, nem handler `onChange` que formate. Todos são campos crus:

- **CNPJ/CPF** — `apps/web/app/(app)/fornecedores/fornecedor-form.tsx:60-68`: `&lt;Input label="Documento (CNPJ ou CPF)" name="documento" placeholder="00.000.000/0000-00 ou 000.000.000-00" hint="Aceita com ou sem máscara — validado por dígito verificador" maxLength={20} /&gt;`. O `hint` **admite explicitamente** que a máscara é problema do usuário. A validação de dígito verificador (`lib/schemas/fornecedor.ts:55-79`) só roda no server, **após o submit**, e o erro volta via `?error=` com recarga de página.
- **Telefone** — `fornecedor-form.tsx:116-123`: `&lt;Input label="Telefone" name="telefone" type="tel" placeholder="(00) 00000-0000" maxLength={30} /&gt;`. Salvo como texto livre; `z.string().trim().max(30)` (`lib/schemas/fornecedor.ts:105`) aceita literalmente qualquer coisa.
- **CEP** — `apps/web/app/(app)/obras/obra-form.tsx:120`: `&lt;Input label="CEP" name="endereco.cep" placeholder="00000-000" maxLength={9} /&gt;`. Sem máscara, sem validação, **sem autofill ViaCEP** (rua/bairro/cidade/UF são todos digitados à mão, `obra-form.tsx:122-140`).
- **Moeda** — `apps/web/app/(app)/pagamentos/pagamento-form.tsx:130-139`: `&lt;Input label="Valor (R$)" name="valor" type="number" min="0" step="0.01" placeholder="0,00" inputMode="decimal" /&gt;`. É um `type="number"` do browser: o `placeholder="0,00"` mente, porque o input nativo exige **ponto** decimal em locale en; não tem separador de milhar, spinner aparece, e não formata como `R$ 1.234,56` ao sair do campo. Idem `obra-form.tsx:90-98` (Orçamento).

O único `inputMode` da app inteira é esse (`pagamento-form.tsx:136`). Zero `pattern=`.

---

## 7. ESTADOS VAZIOS — **PARCIAL** (não há componente; 3 de 12 são decentes; nenhum tem CTA clicável)

**Não existe componente `EmptyState`** em `apps/web/components/**`. O único `emptyState` do repo é um `StyleSheet` do react-pdf (`apps/web/lib/reports/pdf/primitives.tsx:171`), que não é UI.

O `DataTable` tem só um prop de string (`apps/web/components/data-table.tsx:29`): `emptyMessage = 'Nenhum resultado.'` renderizado como `&lt;td className="nos-dt__empty"&gt;` (`data-table.tsx:99-101`).

**Vazios que são só texto dentro de uma célula de tabela, sem ícone e sem botão:**

| Arquivo:linha | Texto |
|---|---|
| `apps/web/components/data-table.tsx:29` | `Nenhum resultado.` (default) |
| `apps/web/app/(app)/obras/obras-table.tsx:350` | `Nenhuma obra encontrada. Clique em 'Nova Obra' para comecar.` |
| `apps/web/app/(app)/pagamentos/pagamentos-table.tsx:164` | `Nenhum pagamento encontrado. Clique em 'Novo Pagamento' para começar.` |
| `apps/web/app/(app)/fornecedores/fornecedores-table.tsx:123` | `Nenhum fornecedor encontrado. Clique em 'Novo Fornecedor' para começar.` |
| `apps/web/app/(app)/documentos/documentos-table.tsx:138` | `Nenhum documento encontrado. Clique em 'Novo Documento' para começar.` |
| `apps/web/app/(app)/config/categorias/page.tsx:184-185` | `Nenhuma categoria ativa. Crie a primeira.` |
| `apps/web/app/(app)/config/usuarios/page.tsx:245-248` | `Nenhum usuario ativo no momento.` |
| `apps/web/app/(app)/notificacoes/page.tsx:162-163` | `Nenhuma notificacao registrada ainda.` |
| `apps/web/app/(app)/painel/page.tsx:191-193` | `Nenhuma atividade nas ultimas 48h.` |
| `apps/web/app/(app)/whatsapp/page.tsx:94` | `Nenhuma mensagem com status "..."` |
| `apps/web/app/(app)/auditoria/page.tsx:251` | `Nenhum registro no filtro` |

As quatro primeiras **mandam o usuário procurar um botão** ("Clique em 'Nova Obra'") em vez de serem o botão. E note que as tabelas não distinguem "banco vazio" de "filtro sem resultado" — digitar `zzz` na busca produz a mesma frase "Clique em 'Nova Obra' para começar".

**Os três decentes** (ícone + título + subtítulo, mas ainda sem CTA):
- `apps/web/app/(app)/pendentes/page.tsx:93-100` — `&lt;Inbox size={48}&gt;` + "Nenhuma pendencia no momento" + explicação
- `apps/web/app/(app)/config/webhooks/page.tsx:220-225` — `&lt;Webhook size={32}&gt;` + texto explicativo
- `apps/web/app/(app)/fornecedores/duplicatas/page.tsx:107-108` — `&lt;CheckCircle2 size={40}&gt;` + "Nenhuma duplicata detectada"

---

## 8. ESTADOS DE ERRO — **PARCIAL** (existe um bom mapeador; a app inteira o contorna)

**O que é bom:** `apps/web/lib/schemas/errors.ts` traduz códigos Postgres para pt-BR e nunca vaza a mensagem crua (`errors.ts:31`: *"Fallback: nunca expor raw message em prod"*). Mapeia `23502/23503/23505/23514/42501/42P01/PGRST116/PGRST301`. E há overrides bons: `'23505': 'Já existe fornecedor com este CNPJ/CPF'` (`apps/web/app/(app)/fornecedores/actions.ts:58`).

**O que é ruim — mensagens literais piores encontradas:**

1. **A camada de dados inteira faz `throw new Error` com a mensagem crua do Postgres/Supabase concatenada** — 20 ocorrências, e como **não existe nenhum `error.tsx`** (item 9), isso vira a tela de crash genérica do Next (`Application error: a server-side exception has occurred`) com o texto no log:
   - `apps/web/lib/data/obras.ts:34` — `throw new Error(\`Falha ao listar obras: ${error.message}\`)`
   - `apps/web/lib/data/pagamentos.ts:51`, `:58`, `:99` (`Falha ao somar pagamentos: ...`)
   - `apps/web/lib/data/fornecedores.ts:41,48,59`, `documentos.ts:41,48`, `categorias.ts:17,53`, `notificacoes.ts:123`, `auditoria.ts:79`, `apelidos.ts:19`, `mensagens.ts:28`, `pendentes.ts:62`, `usuarios.ts:62,68`
   - `apps/web/lib/storage/documents.ts:53` — `Falha ao deletar: ${error.message}` e `:60` — `` Falha ao gerar URL: ${error?.message ?? 'sem URL'} ``

2. **Erros de admin do Supabase interpolados direto na URL e exibidos ao usuário** — `apps/web/app/(app)/config/usuarios/actions.ts`:
   - `:69` — `` `Erro ao convidar: ${result.error}` ``
   - `:98` — `Erro ao reenviar convite: ${result.error}`
   - `:128` — `Erro ao alterar papel: ${result.error}`
   - `:151` — `Erro ao arquivar usuario: ${result.error}` (sem acento)
   - `:170` — `Erro ao restaurar usuario: ${result.error}`
   
   O `result.error` vem do GoTrue e chega ao usuário final como, por exemplo, `Erro ao convidar: A user with this email address has already been registered` — inglês, cru, dentro de um banner vermelho.

3. `apps/web/app/(auth)/definir-senha/actions.ts:39` — `` `Falha ao definir senha: ${error.message}` `` → o usuário vê o texto do Supabase em inglês (`Password should be at least 6 characters`) na tela de definição de senha.

4. Fallbacks genéricos onde o contexto se perde por completo: `apps/web/lib/schemas/errors.ts:26` — `'Erro ao processar. Tente novamente.'`; `apps/web/app/(app)/config/webhooks/actions.ts:93,134,157,196` — `'Erro ao criar webhook. Tente novamente.'`, `'Erro ao atualizar webhook.'`, `'Erro ao arquivar webhook.'`, `'Erro ao regenerar secret.'` — nenhuma diz *o quê* deu errado nem o que fazer.

5. `apps/web/app/(app)/whatsapp/page.tsx:133` — `&lt;div className="wa-item__error"&gt;Erro: {m.erro_msg}&lt;/div&gt;` e `apps/web/app/(app)/notificacoes/[id]/page.tsx:111` — `&lt;strong&gt;Erro:&lt;/strong&gt; {notif.erro}`: despejam a coluna de erro do banco (stack/resposta HTTP do webhook) direto na tela.

Padrão de UX de erro: **todos** os erros de server action navegam via `redirect('...?error=' + encodeURIComponent(msg))` e recarregam a página — **o usuário perde tudo que digitou no formulário**. Ex.: `apps/web/app/(app)/config/webhooks/actions.ts:93`.

`Toaster` do `sonner` está montado em `apps/web/app/(app)/layout.tsx:9-17`, mas **`grep "toast\."` retorna zero** — nenhum toast é disparado em lugar nenhum da aplicação. É dependência morta.

---

## 9. LOADING / SKELETON — **PARCIAL** (6 `loading.tsx`; zero `error.tsx`; zero `not-found.tsx`)

`find` em todo `apps/web` por `error.tsx`, `not-found.tsx`, `global-error.tsx`, `template.tsx`: **nenhum arquivo**. Qualquer throw da camada de dados = tela de crash padrão do Next; qualquer URL inválida = 404 genérico do Next, fora do shell (sem sidebar, em inglês).

**TÊM `loading.tsx`** (com `&lt;Skeleton&gt;` real, bem feitos — o skeleton espelha o layout, inclusive os KPIs):
- `apps/web/app/(app)/painel/loading.tsx`
- `apps/web/app/(app)/obras/loading.tsx`
- `apps/web/app/(app)/pagamentos/loading.tsx`
- `apps/web/app/(app)/documentos/loading.tsx`
- `apps/web/app/(app)/pendentes/loading.tsx`
- `apps/web/app/(app)/relatorios/loading.tsx`

(Por herança de segmento, cobrem também `obras/novo`, `obras/[id]`, `pagamentos/[id]`, etc.)

**NÃO TÊM nada** — tela travada na rota anterior enquanto o server component busca:
- `apps/web/app/(app)/auditoria/` e `auditoria/[id]/`
- `apps/web/app/(app)/fornecedores/` — inclusive `novo/`, `[id]/`, `[id]/editar/`, `duplicatas/` (esta última roda detecção de duplicatas, a mais lenta da app)
- `apps/web/app/(app)/notificacoes/` e `notificacoes/[id]/`
- `apps/web/app/(app)/whatsapp/`
- `apps/web/app/(app)/config/` inteiro — `categorias/`, `importar/`, `perfil/`, `usuarios/`, `webhooks/` e todos os filhos

**`&lt;Suspense&gt;`: zero ocorrências** na app. Nada de streaming — cada página espera o `Promise.all` completo antes de pintar o primeiro byte (ex.: `apps/web/app/(app)/painel/page.tsx:39-45`, 5 queries em série de bloqueio).

---

## 10. FEEDBACK OTIMISTA — **NÃO**

`useOptimistic`: zero ocorrências. `useTransition`: zero. `useActionState`/`useFormState`: zero. Tudo espera o round-trip completo do server action + `revalidatePath` + re-render. Sem sequer um `disabled` no botão durante o envio (ver item 4). O único `useFormStatus` da app está em `apps/web/app/(auth)/definir-senha/definir-senha-form.tsx:10`.

---

## 11. UNDO — **PARCIAL** (soft-delete + restaurar existe; "desfazer" não)

Não há nenhum "Desfazer" — `grep -i desfazer|undo`: zero. O que existe é **arquivar/restaurar** como duas operações separadas e explícitas:

- `apps/web/app/(app)/obras/actions.ts:147` `restoreObra`, botão em `apps/web/app/(app)/obras/[id]/page.tsx:104-107`
- `apps/web/app/(app)/pagamentos/actions.ts:160` `restorePagamento` → `pagamentos/[id]/page.tsx:98-101`
- `apps/web/app/(app)/fornecedores/actions.ts:128` `restoreFornecedor` → `fornecedores/[id]/page.tsx:62-65`
- `apps/web/app/(app)/documentos/actions.ts:207` `restoreDocumento` → `documentos/[id]/page.tsx:81-83`
- `apps/web/app/(app)/config/categorias/actions.ts:127` `restaurarCategoria` → `config/categorias/page.tsx:91-95`
- `apps/web/app/(app)/config/usuarios/actions.ts:158` `restaurarUsuario` → `config/usuarios/page.tsx:148-152`

Para desfazer, o usuário precisa **saber** que existe um filtro "Arquivadas", trocar o filtro, achar o registro e clicar em Restaurar. Não há toast de "Obra arquivada — Desfazer" (impossível, já que nenhum toast é disparado).

Confirmação destrutiva usa `window.confirm()` nativo do browser — `apps/web/app/(app)/obras/obras-table.tsx:200-202`:
```js
const confirmed = window.confirm(
  `Arquivar ${n} obra(s)? A acao e reversivel — filtre por "Arquivadas" para restaurar.`,
);
```
(note também a acentuação perdida: "a acao e reversivel"). Idem `apps/web/app/(app)/fornecedores/duplicatas/merge-buttons.tsx:30`, onde o merge de fornecedores — **irreversível** — é confirmado por um alert nativo do Chrome.

---

## 12. KPIs COM HISTÓRIA — **PARCIAL** (o melhor item da app; falta o alerta de orçamento)

`apps/web/app/(app)/painel/page.tsx:79-150` renderiza 4 cards, cada um com `&lt;Stat&gt;` (label, value, delta, direction, caption) **+ `&lt;Sparkline&gt;` de 8 meses** (`components/nogma/Sparkline.tsx`). Os dados vêm de `apps/web/lib/data/painel.ts:96-228`. O que cada card mostra de fato:

| Card | Valor | Delta % | Sparkline | Caption |
|---|---|---|---|---|
| **Obras ativas** (`painel.ts:200-208`) | contagem não-arquivadas | `delta_pct: null` → cai no fallback `statDelta()` (`page.tsx:26-31`) e **exibe a caption no lugar do delta**, com seta verde ↑ fixa (`direction: 'flat'`) | 8 meses reais, calculados por `created_at`/`deleted_at` ✔ | "não arquivadas" |
| **Gasto no mês** (`painel.ts:199-208`) | BRL, `maximumFractionDigits: 0` | **✔ real** — `pctDelta(mesAtual, mesAnterior)` (`painel.ts:174-180`), com zona morta de ±0,5% → `flat` | 8 meses de gasto ✔ | "N pagamentos confirmados" |
| **Total acumulado** (`painel.ts:210-218`) | BRL histórico | `delta_pct: null`, `direction: 'up'` **hardcoded** → seta verde sempre | running sum 8 meses ✔ | "todas as obras · histórico" |
| **Pendências WhatsApp** (`painel.ts:220-227`) | contagem `recebida`+`classificada` | `delta_pct: null`, `direction: pendencias &gt; 0 ? 'down' : 'flat'` — não é tendência, é semáforo | 8 meses ✔ (âmbar) | "aguardando classificação" |

**Só 1 dos 4 KPIs tem delta real vs mês anterior.** Nos outros três, o slot de delta é preenchido com a caption, de modo que o card mostra a mesma frase duas vezes (no delta e na caption) acompanhada de uma seta direcional que não significa nada.

**Alerta de estouro de orçamento: NÃO.** O painel não menciona orçamento. `obras.orcamento` existe (`lib/schemas/obra.ts:46`) e `percentualOrcamento` é calculado — mas **só dentro dos relatórios exportados**: `apps/web/lib/data/reports.ts:110-111` (`valorTotalPago / orcamento`), consumido em `lib/reports/pdf/obra-completa.tsx:91-93` e `lib/reports/csv.ts:68-69`. Na UI, `apps/web/app/(app)/obras/[id]/page.tsx:143` mostra `&lt;Row label="Orçamento" value={formatBRL(obra.orcamento)} /&gt;` — o número nu, **sem barra de progresso, sem % gasto, sem comparação com o realizado, sem alerta de estouro**. Um gestor de obras não descobre pelo CRM que uma obra passou do orçamento; precisa baixar o PDF.

Detalhes menores no painel: `apps/web/app/(app)/painel/page.tsx:85` saúda **"Bom dia"** hardcoded a qualquer hora; `:53-55` deriva o primeiro nome do e-mail (`operacao@...` → "Operacao") ignorando o `profile.nome`.

Os 3 gráficos (Recharts) são reais e bem alimentados: barras 12 meses (`charts/bar-serie-mensal.tsx`), donut top-5 categorias + "Outros" (`charts/donut-categoria.tsx`, `painel.ts:266-306`), linha acumulada (`charts/line-acumulado.tsx`).

---

## 13. IMPRESSÃO — **NÃO**

`grep "@media print|page-break|print-color-adjust"` em todo `apps/web`: **zero ocorrências**. Os 6 arquivos CSS (`globals.css`, `nogma.css`, `nos-chrome.css`, `nos-responsive.css`, `a11y.css`, `tokens/*`) não têm folha de impressão. Ctrl+P em qualquer tela imprime a sidebar, a topbar e os fundos escuros.

Sem `window.print()`, sem botão "Imprimir", sem "Compartilhar", **sem link público de relatório**.

O que existe é download de arquivo: `apps/web/app/(app)/relatorios/relatorios-forms.tsx:33-61` (`DownloadLink`) aponta para `/api/exports/[tipo]` gerando PDF (`@react-pdf/renderer`) e CSV. É autenticado, um arquivo por vez, e o `&lt;a target="_blank"&gt;` não dá feedback nenhum enquanto o PDF é gerado no servidor (`relatorios-forms.tsx:47-57`) — o usuário clica e olha para uma aba em branco.

---

## 14. ONBOARDING DIA 1 — **NÃO**

`grep -i "onboarding|tour|checklist|primeiros passos|bem-vindo|welcome|getting started"` em `apps/web/app` e `apps/web/components`: **zero ocorrências**.

Com o banco vazio, o usuário cai em `/painel` e vê: "Bom dia, Operacao", quatro KPIs zerados (`R$ 0`, `0`, `0`, `R$ 0`) com sparklines de linha reta, três gráficos vazios do Recharts e "Nenhuma atividade nas ultimas 48h." (`painel/page.tsx:192`). Nenhum indício de que o primeiro passo é criar uma obra. Existe o botão "Nova Obra" na topbar (`painel/page.tsx:70-76`), mas não há nada que o destaque, nem sequência sugerida (obra → categorias → fornecedores → pagamento), nem dados de exemplo, nem estado de "conta nova".

Há um `/config/importar` (CSV de pagamentos) e um template `coming-soon.tsx` (`apps/web/components/layout/coming-soon.tsx`), mas nenhum fluxo guiado.

---

## 15. DENSIDADE — **PARCIAL** (TanStack v8 instalado e usado, mas só o básico)

`@tanstack/react-table: ^8.21.3` está em `apps/web/package.json:16` e **é realmente usado** — em `apps/web/components/data-table.tsx:34-43` e, duplicado à mão, em `apps/web/app/(app)/obras/obras-table.tsx:177-190`. As outras três tabelas (`fornecedores-table.tsx:5`, `pagamentos-table.tsx:5`, `documentos-table.tsx:5`) só importam o tipo `ColumnDef` e delegam ao `&lt;DataTable&gt;`.

Modelos habilitados (`data-table.tsx:40-43`): `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel` — com `pageSize: 10` fixo.

| Recurso | Status | Evidência |
|---|---|---|
| Ordenação por coluna | **SIM** ✔ com `aria-sort` correto | `data-table.tsx:71-79` |
| Busca client-side | **SIM** (só nas linhas já carregadas) | `data-table.tsx:52-58` |
| Paginação | **SIM**, mas `pageSize` fixo em 10 e **sem seletor** de linhas por página | `data-table.tsx:43`, `:116-140` |
| **Toggle de densidade** | **NÃO** | padding fixo `14px 16px` em `data-table.css` (`.nos-dt__td`) |
| **Colunas redimensionáveis** | **NÃO** | `columnResizeMode` ausente; nenhum `getSize()`/handle de resize |
| **Sticky header** | **NÃO** | `.nos-dt__th` em `apps/web/components/data-table.css` não tem `position: sticky` — o header some ao rolar dentro de `.nos-dt__scroll` (`overflow-x: auto`, sem `max-height`) |
| **Virtualização** | **NÃO** | `@tanstack/react-virtual` não está instalado |
| Toggle de visibilidade de colunas | **NÃO** | `getColumnVisibility`/`VisibilityState` ausentes |
| Seleção de linhas + ação em massa | **SIM, só em Obras** | `obras-table.tsx:179-183` (`enableRowSelection`), barra sticky de bulk archive em `obras-table.tsx:245-296` |
| Persistência de sort/filtro | **NÃO** | `useState` puro (`data-table.tsx:31-32`), perde tudo ao navegar |

Observação de arquitetura: `obras-table.tsx:150-350` é uma cópia manual de ~200 linhas de `data-table.tsx` (mesmo markup, mesmas classes `nos-dt__*`, mesmo texto de paginação) só para adicionar seleção — então qualquer melhoria de densidade precisará ser feita duas vezes.

---

## Resumo (placar)

| # | Item | Veredito |
|---|---|---|
| 1 | Busca global ⌘K | **NÃO** — input decorativo, `&lt;kbd&gt;⌘K&lt;/kbd&gt;` mentiroso |
| 2 | Atalhos de teclado | **NÃO** — zero listeners |
| 3 | Autofoco | **NÃO** — zero `autoFocus` |
| 4 | Submit com Enter | **SIM** — mas 40 de 41 forms sem estado de pending |
| 5 | Formatação BR | **PARCIAL** — funciona; 11 `formatBRL` + 12 `formatDateTime` duplicados; **sem `timeZone` → datas erradas em prod (UTC)** |
| 6 | Máscara de entrada | **NÃO** — CNPJ/CPF/telefone/CEP/moeda todos crus |
| 7 | Estados vazios | **PARCIAL** — sem componente, sem CTA, não distingue vazio de filtrado |
| 8 | Estados de erro | **PARCIAL** — bom mapeador em `errors.ts`, contornado por 20 `throw` crus + erros do Supabase em inglês na tela; `sonner` montado e nunca usado |
| 9 | Loading/skeleton | **PARCIAL** — 6 `loading.tsx` bons; **0 `error.tsx`, 0 `not-found.tsx`, 0 `&lt;Suspense&gt;`**; `config/*`, `fornecedores/*`, `auditoria`, `whatsapp`, `notificacoes` sem nada |
| 10 | Feedback otimista | **NÃO** — zero `useOptimistic`/`useTransition` |
| 11 | Undo | **PARCIAL** — soft-delete + Restaurar existe; nenhum "Desfazer"; `window.confirm()` nativo |
| 12 | KPIs com história | **PARCIAL** — sparklines e captions reais; só 1 de 4 com delta verdadeiro; **sem alerta de orçamento na UI** |
| 13 | Impressão | **NÃO** — zero `@media print`, sem link público |
| 14 | Onboarding | **NÃO** — nada |
| 15 | Densidade | **PARCIAL** — TanStack v8 usado só para sort/filter/paginate; sem densidade, resize, sticky header ou virtualização |

**Os três consertos de maior retorno percebido:** (a) implementar de verdade o ⌘K que a topbar já anuncia — a promessa quebrada é pior que a ausência; (b) criar `lib/format.ts` único com `timeZone: 'America/Sao_Paulo'`, eliminando as 23 cópias e corrigindo o bug real de data em produção; (c) adicionar `error.tsx`/`not-found.tsx` e disparar os toasts do `sonner` que já estão montados, para que erro deixe de ser recarga de página com o formulário perdido.
