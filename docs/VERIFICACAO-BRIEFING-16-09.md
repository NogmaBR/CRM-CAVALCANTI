# Verificação do briefing Cavalcanti × código real

> Conferência item a item feita em 2026-09-09, com evidência (`arquivo:linha` / resultado de grep)
> para cada afirmação. Nada aqui é suposição — tudo foi checado contra o código no commit `e7656e9`.
>
> **Importante — leia a §0 antes das outras seções.** A primeira versão deste documento olhou só o
> código do Next.js e concluiu que várias coisas "não existiam". Parte delas existe, mas **fora do
> repositório**: no `supabase/seed.sql` e nos workflows n8n documentados em `docs/N8N-COMPLETO.md`.
> As seções abaixo já estão corrigidas com essa leitura.

---

## 0. Onde cada peça mora (e por que "não achei no código" ≠ "não foi pensado")

O sistema foi desenhado com **duas arquiteturas possíveis** (`docs/N8N-COMPLETO.md:32-82`):

- **Pattern A — CRM direto:** UAZAPI → CRM → classificador Claude dentro do Next.js → Supabase.
- **Pattern B — n8n como middleware:** UAZAPI → n8n (baixa mídia + roda Claude + **responde no WhatsApp**) → CRM só persiste.

No Pattern B, o envio de WhatsApp e a IA **não são código deste repo por design** — rodam no n8n. Por isso
grep no `apps/web` não encontra: está previsto em `docs/N8N-COMPLETO.md` como JSON pronto pra importar.

**O que o Supabase faz aqui:** só banco + auth + storage. Confirmado que **não há** Edge Functions
(`supabase/functions/` não existe), **nem** `pg_net`/`pg_cron`/extensão `http`, **nem** trigger que
dispare HTTP (só triggers de `updated_at` e auditoria). Ou seja: o banco não executa lógica de
integração sozinho — quem orquestra é o CRM ou o n8n.

**Estado real de implantação** (`docs/MANUAL-PENDENCIAS.md:69-70,191`):

| Peça | Estado declarado no próprio manual |
|---|---|
| WhatsApp (UAZAPI) | ⏳ "Rota pronta, **sem provider**" — "fluxo WhatsApp inteiro está em **standby** até UAZAPI conectar" |
| n8n | ⏳ "Endpoint pronto, **sem consumidor**" — precisa instância + importar os workflows |
| Classificador IA | mock (`lib/ia/classifier.ts:70` só aceita `IA_PROVIDER=mock`; anthropic/openai lançam erro) |

Então: os workflows existem **como documentação executável**, não como sistema rodando.

---

## 1. Interface e ajustes — ✅ 7/7 COMPLETOS

| Item do briefing | Status | Evidência |
|---|---|---|
| Renomear "Histórico do Fornecedor" → "Relatório do Fornecedor" | ✅ | 5 ocorrências do nome novo, **0** do antigo (`relatorios-forms.tsx:200`, `pdf/fornecedor.tsx:68,72`, `csv.ts:171`) |
| Remover métrica de confiança da IA da interface | ✅ | 0 ocorrências em toda `app/(app)` |
| "Atividade recente" = ações do agente, não msg bruta | ✅ | `lib/data/painel.ts:377` (`AGENTE_ACAO`), usado em `:420`. Antes mostrava telefone + status técnico |
| Remover automações de e-mail para clientes | ✅ | `lib/email/` não existe mais; deps `resend`/`@react-email` fora do `package.json` |
| Logo do cliente em PNG transparente | ✅ | `public/logos/cavalcanti-mark-{light,dark}.png` (ícone "C" extraído do PDF do cliente) |
| Logo como atalho para o painel | ✅ | `components/layout/sidebar.tsx:14` — `<Link href="/painel">` |
| Modo branco: verde → azul mais forte | ✅ | `styles/tokens/colors.css:22,92,102` — `#283078` (medido da logo) em `--accent` **e** `--brand` |

---

## 2. Dados e organização — ⚠️ 4/6

