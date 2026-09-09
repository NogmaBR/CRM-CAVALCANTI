> **Recuperado do transcript da sessao de 2026-09-09** (VS Code fechou antes de consolidar).
> Agente: Agent "Auditar jornada e atrito dos fluxos" finished
> Custo: 166359 tokens, 41 tool calls

Análise completa. Relatório abaixo.

---

# Auditoria de atrito — 5 jornadas do gestor de obras

Todos os caminhos são relativos a `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\apps\web\`.

---

## Achados transversais (valem para as 5 jornadas)

**1. Sonner instalado, montado e NUNCA usado.**
`app/(app)/layout.tsx:2` importa `Toaster` de `sonner` e monta em `app/(app)/layout.tsx:9-17` (`richColors`, `top-right`, `closeButton`). Mas um grep por `toast.` em `app/`, `components/` e `lib/` retorna **zero ocorrências**. Nenhuma ação dispara toast. Todo feedback é feito via `?success=`/`?error=` na querystring, renderizado como banner estático. O componente é peso morto no bundle.

**2. Nenhum formulário usa `useActionState`/`useFormState`. Erro = perda total do que foi digitado.**
Grep confirma: `useFormStatus` aparece só em `app/(auth)/definir-senha/definir-senha-form.tsx:3`. Nenhum `useActionState`/`useFormState` em lugar nenhum. Todas as server actions tratam erro com `redirect(...?error=msg)` — ex. `app/(app)/obras/actions.ts:31`, `app/(app)/fornecedores/actions.ts:32`, `app/(app)/pagamentos/actions.ts:25`, `app/(app)/documentos/actions.ts:37`. Como os forms usam `defaultValue` (`app/(app)/obras/obra-form.tsx:43`, `:97`, `:106`…) e o redirect recarrega a página `novo` sem os dados, **o usuário reescreve o formulário inteiro a cada erro de validação**. Pior no caso de documentos: perde também o arquivo selecionado.

**3. Nenhum botão de submit tem estado de carregando/disabled.**
`components/nogma/Button.tsx` não tem prop `loading`/`pending` (grep por `loading|pending|disabled` no arquivo: nada). Combinado com a ausência de `useFormStatus` em todos os forms de CRUD, **duplo-clique dispara duas submissões**. Só `definir-senha-form.tsx:9-23` protege via `useFormStatus`.

**4. Zero `autoFocus` no projeto.** Grep por `autoFocus|autofocus` em `app/` e `components/`: nenhuma ocorrência. Todo formulário exige clique no primeiro campo.

**5. Zero máscaras de input.** Grep por `imask|react-input-mask|maskito|cleave|react-number-format`: nada. CNPJ/CPF é campo texto puro com `maxLength={20}` (`app/(app)/fornecedores/fornecedor-form.tsx:62-69`); CEP é texto com `maxLength={9}` e placeholder `00000-000` (`app/(app)/obras/obra-form.tsx:124`); telefone é `type="tel"` com placeholder `(00) 00000-0000` (`fornecedor-form.tsx:120-127`); valor é `&lt;input type="number" step="0.01"&gt;` (`app/(app)/pagamentos/pagamento-form.tsx:127-137`) — ou seja, o gestor digita `1.234,56` e o browser rejeita silenciosamente (número HTML só aceita ponto decimal). **Não há máscara de moeda BRL em nenhum lugar.**

**6. Submit com Enter: funciona** — são `&lt;form&gt;` nativos com `&lt;Button type="submit"&gt;` (`obra-form.tsx:181`, `fornecedor-form.tsx:146`, `pagamento-form.tsx:195`). Exceção: `app/(app)/login/login-form.tsx:73` tem `disabled={!captchaToken}`, então Enter não faz nada até resolver o hCaptcha.

**7. Ações destrutivas: 1 confirmação em todo o app.**
- **Único `window.confirm`** de arquivamento: `app/(app)/obras/obras-table.tsx:200-206` (bulk archive de obras) — e a mensagem sequer é acentuada: `"Arquivar N obra(s)? A acao e reversivel..."`.
- `app/(app)/fornecedores/duplicatas/merge-buttons.tsx:30` — `window.confirm` para merge.
- **Sem nenhuma confirmação:** arquivar obra individual (`app/(app)/obras/[id]/page.tsx:111-117`), arquivar pagamento (`app/(app)/pagamentos/[id]/page.tsx:105`), arquivar documento (`app/(app)/documentos/[id]/page.tsx:86`), arquivar fornecedor (`app/(app)/fornecedores/[id]/page.tsx:69`), arquivar usuário (`app/(app)/config/usuarios/page.tsx:114-120`), cancelar convite (`config/usuarios/page.tsx:138-144`). **Um clique acidental arquiva.**
- **Undo:** não existe botão "desfazer". Existe `restoreObra`/`restorePagamento`/`restoreDocumento`/`restoreFornecedor`, mas o usuário precisa saber ir na aba "Arquivados" e clicar "Restaurar" (`obras/actions.ts:147`, `pagamentos/actions.ts:160`, `documentos/actions.ts:207`). Nenhuma mensagem pós-arquivamento menciona isso.
- Não há `AlertDialog`/modal de confirmação em lugar nenhum — Radix Dialog só é usado no menu mobile (`components/layout/mobile-nav.tsx:21-46`).

**8. Após criar algo, sempre redireciona para o DETALHE, nunca para a lista.**
`obras/actions.ts:58` → `/obras/{id}`; `fornecedores/actions.ts:66` → `/fornecedores/{id}`; `pagamentos/actions.ts:97` → `/pagamentos/{id}`; `documentos/actions.ts:148` → `/documentos/{id}`. E **sem mensagem de sucesso** — as páginas de detalhe só leem `?error` (`obras/[id]/page.tsx:78`, `pagamentos/[id]/page.tsx:59`, `documentos/[id]/page.tsx:37`). O gestor cria uma obra e cai numa tela de leitura sem confirmação visual, sem "criar outra".

**9. Filtros: querystring OK; busca e paginação: estado local perdido.**
Compartilháveis (querystring): status/obra/fornecedor/categoria em pagamentos (`app/(app)/pagamentos/page.tsx:38-42` + `pagamentos-filters.tsx:26-35` com `router.push`), documentos (`documentos/page.tsx:27-29`, `documentos-filters.tsx:18-27`), obras (`obras/page.tsx:21-24`), whatsapp (`whatsapp/page.tsx:62-63`), usuários (`config/usuarios/page.tsx:181`).
Perdidos no refresh: a **busca textual e a página** de TODAS as tabelas — `components/data-table.tsx:31-32` (`useState` para `sorting` e `globalFilter`) e `:44` (`pageSize: 10` em `initialState`). Idem `obras-table.tsx:98-100`. O gestor busca "Cimento", clica num item, volta com o botão do browser e **perde a busca, a ordenação e a página**.

**10. `/pagamentos` não está no menu.**
`components/layout/sidebar-nav.tsx:9-18` (NAV) e `:20-24` (SECONDARY) não incluem `/pagamentos`. O único link para a lista está no botão "Voltar" da própria página de detalhe (`pagamentos/[id]/page.tsx:90`). O painel também não linka (`painel/page.tsx` só tem `href="/obras/novo"` na linha 70 e os itens de atividade na 220). **A tela central do produto financeiro só é alcançável por URL digitada ou clicando num pagamento do feed de atividade.**

**11. `/pendentes` no menu sem badge de contagem** (`sidebar-nav.tsx:14`). O gestor não sabe que tem pendência sem entrar na tela.

---

## (a) Pendência do WhatsApp → pagamento confirmado

### Sequência
1. Mensagem chega no webhook `app/api/webhooks/uazapi/route.ts:80` (grava `dados_extraidos: null`); classificação em `lib/services/classify-and-persist.ts:75,110,122,144,179`.
2. Gestor abre **`/whatsapp`** — `app/(app)/whatsapp/page.tsx`. Feed read-only de até 200 itens (`:65`), com filtro por status em querystring (`:74`).
3. Item com status `classificada` mostra link **"Confirmar em Pendentes"** (`whatsapp/page.tsx:147-150`) → **clique 1**.
4. **`/pendentes`** — `app/(app)/pendentes/page.tsx`. Card por pendência com valor, data, obra, fornecedor, tipo, NF, descrição e "Raciocínio da IA" (`:129-193`) + barra de confiança (`:42-59`).
5. Botão **"Confirmar"** (`pendentes/page.tsx:215-225`) → **clique 2**.
6. `confirmarPendencia` (`pendentes/actions.ts:9`) insere o pagamento e redireciona para `/pendentes?success=Pagamento criado com sucesso.` (`:144`).

**Total: 2 cliques no caminho feliz** (3 se contar entrar em `/whatsapp` ou `/pendentes` pelo menu). Esse fluxo é o menos atritado do app.

### Onde trava / perde trabalho
- **Não existe edição dos campos extraídos.** O card em `pendentes/page.tsx:129-193` renderiza tudo como `&lt;span&gt;`, não como input. Se a IA errou o valor ou a obra, não há como corrigir antes de confirmar.
- **Beco sem saída quando falta obra ou valor.** `pendentes/actions.ts:51-57` bloqueia e manda a mensagem: *"Faltam dados obrigatórios (valor e obra). Use a mensagem original em /whatsapp para editar manualmente."* — mas **`/whatsapp` não tem edição nenhuma**: `whatsapp/page.tsx` é 100% leitura, sem `&lt;form&gt;`. **A instrução do erro aponta para uma funcionalidade que não existe.** O gestor fica preso: nem confirma, nem corrige. A única saída é rejeitar e recadastrar o pagamento à mão em `/pagamentos/novo`.
- **Não existe reprocessar/reclassificar.** Grep por `reprocess|reclassific` em `app/` e `lib/`: só comentários (`pendentes/actions.ts:62`). Não há ação de reenviar a mensagem para a IA.
- **Rejeitar não pede confirmação e é irreversível pela UI.** `pendentes/page.tsx:202-213` submete direto; `rejeitarPendencia` (`actions.ts:147`) grava `status: 'erro'` e `resolvida: true` (`:157-169`). Não há "desrejeitar".
- Confirmação **não** faz link do documento/anexo da mensagem (`midia_mime` é exibido em `pendentes/page.tsx:114-119`, mas o insert em `actions.ts:77-87` não cria registro em `documentos`). A NF que veio no WhatsApp continua fora do módulo Documentos.
- Banner de sucesso fica **preso na URL**: `/pendentes?success=...` (`actions.ts:144`) permanece a cada F5 (`pendentes/page.tsx:86-90`). Sem auto-dismiss, sem toast.
- Sem link do card para o pagamento recém-criado — o `pagamentoId` existe em `actions.ts:120` mas o redirect volta para a lista.

### O que falta
Edição inline dos campos extraídos antes de confirmar; ação "reprocessar"; confirmação para rejeitar; toast + link direto para o pagamento criado; badge de contagem no menu; anexar a mídia da mensagem como documento.

---

## (b) Cadastrar obra nova + primeiros fornecedores

### Sequência
1. `/painel` → botão "Nova Obra" (`painel/page.tsx:70`) ou `/obras` → "Nova Obra" (`obras/page.tsx:37-42`) — **clique 1**.
2. **`/obras/novo`** — `app/(app)/obras/novo/page.tsx:15` renderiza `ObraForm mode="create"`.
3. Preencher e submeter (`obra-form.tsx:181`) — **clique 2**.
4. `createObra` (`obras/actions.ts:26`) → `redirect('/obras/{id}')` (`:58`), sem toast.
5. Para o fornecedor: **sair da obra**, ir no menu → `/fornecedores` (`sidebar-nav.tsx:15`) → "Novo Fornecedor" → `/fornecedores/novo` (`fornecedores/novo/page.tsx`).

### Campos obrigatórios
- **Obra: só `nome`** (`obra-form.tsx:39-46`, `required`). Todo o resto é opcional: cliente, tipo, status (default `ativa`, `:75`), orçamento, datas, endereço inteiro, apelidos, observações. Ótimo do ponto de vista de atrito de entrada — mas o form apresenta **4 fieldsets e ~15 campos** de uma vez (`:35`, `:87`, `:120`, `:150`), sem progressive disclosure. Visualmente parece um formulário longo quando na prática só um campo é exigido.
- **Fornecedor: só `nome`** (`fornecedor-form.tsx:43-50`). Documento, razão social, categoria, telefone, e-mail: opcionais.
- **Pagamento: `obra_id`, `valor`, `data_pagamento`** (`pagamento-form.tsx:73`, `:133`, `:144` — `data_pagamento` já vem com hoje via `todayISO()`, `:10-13`).

### Onde trava / perde trabalho
- **Não dá para criar fornecedor de dentro de nenhum outro form.** `pagamento-form.tsx:88-103` e `documento-form.tsx:198-214` só têm `&lt;select&gt;` populado por props; não há botão "+ novo fornecedor", nem modal, nem combobox creatable. O gestor está registrando um pagamento, descobre que o fornecedor não existe, e **precisa abandonar o form (perdendo tudo — não há rascunho), cadastrar o fornecedor, e recomeçar**. Mesma coisa para obra e categoria.
- **`Cancelar` é um `&lt;Link&gt;` que descarta sem aviso** (`obra-form.tsx:178-180`, `fornecedor-form.tsx:143-145`, `pagamento-form.tsx:192-194`). Sem "tem certeza?".
- **Erro de validação limpa o formulário** (ver achado transversal 2): `obras/actions.ts:28-32` monta a mensagem com o primeiro issue do Zod e redireciona para `/obras/novo?error=...`. O `ObraForm` recebe só `error` (`obras/novo/page.tsx:15`), nunca os valores digitados.
- **Erro genérico, não ancorado no campo.** A mensagem é `${first.path.join('.')}: ${first.message}` (`obras/actions.ts:30`) exibida num banner no topo (`obra-form.tsx:29-33`). O `Input` tem prop `error` (`components/nogma/Input.tsx:13,60-61`) que **nunca é usada em nenhum form** — o suporte a erro por campo existe e está morto.
- Apelidos como CSV em campo de texto (`obra-form.tsx:154-160`) — sem chips, sem validação. `createObra` faz split no schema.
- UF sem `&lt;select&gt;`, apenas `textTransform: uppercase` visual (`obra-form.tsx:139-145`) — o valor enviado pode ser minúsculo.
- CEP não busca endereço (sem ViaCEP): `obra-form.tsx:124` é campo solto. Rua/número/bairro/cidade/UF são todos digitados à mão.
- Documento (CNPJ/CPF): `fornecedor-form.tsx:67` promete *"validado por dígito verificador"* — a validação é server-side (`lib/schemas/fornecedor.ts`), então o erro só aparece **depois** do submit, e leva junto o formulário inteiro.

---

## (c) Fechar o mês e gerar relatório

### Sequência
1. Menu → **"Relatórios"** (`sidebar-nav.tsx:21`) — **clique 1**.
2. **`/relatorios`** — `app/(app)/relatorios/page.tsx:19` renderiza 4 cards (`relatorios-forms.tsx:359-367`).
3. Card "Fechamento Mensal" (`relatorios-forms.tsx:125-176`) já vem com o mês corrente preenchido (`:126` + `currentMonth()` `:20-22`). Ajustar se quiser — **clique 2 (opcional)**.
4. Clicar "Baixar PDF" ou "Baixar CSV" (`relatorios-forms.tsx:159-172`) — **clique 3**.
5. `GET /api/exports/mes?ano=..&amp;mes=..&amp;format=pdf` (`app/api/exports/[tipo]/route.ts:116`), auth em `:121-128`, dados em `:209`, PDF renderizado em `:227-235`.

**Total: 2–3 cliques.** Fluxo curto e bem construído.

### Onde trava / perde trabalho
- **Nenhum preview.** Não existe rota/tela que mostre o conteúdo do relatório antes de baixar. `DownloadLink` (`relatorios-forms.tsx:33-62`) é um `&lt;a target="_blank"&gt;` puro para a API. O gestor baixa às cegas — se o mês estiver vazio, descobre abrindo o PDF.
- **Zero feedback de progresso.** `renderToBuffer` do `@react-pdf/renderer` (`route.ts:59`) roda no servidor para o mês inteiro; para um mês grande são vários segundos com **nenhum spinner, nenhum estado disabled, nenhuma indicação de que algo está acontecendo** — o `&lt;a&gt;` só abre uma aba em branco. Nada em `relatorios-forms.tsx` observa o download.
- **Sem tratamento de erro visível.** Se a API responder 400 (`route.ts:159-167`) ou 404 (`:177-179`, `:244-249`), o usuário vê **JSON cru numa aba nova**. Ex.: `{"error":"obra não encontrada"}`.
- **Não existe histórico de gerações.** Nenhuma tabela/tela registra exports. Não dá para saber se o fechamento de janeiro já foi gerado, por quem, ou rebaixar o mesmo arquivo.
- **Filtro de período inconsistente entre cards:** "Fechamento Mensal" só aceita `&lt;input type="month"&gt;` (`:147-154`) — não dá para fechar um intervalo customizado (ex. 21/01 a 20/02, comum em regime de competência de obra). "Fornecedor" tem De/Até opcionais (`:227-250`), "Atividade" tem De/Até obrigatórios com default 30 dias (`:277-278`). "Obra" **não tem filtro de período nenhum** (`:66-121`) — sempre traz a obra inteira.
- **Botão desabilitado sem explicar.** `DownloadLink` com `disabled` vira `href="#"` + `aria-disabled` + `tabIndex={-1}` (`:48-56`) — cinza e mudo, sem tooltip dizendo "selecione uma obra".
- Estado dos cards é `useState` local (`:67`, `:126`, `:181-183`, `:277-278`): a seleção **não vai para a URL**, então não é compartilhável nem sobrevive a refresh.
- `/api/exports/` está na allowlist do middleware (`lib/supabase/middleware.ts:41`) — a proteção fica só no handler (`route.ts:126`), o que está correto, mas significa que um erro de auth retorna 401 JSON numa aba nova em vez de mandar para o login.

---

## (d) Subir nota fiscal e vincular

### Sequência
1. Menu → "Documentos" (`sidebar-nav.tsx:12`) → botão "Novo Documento" (`documentos/page.tsx:68-71`) — **clique 1**.
2. **`/documentos/novo`** — `app/(app)/documentos/novo/page.tsx:24`. Carrega **todas** as obras, **todos** os pagamentos e **todos** os fornecedores não arquivados (`:15-17`).
3. Selecionar arquivo (`documento-form.tsx:70-85`) — **clique 2 + diálogo do SO**.
4. Escolher tipo (`:120-132`, default `nota_fiscal`), obra (`:163-179`), opcionalmente pagamento (`:186-196`) e fornecedor (`:203-213`).
5. Submeter (`:222`) — **clique 3**.
6. `createDocumento` (`documentos/actions.ts:31`): valida meta (`:33`), valida arquivo (`:42`), lê buffer (`:49`), checa magic bytes (`:53`), calcula SHA-256 (`:58`), insere linha com `storage_path: 'pending'` (`:75`), sobe pro Storage (`:108`), atualiza path (`:118`), redireciona para `/documentos/{id}` (`:148`).

### Respostas diretas
- **Drag and drop: NÃO.** `documento-form.tsx:70-85` é um `&lt;input type="file"&gt;` nativo. A borda tracejada (`border: '1px dashed'`, `:78`) **simula visualmente** uma dropzone mas não há `onDrop`/`onDragOver` em lugar nenhum — é engano visual puro.
- **Upload múltiplo: NÃO.** Sem atributo `multiple` (`:70-75`). Uma NF por vez, com o formulário inteiro reperguntado a cada arquivo.
- **Progresso: NÃO.** Server action com `&lt;form action&gt;` nativo, sem `useFormStatus`, sem barra, sem percentual. Um PDF de 10 MB (`lib/schemas/documento.ts:16`) sobe com a tela congelada e o botão ainda clicável.
- **Vinculação a pagamento: dropdown gigante sem busca.** `documento-form.tsx:186-196` renderiza **todos** os pagamentos não arquivados num `&lt;select&gt;` nativo, com label `"{data} · {valor}"` (`:192`) — sem obra, sem fornecedor, sem NF. Com centenas de pagamentos vira uma lista de datas e valores indistinguíveis. Não filtra pela obra já escolhida no campo acima. Mesmo problema no select de obras (`:163-179`) e fornecedores (`:203-213`), e no `pagamento-form.tsx:69-102`.

### Detecção de duplicata por hash
- Hash calculado em `documentos/actions.ts:58` via `sha256Hex` (`lib/storage/documents.ts:9-11`) e gravado em `hash_sha256` (`actions.ts:78`).
- Detecção é **reativa, via constraint do Postgres**: `actions.ts:86-92` inspeciona `error.code === '23505'` e o texto da mensagem para distinguir `idx_documentos_hash` de `idx_documentos_chave_nf`, produzindo *"Arquivo idêntico já existe (mesmo conteúdo). Verifique documentos anteriores."*
- **Como comunica: mal.** O erro vira `redirect('/documentos/novo?error=...')` (`:93-100`), o que significa: **arquivo selecionado perdido, tipo perdido, obra perdida, NF perdida** — tudo refeito. E a mensagem manda "verifique documentos anteriores" **sem linkar o documento duplicado**, mesmo tendo o hash em mãos para encontrá-lo. Não há checagem prévia (pré-flight por hash antes de subir) nem opção "ver o existente".
- O `hash_sha256` **nunca é exibido na UI**: grep por `hash_sha256` em `app/**/*.tsx` retorna zero. A página de detalhe (`documentos/[id]/page.tsx`) mostra nome, MIME, tamanho, NF, chave — não o hash.

### Outros pontos
- **Não é possível trocar o arquivo depois.** `documento-form.tsx:105-107`: *"Para trocar o arquivo, arquive este documento e crie um novo."* Corrigir a obra de uma NF exige refazer o upload.
- Download gera signed URL de 60 s (`documentos/actions.ts:242`, `lib/storage/documents.ts:57`) via server action + `redirect(url)` (`:247`) — funciona, mas se o usuário voltar e clicar de novo com o link expirado, o erro vira `?error=` na página de detalhe.
- Sem preview/thumbnail do PDF ou da imagem em `documentos/[id]/page.tsx` — mesmo com MIME de imagem, só metadados.
- Rollback de falha de upload é bem feito (`actions.ts:107-125`), mas a mensagem que chega ao usuário é a exceção crua do Storage (`:111`).

---

## (e) Primeiro acesso de usuário convidado

### Sequência (admin)
1. Menu → "Configurações" → `/config/usuarios` (`config/usuarios/page.tsx`, guarda de admin em `:169-177`) — **clique 1–2**.
2. Botão "Convidar" (`:204-210`) → **`/config/usuarios/convidar`** — **clique 3**.
3. Preencher email, nome, papel (`convidar/page.tsx:53-91`; papel default `leitura`, `:83`) — **clique 4**.
4. `convidarUsuario` (`config/usuarios/actions.ts:43`) → `assertAdmin()` (`:44`) → `inviteUsuarioAdmin` (`:59`).

### Sequência (convidado)
5. **O convite manda email: SIM.** `lib/data/usuarios.ts:129-132` chama `admin.auth.admin.inviteUserByEmail(email, { data: {nome, papel}, redirectTo })`, com `redirectTo = ${NEXT_PUBLIC_APP_URL}/definir-senha` (`:126-127`, fallback hardcoded `https://crm-cavalcanti.vercel.app`). Quem envia é o Supabase Auth — **não há template customizado no repo**, então o convidado recebe o e-mail padrão do Supabase, sem branding Nogma/Cavalcanti e sem explicar o que é o produto.
6. Clica no link → `/definir-senha?code=...` — `app/(auth)/definir-senha/page.tsx:32-39` troca o code por sessão (PKCE).
7. **O usuário define a senha: SIM.** `definir-senha-form.tsx:27-50`, dois campos com `minLength={8}`; `definirSenha` (`definir-senha/actions.ts:17`) valida com Zod (`:7-15`) e chama `updateUser({ password })` (`:37`).
8. Redirect para `/painel?success=Senha definida. Bem-vindo ao Gestor de Obras.` (`definir-senha/actions.ts:42`).

