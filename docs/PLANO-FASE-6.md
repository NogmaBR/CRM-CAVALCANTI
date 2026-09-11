# Fase 6 — Vendas: o plano, reescrito em cima do que a Cavalcanti já tem

> Escrito em **2026-09-11**, depois de fechar as Fases 1–5. Substitui a seção
> "FASE 6" de `PLANO-ARQUITETURA-CODE-FIRST.md`, que foi escrita antes de se
> saber o que está na §1 abaixo.
>
> **Nada daqui entra em código antes de 16/09.** O congelamento da Fase 1 vale:
> entre hoje e a entrega, só correção de bug. Este documento existe para que no
> dia 17 o trabalho comece pela decisão certa, não pela primeira tabela.

---

## 1. O fato que muda o plano

O plano original da Fase 6 dizia: "leads, corretores, unidades, propostas, vendas,
contratos — 8 a 12 semanas, um produto novo dentro do mesmo repositório".

Só que `docs/ALINHAMENTO-CAVALCANTI-16-09.md` (Bloco A) registra o que a Cavalcanti
**já tem**:

| O que existe no ERP/CRM005 | Tamanho | Estado do acesso |
|---|---|---|
| Funcionários com login e função (V, G, A, S, T, X) | 43, dos quais 34 vendedores | `GetFuncionarios` funciona; 9 sem login |
| Clientes ativos | 2.955 | `SetCliente` funciona; contrato incompleto |
| Agenda por vendedor | 1 dia × 1 login por chamada | `GetAgendamentos`, `IncAgendamento`, `AltAgendamento` |
| Ocorrências por vendedor | mesma limitação | funciona |
| Títulos e comodatos (inadimplência) | só por cliente | funciona, 2.955 chamadas para a carteira |
| Pedidos de venda | — | `GetPedidoVenda` **quebrado** (`Table unknown VENPEDIDODOC`) |
| Exclusão de agendamento | — | **não existe** |
| WhatsApp do funcionário | — | **não existe no cadastro** |

**A Cavalcanti não precisa de um CRM de vendas do zero. Ela tem um.** O que ela não
tem é o que este projeto faz bem: o canal WhatsApp, o assistente, as automações, os
relatórios. Construir `leads/propostas/contratos` no Supabase criaria um segundo
sistema de verdade para 34 vendedores que já trabalham no primeiro — e o segundo
perde.

Isso não invalida a decisão da FASE 0 (cenário A, expansão). Muda **o que** se
expande: não a modelagem de vendas, e sim **a ponte entre o CRM Nogma e o ERP**, com
o WhatsApp no meio.

---

## 2. Três caminhos, e o recomendado

| | A. Funil próprio | B. Espelho operacional do ERP | C. Híbrido faseado |
|---|---|---|---|
| O que é | O plano original: leads, corretores, unidades, propostas, vendas, contratos no Supabase | O CRM **lê** do ERP (agenda, carteira, inadimplência, ocorrências) e entrega pelo WhatsApp, assistente e automações. **Escreve pouco**, e sempre com confirmação | B primeiro; funil próprio só para o que o ERP não tem (lead que chega pelo WhatsApp antes de ser cliente) |
| Fonte de verdade de cliente e venda | Supabase | **ERP** | ERP; o CRM só para o que nasce nele |
| Prazo | 8–12 semanas | **4–6 semanas** | 6–9 semanas |
| Maior risco | Dois sistemas para o mesmo vendedor; ninguém migra | Depende do parceiro do ERP (HTTPS, endpoints, os 9 logins) | Os dois acima, em doses menores |
| O que a Cavalcanti ganha no 1º mês | Telas vazias esperando cadastro | Agenda do dia no WhatsApp do vendedor, inadimplência da carteira, resumo para o gestor | O mesmo que B |

**Recomendação: C, com B como primeiro marco.** B entrega valor em semanas sobre dados
que já existem; o funil próprio (M5 abaixo) só se justifica quando aparecer o caso
concreto de lead que o ERP não captura — e aí ele nasce ligado ao ERP via `SetCliente`,
não paralelo a ele.

O caminho A continua possível. Só não é o que os fatos pedem hoje.

---

## 3. Princípios que valem em qualquer caminho

1. **O ERP é a fonte de verdade de cliente, venda e agenda.** O CRM guarda cópia com
   `sincronizado_em` e nunca "corrige" o ERP por conta própria.
2. **O CRM é a fonte de verdade do que o ERP não tem:** WhatsApp do funcionário, leads
   de entrada, preferências de aviso. Essas colunas moram aqui, com chave para o
   código do ERP.
3. **Escrita no ERP só com confirmação humana.** Mesmo desenho do pagamento: o bot
   propõe, a pessoa responde SIM, aí grava. `IA_AUTO_APROVAR=false` continua valendo
   para o ERP.
4. **Integração atrás de interface**, como `lib/services/uazapi.ts`: um adaptador em
   `lib/services/erp/` com **allowlist de endpoints**. Trocar de parceiro não toca o
   resto.
