# Roteiro da demonstração — 16/09, meio-dia

> O que mostrar, em que ordem, o que dizer, e o que fazer quando algo não
> aparecer. Escrito em 2026-09-11 contra o sistema como ele está.
>
> A regra do briefing: *"deixar o sistema funcional e bem lapidado antes da
> entrega, evitando liberar uma versão incompleta"*. A demo é a prova disso.
> Vinte minutos, um único caminho, sem improviso.

---

## D-1 — véspera: a checagem que decide se a demo existe

Marque só o que **conferiu**, não o que fez. Tudo vem de `SO-FALTA-VOCE.md`.

- [ ] **Telefones reais dos 8 fornecedores** (item 1). Sem isso, a tela de
      fornecedores mostra `-0001`, `-0002`… na frente do cliente
- [ ] **As 3 mensagens de teste de 07/09 apagadas** (item 4.1b). Senão a tela de
      pendências abre com "Casa das Tintas" e "obra Beta", que não existem
- [ ] **Credenciais + redeploy** (item 2): `checar-integracoes.mjs` sem ✗
- [ ] **Webhook da UAZAPI apontado e a equipe em `/config/autorizados`** (item 3),
      com o **seu** número e o do Fernando
- [ ] `test-webhook-uazapi.mjs` devolvendo `200` contra produção
- [ ] **Uma foto de nota fiscal real** no seu celular, de um fornecedor que existe
      no CRM, com valor legível. Tire hoje, não na hora
- [ ] `/api/health` com `ok: true` (comando no fim deste arquivo)
- [ ] Um teste completo por você: foto → pergunta do bot → `SIM` → lançamento em
      `/pagamentos`. **Se este não passou na véspera, não passa na demo**

Se algum dos quatro primeiros falhar, a demo ainda acontece — mas o roteiro muda para
a **versão B** (fim do arquivo), que não depende do WhatsApp.

---

## A ordem, e por que é essa

```
1. Painel          o que ele vê todo dia         2 min
2. Obra            onde o dinheiro está           3 min
3. WhatsApp ★      o que foi contratado           6 min
4. Pendências      o que falta                    2 min
5. Planilha        o que ele compartilha          2 min
6. Relatório       o que ele imprime              2 min
7. Bot             perguntas sem abrir o CRM      3 min
```

O WhatsApp vem em terceiro, não em primeiro: antes dele o cliente precisa ter visto
uma obra e um pagamento na tela, para reconhecer o que o bot vai criar. E vem antes
das pendências porque o lançamento que ele acabou de fazer é o que vai aparecer lá.

---

## 1. Painel — `/painel`

**Abra logado.** Deixe o navegador na tela antes da call começar; a primeira
impressão não pode ser a página de login.

O que mostrar: o total do mês, as obras ativas, o banner de alertas, a **atividade
recente**.

O que dizer: *"Isto é o que aparece quando você abre. Cada linha da atividade é uma
ação do sistema, não a mensagem crua do WhatsApp — foi um pedido seu."*

Não mostrar: `/config`. Não é para ele.

## 2. Obra — `/obras` → uma obra com movimento

Escolha **antes** qual obra abrir. Uma com vários pagamentos e um fornecedor
recorrente; a Garibaldi serve.

O que mostrar: a **barra de orçamento** (consumo real está entre 4% e 9% — diga que
é porque os dados são o histórico importado, e a barra é o que ele vai ver quando a
obra andar), a lista de pagamentos, o vínculo com fornecedor e categoria.

O que dizer: *"Cada pagamento tem obra, fornecedor, categoria e, quando existe, a nota.
O que não tem nota fica marcado — vamos ver isso daqui a pouco."*

## 3. ★ WhatsApp — o fluxo contratado

**Este é o produto.** Os outros seis passos existem para dar contexto a este.

Do **seu** celular (cadastrado em `/config/autorizados`):

1. Mande a **foto da nota** com uma frase curta: *"paguei 850 pro Zé da areia na
   Garibaldi"*. Fale a frase enquanto manda: o cliente precisa ouvir que é linguagem
   de obra, não formulário.
2. Espere a pergunta do bot. Ela repete os dados extraídos e pede SIM. **Leia em voz
   alta** o que o bot entendeu — valor, obra, fornecedor.
3. Responda `SIM`.
4. Volte ao navegador: `/pagamentos`. O lançamento está lá, com origem WhatsApp.

O que dizer, na ordem: *"Ninguém digitou nada no painel. A pessoa mandou a foto, o
sistema entendeu, perguntou, ela confirmou. Se ela tivesse respondido NÃO, cancelava.
Se não tivesse respondido, ficava esperando em Pendências — nunca grava sozinho."*

**Se o bot demorar mais de 20 segundos:** não fique olhando o celular. Diga *"a
transcrição do áudio e a leitura da imagem levam alguns segundos"* e mostre em
`/whatsapp` a mensagem chegando com status *processando*. Quando a pergunta chegar,
retome.