### Onde trava / perde trabalho
- **A mensagem de boas-vindas nunca aparece.** `app/(app)/painel/page.tsx:38` — `export default async function PainelPage()` — **não recebe `searchParams`**, e não há nenhuma leitura de `success` no arquivo. O único texto de "vazio" no painel é `"Nenhuma atividade nas ultimas 48h."` (`:192`). O `?success=` de `definir-senha/actions.ts:42` é **silenciosamente descartado**: o usuário define a senha e cai num dashboard sem uma palavra de confirmação. Como não há toast (achado 1), a única boa-vinda do produto se perde.
- **Não existe onboarding nem estado vazio de dia 1.** Sem obras, o painel renderiza KPIs zerados e gráficos vazios (`painel/page.tsx:40-45` chama `getKpisResumo`, `getSerieMensal`, `getGastoPorCategoria` sem nenhum caminho alternativo para base vazia). Não há checklist, tour, nem card "comece cadastrando sua primeira obra". As únicas mensagens de vazio estão nas tabelas (`obras-table.tsx:350` — *"Nenhuma obra encontrada. Clique em 'Nova Obra' para comecar."*) e no `DataTable` (`components/data-table.tsx:29`), ou seja, o usuário precisa navegar até uma lista para receber alguma orientação.
- **"Esqueci a senha" está desativada.** `login-form.tsx:62-64`: `&lt;span className="nos-login__link--disabled" title="Em breve"&gt;Esqueci a senha&lt;/span&gt;` — não é link, não faz nada. Se o convidado perder o e-mail ou o link expirar, **depende de um admin reenviar o convite** (`config/usuarios/page.tsx:131-137`).
- **Login exige hCaptcha e o botão fica travado.** `login-form.tsx:73` — `disabled={!captchaToken}`. Se `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` não estiver setada, o widget não renderiza (`:48-58`) mas o botão **continua permanentemente desabilitado** — login impossível, sem mensagem explicando.
- **Erro de login com mensagem crua da Supabase.** `login/actions.ts:26` faz `redirect('/login?error=' + error.message)` — o usuário vê `"Invalid login credentials"` em inglês.
- Login com `noValidate` (`login-form.tsx:28`) desliga validação nativa do browser; a checagem de vazio só ocorre no servidor (`login/actions.ts:12-14`), com redirect que limpa a senha.
- `definirSenha` **não valida força de senha** além de 8 caracteres (`definir-senha/actions.ts:9`), embora o hint prometa *"pelo menos 8 caracteres com letras e números"* (`definir-senha-form.tsx:37`). Promessa não cumprida pela validação.
- Descrição dos 4 papéis é despejada em bloco abaixo do select (`convidar/page.tsx:94-101`) — todos os papéis listados sempre, em vez de mostrar só o selecionado.
- Convite bem-sucedido redireciona para `/config/usuarios?success=Convite enviado` (`config/usuarios/actions.ts:74`) e a página **realmente lê** `success`/`error` (`config/usuarios/page.tsx:184-185`, banners `:212-222`). É uma das poucas telas com feedback de sucesso funcionando — junto com `/obras` (`obras/page.tsx:23-24` → `obras-table.tsx:211-226`) e `/pendentes` (`pendentes/page.tsx:86-90`). Todas as outras listas (`/pagamentos`, `/documentos`, `/fornecedores`) **não leem `?success`/`?error`** (`pagamentos/page.tsx:31-36`, `documentos/page.tsx:25`, `fornecedores/page.tsx:18`) — então redirects como `pagamentos/actions.ts:145` (`/pagamentos?error=ID inválido`) e `fornecedores/actions.ts:114` produzem **erro invisível**.
- `middleware.ts:12` protege tudo exceto assets; `lib/supabase/middleware.ts:43-46` redireciona anônimo para `/login` e `:47-50` manda logado que acessa `/login` para `/painel`. **Não há verificação de papel no middleware** — o gate de admin é feito por página (`config/usuarios/page.tsx:177` com `notFound()`), o que retorna 404 em vez de "acesso negado", confundindo um usuário de leitura que clique num link.

