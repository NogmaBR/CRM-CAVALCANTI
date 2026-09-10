# Roteiro de go-live — dados, WhatsApp e automações

> Passo a passo para sair do sistema vazio e chegar no fluxo funcionando.
> Escrito para ser seguido sem consultar mais nada. Cada passo tem **como
> conferir se deu certo** — não confie no "salvo com sucesso" de nenhuma tela.
>
> Estado verificado em **2026-09-10, 09h**: banco sem nenhuma obra, sem nenhum
> fornecedor, sem nenhum autorizado; motor de automações no ar com as duas
> regras desligadas; nenhuma variável `UAZAPI_*` cadastrada na Vercel.

---

## A ordem importa, e não é negociável

```
1. Categorias  ─┐
2. Obras        ├─→  3. Pagamentos  ─→  4. WhatsApp  ─→  5. Automações
2. Fornecedores─┘
```

A importação de pagamentos casa obra, fornecedor e categoria **pelo nome**. Se
a obra não existir na hora do import, a linha é **recusada**. Se o fornecedor
não existir, a linha entra **sem fornecedor** — e um pagamento sem fornecedor
nunca vai ser cobrado pela automação, porque não há para quem mandar.

Pular a ordem não dá erro barulhento. Dá dado errado silencioso, que é pior.

---

## Antes de começar, tenha em mãos

| O quê | Onde consegue |
|---|---|
| Acesso ao painel do Supabase | <https://supabase.com/dashboard> → projeto `bbtejxugeeccywwhfpoc` |
| Acesso ao painel da Vercel | <https://vercel.com/nogma1/crm-cavalcanti> |
| Login no CRM | <https://crm-cavalcanti.vercel.app> |
| Os dois arquivos gerados | pasta `dados-iniciais/` na raiz do projeto |
| Credenciais UAZAPI | com o fornecedor do serviço (ver Parte 2) |
| Telefones reais da equipe | com o Fernando |

Os dois arquivos em `dados-iniciais/` foram gerados a partir do protótipo
aprovado e **não vão para o Git** (a pasta está no `.gitignore`, porque o
repositório é público). Se sumirem, dá para gerar de novo a partir de
`Cavalcanti enegenharia/src/data/`.

---

# PARTE 1 — Popular o banco

## 1.1 — Rodar o SQL de categorias, obras e fornecedores

Isso cria: a categoria **Frete** (que falta em produção), as **10 obras** e os
**8 fornecedores**.

1. Abra <https://supabase.com/dashboard> e entre no projeto.
2. No menu da esquerda, clique em **SQL Editor**.
3. Clique em **+ New query**.
4. Abra o arquivo `dados-iniciais/01-categorias-obras-fornecedores.sql`,
   **selecione tudo** (Ctrl+A) e **copie** (Ctrl+C).
5. Cole na caixa do SQL Editor.
6. Clique em **Run** (ou Ctrl+Enter).

Deve aparecer `Success. No rows returned`.

> **Pode rodar de novo sem medo.** Todo `INSERT` tem guarda `NOT EXISTS` e o
> bloco inteiro está dentro de `BEGIN/COMMIT`. Se rodar duas vezes, a segunda
> não duplica nada.

### Como conferir

Cole isto numa query nova e rode:

```sql
SELECT
  (SELECT count(*) FROM categorias   WHERE deleted_at IS NULL) AS categorias,
  (SELECT count(*) FROM obras        WHERE deleted_at IS NULL) AS obras,
  (SELECT count(*) FROM fornecedores WHERE deleted_at IS NULL) AS fornecedores,
  (SELECT count(*) FROM fornecedores WHERE deleted_at IS NULL AND telefone IS NULL) AS forn_sem_telefone;
```

**Esperado:** `categorias = 9`, `obras = 10`, `fornecedores = 8`,
`forn_sem_telefone = 0`.

Se `categorias` vier 8, a linha do Frete não entrou — provavelmente já existia
uma categoria chamada "frete" em outra grafia. Confira com
`SELECT nome FROM categorias ORDER BY nome;`.

