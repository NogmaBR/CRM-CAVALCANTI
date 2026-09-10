# Plano de evolução para arquitetura 100% code-first

> Análise da proposta de arquitetura e plano por fases.
> Escrito em 2026-09-10, com o estado real do sistema verificado contra produção.

---

## Resumo executivo — leia isto antes do resto

Três conclusões que mudam o plano proposto:

**1. O n8n já não é dependência. Isso está feito.** Verifiquei: as únicas menções a
n8n no código são *comentários*. O `dispatchEvento` é um despachante genérico de
webhooks (URL + secret + eventos, configurados no banco) — o n8n era apenas o consumidor
pretendido, nunca um acoplamento. E desde o merge do PR #3, todo o fluxo do WhatsApp
roda em código no CRM: recepção, autorização, transcrição, classificação, resposta ao
cliente e lançamento automático. **Nenhuma instância de n8n foi provisionada e nenhuma
é necessária.** O objetivo central do pedido já está cumprido.

**2. A arquitetura proposta descreve um produto diferente do que existe hoje.** Isto é
o item mais importante e está detalhado na §1. Precisa de decisão antes de qualquer
linha de código.

**3. A entrega ao cliente é em 16/09.** Qualquer mudança estrutural precisa começar
*depois* dela. Reescrever a base agora seria trocar um sistema que funciona e está no
ar por um que não existe, a seis dias do prazo.

---

## 1. 🔴 BLOQUEADOR: a proposta é de outro domínio

A arquitetura proposta lista estas entidades:

```
leads · contacts · customers · brokers · teams
developments · buildings · units
pipelines · pipeline_stages · opportunities
proposals · sales · contracts · appointments
```

Isso é um **CRM de vendas imobiliárias**: capta lead, corretor atende, agenda visita,
faz proposta, vende unidade, gera contrato.

O sistema que existe hoje tem estas 16 tabelas em produção:

```
obras · fornecedores · pagamentos · categorias · documentos
autorizados · mensagens_whats · confirmacoes_pendentes
profiles · audit_log · webhooks_outbound · notificacoes_email
lembretes_agendados · rate_limits · obra_compartilhamentos
fornecedor_apelidos
```

Isso é um **CRM de gestão de despesa de obra**: registra o que a construtora *paga* a
fornecedores, com nota fiscal e comprovante.

**A sobreposição é de ~5 entidades em 33** — documentos, auditoria, usuários,
notificações e mensagens. Todo o núcleo é disjunto. O CRM atual não tem funil de
vendas, não tem corretor, não tem unidade à venda; ele rastreia dinheiro **saindo**,
não entrando.

### O que precisa ser decidido

| Cenário | O que significa | Impacto no plano |
|---|---|---|
| **A. Expansão** ✅ **ESCOLHIDO** | A Cavalcanti também vende o que constrói, e o CRM passa a cobrir os dois lados | As duas árvores convivem; `obras`↔`developments` viram a ponte. Fases 2-5 valem, mais uma fase de domínio |
| **B. Produto novo** | É outro CRM, para outro cliente/mercado | Repositório novo. O atual continua entregue e estável. Reaproveita padrões, não código |
| **C. Pivô** | O CRM de obras vira CRM de vendas | O trabalho atual vira legado. Precisa combinar o que acontece com a entrega da Cavalcanti |
| **D. Texto genérico** | A proposta veio de outro contexto e o domínio não é para valer | Descarta-se a lista de entidades; ficam só as fases de arquitetura |

**Decidido em 2026-09-10: cenário A.** (O texto abaixo é de quando a decisão estava aberta.)

**Não consigo escolher por você e não vou adivinhar.** As fases 2 a 5 abaixo valem em
qualquer cenário, porque são infraestrutura, não domínio. A fase 6 depende da resposta.

---

## 2. Análise honesta da stack proposta

O que segue é opinião técnica fundamentada, não resistência a mudança. Onde a proposta
está certa, digo. Onde tem custo escondido, também.

### ✅ O que está claramente certo

- **Motor de automação orientado a eventos.** É a substituição correta de um workflow
  visual, e traz Git, testes, revisão e CI — coisas que o n8n não dá.
- **Filas e workers para trabalho assíncrono.** Hoje o webhook do UAZAPI faz download
  de mídia, transcrição e chamada de IA **dentro do request**. Isso já está no limite:
  se a transcrição demorar, o provider dá timeout e reenvia. Precisa virar fila.
- **Integrações atrás de interface.** Já é o padrão adotado — `lib/services/uazapi.ts`
  isola o provider. Trocar de fornecedor não deve tocar o CRM.