| Item | Status | Evidência |
|---|---|---|
| Estruturar por obra/fornecedor/documentos/comprovantes/NF/pagamentos/categorias | ✅ | 14 tabelas no schema, todas as entidades presentes |
| Distinguir nota fiscal de comprovante | ✅ | `anexo_tipo AS ENUM ('nota_fiscal','comprovante','contrato','outro')` |
| Relatório de **obra**: total pago, docs, categoria, vínculos | ✅ | `lib/data/reports.ts:29` inclui `documentos:` |
| Relatório de **fornecedor**: total pago, vínculo com obras, contato, categoria, CNPJ | ✅ | `FornecedorData` tem `valorTotal`, `porObra`, `categoria_nome`; PDF tem CNPJ/e-mail/telefone |
| Relatório de fornecedor: **"documentos recebidos"** | ❌ **FALTA** | `FornecedorData` não busca `documentos`. Nem o PDF nem o CSV têm essa seção (o de obra tem) |
| Categorias validadas (mão de obra, limpeza, frete, hidráulica, entulho) | ⚠️ **existe seed, falta "Frete"** | `supabase/seed.sql` cadastra 8: Material, Elétrica, **Hidráulica**, **Limpeza**, **Entulho**, **Mão de obra**, Equipamentos, Outros. Bate com o briefing menos **Frete**, que não está lá. Falta (a) aplicar o seed no banco de produção e (b) validar a lista final com o cliente |

---

## 3. Pendências — ❌ 1/3

| Item | Status | Evidência |
|---|---|---|
| Filtros de status com cores pendente=amarelo, recusado=vermelho, aprovado=verde | ⚠️ **cores certas, nomes errados** | `pagamentos-table.tsx:15-24`: `aguardando→warning`(amarelo), `erro→danger`(vermelho), `confirmado→success`(verde). As cores batem, mas os rótulos são "Aguardando/Erro/Confirmado", não "Pendente/Recusado/Aprovado" |
| Revisar lógica "recusado/aprovado" para coerência com aprovação por WhatsApp | ❌ **INCOERENTE** | Não existe estado `recusado`. `pagamento_status = ('confirmado','aguardando','erro')`. Rejeitar no painel grava `status='erro'` + `erro_msg='Rejeitada pelo gestor'` (`pendentes/actions.ts`) — mistura **erro de processamento** com **recusa deliberada**, que são coisas semanticamente diferentes |
| Itens sem NF/comprovante viram pendência, **com contagem de dias** | ⚠️ **projetado no n8n, não implantado; e não aparece na UI** | Existe como **WF5** (`N8N-COMPLETO.md:886`): cron diário que faz `SELECT pagamentos WHERE status='aguardando' AND created_at < now() - 7d` e **cobra o fornecedor por WhatsApp**. Mas: (a) o WF5 não está implantado (n8n sem instância), e (b) mesmo com ele rodando, isso **cobra por WhatsApp** — não cria a visão de "pendências com X dias" **na tela** que o briefing descreve. Na UI não há nenhuma query de pagamento sem documento nem cálculo de dias. O cron `sweep-pending-documentos` do CRM tem nome parecido mas faz outra coisa (limpa uploads órfãos) |

---

## 4. Fluxo principal via WhatsApp — ⚠️ PROJETADO, NÃO LIGADO (e falta 1 elo real)

Este é o núcleo do produto. Boa parte **existe como projeto** (workflows n8n prontos pra importar),
mas nada está em execução — e há **um elo que não existe em lugar nenhum**, nem no CRM nem no n8n.

| Etapa do briefing | Status | Onde está / o que falta |
|---|---|---|
| Cliente envia áudio, texto ou documento | ⚠️ **texto e mídia OK; áudio não** | Webhook recebe e grava (`api/webhooks/uazapi/route.ts:72`). **Áudio não é transcrito** — zero código de transcrição/Whisper no CRM **e** nenhum node de transcrição nos 7 workflows. Áudio cai em `nao_identificado` |
| Agente identifica e estrutura | ⚠️ **projetado, não ligado** | Duas rotas possíveis: no CRM (`lib/ia/classifier.ts` — hoje só `mock`, providers reais não implementados) **ou** no n8n via Pattern B (WF1 "opcionalmente baixa mídia + roda Claude"). Nenhuma das duas está ativa: sem `ANTHROPIC_API_KEY` no CRM, sem instância n8n |
| Bot retorna confirmação no WhatsApp | ⚠️ **existe como WF7, não implantado** | **WF7 · Bot confirmação WhatsApp** (`N8N-COMPLETO.md:1203`) faz exatamente isso: escuta o evento `confirmacao_pendente_created` do CRM, monta a mensagem e envia via UAZAPI. O texto já está escrito: *"Recebi sua mensagem! 📩 … Pra confirmar responda **SIM**. Pra corrigir, escreva o que faltou. Pra cancelar responda **NÃO**."* Falta: instância n8n + UAZAPI + registrar o webhook em `/config/webhooks` |
| Após "OK/SIM", insere automaticamente, **sem aprovação manual** | ❌ **ELO INEXISTENTE** | **Este é o gap real.** O WF7 só **envia** a pergunta. Quando o cliente responde "SIM", essa resposta volta pelo webhook do UAZAPI como uma **mensagem nova** e é **reclassificada do zero** — não há nada, nem no CRM nem em nenhum dos 7 workflows, que ligue a resposta à `confirmacoes_pendentes` aberta e execute a inserção. Busca por `resolvida=true` / `resposta_bruta` / `UPDATE confirmacoes_pendentes` nos workflows: **zero**. O único caminho que resolve uma pendência hoje é `confirmarPendencia`/`rejeitarPendencia` no painel `/pendentes` — ou seja, exatamente a **aprovação manual que o briefing quer eliminar** |