5. **Sincronização em lote pelo banco**, não em request de usuário: `pg_cron` acorda
   `/api/cron/erp-sync`, que enfileira um job por vendedor na fila `erp_sync` (pgmq),
   e o consumidor drena respeitando o limite do parceiro. É o mesmo padrão da Fase 3,
   já provado em produção.
6. **Tudo que sincroniza vira linha em `sync_runs`** e entra em `saude_sistema()`:
   sync que não roda há mais de um ciclo é problema, não aviso.

---

## 4. Modelo de dados

### 4.1 — Espelho do ERP (marcos M1–M4)

```
erp_funcionarios      codigo (PK do ERP) · nome · login · funcao · ativo
                      telefone_whats  ← só existe AQUI; o ERP não tem
                      sincronizado_em
erp_clientes          codigo · nome · documento · vendedor_codigo · sincronizado_em
erp_agendamentos      erp_id · vendedor_codigo · cliente_codigo · quando · status
                      origem ('erp' | 'crm') · sincronizado_em
erp_ocorrencias       erp_id · vendedor_codigo · cliente_codigo · texto · quando
erp_titulos           erp_id · cliente_codigo · vencimento · valor · situacao
sync_runs             id · alvo ('funcionarios'|'clientes'|'agenda'|'titulos')
                      iniciado_em · terminado_em · ok · requisicoes · erro
```

Todas com RLS (leitura por `gestor`/`admin`; escrita só `service_role`), índice em
`vendedor_codigo` e `cliente_codigo`, e `sincronizado_em` para o painel mostrar "dado
de quando".

### 4.2 — A ponte obra ↔ empreendimento (marcos M3+)

```
empreendimentos       id · nome · obra_id (nullable, FK obras) · erp_codigo (nullable)
unidades              id · empreendimento_id · identificador ('Casa 3', 'Apto 201')
                      status ('disponivel'|'reservada'|'vendida') · valor · cliente_codigo
```

Uma obra é o que se constrói; um empreendimento é o que se vende. 1:1 na maioria dos
casos, 1:N nas "7 casas". `obra_id` nullable porque há empreendimento sem obra ativa
(estoque pronto) e obra sem venda (obra para terceiro).

### 4.3 — Só no caminho C (marco M5)

```
leads                 id · origem ('whatsapp'|'site'|'indicacao') · telefone · nome
                      empreendimento_id · corretor_codigo (FK erp_funcionarios)
                      status ('novo'|'em_contato'|'visita'|'proposta'|'cliente'|'perdido')
                      cliente_codigo (preenchido quando SetCliente devolver o código)
```

Os eventos já estão declarados em `lib/events/tipos.ts` desde a Fase 2
(`lead.criado`, `lead.atribuido`, `lead.sem_resposta`, `visita.agendada`, …). Não
precisa desenhar nomenclatura de novo.

---

## 5. Marcos

Cada marco termina com algo que o gestor **vê no WhatsApp**, não com tabela criada.

### M0 — Pré-requisitos (humano, sem código)

- [ ] Respostas do parceiro do ERP às perguntas A.2 do alinhamento, em especial:
      os 9 funcionários sem login (ignorar ou cadastrar?) e a legenda de `Funcao`