- **Prompts versionados em arquivo**, não string perdida no código.
- **Tools com allowlist explícita** para o agente. Deixar um LLM com acesso amplo ao
  banco é um risco que não se justifica.
- **Separar dados de IA dos dados de negócio.**
- **RBAC + auditoria + RLS.** Já existe e funciona; manter.

### ⚠️ Onde eu discordaria, e por quê

**NestJS como API separada.** O Next.js App Router *já é* o backend: route handlers e
server actions com validação Zod, RLS no banco e tipos compartilhados. Introduzir
NestJS significa dois runtimes, duas camadas de auth, dois lugares para validar, e
reescrever ~50 server actions que hoje funcionam e estão testadas.

O motivo legítimo para uma API separada é ter **múltiplos consumidores** (app mobile,
API pública para terceiros) ou **um time grande precisando de fronteiras rígidas**.
Se for um desses casos, NestJS se paga. Se o consumidor é só o próprio front, ele
adiciona superfície sem adicionar capacidade.

**Importante:** worker com fila **não exige NestJS**. Um processo Node comum consumindo
BullMQ resolve, e pode importar os mesmos serviços de `lib/` que o app já usa.

*Recomendação:* mantenha o Next.js como API. Extraia a lógica de `lib/services/` para
um pacote compartilhado que tanto o app quanto os workers importam. Reavalie NestJS
quando aparecer o segundo consumidor.

**Python + FastAPI + LangGraph.** Justifica-se quando o agente precisa de estado entre
passos, ramificação e retomada — que é o que o LangGraph resolve bem. Hoje a
necessidade é "classificar uma mensagem e devolver JSON estruturado", que é **uma
chamada** e já está implementada em TypeScript com structured outputs.

RAG também não exige Python: pgvector + uma chamada de embeddings funciona igual em TS,
e evita um terceiro runtime, um terceiro deploy e a serialização de contexto entre
serviços.

*Recomendação:* adie o Python até existir um agente que genuinamente precise de grafo
com estado. Quando precisar, o serviço nasce isolado e sem precisar reescrever nada.

**Sair da Vercel para VPS.** Aqui há um fato técnico que decide: **BullMQ precisa de
processo vivo, e serverless não tem isso.** Se a arquitetura vai ter workers, algo
precisa rodar fora da Vercel.

Mas isso não obriga a mover *tudo*. Duas opções reais:

| Opção | Como fica | Prós | Contras |
|---|---|---|---|
| **Híbrida** | Web na Vercel, workers + Redis numa VPS pequena | Mantém preview deploys, SSL e escala automática do front; ops mínima | Dois lugares para observar |
| **VPS completa** | Tudo em Docker na VPS, Caddy na frente | Controle total, custo previsível | Você assume SSL, deploy, uptime, backup, escala |

*Recomendação:* comece híbrido. Migrar o front depois é fácil; voltar atrás de uma
migração completa mal-feita, não.

**Antes de adotar Redis + BullMQ, considere o que já está disponível:** o Supabase
deste projeto tem `pg_cron` 1.6.4 e `pg_net` 0.20.4 **disponíveis e não instalados**.
Para agendamento e disparo assíncrono simples, isso resolve sem infraestrutura nova.
BullMQ passa a valer quando houver retry com backoff, prioridade, rate limit por fila
e observabilidade de job — que é exatamente o caso do WhatsApp, então provavelmente
vai valer. Só não precisa ser o primeiro passo.

### 📌 Fatos do ambiente que o plano leva em conta

- `pgvector` **0.8.2 disponível**, não instalado — RAG é uma migration de distância
- `pg_cron`, `pg_net`, `http` disponíveis, não instalados
- Supabase em `sa-east-1`, PostgreSQL 17.6, `ACTIVE_HEALTHY`
- 177 testes passando, typecheck limpo, build ok
- O banco de produção **foi populado em 2026-09-10**: 10 obras, 8 fornecedores,
  80 pagamentos (R$ 453.500,00), 9 categorias. Conferido obra a obra contra o
  protótipo. Nenhum documento anexado ainda — os PDFs seguem no OneDrive, então
  os 80 pagamentos contam como "sem nota" para efeito de automação

---

## 3. As fases

Cada fase tem critério de pronto verificável. Nenhuma depende de trabalho manual do
usuário além do que está marcado.

---

### FASE 0 — ✅ DECIDIDA em 2026-09-10

As três respostas, como o cliente decidiu:

#### 1. Domínio → **Cenário A, Expansão**

A Cavalcanti também vende o que constrói. As duas árvores convivem e
`obras` ↔ `empreendimentos` é a ponte.

O que isso implica, concretamente:

- **Nada do que existe é jogado fora.** Obras, fornecedores, pagamentos e o
  fluxo do WhatsApp continuam sendo o produto entregue em 16/09.
- **A Fase 6 passa a existir de verdade** — é ela que traz `leads`,
  `corretores`, `unidades`, `propostas`, `vendas`, `contratos`.
- **O catálogo de eventos já previu isso.** `lib/events/tipos.ts` declara
  `EventosVendas` desde o primeiro commit do motor, sem emissor, exatamente
  para o desenho não precisar mudar quando a decisão chegasse. Chegou, e não
  precisa.
- **A ponte não é renomear.** Uma obra é o que se constrói; um empreendimento
  é o que se vende. Podem ser 1:1, mas também 1:N — as "NSIY 7 Casas" são uma
  obra e sete unidades vendáveis. A modelagem tem que aguentar isso desde o
  começo, e é a primeira coisa a desenhar na Fase 6.

#### 2. Hospedagem → **Só Vercel, DNS na Cloudflare** *(revisado em 2026-09-10)*

> A primeira resposta foi "híbrida, com workers numa VPS". Ao detalhar, o cliente
> preferiu **não ter VPS nenhuma**: web na Vercel, DNS na Cloudflare. Esta seção
> registra a decisão final e o que ela custa.

Sem VPS não há processo vivo, e sem processo vivo **não há BullMQ** — ele precisa
de um consumidor rodando para sempre. Mas isso não significa ficar sem fila.

**A fila passa a morar no banco**, com três extensões já instaladas e verificadas:

| Peça | Papel |
|---|---|
| `pgmq` 1.5.1 | Guarda a mensagem, entrega uma vez, esconde por N segundos (visibility timeout) e devolve à fila se ninguém confirmar |
| `pg_cron` 1.6.4 | Acorda de minuto em minuto e pergunta se há o que fazer |
| `pg_net` 0.20.4 | Chama uma rota da Vercel de forma assíncrona, sem segurar conexão |

Testado neste banco antes de adotar: criar fila, enviar e ler com visibility
timeout funcionam. `pgmq.send` tem variante com **delay**, o que cobre job
adiado e backoff de retentativa.

**O que se perde em relação a Redis + BullMQ:**

- Painel de observação pronto (o do BullMQ vem de graça; aqui é uma tela nossa
  sobre `pgmq.q_*` e `pgmq.a_*`, ou SQL)
- Prioridade por job
- Throughput de Redis — irrelevante nesta escala: são dezenas de mensagens por
  dia, não milhares por segundo

**O que se ganha:** zero servidor para administrar, atualizar, vigiar e pagar.
Nada de SSL, uptime, backup ou worker que morre em silêncio às 3h da manhã.

Para esta escala, a troca vale. Se um dia o volume justificar Redis, migrar de
`pgmq` para BullMQ é trocar o adaptador de fila — não a arquitetura, porque o
que enfileira e o que consome continuam sendo os mesmos serviços em `lib/`.

> ⚠️ **Achado que esta decisão torna mais importante: as regiões não batem.**
>
> As funções da Vercel rodam em **`iad1` (Virgínia)** e o Supabase está em
> **`sa-east-1` (São Paulo)**. Toda consulta do servidor atravessa ~7.600 km.
>
> Medido em produção em 2026-09-10, no `/api/cron/automacoes` com as regras
> desligadas — o que é essencialmente **uma** consulta: `154, 392, 394, 461,
> 900 ms`, mediana **394 ms**.
>
> Com tudo na Vercel, isso deixa de ser detalhe: cada página server-rendered
> paga esse pedágio, várias vezes. Mudar a região das funções para `gru1`
> (São Paulo) é configuração, mas **exige plano pago** — e o repositório já
> depende de ir para o plano pago para virar privado. São a mesma conversa.
>
> Não confundir com o DNS na Cloudflare: Cloudflare acelera o que é estático e
> a resolução de nome. Ela não encurta a distância entre a função e o banco.

#### 3. API → **Manter Next.js**

Sem NestJS. O App Router já é o backend: route handlers, server actions com
Zod, RLS no banco e tipos compartilhados. NestJS se pagaria com múltiplos
consumidores ou time grande precisando de fronteiras rígidas; com o front como
único consumidor, adicionaria superfície sem adicionar capacidade.

