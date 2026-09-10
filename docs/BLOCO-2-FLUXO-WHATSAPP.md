# Bloco 2 — o fluxo do WhatsApp ligado ponta a ponta

> Fecha os itens 5, 6, 7, 8, 9 e 10 da lista "falta construir" de
> `docs/VERIFICACAO-BRIEFING-16-09.md`, mais a tela que faltava para operar a
> trava de segurança.

## O que existia antes

O CRM recebia a mensagem, classificava e **parava aí**. O gestor tinha que
abrir `/pendentes` e clicar em Confirmar — exatamente a aprovação manual que o
briefing quer eliminar. Além disso:

- qualquer número que alcançasse o webhook virava lançamento no financeiro;
- áudio caía sempre em `nao_identificado` (nada transcrevia);
- a mídia era perdida (a URL do provider expira em minutos);
- um retry do provider reclassificava a mensagem e abria pendência duplicada;
- "recusado" e "erro técnico" eram gravados no mesmo campo.

## O que passou a existir

O caminho completo agora é:

```
WhatsApp → autorizados? → dedupe → baixa mídia + transcreve áudio
        → é resposta a pergunta aberta?
              sim → lança o pagamento e responde "Lançado ✅"
              não → recusa e responde
              nada disso → classifica → abre pendência → PERGUNTA no WhatsApp
```

### Arquivos

| Peça | Arquivo |
|---|---|
| Orquestração do inbound | `lib/services/inbound-whatsapp.ts` |
| Interpretar "SIM"/"NÃO" | `lib/whatsapp/resposta.ts` (+ 58 testes) |
| Resolver pendência (painel **e** WhatsApp) | `lib/services/confirmacoes.ts` |
| Enviar mensagem / baixar mídia | `lib/services/uazapi.ts` |
| Transcrição de áudio | `lib/ia/transcricao.ts` |
| Classificador Claude real | `lib/ia/anthropic-classifier.ts` |
| Rota (fina: HMAC + rate limit + delega) | `app/api/webhooks/uazapi/route.ts` |
| Tela de números autorizados | `app/(app)/config/autorizados/` |
| Hub de configurações | `app/(app)/config/page.tsx` |

### Decisões que valem registro

**A confirmação virou obrigatória.** A auto-aprovação silenciosa a partir de
0.85 de confiança passou a ser opt-in (`IA_AUTO_APROVAR=true`, default `false`).
Com o classificador real ligado, mantê-la como padrão significaria gravar no
financeiro do cliente a partir de um palpite, sem ninguém ter dito "sim" — e o
briefing descreve a confirmação como parte do fluxo, não como um degrau
opcional.

**O parser de resposta é deliberadamente conservador.** Só respostas curtas e
inequívocas agem. "não, o valor é 500" **não** recusa: vira mensagem comum e a
pendência fica aberta. O custo de errar não é simétrico — tratar uma correção
como "sim" grava um pagamento errado; tratar um "sim" como correção só faz o
gestor clicar no painel, que é o que ele já fazia.

**Falha fechada na autorização.** Número fora de `/config/autorizados` é
descartado sem resposta (responder confirmaria a quem sondou que existe um
sistema atrás do número). Como a lista vazia faz o sistema ignorar tudo, a
própria tela avisa isso em vermelho — senão o sintoma na obra seria "o WhatsApp
parou de funcionar", sem erro nenhum em lugar algum.

**Idempotência em três camadas**, porque as três corridas são reais: dedupe por
`msg_id_uazapi` (retry do provider), pré-checagem por `criado_via_msg_id` e
catch de `23505` (o "SIM" chegando junto com o clique do gestor).

## Também entrou

- **Pendências com contagem de dias** (`/pendentes`): pagamentos sem NF nem
  comprovante, do mais antigo pro mais novo, destacando os de 15+ dias. Existia
  só como cobrança automática por WhatsApp no n8n — o gestor não tinha onde ver.
- **"Documentos recebidos" no relatório do fornecedor** (PDF e CSV). O de obra
  já tinha; o de fornecedor, não.
- **Estado `recusado` de verdade**, separado de `erro`, com os rótulos que o
  gestor pediu (Pendente / Recusado / Aprovado) em `lib/status-labels.ts`.
- **`/config` deixou de ser "Em construção".** A sidebar aponta pra lá, então
  categorias, usuários, webhooks e importação estavam inacessíveis pela
  interface: só chegava quem digitasse a URL.
- **Correção no export CSV:** valor negativo (`-3,00`) disparava o guard de
  formula injection e chegava no Excel como texto, quebrando a soma da coluna.
  Número puro agora é isento; `-1+1` continua barrado.

## Verificação

```
pnpm --filter web typecheck   # limpo
pnpm --filter web exec vitest run   # 136 testes, 6 arquivos
pnpm --filter web build       # compila
```

## O que falta — e não é código

O fluxo está construído e testado, mas **não roda sem credenciais**:

1. **`UAZAPI_BASE_URL` + `UAZAPI_TOKEN`.** Sem eles o CRM recebe e registra,
   mas nunca responde — o cliente não recebe a pergunta e o ciclo não fecha.
   O código não quebra sem isso: loga e segue.
2. **`IA_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`** para classificação real.
   Em `mock` o fluxo roda inteiro, só a extração é heurística.
3. **`IA_TRANSCRICAO_PROVIDER=openai` + `OPENAI_API_KEY`** para áudio.
4. **Aplicar as 3 migrations novas** (`20260909140000`, `140100`, `140200`).
5. **Cadastrar a equipe em `/config/autorizados`.** Sem isso, nada é processado.
6. **Rotacionar os secrets vazados** (senha do Postgres e `WEBHOOK_HMAC_SECRET`)
   — pendência crítica herdada, ver achado C-1 da auditoria.