**Resumo do fluxo:** o briefing quer `WhatsApp → IA → bot pergunta → cliente responde SIM → grava sozinho`.
Hoje existe `WhatsApp → grava → classifica (mock) → **gestor aprova no painel**`.
O WF7 cobre o "bot pergunta"; **ninguém cobre o "cliente responde SIM → grava"**.

---

## 5. Segurança — pendências que bloqueiam produção

Das auditorias em `docs/audit/2026-09-09-opus5/`:

| Item | Severidade | Situação |
|---|---|---|
| Senha do Postgres + `WEBHOOK_HMAC_SECRET` vazados no histórico do git público | 🔴 Crítico | **Ação manual sua** — rotacionar no Supabase/Vercel (C-1) |
| `autorizados` (quem pode mandar WhatsApp) nunca é verificado no pipeline | 🔴 Crítico | **Bloqueador antes de ligar IA real** — hoje qualquer número que chegue ao webhook é processado (achado A) |
| Escalada de privilégio via self-signup | ✅ Corrigido | migration `20260909130000` |
| Secret de webhook vazando pro papel `gestor` via `audit_log` | ✅ Corrigido | migration `20260909130100` |
| Formula/CSV injection nos exports | ✅ Corrigido | `csvCell()` em `lib/reports/csv.ts` |

---

## 6. Infraestrutura e processo — ação sua, não código

- VPS da Ciane + subdomínio · organização separada no Supabase · conta OpenAI própria (e-mail Nogma) + US$5 · chip virtual para teste do WhatsApp
- Tarcísio no grupo, comunicação formal, call de terça, confirmar com o cliente como ele enviará os documentos reais
- UAZAPI: `.env.example:60` ainda diz "Fase 8 pending, config no n8n/proxy" — sem credencial, o WhatsApp não roda nem em teste

---

## Resumo executivo

**Pronto e verificado:** os 7 ajustes de interface do briefing, a estrutura de dados completa, os
relatórios de obra, as categorias no seed, e o baseline de segurança (3 fixes críticos nesta rodada).

**O CRM como painel de gestão está funcional.** O que não está de pé é o **fluxo automatizado do
WhatsApp** — que é o diferencial vendido ao cliente.

### Falta ligar (existe pronto, só não está em execução)
1. Contratar UAZAPI + 3 env vars (`UAZAPI_*`) — sem isso o WhatsApp não roda nem em teste.
2. Subir instância n8n + importar os 7 workflows (WF7 = bot de confirmação, WF5 = cobrança de NF).
3. Ligar a IA real: `ANTHROPIC_API_KEY` no CRM **ou** o nó Claude no n8n (Pattern B).
4. Aplicar `supabase/seed.sql` no banco (categorias) e validar a lista com o cliente (falta "Frete").

### Falta construir (não existe em lugar nenhum)
5. **O elo da resposta "SIM"** — ligar a resposta do cliente à pendência aberta e gravar sozinho.
   Sem isso, a "aprovação manual pelo painel" que o briefing quer eliminar continua sendo o único
   caminho. É o item de maior impacto no escopo contratado.
6. Verificação de `autorizados` antes de processar mensagem — bloqueador de segurança que precisa
   entrar **junto** com o item 5 (senão qualquer número manda pagamento pro sistema).
7. Transcrição de áudio.
8. Visão de "pendências com X dias" **na tela** (o WF5 só cobra por WhatsApp).
9. Estado `recusado` de verdade, separado de `erro`.
10. "Documentos recebidos" no relatório do fornecedor.

**Ação sua, fora do código:** rotação dos secrets vazados (crítico), contas UAZAPI/OpenAI,
VPS da Ciane, organização Supabase, e a validação das categorias com o cliente.
