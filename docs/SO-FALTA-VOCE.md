# Só falta você

> **Tudo que não dá para eu fazer.** Um arquivo só, na ordem certa.
>
> Estado verificado em **2026-09-10, 15h**. Cada item diz o que fazer, onde, e
> **como conferir que deu certo** — porque "salvo com sucesso" não é prova de nada.
>
> Este documento substitui `MANUAL-PENDENCIAS.md`, que é de 08/09 e está desatualizado.

---

## O mapa em uma tela

```
JÁ FEITO (não precisa mexer)
  ✅ Banco populado: 10 obras, 8 fornecedores, 80 pagamentos (R$ 453.500,00)
  ✅ Motor de automações em produção, com painel /config/automacoes
  ✅ Filas pgmq + consumidor + dead-letter, com painel /config/filas
  ✅ pgvector, pgmq, pg_cron, pg_net instalados e verificados
  ✅ Base de conhecimento e busca vetorial (PR #10)

SÓ FALTA VOCÊ
  🔴 1. Telefones reais dos fornecedores      ← antes de qualquer automação
  🔴 2. Credenciais (UAZAPI, Anthropic, OpenAI) + redeploy
  🔴 3. Cadastrar a equipe em /config/autorizados
  🟠 4. Mergear PR #10 (RAG)                  ← pode agora
  🟡 5. Indexar a base de conhecimento
  🟡 6. Ligar as automações, com cuidado
  ⏳ 7. Depois de 16/09: PR #7 e a chave FILA_WHATSAPP
  🟢 8. Plano pago da Vercel: repo privado + região São Paulo
```

---

# 🔴 1. Telefones reais dos fornecedores

**Por que é o primeiro:** os telefones que vieram do protótipo são **falsos**. São
sequenciais — `(51) 99812-0001`, `(51) 99734-0002`, até `-0007`. Os CNPJs também
(`12.345.678`, `23.456.789`, …).

Se você ligar a automação de cobrança com eles, o sistema manda WhatsApp para números
que não existem ou pertencem a estranhos. **Nada mais nesta lista importa se este item
não for feito.**

### Como fazer

1. Entre em <https://crm-cavalcanti.vercel.app/fornecedores>
2. Para cada um dos 8, clique em editar e troque **telefone** e **documento** pelos reais
3. Os nomes das obras e dos fornecedores **estão corretos** — não precisa mexer

### Como conferir

No SQL Editor do Supabase:

```sql
SELECT nome, telefone, documento
FROM fornecedores WHERE deleted_at IS NULL ORDER BY nome;
```

Nenhum telefone pode terminar em `-0001` a `-0007`.

---

# 🔴 2. Credenciais + redeploy

Faltam **7 variáveis**, em pares. O par importa: definir só a chave não liga nada, e a
chave passa a ser cobrada à toa.

| Integração | Variáveis | Sem isso |
|---|---|---|
| **WhatsApp** | `UAZAPI_BASE_URL` · `UAZAPI_TOKEN` | O CRM recebe e registra, mas **nunca responde** |
| **Classificador** | `IA_PROVIDER=anthropic` · `ANTHROPIC_API_KEY` | A extração da nota é simulada |
| **Transcrição** | `IA_TRANSCRICAO_PROVIDER=openai` · `OPENAI_API_KEY` | Áudio vira pendência para alguém ouvir |
| **Busca (RAG)** | `IA_EMBEDDINGS_PROVIDER=openai` | Perguntas livres não funcionam |

`IA_EMBEDDINGS_PROVIDER` reaproveita a mesma `OPENAI_API_KEY` da transcrição.

### Como fazer

1. <https://vercel.com/nogma1/crm-cavalcanti/settings/environment-variables>
2. **Add New** para cada uma. Marque **Production**.
3. Marque **Sensitive** só nas três chaves (`UAZAPI_TOKEN`, `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY`). As outras são configuração, não segredo.

