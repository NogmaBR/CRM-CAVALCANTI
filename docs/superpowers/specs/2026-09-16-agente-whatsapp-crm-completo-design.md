# Agente do WhatsApp que responde e age sobre o CRM inteiro — design

Data: 2026-09-16. Aprovado pelo usuário na conversa de planejamento (decisões 1–4).

## O problema

Hoje o WhatsApp responde a três comandos fixos (`resumo`, `pendências`, `quanto gastei
em X`) e a perguntas que **começam** com "quanto/qual/quem…", com 5 ferramentas de
leitura. Não responde "Velho, queria saber quanto estou lucrando no Garibaldi", não sabe
o que é lucro (não existe valor de contrato nem receita no banco), e não faz nada além de
lançar pagamento: "cria uma obra chamada tal" vira `nao_identificado` no painel.

O que o cliente espera do agente: perguntar **qualquer coisa** que esteja no CRM e pedir
as ações do dia a dia — criar obra, cadastrar fornecedor, dizer o valor do contrato,
registrar o que o cliente da obra pagou, arquivar obra — pelo mesmo grupo onde manda a
foto da nota.

## Decisões fechadas

1. **Toda escrita pede "SIM"** (decisão 2 do usuário). Nenhuma ferramenta do modelo grava.
   Uma ação vira `confirmacoes_pendentes` com `tipo = 'acao'`, o bot repete tudo o que
   entendeu e pergunta; o "SIM" executa; "NÃO" cancela. É o mesmo contrato do pagamento,
   que o cliente já aprovou.
2. **Lucro existe a partir de duas peças novas** (decisão 3): `obras.valor_contrato` e a
   tabela `recebimentos` (parcelas que o cliente da obra pagou). Sem elas a resposta
   honesta é "não tenho o valor do contrato" — e continua sendo, obra por obra, até
   alguém informar.
3. **O modelo não decide o que é lançamento.** A regra de ouro do fluxo (na dúvida, é
   lançamento) continua em código puro. O modelo só entra para separar *pergunta* de
   *ação* de *conversa* — depois que o código já descartou lançamento, comando e
   resposta a pendência.
4. **A frase de confirmação de uma ação é template em código**, não texto do modelo.
   Garante que o que se pergunta é exatamente o que se vai gravar (e o projeto B ajusta
   o texto em um lugar só).

## Onde entra no fluxo (`processarInbound`)

```
1. autorizados?        (igual)
2. dedupe              (igual)
3. mídia + áudio       (igual)
4. resposta a pendência aberta?
     pagamento  → SIM/NÃO/número      (igual)
     obra_*     → número              (igual)
     acao       → SIM executa a ação; NÃO cancela          ← NOVO
5. comando fixo?       (igual — barato e exato)
5b. assistente         ← MUDA: `roteador` decide se a mensagem é para o assistente
6. classifica          (igual)
```

### 5b — o roteador (`lib/whatsapp/roteador.ts` + `lib/ia/intencao.ts`)

Três camadas, na ordem em que erram:

1. **Código puro, vence sempre**: tem mídia → lançamento (classificador). Tem
   `CHEIRO_DE_LANCAMENTO` (R$, reais, paguei, pix…) **e** um número → lançamento.
   `ehPerguntaAoAssistente` verdadeiro → assistente (sem gastar modelo).
2. **Padrões de ação** (puro): começa com verbo de ação seguido de substantivo do CRM
   ("cria/cadastra/registra/arquiva/anota … obra/fornecedor/recebimento/contrato") →
   assistente. Cobre o caso comum sem modelo.
3. **Modelo, só no que sobrou** (texto sem mídia, sem cheiro de dinheiro, 4+ palavras):
   uma chamada `json_schema` estrita, saída
   `{ intencao: 'pergunta' | 'acao' | 'lancamento' | 'conversa' | 'nenhuma' }`.
   `pergunta`/`acao`/`conversa` → assistente; `lancamento`/`nenhuma` → classificador
   (o comportamento de hoje). Sem chave de modelo → camada 3 não existe e o fluxo é o
   de hoje. Falha do modelo → classificador.

`conversa` ("bom dia", "valeu") vai ao assistente para responder uma linha e **não abrir
pendência boba** — hoje vira `nao_identificado` no painel.

Dedupe por `whatsapp_respostas` como as perguntas de hoje (`pergunta`), porque o
assistente é onde o provider mais dá timeout e reenvia.

### O assistente (`lib/ia/assistente.ts`)

Continua o laço de hoje (busca → modelo → ferramentas → redige, teto de 4 rodadas), com:

