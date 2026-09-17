# Agente do WhatsApp — CRM completo: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O agente do WhatsApp responde qualquer pergunta sobre o CRM (inclusive lucro por obra) e executa cinco ações (criar obra, cadastrar fornecedor, definir contrato, registrar recebimento, arquivar obra) — sempre com confirmação "SIM".

**Architecture:** Roteador puro decide se a mensagem vai ao assistente; o assistente (laço existente) ganha ferramentas de leitura e ferramentas que só *propõem*; a proposta vira `confirmacoes_pendentes.tipo='acao'` e `aplicarAcao` grava no "SIM". Dado novo: `obras.valor_contrato` + tabela `recebimentos`.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres 17, RLS), Zod v4 nas ferramentas, OpenAI chat completions (fetch), Vitest 4 com `test/fake-supabase.ts`.

Spec: `docs/superpowers/specs/2026-09-16-agente-whatsapp-crm-completo-design.md`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260916230000_contrato_recebimentos_acoes.sql` | `obras.valor_contrato`, tabela `recebimentos` (+RLS, grants, triggers), `confirmacoes_pendentes.tipo='acao'` + coluna `acao` |
| `packages/db/src/types.ts` | tipos das colunas/tabela novas |
| `apps/web/lib/data/recebimentos.ts` | listar/somar recebimentos por obra (sessão do usuário) |
| `apps/web/lib/data/obras.ts` | `resumoFinanceiroDaObra(id)` |
| `apps/web/lib/schemas/obra.ts` | `valor_contrato` (pt-BR → número) |
| `apps/web/lib/schemas/recebimento.ts` | Zod do recebimento |
| `apps/web/app/(app)/obras/obra-form.tsx` | campo Valor do contrato |
| `apps/web/app/(app)/obras/[id]/page.tsx` | bloco Resultado + seção Recebimentos |
| `apps/web/app/(app)/obras/[id]/recebimentos/actions.ts` | criar/arquivar recebimento |
| `apps/web/lib/ia/ferramentas/crm.ts` (+test) | 9 ferramentas de leitura novas |
| `apps/web/lib/ia/ferramentas/acoes.ts` (+test) | 5 ferramentas `propor_*` + tipo `Proposta` |
| `apps/web/lib/ia/ferramentas/obras.ts` | `FERRAMENTAS_DE_OBRA` passa a incluir crm + acoes |
| `apps/web/lib/ia/memoria-curta.ts` (+test) | conversa recente (2 h / 6 trocas) e obra recente |
| `apps/web/lib/ia/intencao.ts` (+test) | chamada `json_schema` estrita → intenção |
| `apps/web/lib/whatsapp/roteador.ts` (+test) | camadas 1–3: destino da mensagem |
| `apps/web/lib/ia/prompts/assistente-obra.ts` | prompt v3 |
| `apps/web/lib/ia/assistente.ts` | memória curta no prompt; `proposta` no retorno |
| `apps/web/lib/services/acoes-whatsapp.ts` (+test) | `perguntaDaAcao`, `abrirPendenciaDeAcao`, `aplicarAcao` |
| `apps/web/lib/services/confirmacoes.ts` | `TipoPendencia` ganha `'acao'`; `PendenciaAberta.acao` |
| `apps/web/lib/services/inbound-whatsapp.ts` | passo 4 (acao) e 5b (roteador + proposta) |
| `apps/web/app/(app)/pendentes/{page,actions}.tsx` | pendência de ação: mostrar, confirmar, rejeitar |
| `apps/web/lib/ia/classificador-comum.ts` | `contexto.obraSugeridaId` (default quando não cita obra) |
| `apps/web/lib/ia/openai.real.test.ts` | 2 casos reais (gated) |
| `docs/SO-FALTA-VOCE.md` §15, `CLAUDE.md` §7/§8 | ações humanas e regras novas |

---

### Task 1: Migration + tipos

- [ ] Escrever `20260916230000_contrato_recebimentos_acoes.sql` (spec › Banco). Policies no formato `TO authenticated` + `(select has_role(...))`; `GRANT SELECT, INSERT, UPDATE, DELETE ON recebimentos TO authenticated; GRANT ALL TO service_role`; `trg_recebimentos_updated` (`set_updated_at`), `trg_audit_recebimentos` (`audit_log_trigger`); índice parcial por obra.
- [ ] Ensaiar: `node --env-file=.env.local scripts/apply-migration.mjs 20260916230000_contrato_recebimentos_acoes.sql --ensaio` → sem erro.
- [ ] Atualizar `packages/db/src/types.ts` à mão (obras.valor_contrato; tabela recebimentos; confirmacoes_pendentes.acao).
- [ ] `pnpm --filter web typecheck` verde. Commit `feat(db): valor_contrato, recebimentos e pendência de ação`.

### Task 2: Dado no painel (contrato + recebimentos)

- [ ] `lib/schemas/obra.ts`: `valor_contrato` igual a `orcamento` (opcional, pt-BR).
- [ ] `lib/schemas/recebimento.ts`: `{ obra_id uuid, valor > 0 (pt-BR), data_recebimento date, descricao? ≤ 200, observacoes? ≤ 1000 }`.
- [ ] `lib/data/recebimentos.ts`: `listRecebimentosDaObra(obraId)`, `totalRecebidoPorObra(ids[])`.
- [ ] `lib/data/obras.ts`: `resumoFinanceiroDaObra(id)` → `{ contrato, gasto, recebido, resultado, margemPrevista }` com `STATUS_QUE_CONTAM`.
- [ ] Form da obra: campo "Valor do contrato (R$)" após Orçamento, com `valores`/`erroDe`/`autoFocus` como os outros; `obras/actions.ts` grava.
- [ ] `obras/[id]/page.tsx`: bloco **Resultado da obra** (4 números + frase) e seção **Recebimentos** (tabela + form inline + arquivar). Actions em `obras/[id]/recebimentos/actions.ts` (`criarRecebimento`, `arquivarRecebimento`) com `voltarComErro`, `erroDeEscrita`, `revalidatePath`.
- [ ] typecheck + vitest. Commit `feat(obras): valor do contrato e recebimentos no painel`.

### Task 3: Ferramentas de leitura (`ferramentas/crm.ts`)

- [ ] Teste com `fakeSupabase` (obras, pagamentos, recebimentos, categorias, fornecedores, documentos, registros_obra): `listar_obras` soma gasto/recebido; `resumo_da_obra` sem contrato → `contrato: null`, `margem_prevista: null`; nome ambíguo → `{ ok:false, opcoes }`; `lucro_por_obra` ordena por resultado.
- [ ] Implementar as 9 ferramentas com `ferramenta({...})`, limites (`limite ≤ 20`), resolução por `resolverPorNome`.
- [ ] `FERRAMENTAS_DE_OBRA = [...existentes, ...FERRAMENTAS_CRM]`.
- [ ] Commit `feat(ia): ferramentas de leitura do CRM inteiro (lucro, etapas, documentos, diário, fornecedores)`.

### Task 4: Ferramentas de ação (`ferramentas/acoes.ts`) + templates

- [ ] `export type Proposta = { tipo: 'criar_obra' | 'cadastrar_fornecedor' | 'definir_contrato' | 'registrar_recebimento' | 'arquivar_obra'; dados: …; resumo: string }` com Zod por tipo (`PropostaSchema`) — é o que vai para o JSONB e o que `aplicarAcao` relê.
- [ ] Testes: duplicata de obra → `ok:false`; fornecedor com nome parecido existente → devolve o existente como aviso; contrato em obra ambígua → opções; recebimento sem data → hoje BR.
- [ ] Implementar 5 `propor_*` devolvendo `{ ok: true, proposta }`.
- [ ] Commit `feat(ia): ferramentas de proposta de ação (nunca gravam)`.

### Task 5: `acoes-whatsapp.ts`

- [ ] Testes: `perguntaDaAcao` por tipo (texto exato, termina com "Responda SIM…"); `aplicarAcao` cria obra/fornecedor/recebimento, define contrato, arquiva obra; segunda chamada → `ja_resolvida`; tipo diferente → `tipo_diferente`; erro de insert → pendência continua aberta com `resultado` = erro.
- [ ] Implementar `abrirPendenciaDeAcao`, `perguntaDaAcao`, `respostaDaAcao`, `aplicarAcao` (padrão de `aplicarConfirmacao`: pré-checagem + `UPDATE … eq('resolvida', false)` + `erroDeEscrita`).
- [ ] `confirmacoes.ts`: `TipoPendencia` + `'acao'`, `PendenciaAberta.acao: Proposta | null`, `lerTipoPendencia`, select inclui `acao`.
- [ ] Commit `feat(whatsapp): pendência de ação — pergunta por template, SIM executa`.

### Task 6: Memória curta + intenção + roteador

- [ ] `memoria-curta.ts`: `conversaRecente(supabase, { chatId, telefone, agora })` → `Array<{ papel:'pessoa'|'agente', texto }>` (≤ 6, 2 h) lendo `mensagens_whats` e `ai_messages` via `ai_conversations.autorizado_id`; `obraRecente(...)` → `{ id, nome } | null` (pendência resolvida com obra, obra criada por ação, ou ferramenta `resumo_da_obra` nas 2 h). Teste com fake.
- [ ] `intencao.ts`: `classificarIntencao(texto, deps)` → `'pergunta'|'acao'|'lancamento'|'conversa'|'nenhuma'`; usa `chatCompletions` com `response_format: json_schema strict`; qualquer falha → `'nenhuma'`. Teste com `chat` falso.
- [ ] `roteador.ts`: `decidirDestino({ texto, temMidia, comando }, deps)` → `'assistente' | 'classificador'`. Tabela de testes:
  - mídia → classificador; "paguei 500 pro Zé" → classificador; "quanto gastei na garibaldi" → assistente (sem modelo);
  - "cria uma obra chamada Sítio" → assistente (padrão de ação, sem modelo);
  - "velho, queria saber quanto estou lucrando no garibaldi" → modelo diz `pergunta` → assistente; modelo falha → classificador;
  - "bom dia" → modelo `conversa` → assistente; "ok" (≤ 3 palavras, sem modelo) → classificador.
- [ ] Commit `feat(whatsapp): roteador de intenção — pergunta, ação e conversa vão ao assistente`.

### Task 7: Assistente v3 + inbound

- [ ] Prompt v3 (`VERSAO = 3`) com as regras da spec e do projeto B.
- [ ] `assistente.ts`: `PerguntaAoAssistente.chatId`; monta `CONVERSA RECENTE`; coleta `proposta` dos resultados; `RespostaDoAssistente.proposta?: Proposta`; duas propostas → texto "uma de cada vez".
- [ ] `inbound-whatsapp.ts`: passo 4 — `pendencia.tipo === 'acao'`: `sim` → `aplicarAcao` → responde; `nao` → `recusarConfirmacao` → responde; outro → segue. Passo 5b — `decidirDestino`; se assistente: dedupe, `perguntar`; se `proposta`: `gravarMensagem(status:'recebida')` + `abrirPendenciaDeAcao` + envia `perguntaDaAcao`; senão envia texto.
- [ ] `classificador-comum.ts` + mock: `contexto.obraSugeridaId` (mesma semântica de `grupoObraId`, precedência: grupo dedicado > sugerida). Inbound preenche pela `obraRecente`.
- [ ] `inbound-whatsapp.test.ts`: cenários "cria a obra X" → SIM; NÃO; "bom dia".
- [ ] Commit `feat(whatsapp): o agente responde e age sobre o CRM inteiro`.

### Task 8: `/pendentes`

- [ ] `page.tsx`: item `tipo === 'acao'` mostra "Ação pelo WhatsApp" + `pergunta_enviada` + botões Confirmar/Rejeitar.
- [ ] `actions.ts › confirmarPendencia`: lê `tipo`; `'acao'` → `aplicarAcao(..., via:'painel')`; mensagem de sucesso = `resposta.texto`.
- [ ] Commit `feat(pendentes): ações do WhatsApp podem ser confirmadas no painel`.

### Task 9: Prova real, docs, verificação

- [ ] `openai.real.test.ts`: 2 casos (gated). Rodar com `TESTE_REAL=1` uma vez e registrar o resultado no commit.
- [ ] `docs/SO-FALTA-VOCE.md` §15 (migration, como conferir, roteiro de teste 11–15), `CLAUDE.md` §7 + §8, spec marcada.
- [ ] `pnpm --filter web typecheck && pnpm --filter web exec vitest run && pnpm --filter web build`; `biome check --fix` só nos arquivos tocados; typecheck de novo.
- [ ] `graphify update .`; PR `feat/agente-crm-completo`.