- [ ] **HTTPS ou liberação de IP** para produção (A.2 #4). Sem isso o adaptador não
      sai do ambiente de teste
- [ ] Teste controlado de escrita (A.4): uma ocorrência e um agendamento no banco de
      teste, confirmados pelo parceiro no CRM005
- [ ] Decisão do caminho (§2)

**Pronto quando:** existir uma credencial de produção do ERP no `.env.local` e uma
chamada `GetFuncionarios` real devolvendo os 43.

### M1 — Adaptador e espelho de cadastro (1 semana)

- `lib/services/erp/` com interface, allowlist de endpoints, timeout, retentativa e
  log estruturado (`area: erp`)
- Migration: `erp_funcionarios`, `erp_clientes`, `sync_runs`
- `/api/cron/erp-sync?alvo=funcionarios|clientes` + `pg_cron` diário
- Tela `/config/erp`: última sincronização, contagens, erros — e o campo
  **WhatsApp do funcionário**, que só existe aqui
- `saude_sistema()` passa a olhar `sync_runs`

**Pronto quando:** os 43 funcionários e os 2.955 clientes estiverem no Supabase com
`sincronizado_em` de hoje, e o gestor tiver cadastrado o WhatsApp de pelo menos um
vendedor.

### M2 — Agenda e ocorrências no WhatsApp do vendedor (1–2 semanas)

- Fila `erp_sync` (pgmq) + handler: um job por vendedor por dia (`GetAgendamentos`),
  respeitando o limite de 1 dia × 1 login por chamada — os 238 requests viram 34 jobs
  de 7 chamadas
- Migration: `erp_agendamentos`, `erp_ocorrencias`
- Automação `agenda.do_dia`: às 7h, cada vendedor com WhatsApp cadastrado recebe a
  agenda dele. Nasce **desligada**, como todas
- Comando do bot: `agenda` / `agenda amanhã` (só para número que casa com
  `erp_funcionarios.telefone_whats`)
- Ferramenta do assistente: `agenda_do_vendedor`

**Pronto quando:** um vendedor real receber a agenda de amanhã no WhatsApp sem
ninguém tocar em nada.

### M3 — Inadimplência e carteira (1 semana)

- Sync de títulos: 2.955 chamadas por cliente → fila com lote de 100 por invocação,
  rodando de madrugada; `sync_runs.requisicoes` para medir
- Migration: `erp_titulos`, `empreendimentos`, `unidades` (a ponte da §4.2)
- Ferramentas do assistente: `inadimplencia_do_cliente`, `carteira_do_vendedor`
- Automação `titulo.vencido_ha_dias`: aviso ao gestor com o total da carteira

**Pronto quando:** "quanto tem vencido na carteira do Charlie?" for respondido no
WhatsApp com número que bate com o ERP.

### M4 — Escrita controlada no ERP (1 semana)

- `IncAgendamento` e ocorrência via WhatsApp, **com confirmação SIM** — mesmo fluxo
  de `confirmacoes_pendentes`, mesma janela de 24h
- `AltAgendamento` para concluir (não há exclusão no ERP; o CRM não inventa uma)
- `erp_agendamentos.origem = 'crm'` para saber o que nasceu aqui
- Idempotência: índice único por (vendedor, cliente, quando) + checagem antes de
  escrever — o ERP não tem "desfazer"

**Pronto quando:** um agendamento criado por áudio no WhatsApp aparecer no CRM005 e o
parceiro confirmar.

### M5 — Leads de entrada (só caminho C; 2–3 semanas)

- `leads` + emissão de `lead.criado` quando um número **não cadastrado** manda
  mensagem com cheiro de interesse (hoje é ignorado em silêncio, por segurança — isso
  continua o padrão; o lead só nasce se o gestor ligar a automação)
- Atribuição a vendedor (`lead.atribuido`) e `lead.sem_resposta` em 24h → aviso
- Quando vira cliente: `SetCliente` no ERP com confirmação, e `cliente_codigo`
  preenchido — o lead morre aqui e a vida segue no ERP

**Pronto quando:** um lead que chegou pelo WhatsApp virar cliente no CRM005 sem
digitação dupla.

---

## 6. O que eu preciso de você para começar

Sem isto não há M1. Com isto, M1 começa no dia 17.

1. **O caminho** — A, B ou C (§2). Minha recomendação é C começando por B.
2. **As respostas do parceiro do ERP** (A.2 do alinhamento): os 9 logins, a legenda de
   `Funcao`, e **HTTPS ou IP liberado**. Este último é o bloqueador de verdade.
3. **A credencial do ERP** no `.env.local`, e a URL de produção.
4. **Quem recebe o quê:** a agenda vai para o vendedor, a inadimplência para o gestor,
   ou tudo para o Fernando? Define quem precisa de WhatsApp cadastrado primeiro.
5. **O que se vende** — só para a ponte da §4.2 e para M5: unidades de empreendimento
   próprio, lotes, casas avulsas, ou construção sob contrato? Pode esperar até M3.

---

## 7. Riscos que já dá para nomear

| Risco | Como o plano lida |
|---|---|
| O parceiro do ERP não libera HTTPS/IP | M0 não fecha, nada começa. Melhor descobrir na semana 0 que na 4 |
| 238 requests por ciclo derrubam o ERP ou estouram o tempo da função | Fila com um job por vendedor, lote pequeno, de madrugada; `sync_runs.requisicoes` mede antes de doer |
| `GetPedidoVenda` quebrado | Vendas ficam fora do espelho até o parceiro consertar. O plano não depende dele |
| Dois sistemas divergem (agenda editada nos dois) | `origem` em cada linha; o ERP vence; o CRM mostra "dado de quando" |
| Vendedor não tem WhatsApp cadastrado | A tela de M1 é a primeira coisa a existir, e `agenda.do_dia` pula quem não tem |
| Escrita errada no ERP sem "desfazer" | Confirmação SIM obrigatória + idempotência + `origem = 'crm'` para auditar |

---

## 8. O que NÃO entra

- Reescrever o funil do ERP no CRM. Se um dia o CRM005 for desligado, aí é outro
  projeto, com outro plano.
- Python/LangGraph. Nada aqui tem grafo de estado; são chamadas HTTP e filas, que já
  existem em TypeScript.
- NestJS. O único consumidor continua sendo o front e o WhatsApp.

---

## 9. Cronograma, se tudo der certo

```
até 16/09   Fase 1: entrega. Congelamento. Este documento é a única saída da Fase 6.
17/09       M0 — depende só de você e do parceiro do ERP
sem 1       M1 — espelho de cadastro
sem 2–3     M2 — agenda no WhatsApp do vendedor
sem 4       M3 — inadimplência e a ponte obra ↔ empreendimento
sem 5       M4 — escrita controlada
sem 6–8     M5 — leads (só se C)
```

**Da entrega até M4: 5 semanas.** Comparado às 8–12 do plano original, com a
diferença de que cada marco termina no WhatsApp de alguém da Cavalcanti.