- **Ferramentas de leitura ampliadas** (`lib/ia/ferramentas/obras.ts` + novo
  `lib/ia/ferramentas/crm.ts`), todas só leitura, Zod com limites, nome snake_case
  estável:

  | ferramenta | responde |
  |---|---|
  | `listar_obras` | obras vivas: nome, cliente, status, contrato, gasto, recebido |
  | `resumo_da_obra` | uma obra: contrato, gasto, recebido, **resultado** (recebido − gasto), **margem prevista** (contrato − gasto), gasto por etapa (top 5), últimos 5 pagamentos, notas faltando, documentos por pasta, último registro do diário |
  | `lucro_por_obra` | as 4 obras lado a lado: contrato, gasto, recebido, resultado, % gasto do contrato |
  | `gasto_por_etapa` | categoria (ETAPA do plano de contas) por obra e/ou período |
  | `pagamentos_recentes` | últimos N por obra/fornecedor/período, com descrição |
  | `listar_fornecedores` | busca por nome; total pago, nº de pagamentos, tem CNPJ/telefone |
  | `documentos_da_obra` | contagem por pasta e últimos arquivos (nome, data) |
  | `diario_da_obra` | últimos registros do diário |
  | `recebimentos_da_obra` | parcelas recebidas, total e último |
  | (existentes) `gasto_por_obra`, `gastos_por_periodo`, `maiores_fornecedores`, `pagamentos_sem_documento`, `pendencias_abertas` | (igual) |

  Nome de obra/fornecedor entra por **nome** e passa por `resolverPorNome` (exato/
  apelido, depois parecido único; ambíguo devolve as opções para o modelo perguntar).
  Lucro sem `valor_contrato` devolve `contrato: null` e o modelo diz que falta o valor
  e como informar ("mande: o contrato da Garibaldi é 850 mil").

- **Ferramentas de ação** (`lib/ia/ferramentas/acoes.ts`): `propor_criar_obra`,
  `propor_cadastrar_fornecedor`, `propor_definir_contrato`, `propor_registrar_recebimento`,
  `propor_arquivar_obra`. Cada uma **valida e devolve uma proposta**, nunca grava:
  resolve nomes, checa duplicata (obra com o mesmo nome viva, fornecedor igual), aplica
  defaults (data = hoje BR), e devolve `{ proposta: { tipo, dados, resumo } }`. O laço do
  assistente reconhece `proposta` no resultado e a devolve em
  `RespostaDoAssistente.proposta` (a **última** proposta válida da rodada; mais de uma
  proposta na mesma mensagem → responde que faz uma por vez).

- **Memória curta**: o prompt recebe `CONVERSA RECENTE` — as últimas 6 trocas do mesmo
  chat nas últimas 2 h (`mensagens_whats.texto_bruto/texto_transcrito` + a resposta do
  agente registrada em `ai_messages`/`whatsapp_respostas`). É o que faz "e no INOX?"
  depois de "quanto gastei na Garibaldi" funcionar. Quem lê é `lib/ia/memoria-curta.ts`;
  falha → sem memória, sem erro.

- **Prompt v3** (`prompts/assistente-obra.ts`): declara as fontes (contexto, ferramentas
  de leitura, ferramentas de proposta), a regra "lucro só com contrato", "uma ação por
  vez", e as regras de texto do projeto B (frases curtas, uma ideia por linha, terminar
  com o que fazer). `VERSAO = 3`.

### A pendência de ação e o SIM (`lib/services/acoes-whatsapp.ts`)

- `abrirPendenciaDeAcao(supabase, { mensagemId, proposta, chatId })`: grava
  `confirmacoes_pendentes` com `tipo = 'acao'`, `acao = proposta` (JSONB),
  `pergunta_enviada = perguntaDaAcao(proposta)`. Uma pendência por mensagem (índice que
  já existe). A mensagem de origem é gravada com `status = 'recebida'` e
  `classificacao = 'acao'`? Não: `mensagens_whats.classificacao` continua a do
  classificador; a mensagem de ação fica `recebida` e vira `confirmada`/`recusada`
  quando a pendência resolve (mesmos status do pagamento).
- `perguntaDaAcao(proposta)` — **puro**, template por tipo: repete cada campo em linha
  própria e termina com "Responda SIM para confirmar, ou NÃO para cancelar."
- `aplicarAcao(supabase, { confirmacaoId, via, respostaBruta })`: relê a pendência,
  recusa se resolvida (`ja_resolvida`) ou de outro tipo, executa a escrita **por tipo**
  numa função pequena (`criarObra`, `cadastrarFornecedor`, `definirContrato`,
  `registrarRecebimento`, `arquivarObra`), marca resolvida com `resultado` legível,
  emite evento (`obra.criada` etc. no barramento — só log, regra nenhuma reage), e
  devolve `{ ok, texto }` com a frase de sucesso do template. Corrida do retry: a
  pré-checagem de `resolvida` + `UPDATE … WHERE resolvida = false` com `erroDeEscrita`;
  perdedor recebe `ja_resolvida` e responde a mesma frase de sucesso (idempotente para
  quem lê).
- `recusarConfirmacao` já serve para o NÃO (aceita qualquer tipo).
- `/pendentes` mostra pendências de ação (título pela `pergunta_enviada`) com Confirmar /
  Rejeitar; a action da tela chama `aplicarAcao` quando `tipo = 'acao'`.
- Expiração: a mesma varredura de 24 h das pendências de pagamento.

### Banco (`supabase/migrations/20260916230000_contrato_recebimentos_acoes.sql`)