> **Não defina `IA_AUTO_APROVAR=true`.** O padrão é `false` e é decisão de produto: o
> briefing define a confirmação do remetente como parte do fluxo. Auto-aprovar gravaria
> no financeiro do cliente sem ninguém dizer "sim".

### 2.1 — O redeploy, que todo mundo esquece

**Variável na Vercel só vale depois de um deploy novo.** Salvar e não redeployar é
exatamente como se conclui, errado, que "a credencial não funcionou".

1. <https://vercel.com/nogma1/crm-cavalcanti/deployments>
2. No do topo → **⋯** → **Redeploy**
3. **Desmarque** "Use existing Build Cache"

### Como conferir

```bash
node --env-file=.env.local scripts/checar-integracoes.mjs
```

Tem que sair **sem nenhum ✗** e dizer que o deploy é mais novo que a última variável.

---

# 🔴 3. Webhook da UAZAPI + equipe autorizada

### 3.1 — Apontar o webhook

No painel da UAZAPI:

| Campo | Valor |
|---|---|
| URL | `https://crm-cavalcanti.vercel.app/api/webhooks/uazapi` |
| Método | `POST` |
| Header | `x-signature: <HMAC-SHA256 do corpo cru, chave = WEBHOOK_HMAC_SECRET>` |

> ⚠️ **Este é o risco que não consigo resolver daqui.** O CRM exige assinatura HMAC e
> devolve **401** sem ela. Se a UAZAPI não oferecer assinatura com segredo próprio, o
> webhook nunca passa — e isso não se resolve na tela deles, precisa de decisão nossa.
> **Descubra antes do dia 16**, não na demonstração.

O `WEBHOOK_HMAC_SECRET` já existe em produção e está no `.env.local`. Não gere outro.

### 3.2 — Cadastrar a equipe

**Hoje há zero autorizados.** Com a lista vazia o sistema **ignora toda mensagem**, de
qualquer número, sem responder nada. É a trava segura funcionando — mas por fora parece
"o WhatsApp não funciona".

1. <https://crm-cavalcanti.vercel.app/config/autorizados>
2. Adicione cada pessoa: nome, telefone **com DDD**, função na obra
3. O número precisa ser o **mesmo** de onde a pessoa vai mandar mensagem

### Como conferir — o teste que vale

```bash
node --env-file=.env.local scripts/test-webhook-uazapi.mjs text-simples --url https://crm-cavalcanti.vercel.app
```

Espera-se `200`. Se vier `401`, a assinatura não bateu.

**Depois disso, o teste de verdade:** do celular de alguém cadastrado, mande uma foto de
nota fiscal. O bot deve perguntar se confirma. Responda `SIM`. O lançamento tem que
aparecer em `/pagamentos` sem ninguém tocar no painel.

---

# 🟠 4. Mergear o PR #10

<https://github.com/NogmaBR/CRM-CAVALCANTI/pull/10> — base de conhecimento e assistente.

Aditivo e inerte: sem as credenciais do item 2, o bloco de pergunta livre não age.

---

# 🟡 5. Indexar a base de conhecimento

Só depois do PR #10 mergeado **e** das credenciais do item 2.

### Primeiro sem gastar nada

```bash
node --env-file=.env.local -e "fetch('https://crm-cavalcanti.vercel.app/api/cron/indexar?apenas=texto',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.text()).then(console.log)"
```

Deve criar ~98 documentos (80 pagamentos + 10 obras + 8 fornecedores) sem chamar API
nenhuma.

### Depois com embeddings

Mesmo comando, **sem** o `?apenas=texto`. A partir daí o `pg_cron` mantém em dia sozinho,
de hora em hora, e só gasta no que mudou.

### Como conferir

```sql
SELECT count(*) AS documentos,
       count(*) FILTER (WHERE indexado_em IS NOT NULL) AS com_embedding
FROM knowledge_documents WHERE deleted_at IS NULL;
```

Depois disso, mande no WhatsApp: **"quanto gastei na obra Garibaldi?"**

---