Consequência prática para a Fase 3: a lógica de `lib/services/` sai para um
pacote compartilhado que **o app e os workers importam**. Worker com fila é um
processo Node comum consumindo a fila — não exige NestJS.

Reavaliar quando aparecer o segundo consumidor.

---

### FASE 1 — Blindar a entrega de 16/09 (até 16/09)

Nada de arquitetura até o cliente receber. O que entra aqui é só o que falta para a
entrega funcionar:

- Popular o banco com os dados reais do cliente (10 obras, 8 fornecedores, 80 pagamentos
  — já inventariados em `docs/recuperacao/2026-09-09/`)
- Adicionar a categoria "Frete" que falta em produção
- Limpar as 3 mensagens de teste de 07/09 que poluem `/pendentes`
- Cadastrar a equipe em `/config/autorizados`
- Credenciais UAZAPI + `ANTHROPIC_API_KEY`
- Tornar o repositório privado

**Pronto quando:** o cliente conseguir mandar uma foto de nota no WhatsApp e ver o
lançamento aparecer no painel, sem ninguém tocar em nada.

**Congelamento:** entre hoje e 16/09, nenhuma mudança estrutural. Só correção de bug.

---

### FASE 2 — Núcleo de eventos e automações (2 a 3 semanas, pós-entrega)

O "n8n de código" da proposta, construído **dentro da stack atual**. Sem infraestrutura
nova, sem Redis, sem VPS.

**Entregáveis:**

```
lib/events/
├── bus.ts                    emitir e assinar, tipado
├── tipos.ts                  catálogo de eventos do domínio
└── registry.ts

lib/automations/
├── engine.ts                 avalia regra → condição → ação
├── triggers/                 o que dispara
├── conditions/               quando roda
├── actions/                  o que faz
└── definitions/              as regras, versionadas em código
```

Tabelas novas: `automation_rules`, `automation_executions` (com log de cada execução,
que é o que o n8n dá de graça e você não pode perder).

O `dispatchEvento` atual vira **uma ação** entre outras, em vez de ser o único caminho
de saída.

**Pronto quando:** uma regra como "pagamento sem documento há 7 dias → cobrar o
fornecedor no WhatsApp" existir como código versionado, com teste, e sua execução
ficar registrada em `automation_executions`.

**Risco:** baixo. É aditivo; nada existente muda de comportamento.

---

### FASE 3 — Filas, sem sair da Vercel (1 a 2 semanas) *(revisado)*

**Esta fase existe por uma razão concreta:** hoje o webhook do UAZAPI faz download de
mídia, transcrição e chamada de IA dentro do request HTTP. Se qualquer um demorar, o
provider dá timeout e reenvia — e a idempotência que construí segura a duplicata, mas o
trabalho é refeito.

A versão anterior desta fase previa Redis + BullMQ numa VPS. **A decisão de hospedagem
mudou** (ver FASE 0): sem VPS, a fila é `pgmq` no próprio Postgres.

**Entregáveis:**

- Extrair `lib/services/` para `packages/core/`, importável pelo app e pelo consumidor
- Filas `pgmq`: `whatsapp-inbound`, `whatsapp-outbound`, `ia-classificacao`, `midia`
- Rota `/api/queue/consume`, protegida por segredo como os crons de hoje
- `pg_cron` chamando essa rota via `pg_net`, de minuto em minuto
- Retry com backoff usando `pgmq.send(..., delay)`; fila de arquivo (`pgmq.archive`)
  no lugar da dead-letter
- Tela de observação sobre `pgmq.q_*` — o que o painel do BullMQ daria pronto
- O webhook passa a só validar HMAC, enfileirar e responder 200

**Pronto quando:** o webhook responder em <100ms com a mídia sendo baixada depois, e um
job que falha três vezes aparecer arquivado e visível numa tela.

**Risco:** baixo, e menor que o da versão anterior — não há infraestrutura nova para
administrar. O risco que sobra é de desenho: `pgmq` entrega *pelo menos uma vez*, então
todo consumidor precisa ser idempotente. O motor de automações já é; os novos precisam
nascer assim.

---

### FASE 4 — IA e RAG (3 a 4 semanas)

**Entregáveis:**

- `CREATE EXTENSION vector` — já disponível no projeto
- Tabelas `knowledge_documents`, `knowledge_chunks`, `embeddings`
- Pipeline: documento → parser → chunking → embedding → pgvector
- Busca vetorial + montagem de contexto
- Tools com allowlist explícita, cada uma com schema e permissão
- Prompts em arquivo, versionados
- Tabelas `ai_conversations`, `ai_messages`, `ai_tool_calls` — separadas das de negócio