- `ALTER TABLE obras ADD COLUMN valor_contrato numeric(14,2) CHECK (valor_contrato > 0)`.
- `CREATE TABLE recebimentos (id uuid pk, obra_id uuid not null → obras, valor numeric(14,2)
  not null check > 0, data_recebimento date not null, descricao text, origem text not null
  default 'manual' check in ('manual','whatsapp'), criado_por_user_id uuid → auth.users,
  autorizado_id uuid → autorizados, observacoes text, created_at/updated_at/deleted_at)`;
  índices `(obra_id) where deleted_at is null` e `(data_recebimento)`; RLS ligada;
  policies no formato do projeto (`TO authenticated`, `(select auth.uid())`,
  `(select has_role(...))`): SELECT para authenticated; INSERT/UPDATE para
  admin/gestor/financeiro; DELETE só admin; `service_role` bypassa. Trigger de auditoria
  e de `updated_at` iguais a `pagamentos`. `GRANT` como as demais tabelas (sem TRUNCATE/
  REFERENCES/TRIGGER para authenticated).
- `confirmacoes_pendentes`: `tipo` aceita `'acao'`; coluna `acao jsonb`.
- `audit_log` cobre `recebimentos` (o trigger genérico).
- `busca_global` passa a devolver recebimentos? **Não** (fora do escopo).
- `pagamentos_sem_documento`, `saude_sistema`: sem mudança.

### Painel (mínimo para o dado existir fora do WhatsApp)

- Formulário de obra: campo **Valor do contrato (R$)** (texto pt-BR, `parseValorBR`).
- Página da obra: bloco **Resultado** — Contrato · Gasto · Recebido · Resultado, com a
  barra de orçamento passando a usar `valor_contrato` quando `orcamento` é nulo — e seção
  **Recebimentos** (lista + formulário de nova parcela + arquivar), com `erroDeEscrita`,
  `voltarComErro` e `revalidatePath`. Server actions em
  `app/(app)/obras/[id]/recebimentos/actions.ts`.
- `lib/data/recebimentos.ts` (listar por obra, somar por obra) e `lib/data/obras.ts`
  ganha `resumoFinanceiroDaObra` (contrato, gasto = `STATUS_QUE_CONTAM`, recebido).

### Classificador: obra sugerida pela conversa

`contexto.obraSugerida` (nome) entra no prompt do classificador quando o remetente
resolveu uma pendência de obra, criou uma obra ou perguntou por uma obra nas últimas 2 h
nesse chat (`lib/ia/memoria-curta.ts › obraRecente`). O modelo usa como default quando a
mensagem não cita obra; o mock também. É o que faz "vou mandar os documentos aqui" depois
de "cria a obra X" arquivar na obra certa sem perguntar a cada foto. Grupo com obra
dedicada continua vencendo.

## O que NÃO entra

- Lançar pagamento por ferramenta (já existe pelo classificador; duas portas = duas
  regras).
- Editar/apagar pagamento pelo WhatsApp.
- Ação sem confirmação.
- Modelo com acesso a SQL.
- Mudar `ehPerguntaAoAssistente` para ser largo: ela continua estreita; o roteador é
  quem amplia, e só quando as travas puras já passaram.

## Erros e degradação

| Situação | Comportamento |
|---|---|
| Sem chave de modelo | roteador sem camada 3; assistente responde como hoje (busca/texto fixo); ações não existem |
| Modelo cai no roteador | trata como `nenhuma` → classificador (fluxo de hoje) |
| Modelo cai no assistente | `SEM_CONTEXTO` como hoje; nada gravado |
| Ferramenta de ação com nome ambíguo | devolve opções; o modelo pergunta qual; não abre pendência |
| Duas propostas na mesma rodada | responde "uma de cada vez" com as duas listadas; não abre pendência |
| SIM com pendência de ação já resolvida | responde a frase de sucesso (idempotente) |
| Falha ao executar a ação | pendência fica aberta, `resultado` guarda o erro, resposta `falhaTemporaria`; painel pode confirmar de novo |

## Testes

- `roteador.test.ts`: tabela de frases → destino, sem modelo (camadas 1–2) e com modelo
  falso (camada 3); lançamento sempre vence; mídia nunca vai ao assistente.
- `intencao.test.ts`: schema estrito, resposta inválida → `nenhuma`.
- `ferramentas/crm.test.ts` e `acoes.test.ts` com `fakeSupabase`: totais, lucro sem
  contrato, nome ambíguo, duplicata, proposta bem formada.
- `acoes-whatsapp.test.ts`: `perguntaDaAcao` (snapshot por tipo), `aplicarAcao` por tipo,
  idempotência (`ja_resolvida`), recusa.
- `inbound-whatsapp.test.ts`: cenário "cria a obra X" → pendência `acao` → "SIM" → obra
  existe; "NÃO" → recusada; e "bom dia" → resposta sem pendência.
- `memoria-curta.test.ts`: janela de 2 h, 6 trocas, chat certo.
- `openai.real.test.ts` (gated `TESTE_REAL=1`): "quanto estou lucrando na Garibaldi" (sem
  contrato → diz que falta), "cria uma obra chamada Sítio do Pedro" → proposta.