---

## Resumo dos 10 atritos de maior impacto

| # | Atrito | Evidência |
|---|---|---|
| 1 | Erro de validação apaga o formulário inteiro (inclusive o arquivo do upload) | `obras/actions.ts:31`, `documentos/actions.ts:37,93`; nenhum `useActionState` no repo |
| 2 | Toast instalado e nunca chamado — sucesso invisível na maioria das ações | `app/(app)/layout.tsx:9`; zero `toast.` no código |
| 3 | Pendência sem obra/valor vira beco sem saída; erro aponta para tela de edição inexistente | `pendentes/actions.ts:51-57` vs. `whatsapp/page.tsx` (read-only) |
| 4 | Arquivar obra/pagamento/documento/fornecedor/usuário sem confirmação nem undo | `obras/[id]/page.tsx:111`, `pagamentos/[id]/page.tsx:105`, `documentos/[id]/page.tsx:86`, `config/usuarios/page.tsx:114` |
| 5 | Impossível criar fornecedor/obra sem abandonar o formulário atual | `pagamento-form.tsx:88-103`, `documento-form.tsx:198-214` |
| 6 | `/pagamentos` fora do menu | `components/layout/sidebar-nav.tsx:9-24` |
| 7 | Upload sem drag&amp;drop, sem múltiplos, sem progresso; duplicata por hash perde o arquivo e não linka o original | `documento-form.tsx:70-85`, `documentos/actions.ts:86-100` |
| 8 | Relatórios sem preview, sem progresso, sem histórico; erro vira JSON cru | `relatorios-forms.tsx:33-62`, `api/exports/[tipo]/route.ts:159-167` |
| 9 | Busca/ordenação/paginação das tabelas perdidas no refresh e no "voltar" | `components/data-table.tsx:31-32,44` |
| 10 | Primeiro acesso sem boas-vindas e sem onboarding: `?success` do painel é descartado | `definir-senha/actions.ts:42` vs. `painel/page.tsx:38` (sem `searchParams`) |

Nenhum arquivo foi alterado.
