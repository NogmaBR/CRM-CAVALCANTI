# Conversa premium no WhatsApp: o agente que acompanha quem manda foto o dia inteiro

**Data:** 2026-09-19 · **Para:** apresentação ao Cavalcanti em **23/09** · **Base:** conversa
real de 17/09 no grupo "Teste - 2" + resumo da reunião (Granola) de 18/09.

> Como ler: a §1 é o diagnóstico (o que a conversa mostrou e a causa no código); a §2 é o
> contrato de conversa que o agente passa a cumprir; a §3 é o desenho de cada bloco; a §4
> é a ordem de execução até 23/09; a §5 é a prova; a §6 é o que só o Cavalcanti decide.

---

## 0. Em uma página

O agente já faz o núcleo do contrato (lê a nota, pergunta, grava no SIM, guarda arquivo,
anota diário, responde sobre a obra, cadastra com confirmação). O que a conversa de 17/09
mostrou é que ele **não se comporta como alguém que está do outro lado de uma conversa**:
não lê citação (responder "sim" *em cima* de uma mensagem), não entende reação (👍), não
sabe que 3 fotos seguidas são uma coisa só, não aceita correção ("não, é outra obra") sem
cancelar tudo, não desfaz ("cancela isso"), e gruda na última obra citada por duas horas.

O plano corrige isso em **sete blocos**, na ordem em que um destrava o outro:

| # | Bloco | O que muda para o Cavalcanti |
|---|---|---|
| A | **Fundação: rastro das respostas do bot + citação + reação** | Responder "sim" em cima de uma pergunta resolve *aquela*; 👍 na pergunta = SIM; nada de "não entendi" para reação/figurinha |
| B | **Lote (janela de silêncio)** | 5 fotos seguidas = uma pergunta ("Recebi 5 fotos. De qual obra?"); foto + "Inox" 2 s depois = a foto vai para a INOX; 3 comprovantes = uma lista numerada e um SIM |
| C | **Pendências por conversa** | O SIM resolve o que foi citado; sem citação, a última; com 2+ abertas, o bot pergunta qual (ou "SIM TODOS"). Qualquer autorizado do grupo pode confirmar |
| D | **Corrigir e desfazer** | "não, é na INOX" troca a obra e reconfirma em uma linha; "desfaz" / "cancela isso" (citando ou até 30 min) desfaz o último lançamento/arquivo/anotação |
| E | **Memória e contexto** | 20 mensagens / 24 h, **incluindo o que o bot respondeu**; a obra "da conversa" expira em 30 min e morre na primeira correção; prompt sem exemplos da Garibaldi |
| F | **Linguagem e organização** | "Li o comprovante" só com arquivo; "Ouvi o áudio"; "Entendi assim"; respostas de lote; link direto para o item no painel; categorias fixas + "Outros"; fornecedor aprende |
| G | **Painel, automações e operação** | Inbox por conversa em `/whatsapp`; coluna "Comprovante" na lista; PDF "Cavalcanti Construções"; painel simplificado para o cliente; lembrete de pendência aberta; retenção de 1 ano |

**Até 23/09 entram A–F e a metade de G** (coluna, PDF, inbox). O resto de G é a semana
seguinte. Tudo continua passando pela confirmação SIM — isso não muda.

---

## 1. Diagnóstico: o que a conversa de 17/09 mostrou

Cada linha é um momento real da conversa, a causa no código de hoje e o bloco que corrige.