# 🟡 6. Ligar as automações

Tela: <https://crm-cavalcanti.vercel.app/config/automacoes>

### 6.1 — Comece pela inócua

**"Registra alerta quando o gasto passa do limiar"** — só escreve no histórico, não manda
nada para ninguém. Clique em **Ligar**, depois em **Ensaiar sem agir**.

> O consumo real das obras está entre **4,4% e 9,3%**, e o limiar é 80%. Ela vai
> registrar "Não se aplicava" em todas — **corretamente**. Se quiser mostrar a automação
> agindo na demo, baixe o limiar para 5 nos parâmetros. É legítimo, mas é um alarme
> fabricado; vale dizer isso ao Fernando.

### 6.2 — A cobrança, só depois do item 1

> 🔴 **O perigo, medido:** há **80 pagamentos sem documento**, todos com mais de 7 dias.
> Ligar a cobrança sem cuidado dispara 25 mensagens por dia até esgotar os 80 — para os
> telefones do item 1.

**Antes de ligar**, ponha o freio de mão nos parâmetros:

```json
{"dias_sem_documento": 7, "limite_por_rodada": 3}
```

Depois **Ligar** → **Ensaiar sem agir** → leia o histórico inteiro antes de deixar rodar.

### Para desligar tudo, rápido

Botão **Desligar** em cada regra. Ou, pelo SQL: `UPDATE automation_rules SET ativo = false;`

---

# ⏳ 7. Depois de 16/09

Nada aqui antes da entrega.

1. **Mergear o PR #7** — o barramento de eventos ganha chamadores.
   <https://github.com/NogmaBR/CRM-CAVALCANTI/pull/7>
2. **Criar `FILA_WHATSAPP=true`** na Vercel + redeploy. O webhook passa a só enfileirar e
   responde em milissegundos; download, transcrição e IA saem da frente do provider.
3. Conferir em <https://crm-cavalcanti.vercel.app/config/filas> que os jobs são drenados.

---

# 🟢 8. Quando a Vercel virar plano pago

Dois motivos, não um:

1. **Tornar o repositório privado.** Ele é público hoje.
2. **Mudar a região das funções para `gru1` (São Paulo).** Hoje elas rodam em `iad1`
   (Virgínia) e o banco está em São Paulo — medi **394 ms de mediana para uma única
   consulta**, porque cada uma atravessa ~7.600 km. Com o banco cheio, toda página paga
   esse pedágio várias vezes.

O DNS na Cloudflare **não** resolve isso: ela acelera estático e resolução de nome, não
encurta a distância entre a função e o banco.

---

## Checklist final

Marque só o que você **conferiu**, não o que fez.

- [ ] Nenhum telefone de fornecedor terminando em `-000N`
- [ ] `scripts/checar-integracoes.mjs` sem nenhum ✗
- [ ] `test-webhook-uazapi.mjs` devolvendo 200
- [ ] Equipe em `/config/autorizados`, com os números certos
- [ ] **Foto de nota → bot pergunta → "SIM" → lançamento no painel**
- [ ] PR #10 mergeado e base indexada
- [ ] "quanto gastei na obra X?" respondido com fonte
- [ ] `orcamento-em-risco` ligada, com histórico aparecendo
- [ ] `cobrar-documento-fornecedor` só depois do item 1

---

## Se algo der errado, olhe aqui primeiro

| Sintoma | Onde olhar |
|---|---|
| Mensagem chega e nada acontece | `/config/autorizados` — lista vazia ignora tudo |
| Bot não responde | Credencial UAZAPI + **redeploy feito?** |
| Webhook devolve 401 | HMAC — o segredo da UAZAPI bate com `WEBHOOK_HMAC_SECRET`? |
| Automação não disparou | `/config/automacoes`, coluna **Motivo** no histórico |
| Pergunta responde "não encontrei" | Base indexada? (item 5) |
| Job parado na fila | `/config/filas` — mensagem parada há 15min significa consumidor não chamado |