**Decisão dentro da fase:** TypeScript ou Python. Minha recomendação é começar em TS
(a chamada de embeddings e a busca vetorial são triviais nas duas linguagens) e só
extrair para Python quando entrar um agente com grafo de estado. Se a decisão for
Python desde já, o serviço nasce isolado atrás de HTTP e a fase não muda de forma.

**Pronto quando:** o gestor perguntar algo sobre um documento da obra no WhatsApp e
receber resposta fundamentada, com a fonte citada.

---

### FASE 5 — Infraestrutura e operação (2 semanas)

- Docker Compose: web, workers, redis, monitoramento
- Caddy com TLS automático
- Cloudflare: DNS, WAF, subdomínios por serviço
- GitHub Actions: lint → testes → build → imagem → deploy
- `/health`, `/ready`, `/metrics` em cada serviço
- Logs estruturados e alerta quando job falha ou worker cai
- Backup automatizado e **restore testado** — backup não testado não é backup

**Pronto quando:** um deploy inteiro sair de um merge na `main`, sem passo manual, e o
alerta chegar antes de o usuário perceber.

---

### FASE 6 — Domínio (depende da FASE 0)

Só faz sentido depois da decisão da §1. Se for expansão (cenário A):

- `developments` / `buildings` / `units` — o estoque à venda
- `leads` / `contacts` / `customers` — quem compra
- `brokers` / `teams` — quem vende
- `pipelines` / `opportunities` / `proposals` / `sales` / `contracts` — o funil
- `appointments` / `activities` / `tasks` — a operação
- A ponte: `obras` ↔ `developments` (a obra que se constrói é o empreendimento que se
  vende)

Estimativa realista: **8 a 12 semanas**, e é maior que tudo que veio antes somado.
É um produto novo dentro do mesmo repositório.

---

## 4. Cronograma

| Fase | Duração | Quando | Depende de |
|---|---|---|---|
| 0 — Decidir | ~1h | agora | você |
| 1 — Blindar entrega | até 16/09 | agora | credenciais |
| 2 — Eventos e automações | 2-3 sem | pós-16/09 | Fase 0 |
| 3 — Filas e workers | 2-3 sem | seguida | Fase 2 + VPS |
| 4 — IA e RAG | 3-4 sem | seguida | Fase 3 |
| 5 — Infra e operação | 2 sem | paralela à 4 | VPS |
| 6 — Domínio novo | 8-12 sem | por último | Fase 0 = A ou C |

**Da entrega até a arquitetura completa (sem a fase 6): ~10 a 12 semanas.**

---

## 5. Custo recorrente que a mudança introduz

Hoje o projeto roda em plano gratuito. A arquitetura proposta tem custo fixo:

| Item | Ordem de grandeza |
|---|---|
| VPS (workers + Redis) | US$ 10-20/mês para começar |
| VPS (stack completa) | US$ 40-80/mês |
| Supabase Pro (quando passar do free) | US$ 25/mês |
| Vercel Pro (se ficar na híbrida) | US$ 20/mês |
| LLM (classificação + RAG) | variável, US$ 5-50/mês no início |
| Cloudflare | gratuito no começo |

Não é caro, mas deixa de ser zero — e o repositório só vira privado quando a Vercel
for paga, o que hoje é uma pendência de segurança em aberto.

---

## 6. O que eu faria diferente da proposta

Resumindo as divergências, para ficarem explícitas:

1. **Não introduzir NestJS** enquanto o único consumidor for o próprio front.
2. **Não introduzir Python** enquanto não houver agente com estado.
3. **Não migrar tudo para VPS de uma vez** — híbrido primeiro.
4. **Considerar `pg_cron` antes de BullMQ** para o que for só agendamento.
5. **Resolver o domínio antes de tudo.** É a decisão que pode invalidar o resto.

O que a proposta acerta em cheio, e eu manteria integralmente: motor de automação
próprio orientado a eventos, filas para trabalho assíncrono, integrações atrás de
interface, prompts versionados, tools com allowlist, e separação entre dados de IA e
dados de negócio.

---

## 7. Próximo passo

Responda a §1 (domínio) e as duas decisões da Fase 0. Com isso eu detalho a fase
escolhida em tarefas executáveis, com arquivos e testes definidos.

Enquanto isso, a Fase 1 pode começar hoje — é independente de qualquer decisão de
arquitetura.