| Momento (17/09) | O que aconteceu | Causa (arquivo:linha) | Bloco |
|---|---|---|---|
| 15:41 · 👍 | "Não entendi o que fazer com essa mensagem" | Reação chega como mensagem; o adaptador descarta `reaction` (`lib/webhooks/adaptar-uazapi.ts:107-172`); emoji solto sem pendência do remetente cai em `nao_identificado` | A |
| 15:39 · figurinha | "Recebi o arquivo. De qual obra ele é?" | `sticker` vira `imagem` (`lib/schemas/uazapi.ts:38`) e entra no classificador como anexo | A |
| 15:45 · "nao , e outra obra?" (em cima da pergunta de R$ 109,99) | Foi para o assistente, que listou as obras. A pendência ficou aberta | `interpretarResposta` é conservador de propósito (`lib/whatsapp/resposta.ts`): "não" + texto = `outro`. Não existe intenção *corrigir* | D |
| 15:46 · "Não é Garibaldi" citando o PDF | "Não entendi" | `quoted` descartado pelo adaptador; texto de 3 palavras vira `nao_identificado` | A, D |
| 16:05 · foto, e "Inox" 1 s depois | "📁 Guardei na obra **Garibaldi**, pasta Outros" | Sem lote, a foto foi classificada sozinha com a obra padrão; `obraRecente` (`lib/ia/memoria-curta.ts:134`) devolve a última obra citada no chat nas últimas **2 h** — desde o "paguei 1200 na Garibaldi" das 15:41 tudo virou Garibaldi | B, E |
| 16:05 · "Não é na Garibaldi, é em outra obra" | "📝 Anotei no diário" | Texto de 4+ palavras sem `?` e sem valor = `registro_obra` no classificador. Correção não é intenção conhecida | D |
| 16:08 · "Cancela isso" / "Desfaz, não guarda" (citando o "Guardei") | "Não entendi" | Não existe desfazer; o bot não guarda o id das próprias respostas, logo "isso" não aponta para nada | A, D |
| 16:25 · 3 comprovantes seguidos | 3 perguntas + "faltou o valor" | Sem lote: cada mídia abre uma pendência | B |
| 16:26 · "sim" do Hugo | Lançou o **R$ 109,99 na Garibaldi** que o Társis tinha recusado | `buscarConfirmacaoAberta` (`lib/services/confirmacoes.ts:412-420`) busca **por remetente**, a mais recente, `limit(1)`: a do Hugo era a do PDF das 15:44 | C |
| 16:27 · "sim" citando o de R$ 10 | "Recebi o seu SIM, mas faltou um dado" | Citação ignorada; a pendência mais recente do Társis era a incompleta | A, C |
| 16:07 · "Essa ação já foi resolvida" | Frase sem contexto | `RESPOSTAS.acaoJaResolvida` (`lib/whatsapp/textos.ts:189`) não diz *qual* ação nem o que fazer | F |
| reunião · "Li o comprovante" sem arquivo | Linguagem errada | `deAnexo = Boolean(midiaStoragePath)` (`classify-and-persist.ts:383`): figurinha conta como anexo; áudio não tem frase própria | F |
| reunião · IA cria categoria duplicada | **Não acontece hoje** | `classificador-comum.ts:212` só resolve `categoria_nome` contra a lista viva. Falta o balde "Outros" e perguntar quando em dúvida | F |
| reunião · "janela de concatenação de 2 s / Redis" | Não existe no código | O CRM não tem Redis nem janela; cada webhook processa sozinho. O lote é o bloco B, no Postgres | B |

O que **já está certo** e não muda: autorização fechada, só grupo cadastrado, dedupe por
id do provider, SIM explícito antes de gravar, "Apaga todos os dados" recusado, ajuda.

---

## 2. O contrato de conversa (o que o agente passa a garantir)

1. **Nunca grava sem SIM.** Continua. Correção não cancela: ajusta e reconfirma.
2. **Toda resposta do bot tem rastro.** Cada envio fica em `mensagens_enviadas` com o id do
   provider e a entidade a que se refere (pendência, documento, pagamento, registro). É o
   que faz citação, reação, desfazer e memória funcionarem.
3. **Citação vence.** "sim" / "não" / "é na INOX" em cima de uma mensagem do bot age sobre
   **aquela** pendência ou entidade. Sem citação, a mais recente da conversa.
4. **Reação é resposta.** 👍 ✅ 👌 na pergunta = SIM; 👎 ❌ = NÃO; outra reação = nada.
   Figurinha, reação sem alvo e emoji solto sem pendência: **silêncio**, nunca "não entendi".
5. **Sequência é lote.** Mensagens do mesmo remetente no mesmo chat dentro da janela de
   silêncio (8 s, configurável) são uma só entrada: N fotos = um arquivamento; texto + mídia
   = legenda; N comprovantes = uma lista com um SIM.