## 1.2 — Importar os 80 pagamentos

1. Entre no CRM: <https://crm-cavalcanti.vercel.app>
2. Vá em **Configurações → Importar** (ou direto:
   <https://crm-cavalcanti.vercel.app/config/importar>)
3. Selecione o arquivo `dados-iniciais/02-pagamentos.csv`
4. A tela mostra uma **pré-visualização**. Ela **não grava nada ainda**.
5. Confira o resumo no topo: deve dizer **80 linhas, 80 ok, 0 erro**.
6. Só então clique em **Confirmar importação**.

> **Se aparecer qualquer linha com erro, PARE.** Não confirme. Erro de
> "obra não encontrada" significa que o passo 1.1 não rodou direito — volte,
> conserte, e recarregue esta tela. Confirmar com erro importa dado torto que
> depois precisa ser apagado à mão.

### Como conferir

```sql
SELECT count(*) AS pagamentos, to_char(sum(valor),'FM999G999G999D00') AS total
FROM pagamentos WHERE deleted_at IS NULL;
```

**Esperado:** `pagamentos = 80`, `total = 453.500,00`.

> ### ⚠️ A importação NÃO é idempotente
>
> Diferente do SQL do passo 1.1, subir o mesmo CSV duas vezes **cria 160
> pagamentos**. Não existe trava. Se acontecer, o conserto é:
>
> ```sql
> -- Confira o que vai apagar ANTES de apagar:
> SELECT count(*) FROM pagamentos WHERE observacoes LIKE '%prototipo pay-%';
> -- Se o número for o dobro do esperado, apague tudo e importe de novo:
> UPDATE pagamentos SET deleted_at = now() WHERE observacoes LIKE '%prototipo pay-%';
> ```

> ### ⚠️ Os 80 pagamentos entram SEM documento
>
> Os PDFs de nota e comprovante estão no OneDrive do cliente, não no sistema.
> Então, depois do import, a tela `/pendentes` vai mostrar **os 80 como
> "sem documento"** — não só os ~20 que de fato estão pendentes no controle do
> cliente.
>
> Isso é fiel ao que o sistema sabe, mas pode assustar na demonstração de 16/09.
> Duas saídas, e a escolha é do Fernando:
>
> - **Explicar na demo:** "os documentos antigos estão no OneDrive; daqui pra
>   frente eles entram pelo WhatsApp". É o mais honesto.
> - **Não importar o histórico:** começar limpo e deixar o sistema encher a
>   partir das mensagens reais. A demo fica com pouco dado, mas tudo verdadeiro.
>
> Isso também é o que torna a Parte 3 perigosa. Leia lá antes de ligar nada.

---

# PARTE 2 — WhatsApp (UAZAPI)

Hoje o CRM **recebe e registra**, mas nunca responde — falta credencial. Sem
isso o ciclo "manda foto → bot pergunta → você responde SIM → lança" não fecha,
e esse ciclo é o núcleo do contrato.

## 2.1 — Obter as credenciais

Você precisa de dois valores do painel da UAZAPI:

| Variável | O que é |
|---|---|
| `UAZAPI_BASE_URL` | URL da sua instância, ex.: `https://xxx.uazapi.com` (sem barra no fim) |
| `UAZAPI_TOKEN` | Token da instância conectada ao número do WhatsApp |

A instância precisa estar **conectada** (QR code já lido, número pareado).
Uma instância desconectada devolve erro em todo envio.

## 2.2 — Cadastrar na Vercel

1. Abra <https://vercel.com/nogma1/crm-cavalcanti/settings/environment-variables>
2. Clique em **Add New**.
3. Primeira variável:
   - **Key:** `UAZAPI_BASE_URL`
   - **Value:** a URL da instância
   - **Environments:** marque **Production**
   - **Sensitive:** pode deixar desmarcado (não é segredo)
   - **Save**
4. Repita para a segunda:
   - **Key:** `UAZAPI_TOKEN`
   - **Value:** o token
   - **Environments:** marque **Production**
   - **Sensitive:** ✅ **marque** — é credencial
   - **Save**

> **Nunca cole o token num chat, num commit ou num documento.** O repositório é
> público. Se colar por engano em algum lugar versionado, o certo é **rotacionar
> o token na UAZAPI**, não apagar o commit.

## 2.3 — Redeployar (o passo que todo mundo esquece)

**Variável de ambiente na Vercel só passa a valer depois de um novo deploy.**
Salvar e não redeployar é exatamente o motivo pelo qual se conclui, errado, que
"a credencial não funcionou".

1. Vá em <https://vercel.com/nogma1/crm-cavalcanti/deployments>
2. No deployment do topo (o de Production), clique nos **três pontinhos** → **Redeploy**
3. **Desmarque** "Use existing Build Cache"
4. Confirme e espere ficar **Ready**

## 2.4 — Apontar o webhook da UAZAPI para o CRM

No painel da UAZAPI, configure o webhook de mensagens recebidas:

| Campo | Valor |
|---|---|
| URL | `https://crm-cavalcanti.vercel.app/api/webhooks/uazapi` |
| Método | `POST` |
| Header | `x-signature: <HMAC-SHA256 do corpo cru, chave = WEBHOOK_HMAC_SECRET>` |

> **Este é o ponto de risco real da integração.** O CRM exige assinatura
> HMAC-SHA256 do corpo da requisição no header `x-signature`, e recusa com
> **401** qualquer chamada sem ela. Se o painel da UAZAPI **não** oferecer
> assinatura HMAC com segredo próprio, o webhook nunca vai passar, e isso não
> se resolve na tela deles — precisa de decisão nossa (relaxar a verificação
> para um token fixo, ou pôr um intermediário que assine). **Descubra isso
> ANTES do dia 16**, não na hora da demonstração.
>
> O valor de `WEBHOOK_HMAC_SECRET` já existe em produção e está em
> `.env.local`. Não precisa gerar outro.

## 2.5 — Cadastrar a equipe em `/config/autorizados`

**Sem isso nada funciona.** Hoje há **zero autorizados**, e a trava é
*fail-closed*: com a lista vazia, o sistema **ignora toda mensagem que chega**,
de qualquer número, sem responder nada. É o comportamento seguro, e é
proposital.

1. Vá em <https://crm-cavalcanti.vercel.app/config/autorizados>
2. Para cada pessoa da equipe, clique em **Adicionar** e preencha:
   - **Nome** — como a pessoa é chamada
   - **Telefone** — o número do WhatsApp **com DDD**, ex.: `(51) 99999-0000`
   - **Papel na obra** — texto livre (ex.: "mestre de obras", "financeiro")
   - **Ativo** — deixe marcado
3. Salve e confira que a pessoa aparece na lista.

O número precisa ser o **mesmo** de onde a pessoa vai mandar mensagem. Número
diferente = mensagem ignorada em silêncio.

### Como conferir

```sql
SELECT nome, telefone_whats, ativo FROM autorizados WHERE deleted_at IS NULL ORDER BY nome;
```

## 2.6 — Testar o webhook sem depender de celular

No terminal, na pasta do projeto:

```bash
node --env-file=.env.local scripts/test-webhook-uazapi.mjs text-simples --url https://crm-cavalcanti.vercel.app
```

**Esperado:** `200`. Se vier `401`, a assinatura não bateu — confira se o
`WEBHOOK_HMAC_SECRET` do `.env.local` é o mesmo da Vercel.

Outras fixtures disponíveis: `image-nf`, `pdf-boleto`, `audio-ignorado`.

> Este teste prova que o CRM **recebe**. Ele não prova que o CRM **responde** —
> para isso precisa do passo seguinte.

## 2.7 — O teste que vale: um celular de verdade

1. Do celular de alguém que você cadastrou em `/config/autorizados`, mande uma
   foto de nota fiscal para o número da instância UAZAPI.
2. **Esperado:** em alguns segundos, o bot responde perguntando se confirma,
   com os dados que extraiu.
3. Responda `SIM`.
4. **Esperado:** o lançamento aparece em
   <https://crm-cavalcanti.vercel.app/pagamentos>, sem ninguém tocar no painel.

Se o passo 2 não acontecer, olhe
<https://crm-cavalcanti.vercel.app/pendentes> e
<https://crm-cavalcanti.vercel.app/whatsapp>: se a mensagem está lá mas o bot
não respondeu, o problema é no envio (credencial UAZAPI). Se a mensagem nem
apareceu, o problema é no recebimento (webhook ou autorizados).

> **O classificador está em modo mock.** Sem `ANTHROPIC_API_KEY` cadastrada na
> Vercel (hoje não está), a extração dos dados da nota é simulada, não real. O
> ciclo de confirmação funciona; os **valores** é que não saem da imagem de
> verdade. Para ligar de verdade: adicione `ANTHROPIC_API_KEY` e
> `IA_PROVIDER=anthropic` na Vercel, e redeploye (passo 2.3 de novo).

---

# PARTE 3 — Ligar as automações

## 3.1 — Leia isto antes de ligar qualquer coisa

O motor está em produção com **duas regras, ambas desligadas**:

| Regra | O que faz | Efeito externo |
|---|---|---|
| `orcamento-em-risco` | Registra alerta quando uma obra passa de 80% do orçamento | **Nenhum.** Só escreve log |
| `cobrar-documento-fornecedor` | Manda WhatsApp ao fornecedor cobrando nota/comprovante | **Manda mensagem para gente de verdade** |

> ### 🔴 O perigo concreto
>
> Depois da Parte 1, o banco tem **80 pagamentos de janeiro a março de 2026,
> todos sem documento anexado** — porque os PDFs estão no OneDrive, não aqui.
> Hoje é setembro. Para a regra de cobrança, são 80 pagamentos com **6 a 8
> meses de atraso**.
>
> Se você ligar `cobrar-documento-fornecedor` logo depois de importar, no dia
> seguinte às 9h ela manda **25 mensagens de WhatsApp** (o teto por rodada)
> para fornecedores, cobrando notas de pagamentos antigos que provavelmente já
> foram resolvidos fora do sistema. E de novo no dia seguinte, e no outro, até
> acabarem os 80.
>
> **Pior:** os telefones que vieram do protótipo são **placeholders
> sequenciais** (`(51) 99812-0001`, `(51) 99734-0002`, …), não os números reais
> dos fornecedores. Ou não existem, ou pertencem a estranhos.
>
> **Conclusão: não ligue essa regra antes de (a) trocar os telefones dos
> fornecedores pelos reais e (b) decidir o que fazer com o histórico.**

## 3.2 — A tela: `/config/automacoes`

Tudo que vem a seguir se faz por **<https://crm-cavalcanti.vercel.app/config/automacoes>**,
sem tocar em SQL. A tela mostra:

- cada automação, se está **ligada**, quando roda e se **envia mensagem para fora**;
- os **parâmetros** de cada uma, editáveis ali mesmo (é o que se ajusta sem deploy);
- o **histórico**, com uma linha por avaliação — inclusive as que **não** agiram, com o motivo.

> Se a tela ainda não existir no seu ambiente, ela veio no PR do painel de
> automações. Enquanto ele não estiver mergeado e deployado, use os comandos SQL
> que estão no fim de cada passo como alternativa.

### Ensaiar sem agir

Botão **"Ensaiar sem agir"**, no topo da tela. É o "Test workflow" do n8n:
avalia todas as regras ligadas, registra o que **teria** feito, e não manda
nada para ninguém. O resultado aparece no histórico como **Ensaio**.

Faça isso antes de qualquer coisa. É a única forma de ver para quem uma
cobrança iria **antes** de ela ir.

## 3.3 — Ligar a regra inócua primeiro

Comece por **"Registra alerta quando o gasto de uma obra passa do limiar"**.
Ela não manda nada para ninguém — só escreve no histórico. Serve para você ver
o motor funcionando sem risco nenhum.

1. Na linha dela, clique em **Ligar**.
2. Clique em **Ensaiar sem agir**.
3. Olhe o histórico.

Você vai ver uma linha por obra avaliada: **"Não se aplicava"** com o motivo
("Consumo em 42%, abaixo do limiar de 80%"), ou **"Executada"** para as que
passaram do limiar.

**Toda avaliação vira registro, inclusive as que não fizeram nada.** É de
propósito: quando alguém perguntar "por que não avisou daquela obra?", a
resposta está na coluna Motivo. Sem isso, a pergunta não teria resposta em
lugar nenhum.

Para mudar o limiar, edite o campo de parâmetros na própria linha
(`{"limiar_percentual": 90}`) e clique em **Salvar**. Não precisa de deploy.

> Pelo SQL, se preferir: `UPDATE automation_rules SET ativo = true WHERE chave = 'orcamento-em-risco';`

## 3.4 — Ligar a cobrança, quando for a hora

Só depois de resolver o que está na caixa vermelha do 3.1 — os telefones falsos
e o histórico sem documento.

**Primeiro** ponha um freio de mão. Na linha da cobrança, edite os parâmetros:

```json
{"dias_sem_documento": 7, "limite_por_rodada": 3}
```

`limite_por_rodada: 3` significa no máximo três mensagens por dia. É para você
ver o resultado antes de soltar o volume todo. Depois que confiar, volte para 25.

**Depois** clique em **Ligar** e, em seguida, em **Ensaiar sem agir**.

O histórico vai mostrar linhas **Ensaio** dizendo para quem ela mandaria e o
que diria — com o telefone mascarado, que é como ele aparece no log.

**Leia essa lista inteira antes de deixar rodar de verdade.** Se tiver algum
fornecedor que não deveria ser cobrado, o conserto é o cadastro dele, não a regra.

Enquanto a regra estiver ligada e mandar mensagem para fora, a tela mostra um
aviso vermelho permanente no topo. É de propósito.

> Pelo SQL: `UPDATE automation_rules SET config = '{"dias_sem_documento": 7, "limite_por_rodada": 3}'::jsonb, ativo = true WHERE chave = 'cobrar-documento-fornecedor';`

## 3.5 — Como desligar tudo, rápido

Na tela, clique em **Desligar** em cada regra ligada. A partir daí o motor não
age mais — nem no cron, nem em evento — e nada precisa de deploy.

Pelo SQL, se a tela estiver fora do ar:

```sql
UPDATE automation_rules SET ativo = false;
```

O histórico do que já aconteceu continua lá para investigar.

---

## Checklist final

Marque só o que você **conferiu**, não o que você fez.

- [ ] `categorias = 9`, `obras = 10`, `fornecedores = 8` no SQL de conferência
- [ ] `pagamentos = 80`, total `453.500,00`
- [ ] Telefones dos fornecedores trocados pelos **reais** (os do protótipo são falsos)
- [ ] `UAZAPI_BASE_URL` e `UAZAPI_TOKEN` na Vercel, em Production
- [ ] **Redeploy feito** depois de cadastrar as variáveis
- [ ] Webhook da UAZAPI apontado, com HMAC — e `test-webhook-uazapi.mjs` devolvendo 200
- [ ] Equipe cadastrada em `/config/autorizados`, com os números certos
- [ ] Teste com celular real: foto → bot pergunta → "SIM" → lançamento no painel
- [ ] `orcamento-em-risco` ligada em `/config/automacoes` e com histórico aparecendo
- [ ] `cobrar-documento-fornecedor` **só depois** de resolver o histórico e os telefones

---

## O que ainda depende de decisão, não de execução

1. **O histórico de 80 pagamentos sem documento** — explicar na demo ou não importar (§1.2).
2. **Os telefones falsos dos fornecedores** — precisam dos reais antes de qualquer cobrança automática.
3. **HMAC no webhook da UAZAPI** — se o provider não assina, precisa de decisão de arquitetura (§2.4).
4. **`ANTHROPIC_API_KEY`** — sem ela o classificador é mock e a extração da nota é simulada.
5. **Repositório público** — vira privado quando a Vercel for paga.