**Se o bot não responder em 60 segundos:** versão B, sem drama — *"vou mostrar pela
tela de mensagens como isso fica"* e abra `/whatsapp`, onde a mensagem recebida está
registrada mesmo sem resposta.

## 4. Pendências — `/pendentes`

O que mostrar: o **semáforo de dias** (amarelo a partir de 3, vermelho a partir de 7),
os pagamentos sem nota com a contagem, e a confirmação que acabou de ser resolvida.

O que dizer: *"Item sem nota ou comprovante vira pendência com a idade. Aqui é onde
você cobra o fornecedor — e daqui a pouco o sistema cobra sozinho."*

## 5. Planilha compartilhável — `/obras/[id]` → **Compartilhar**

O que mostrar: gere o link, abra **numa janela anônima** (é a única tela que o cliente
final dele abre sem login). Saldo acumulado, filtro, impressão.

O que dizer: *"Este link você manda para quem precisa ver a obra. Ele não entra no
sistema, só vê isto. Você revoga quando quiser."*

## 6. Relatório do fornecedor — `/relatorios`

O que mostrar: **Relatório do Fornecedor** (o nome que você pediu), PDF com total
pago, documentos recebidos, vínculo com obras, contato, CNPJ.

Gere o PDF **de um fornecedor com telefone real**. O PDF mostra o contato.

## 7. O bot responde perguntas — de volta ao celular

Três mensagens, nesta ordem, com o celular na câmera:

| Mande | Espere |
|---|---|
| `resumo` | total do mês e comparação com o anterior |
| `pendências` | quantas confirmações abertas e quantos pagamentos sem nota |
| `quanto gastei na Garibaldi` | total da obra, lançamentos, barra do orçamento |

O que dizer: *"Isso é para quem está na obra e não vai abrir o computador. Três
comandos fixos hoje; com a chave da IA ligada, ele responde pergunta livre — 'quanto
gastei em setembro', 'quem mais recebeu' — somando no banco."*

Se `ANTHROPIC_API_KEY` estiver configurada, feche com uma pergunta livre:
*"quanto gastei em setembro?"*. Se não estiver, **não tente**: a resposta seria o texto
fixo de "busca não ligada", e isso parece defeito.

---

## O que NÃO mostrar

- `/config/automacoes`, `/config/filas`, `/api/health` — são de operação. Se ele
  perguntar "e se parar?", responda com uma frase: *"o sistema se vigia sozinho e
  avisa por WhatsApp"*. Não abra a tela.
- A automação de cobrança **ligada**. Ela mandaria WhatsApp para fornecedor de
  verdade durante a call. Se quiser mostrar, use **Ensaiar sem agir** em
  `/config/automacoes` e leia o histórico: "faria X". Só se sobrar tempo.
- Métrica de confiança da IA. Não existe mais na tela, e ele pediu para tirar.

---

## Versão B — sem WhatsApp

Se a UAZAPI não estiver ligada na véspera, o passo 3 vira isto:

1. Abra `/whatsapp`. Mostre as mensagens registradas (as suas de teste, não as de
   07/09 — apague aquelas).
2. Rode no terminal, com a tela visível:
   ```bash
   node --env-file=.env.local scripts/test-webhook-uazapi.mjs text-simples --url https://crm-cavalcanti.vercel.app
   ```
   e mostre a mensagem aparecendo em `/whatsapp`.
3. Abra `/pendentes` e resolva uma confirmação pelo botão, dizendo: *"na versão
   ligada, este clique é o SIM no WhatsApp"*.

Diga a verdade: *"o canal do WhatsApp entra assim que o número do cliente estiver
ativo na plataforma — o fluxo está pronto e testado, falta a credencial"*. É melhor que
uma demo que engasga.

---

## Frases para perguntas prováveis

| Ele pergunta | Responda |
|---|---|
| "E se eu mandar áudio?" | *"Vira texto antes de qualquer coisa. Dá para confirmar por áudio também."* |
| "E se mandar errado?" | *"Responde NÃO e cancela. Se não responder, fica em Pendências para você."* |
| "Quem pode mandar?" | *"Só os números que você cadastrar. Número desconhecido é ignorado sem resposta."* |
| "E a nota fiscal?" | *"Fica guardada junto do pagamento. Pagamento sem nota vira pendência com a idade."* |
| "Isso fica onde?" | *"Banco em São Paulo, com cópia semanal fora dele."* |
| "Vendas entram?" | *"O sistema já está preparado para conversar com o CRM005 — é a próxima fase, e tem plano."* (`PLANO-FASE-6.md`) |

---

## Conferência de saúde, na hora

```bash
node --env-file=.env.local -e "fetch('https://crm-cavalcanti.vercel.app/api/health',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.json()).then(j=>console.log(j.ok, j.problemas))"
```

`true []` é o esperado. Qualquer outra coisa: `docs/SO-FALTA-VOCE.md` → "Se algo der
errado".