6. **Pendência é da conversa, não do remetente.** No grupo, qualquer autorizado responde.
   Com 2+ abertas e resposta sem citação, o bot pergunta qual ("1) R$ 8 Maria 2) R$ 16
   Gilvando — ou SIM TODOS").
7. **Desfazer em uma palavra.** "desfaz", "cancela isso", "apaga esse", "não era pra
   guardar" — citando a resposta do bot ou até 30 min depois — desfaz a última ação daquele
   remetente: pagamento arquivado, documento arquivado, registro apagado. Sempre responde o
   que desfez.
8. **A obra da conversa tem prazo curto e obedece à correção.** 30 min, só dentro do mesmo
   chat, e qualquer correção ("não é na Garibaldi") a apaga. Nome citado na mensagem sempre
   vence o padrão. Grupo com obra dedicada continua mandando.
9. **A linguagem diz o que o bot fez de verdade.** "Li o comprovante" só quando leu um
   arquivo; "Ouvi o áudio"; "Entendi assim" para texto; "Vi a foto" para foto sem valor.
   Toda resposta termina com um caminho: link direto para o item no painel, ou a próxima
   coisa que a pessoa pode fazer.
10. **Categoria nunca nasce da IA.** Lista fixa + "Outros"; em dúvida entre duas, pergunta
    numerada. Fornecedor novo: cadastra com confirmação e **aprende** a categoria/apelido
    para as próximas.

---

## 3. Desenho por bloco

### A. Fundação: `mensagens_enviadas`, citação e reação

**Migration `20260919…_mensagens_enviadas.sql`:**

```sql
create table mensagens_enviadas (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null,
  msg_id_uazapi text not null unique,
  texto text not null,
  tipo text not null,                      -- 'pergunta_pendencia' | 'lancado' | 'arquivado' | 'anotado' | 'resposta' | 'aviso'
  em_resposta_a uuid references mensagens_whats(id) on delete set null,
  confirmacao_id uuid references confirmacoes_pendentes(id) on delete set null,
  pagamento_id uuid references pagamentos(id) on delete set null,
  documento_id uuid references documentos(id) on delete set null,
  registro_id uuid references registros_obra(id) on delete set null,
  lote_id uuid,                            -- bloco B
  created_at timestamptz not null default now()
);
-- RLS: leitura para authenticated (a tela /whatsapp mostra), escrita só service_role.
-- Purga junto com a retenção (bloco G).
```

`enviarTexto` (`lib/whatsapp/enviar.ts`) ganha um parâmetro `rastro` e grava a linha depois
do envio; todos os chamadores do inbound passam o `rastro`. Substitui o campo solto
`confirmacoes_pendentes.msg_id_pergunta_uazapi` (mantido por compatibilidade, mas quem lê
passa a ler `mensagens_enviadas`).

**Adaptador** (`lib/webhooks/adaptar-uazapi.ts`): lê `message.quoted` (id da mensagem
citada) → `payload.quotedId`; lê `message.reaction` (id da mensagem reagida) + `text` (o
emoji) → `payload.type = 'reaction'`, `payload.reactionTo`. Schema Zod (`lib/schemas/uazapi.ts`)
ganha os dois campos opcionais e o tipo `reaction`.

**Passo 0 novo no inbound** (antes do dedupe, depois da autorização):

| Entrada | Ação |
|---|---|
| `reaction` cujo alvo está em `mensagens_enviadas` com `confirmacao_id` | 👍✅👌🙏 → `interpretacao='sim'`; 👎❌🚫 → `'nao'`; resto → `ignorada_reacao` em silêncio |
| `reaction` a qualquer outra coisa | `ignorada_reacao`, silêncio, só rastro |
| `sticker` | `ignorada_figurinha`, silêncio, não grava |
| texto só de emoji, sem pendência e sem citação | `ignorada_emoji`, silêncio |
| `quotedId` presente | resolve para `{ pendencia \| documento \| pagamento \| registro \| mensagem_recebida }` via `mensagens_enviadas` / `mensagens_whats.msg_id_uazapi` e entrega ao resto do fluxo como `alvo` |

Testes: `adaptar-uazapi.test.ts` (quoted, reaction, sticker), `inbound-whatsapp.test.ts`
(reação = SIM na pendência certa; figurinha em silêncio; emoji solto em silêncio).

### B. Lote: janela de silêncio no Postgres

Não há Redis nem processo vivo; o webhook roda na Vercel com `maxDuration = 60`. A janela
vive no banco:

1. Webhook **grava a mensagem primeiro** (`mensagens_whats.status = 'em_lote'`,
   `lote_id = null`) e responde 200 ao provider. Isso já resolve o retry.
2. A função **espera `JANELA_LOTE_MS`** (8 000; env `WHATSAPP_JANELA_LOTE_MS`) e então
   pergunta: *sou a mensagem mais recente deste remetente neste chat?* Se não, sai — a
   invocação da mensagem mais nova vai fechar o lote. Se sim, **reivindica** todas as
   `em_lote` do par (chat, remetente) com `UPDATE … SET lote_id = <uuid>, status = 'recebida'
   WHERE status = 'em_lote' RETURNING` — atômico; a perdedora de uma corrida recebe zero
   linhas e sai.
3. O lote é processado como **uma entrada**: `LoteInbound { mensagens[], texto (concatenado,
   na ordem), midias[], quotedId (da última), … }`. Regras de composição, puras e testadas em
   `lib/whatsapp/lote.ts`:

| Composição do lote | Vira |
|---|---|
| 1 mensagem | o fluxo de hoje (sem mudança) |
| texto + 1 mídia (qualquer ordem) | mídia com legenda = o texto |
| N mídias sem valor (fotos, vídeo, projeto) | **um** arquivamento: obra do texto/legenda, senão obra da conversa, senão **uma** pergunta "Recebi N fotos. De qual obra?" com opções; a resposta arquiva todas |
| N comprovantes/notas (com valor) | N classificações em paralelo → **uma** pergunta numerada com os N resumos; "SIM" lança todos; "2 não" recusa o 2; "2 é na INOX" corrige o 2 (bloco D) |
| texto que é pergunta + mídia | mídia arquiva; pergunta vai ao assistente com a mídia como contexto |
| resposta a pendência (sim/não/número) + nada | resolve a pendência (bloco C) |

4. `confirmacoes_pendentes` ganha `lote_id` e `indice_no_lote`; a pergunta numerada é **uma**
   `mensagens_enviadas` ligada a N pendências (tabela ponte `mensagens_enviadas_pendencias`
   ou array `confirmacao_ids uuid[]` — array, mais simples).
5. Fila (`FILA_WHATSAPP=true`): o consumidor faz a mesma reivindicação; a janela passa a ser
   o `vt`/delay do `pgmq.send`. Sem mudança de desenho.

**Latência para o usuário:** resposta 8–10 s depois da última mensagem da sequência (hoje é
~5 s depois de cada). Validar o número com o Cavalcanti (§6); `WHATSAPP_JANELA_LOTE_MS`
muda sem deploy de código.

**Prova:** teste com fake-supabase simulando 3 invocações concorrentes; prova real no grupo
com 5 fotos e com foto + "Inox".

### C. Pendências por conversa, citação primeiro

`buscarConfirmacaoAberta(supabase, { chatId, telefone, quotedAlvo })`:

1. Se há `quotedAlvo.confirmacao` aberta → ela.
2. Senão, pendências abertas **do chat** (grupo) ou do telefone (privado), últimas 24 h,
   ordenadas por `created_at desc`.
3. Uma → ela. Nenhuma → segue o fluxo. **Duas ou mais** e a resposta é sim/não sem citação
   → responde `RESPOSTAS.qualPendencia` (lista numerada com valor + fornecedor + obra, "ou
   SIM TODOS / NÃO TODOS") e abre uma **pendência de escolha** de 10 min; o número escolhe.

`interpretarResposta` ganha `sim todos` / `não todos` / `todos`; `interpretarEscolha` aceita
"2 sim", "2 não", "o 2".

Quem pode confirmar no grupo: qualquer `autorizado` ativo (é o desenho do grupo do
Cavalcanti: ele, o gerente e a Nogma). A resposta do bot diz "✅ Lançado (confirmado por
Hugo)".

### D. Corrigir e desfazer

**Corrigir** — nova camada no roteador, **antes** do modelo, só quando há pendência-alvo
(citada ou a mais recente do chat, ≤ 24 h) e o texto não é sim/não puro:

- Padrões puros (`lib/whatsapp/correcao.ts`): começa com `não|nao|errado|na verdade|troca|
  muda|é na|é da|é o|é a|o valor é|foi dia|fornecedor é` **ou** cita uma obra/fornecedor
  conhecido por nome/apelido.
- Extração pelo modelo com `json_schema` estrito (`lib/ia/correcao.ts`): `{ obra_nome?,
  fornecedor_nome?, valor?, data?, categoria_nome?, descricao?, cancelar: boolean }` —
  campos ausentes = não mexe. Nomes passam por `resolverPorNome` (regra do UUID do §8 do
  CLAUDE.md).
- Aplica o patch em `dados_extraidos` da pendência (`corrigirPendencia` em
  `confirmacoes.ts`, com `erroDeEscrita`), registra o diff em `audit_log`, e reconfirma em
  **uma linha**: "Troquei a obra para INOX Piratini. Lanço R$ 109,99 da VERO? SIM / NÃO".
- Correção **também apaga a obra da conversa** (bloco E) e, se citar obra, passa a ser ela.
- `cancelar: true` ("não, esquece") = recusa como hoje.

**Desfazer** — camada pura no roteador (`pareceDesfazer`: `desfaz|desfazer|cancela isso|
apaga (isso|esse|essa)|não era pra (guardar|lançar|anotar)|tira (isso|esse)|volta`):

- Alvo: a entidade da mensagem citada (`mensagens_enviadas` → `pagamento_id|documento_id|
  registro_id`), senão a última ação **desse remetente** no chat nos últimos 30 min.
- Executa `desfazerAcao` (`lib/services/desfazer.ts`): pagamento → `deleted_at` (arquiva,
  não apaga; auditoria), documento → `deleted_at` (arquivo fica no Storage 30 dias, purga no
  sweep), registro → `deleted_at`, pendência → recusa. Ação executada (obra/fornecedor
  criado) → arquiva se nada aponta para ela, senão diz que não dá e por quê.
- Responde o que desfez: "↩️ Desfeito: a foto saiu da Garibaldi. Quer que eu guarde em
  outra obra? Diga qual." Um desfazer de desfazer não existe — o painel restaura.
- **Mover** é correção sobre entidade: "essa foto é da INOX" citando o "Guardei" →
  `moverDocumento(obraId)`; responde "📁 Movi para INOX Piratini › Fotos".

### E. Memória e contexto

- `memoria-curta.ts`: `MAX_TROCAS` 6 → **20**, `JANELA_HORAS` 2 → **24**. A conversa passa a
  incluir **as respostas do bot** (`mensagens_enviadas`), intercaladas por horário, com
  papel `bot`. É isso que permite "aquela da Casa EJ que você mostrou" funcionar.
- `obraRecente`: janela **30 min**, só o mesmo chat, e respeita `obra_conversa_apagada_em`
  (gravado pela correção e pelo desfazer). Obra citada na mensagem/legenda **sempre vence**
  (já é assim no classificador; o teste passa a afirmar).
- Prompt do assistente (**v5**) e do classificador: exemplos com obra **fictícia** ("Obra
  Exemplo"), nunca uma obra real do cadastro. Regra nova no COMO ESCREVER: "quando a pessoa
  corrigir, reconheça em 3 palavras e siga" e "nunca liste as obras se a pessoa já disse
  qual é".
- Contexto do assistente ganha `pendenciasAbertas` (as do chat) — para "o que está
  faltando confirmar?" responder de verdade — e `ultimasAcoes` (últimas 5 respostas do bot
  com entidade), para "aquela foto de ontem" resolver.

### F. Linguagem, organização e categorias

**Textos** (`lib/whatsapp/textos.ts`, todos com teste de legibilidade):

| Situação | Hoje | Passa a ser |
|---|---|---|
| texto com valor | "Entendi assim. Vou lançar…" | mantém |
| áudio com valor | "Entendi assim" | "Ouvi o áudio. Vou lançar…" |
| foto/PDF de comprovante | "Li o comprovante" | mantém — **só** quando houve arquivo lido |
| foto sem valor | "📁 Guardei na obra X, pasta Fotos" | "📁 Guardei a foto na INOX Piratini › Fotos" + link |
| N fotos | N mensagens | "📁 Guardei 5 fotos na INOX Piratini › Fotos" |
| lançado | "✅ Lançado… menu Pagamentos" | "✅ Lançado R$ 1.200 · Garibaldi · Mathias Velho\n{URL}/pagamentos/{id}" |
| falta comprovante no lançamento por texto | nada | "Quando tiver a nota, manda aqui em cima desta mensagem que eu anexo." (e o anexo citado **anexa ao pagamento** — bloco A) |
| ação já resolvida | "Essa ação já foi resolvida" | "Isso já foi feito às 16:05 (obra Sítio do Pedro criada). Para mudar algo, me diga o quê." |
| não entendi | 3 linhas de exemplo | 1 linha, sem exemplo da Garibaldi: "Não entendi. Se for um gasto, diga o valor e a obra; se for uma dúvida, pergunte normal." — e **nunca** para reação/figurinha/emoji |

`NEXT_PUBLIC_APP_URL` já é lido pelo resumo diário; o link curto vai em toda resposta que criou algo.

**Categorias fixas + "Outros":** categoria `Outros` garantida no seed (migration); o
classificador recebe `categoriaOutrosId` e o prompt manda usar "Outros" quando não encaixa;
quando o modelo devolver duas candidatas (`categoria_nome_alternativa`), a pergunta de
confirmação mostra "Etapa: Estrutura (ou 2 = Alvenaria)". A tela `/config/categorias`
ganha o aviso "esta lista é o plano de contas; a IA nunca cria etapa". **A lista em si é
decisão do Cavalcanti (§6).**

**Fornecedor aprende:** `cadastrar_fornecedor` pergunta a categoria (opções numeradas) e o
apelido; `fornecedor_apelidos` já existe. Pagamento confirmado com fornecedor + categoria
grava `fornecedores.categoria_padrao` se estava vazia — próxima vez não pergunta.

### G. Painel, automações e operação

| Item | O quê | Onde |
|---|---|---|
| **Inbox por conversa** | `/whatsapp` vira lista de conversas (grupo/pessoa) com balões: pessoa à esquerda, bot à direita (`mensagens_enviadas`), cada balão com o link da entidade (pendência, pagamento, documento). Filtro por chat, dia, tipo. Ação "responder pelo painel" | `app/(app)/whatsapp/` |
| **Coluna "Comprovante"** | A coluna "Situação" (PR #45) já pinta de vermelho quem não tem comprovante; a lista de pagamentos ganha coluna própria **Comprovante** (✓ / ✗ vermelho / — recusado) à esquerda de Situação, e o filtro `?comprovante=sem` | `pagamentos/(lista)/` |
| **PDF** | Cabeçalho "CAVALCANTI CONSTRUÇÕES · Relatório", rodapé "Cavalcanti Construções · gerado pelo CRM Nogma"; data de emissão fica (é o que diz "de quando é este número") | `lib/reports/pdf/primitives.tsx:200-217` |
| **Painel simplificado** | Papel `gestor` (o do Cavalcanti) não vê `/config/{whatsapp,automacoes,filas,usuarios,autorizados}` nem Auditoria; sidebar reduzida; `/config` mostra só Perfil, Categorias (leitura), Tema/Texto. Regra em `lib/auth/permissoes.ts` + middleware (`/config/*` exige `admin`) | `components/layout/sidebar.tsx`, `middleware.ts` |
| **Cores** | Painel: cartões com `--chart-1` no destaque; semáforo já colorido. Revisar `--surface-2` cinza do tema claro (contraste) | `styles/tokens/colors.css` |
| **Lembrete de pendência** | Regra agendada `lembrar-pendencias`: pendência aberta há 2 h → "Ficou faltando confirmar: R$ 8 Maria (INOX). SIM / NÃO" citando a pergunta original; uma vez por pendência | `lib/automations/definitions/` |
| **Retenção 1 ano** | Cron `manutencao-mensagens`: `mensagens_whats`, `mensagens_enviadas`, `ai_*` com mais de 365 dias → apaga (mídia do Storage junto); pagamentos/documentos/registros **ficam**. Aviso em `/config/whatsapp`: "conversas ficam 1 ano" | migration + `pg_cron` |
| **Vídeos > 50 MB** | Só com Supabase Pro (o teto por arquivo sobe de 50 MB para muito acima disso). Decisão do Cavalcanti (§6) | `docs/SO-FALTA-VOCE.md` |
| **Entrega de dados no cancelamento** | Script `exportar-tudo.mjs`: CSV por tabela + ZIP dos arquivos por obra/pasta. Documentar no contrato | `scripts/` |

**"Puxar coisas de fora"** (pedido do usuário): duas ferramentas de leitura, com allowlist
e sem custo: `consultar_cnpj` (BrasilAPI — ao cadastrar fornecedor por CNPJ preenche razão
social/endereço e confirma) e `consultar_cep` (ao criar obra com endereço). Perguntas
técnicas gerais ("quantos sacos de cimento por m³?") o modelo responde **marcando** "isso é
referência geral, não dado da obra". Busca na web fica fora até haver caso de uso — cada
ferramenta é um risco de resposta inventada.

---

## 4. Ordem de execução (para 23/09)

Cada PR fecha com os três comandos da §5 do CLAUDE.md, Biome nos arquivos tocados,
`graphify update .` e prova real no grupo "Teste - 2" (roteiro da §5).

| PR | Conteúdo | Dep. | Prazo |
|---|---|---|---|
| **1 · Fundação** | migration `mensagens_enviadas`; `enviarTexto` com rastro; adaptador com `quoted`/`reaction`; passo 0 (reação, figurinha, emoji, alvo citado); textos de F que não dependem de lote ("Ouvi o áudio", link direto, "ação já feita", "não entendi" curto); prompt v5 sem Garibaldi; memória 20/24 h com respostas do bot; `obraRecente` 30 min | — | 19–20/09 |
| **2 · Pendências e correção** | bloco C (por chat, citação primeiro, "qual?"); bloco D (corrigir com patch, desfazer, mover); anexo citado anexa ao pagamento | 1 | 20–21/09 |
| **3 · Lote** | bloco B (`em_lote`, reivindicação, composição), pergunta numerada, "SIM TODOS" | 2 | 21–22/09 |
| **4 · Painel e PDF** | coluna Comprovante + filtro; PDF Cavalcanti; inbox `/whatsapp` (v1: conversa por chat com balões e links) | 1 | 22/09 |
| **5 · Categorias e fornecedor** | "Outros" no seed; alternativa na pergunta; fornecedor aprende; aviso em `/config/categorias` | — | 22/09 (depende da lista da §6) |
| **6 · Operação** | lembrete de pendência; retenção 1 ano; painel simplificado por papel; `consultar_cnpj`/`cep`; `exportar-tudo.mjs` | 1 | semana de 24/09 |

**22/09 à noite: rodada completa do roteiro com o Hugo.** 23/09: apresentação.

---

## 5. Prova

**Unitária** (fake-supabase, sem rede): composição de lote (6 casos), reivindicação
concorrente, pendência por chat com 0/1/N abertas, citação para cada tipo de entidade,
reação → sim/não/ignorada, figurinha/emoji em silêncio, correção (patch parcial, nomes
ambíguos não resolvem), desfazer por citação e por janela, textos legíveis.

**Real contra o modelo** (`TESTE_REAL=1`): extração de correção em 8 frases; classificador
sem viés (foto + "Inox" → INOX Piratini; texto sem obra → null, não Garibaldi).

**Roteiro no grupo "Teste - 2" (substitui a 13.3 do SO-FALTA-VOCE):**

| # | Manda | Tem que acontecer |
|---|---|---|
| 1 | 👍 solto | silêncio |
| 2 | figurinha | silêncio |
| 3 | "paguei 1200 de cimento pro Mathias na Garibaldi" → 👍 **na pergunta** | ✅ Lançado, com link |
| 4 | foto do comprovante, depois "Inox" (2 s) | uma pergunta, obra INOX Piratini |
| 5 | resposta "não, é na Casa EJ" | "Troquei a obra para Casa EJ. Lanço? SIM" → SIM → lançado na Casa EJ |
| 6 | 5 fotos seguidas | "Recebi 5 fotos. De qual obra?" → "2" → "📁 Guardei 5 fotos na Casa EJ › Fotos" |
| 7 | "desfaz" citando o "Guardei" | "↩️ Desfeito…" e as 5 somem da pasta |
| 8 | 3 comprovantes seguidos | uma lista numerada → "SIM TODOS" → 3 lançados |
| 9 | 2 comprovantes, depois "sim" solto | "Qual? 1) … 2) … ou SIM TODOS" |
| 10 | Hugo responde "sim" à pergunta do Társis | lança, "(confirmado por Hugo)" |
| 11 | "o que está faltando confirmar?" | lista as pendências abertas do chat |
| 12 | foto da nota citando o "✅ Lançado" do item 3 | "📎 Anexei a nota ao pagamento de R$ 1.200" e o semáforo do pagamento fica verde |
| 13 | "cadastra o fornecedor Elétrica Silva, CNPJ …" | razão social e endereço vindos da consulta; pergunta a categoria numerada; SIM |
| 14 | texto sem obra 40 min depois do último lançamento | pergunta a obra (não assume a anterior) |
| 15 | "Apaga todos os dados" | recusa (continua) |

**Métricas para a apresentação:** 0 "não entendi" em reação/figurinha; SIM resolve a
pendência certa em 15/15; lote responde em ≤ 12 s após a última mensagem; nenhuma categoria
nova criada pela IA (consulta em `categorias` antes/depois).

---

## 6. O que só o Cavalcanti decide (levar para 23/09)

1. **Janela de lote:** 8 s (proposta) — ele manda foto e escreve o nome da obra em seguida?
2. **Lista fixa de etapas** (plano de contas): as 19 atuais vieram das planilhas dele; o que
   funde e o que vai para "Outros".
3. **Quem confirma no grupo:** qualquer autorizado (proposta) ou só ele.
4. **Vídeos > 50 MB:** essenciais? Se sim, Supabase Pro (custo mensal) — senão ficam no
   Drive com link.
5. **Retenção de conversa:** 1 ano (proposta da reunião).
6. **Painel simplificado:** o que ele quer ver em `/config` — só perfil e tema?
7. **PDF:** "Cavalcanti Construções" no cabeçalho, data de emissão fica.

---

## 7. Riscos e como estão cobertos

| Risco | Cobertura |
|---|---|
| Espera de 8 s na Vercel estoura em rajadas | `maxDuration = 60`; cada invocação espera uma vez; com `FILA_WHATSAPP` o delay vai para o `pgmq` e a função não espera |
| Correção pelo modelo troca o campo errado | Patch **parcial** e nomes resolvidos contra o cadastro (`resolverPorNome`, ambíguo = não resolve); a reconfirmação mostra o que mudou; SIM continua obrigatório |
| Desfazer apaga coisa de verdade | Tudo é `deleted_at`; restauração pelo painel; auditoria com quem/quando |
| Pendência por chat deixa qualquer um confirmar | Só `autorizados` ativos; a resposta nomeia quem confirmou; §6.3 pode restringir a papel |
| Mais contexto = mais custo por pergunta | 20 trocas curtas (~1,5 k tokens) no `gpt-5.4-mini`; medir em `ai_tool_calls` |
| Lote junta mensagens que não eram uma coisa só | Só mesmo remetente + mesmo chat + dentro da janela; a pergunta numerada mostra o que foi entendido antes de gravar |
