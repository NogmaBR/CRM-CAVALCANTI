# Acervo OneDrive + agente no grupo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer o acervo do OneDrive do cliente para dentro do CRM (documentos por obra e pasta, texto pesquisável, notas conciliadas com os pagamentos) e fazer o agente do WhatsApp funcionar num grupo, arquivando documentos e registros de obra além de lançar pagamentos.

**Architecture:** Uma migration adiciona `categoria`/`origem`/texto extraído em `documentos`, cria `registros_obra` e `whatsapp_grupos`, e estende pendências com `tipo` e `opcoes`. Um script Node (raiz) importa a pasta/ZIP; o app extrai texto, indexa no RAG existente e concilia notas com pagamentos por um cron. O webhook ganha adaptador para payload de grupo; o classificador ganha dois tipos; `classifyAndPersist` arquiva e responde no grupo; pendência de obra é resolvida por número.

**Tech Stack:** Next.js 16.3 App Router, Supabase (Postgres 17, Storage, RLS), Zod 3, Vitest 4, `pdf-parse` (novo em `apps/web`), scripts Node 22 com `--env-file`.

## Global Constraints

- Repositório **público**: nunca escrever segredo, nome de arquivo do cliente ou dado real em arquivo versionado; o ZIP é extraído no scratchpad do sistema, nunca no repo.
- **Nada toca produção antes de 2026-09-16 12:00.** Migration se aplica só com `--ensaio` para validar; a aplicação real é ação humana na quarta à tarde.
- Log só via `logger('area')` (`lib/log.ts`); nunca `console.*` em código de operação.
- Toda `.update()/.delete()` com sessão de usuário usa `.select('id')` + `erroDeEscrita()` (`lib/supabase/escrita.ts`).
- Policy nova: `TO authenticated`, `(select auth.uid())` / `(select has_role(ARRAY[...]::papel_usuario[]))`.
- Datas civis: `hojeBR()` de `lib/util/datas.ts`.
- Rota nova em `/api/` entra na lista pública de `lib/supabase/middleware.ts`; cron em `apps/web/vercel.json` (nunca na raiz).
- Lint: `./node_modules/.bin/biome check --fix <arquivos tocados>` e typecheck depois.
- Verificação final: `pnpm --filter web typecheck`, `pnpm --filter web exec vitest run`, `pnpm --filter web build`.
- Rótulos de status/categoria centralizados em `lib/status-labels.ts`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260915120000_acervo_e_grupo.sql` | enums, colunas, tabelas, RLS, índices, audit |
| `packages/db/src/types.ts` | tipos das novas colunas/tabelas (edição manual, no formato do gerador) |
| `apps/web/lib/status-labels.ts` | `CATEGORIA_LABELS`, `CATEGORIAS`, `DocCategoria` |
| `apps/web/lib/acervo/categoria.ts` | `categoriaDaPasta(nome)`, `tipoDoNome(nome)` — puros, compartilhados com o script via cópia mínima em JS |
| `scripts/importar-onedrive.mjs` + `scripts/lib/importar-onedrive-core.mjs` + `scripts/lib/importar-onedrive-core.test.mjs` | varredura, casamento, dedupe, escrita REST |
| `scripts/seed-apelidos-obras.mjs` | apelidos e `onedrive_folder_id` novos das 10 obras |
| `apps/web/lib/acervo/extrair-texto.ts` (+test) | PDF → texto; imagem → visão (só com chave) |
| `apps/web/lib/acervo/conciliar.ts` (+test) | NF importada ↔ pagamento |
| `apps/web/lib/rag/documentos.ts`, `indexador.ts` | fontes `documento` e `registro` |
| `apps/web/app/api/cron/acervo/route.ts` (+test) | extrair → indexar → conciliar |
| `apps/web/lib/schemas/uazapi.ts`, `apps/web/lib/webhooks/adaptar-uazapi.ts` (+test) | grupo no payload |
| `apps/web/lib/whatsapp/escolha.ts` (+test) | `interpretarEscolha` |
| `apps/web/lib/ia/classifier.ts`, `mock-classifier.ts` (+test), `anthropic-classifier.ts` | tipos novos |
| `apps/web/lib/services/arquivar.ts` (+test) | `arquivarDocumentoDeObra`, `registrarNaObra` |
| `apps/web/lib/services/classify-and-persist.ts`, `confirmacoes.ts`, `inbound-whatsapp.ts` (+test) | grupo, arquivamento, pendência de obra |
| `apps/web/app/(app)/obras/[id]/page.tsx` + `pastas.tsx` + `diario.tsx` | Bloco C |
| `apps/web/app/(app)/documentos/*` | filtro e campo categoria |
| `apps/web/app/(app)/pendentes/page.tsx` + `documentos-sem-pagamento.tsx` | conciliação manual |
| `apps/web/app/(app)/config/autorizados/*` + `grupos/*` | grupos |
| `docs/SO-FALTA-VOCE.md`, `CLAUDE.md` §7/§8 | ações humanas e estado |

---

### Task 1: Migration e tipos

**Files:** Create `supabase/migrations/20260915120000_acervo_e_grupo.sql`; Modify `packages/db/src/types.ts`.

- [ ] Escrever a migration conforme §3 do spec. Além do que está lá: `knowledge_documents.origem` — `ALTER TABLE ... DROP CONSTRAINT knowledge_documents_origem_check; ADD CONSTRAINT ... CHECK (origem IN ('pagamento','obra','fornecedor','documento','registro'))`. RLS de `registros_obra`: select para authenticated logado; insert/update para admin/gestor/financeiro; delete admin. `whatsapp_grupos` igual a `autorizados`. Audit trigger `trg_audit_registros_obra` e `trg_audit_whatsapp_grupos` com `audit_log_trigger()`. `GRANT SELECT, INSERT, UPDATE, DELETE` para authenticated nas duas tabelas (o padrão de `20260912150000` revoga TRUNCATE/REFERENCES/TRIGGER — repetir o `REVOKE`). Índice único parcial `idx_confirmacoes_mensagem_aberta` já existe — não recriar.
- [ ] `node --env-file=.env.local scripts/apply-migration.mjs 20260915120000_acervo_e_grupo.sql --ensaio` → deve passar (rollback). Não aplicar.
- [ ] Editar `packages/db/src/types.ts`: enums `doc_categoria`, `doc_origem`; colunas novas em `documentos`, `mensagens_whats`, `confirmacoes_pendentes`; tabelas `registros_obra`, `whatsapp_grupos` (Row/Insert/Update/Relationships).
- [ ] `pnpm --filter web typecheck` limpo. Commit `feat(db): acervo e grupo — migration e tipos`.

### Task 2: Rótulos e categoria por pasta

**Files:** Modify `apps/web/lib/status-labels.ts`; Create `apps/web/lib/acervo/categoria.ts`, `categoria.test.ts`.

**Produces:** `type DocCategoria`, `CATEGORIAS: DocCategoria[]`, `CATEGORIA_LABELS: Record<DocCategoria, { rotulo: string; icone: string }>`, `categoriaDaPasta(nome: string): DocCategoria`, `tipoDoNome(nome: string): AnexoTipo`, `normalizarNome(s: string): string` (sem acento, minúsculo, `&`→`e`, espaços colapsados).

- [ ] Testes: `NFs/Pagamentos`→`nfs_pagamentos`; `NF's`→idem; `Notas`→idem; `Documentação`→`documentacao`; `Projeto Aprovado`→`projeto_aprovado`; `Projeto`→`projeto`; `Fotos`, `Imagens`→`fotos`; `Orçamento`→`orcamentos`; `Propostas`→`proposta`; `Cronograma`; `xyz`→`outro`. `tipoDoNome`: `NF 123.pdf`→`nota_fiscal`; `comprovante pix.jpg`→`comprovante`; `Contrato.pdf`→`contrato`; `foto.jpg`→`outro`.
- [ ] Implementar; vitest verde; commit `feat(acervo): categorias e rótulos`.

### Task 3: Importador

**Files:** Create `scripts/lib/importar-onedrive-core.mjs`, `scripts/lib/importar-onedrive-core.test.mjs` (node:test), `scripts/importar-onedrive.mjs`, `scripts/seed-apelidos-obras.mjs`.

**Produces (core, puro):**
- `varrer(raiz): Promise<Arquivo[]>` — `{ caminhoRel, nome, bytes(): Promise<Buffer>, tamanho, mtime }`, ignora lixo.
- `planejar({ arquivos, obras, documentosExistentes, criarObras }): Plano` — `obras: {id,nome,apelidos,onedrive_folder_id}[]`, `documentosExistentes: {id,hash_sha256,caminho_origem,obra_id}[]`; devolve `{ criar[], atualizar[], apagar[], ignorar[], obrasNovas[], obrasNaoCasadas[] }`.
- `casarObra(pasta, obras, excecoes)`, `normalizarNome`, `categoriaDaPasta`, `tipoDoNome` (cópia JS das de Task 2 — testadas aqui de novo).

**Runner:** REST com `SUPABASE_SERVICE_ROLE_KEY`: `GET /rest/v1/obras`, `GET /rest/v1/documentos?origem=eq.onedrive`, `POST /rest/v1/documentos` (`Prefer: return=representation`), `POST /storage/v1/object/documents/<path>`, `PATCH` para apagar/atualizar. ZIP: se o argumento termina em `.zip`, extrai com `unzip`/PowerShell `Expand-Archive` para `os.tmpdir()/crm-acervo-<ts>` e varre de lá. Raiz da varredura: a pasta que contém as subpastas de obra (aceita tanto `_OBRAS ATIVAS_` quanto o pai com `Cavalcanti Construções/_OBRAS ATIVAS_`).

- [ ] Testes do core sobre árvore fake: casamento por nome/apelido/exceção; categoria; dedupe hash igual; substituído (mesmo caminho, hash novo); removido só em obra varrida; lixo ignorado; `--criar-obras` gera `obrasNovas`.
- [ ] `node --test scripts/lib/` verde. Runner com `--ensaio` imprimindo relatório. Commit `feat(acervo): importador do OneDrive`.
- [ ] `seed-apelidos-obras.mjs`: mapa nome→apelidos + `onedrive_folder_id` novo; `--ensaio` imprime; escreve por `PATCH`. Commit.

### Task 4: Extração de texto e indexação

**Files:** Create `apps/web/lib/acervo/extrair-texto.ts`, `extrair-texto.test.ts`; Modify `apps/web/lib/rag/documentos.ts`, `indexador.ts`; `apps/web/package.json` (+`pdf-parse`).

**Produces:** `extrairTextoPendentes(supabase, { limite = 40, deps? }): Promise<{ processados, comTexto, semTexto, erros }>`; `extrairTextoDe(buffer, mime, deps): Promise<string | null>`; em `rag/documentos.ts`: `documentoParaDocumento(d): DocumentoIndexavel` e `registroParaDocumento(r)`; `sincronizarDocumentos` passa a coletar as duas fontes.

- [ ] Testes: PDF com texto (fixture gerada em teste com `%PDF` mínimo? não — usar `deps.lerPdf` injetável e testar a orquestração: mime pdf → chama lerPdf; texto vazio + sem visão → `null` e marca; imagem sem chave → `null`). Teste do `documentoParaDocumento`: título `"<obra> › <rótulo> › <nome>"`, conteúdo com texto ou só cabeçalho.
- [ ] Implementar; vitest; commit `feat(acervo): extração de texto e indexação no RAG`.

### Task 5: Conciliação

**Files:** Create `apps/web/lib/acervo/conciliar.ts`, `conciliar.test.ts`.

**Produces:** `conciliarPendentes(supabase, { limite = 20, deps? }): Promise<{ analisados, vinculados, ambiguos, semCandidato }>`; `escolherCandidato(extraido, candidatos): Pagamento | null` (puro): valor igual ±0,01, data ±7 dias quando extraída; 1 → devolve; 0/2+ → `null`.

- [ ] Testes de `escolherCandidato` (0/1/2 candidatos, tolerância de data, sem data extraída). Implementar. Commit `feat(acervo): conciliação de notas com pagamentos`.

### Task 6: Rota de cron

**Files:** Create `apps/web/app/api/cron/acervo/route.ts`, `route.test.ts`; Modify `apps/web/lib/supabase/middleware.ts`, `apps/web/vercel.json`.

- [ ] Teste: 401 sem bearer; 200 JSON `{ ok, extracao, indexacao, conciliacao }` com bearer (deps mockadas via `vi.mock`). Implementar com `bearerConfere`, `maxDuration = 60`. Cron `40 3 * * *`. Commit `feat(acervo): cron /api/cron/acervo`.

### Task 7: Grupo no payload

**Files:** Modify `apps/web/lib/schemas/uazapi.ts`; Create `apps/web/lib/webhooks/adaptar-uazapi.ts`, `adaptar-uazapi.test.ts`; Modify `apps/web/app/api/webhooks/uazapi/route.ts`.

**Produces:** schema com `chatId?`, `isGroup?`, `sender?`, `senderName?`; `adaptarPayloadUazapi(raw: unknown): unknown` — se `raw.message?.messageid` existe, traduz v2 → canônico; senão devolve `raw`. Mapa de tipo: `Conversation|ExtendedTextMessage`→`text`, `ImageMessage`→`image`, `DocumentMessage|DocumentWithCaptionMessage`→`document`, `AudioMessage|PTT`→`audio`, `VideoMessage`→`video`, `StickerMessage`→`sticker`, `LocationMessage`→`location`.

- [ ] Testes: fixture v2 de grupo → `{ id, type, from: sender, chatId, isGroup: true, ... }`; fixture v2 privada → `chatId = from`; fixtures atuais passam intactas. Rota chama o adaptador antes do Zod. Commit `feat(whatsapp): grupo no payload do webhook`.

### Task 8: Escolha numerada

**Files:** Create `apps/web/lib/whatsapp/escolha.ts`, `escolha.test.ts`.

**Produces:** `type Opcao = { n: number; id: string; nome: string; apelidos?: string[] }`; `interpretarEscolha(texto, opcoes): Opcao | null`.

- [ ] Testes: `"2"`, `"2)"`, `"opção 2"`, `"dois"`, `"garibaldi"`, `"da Garibaldi"`, `"não sei"`→null, `"12"` com 3 opções→null, texto longo→null. Commit `feat(whatsapp): resposta numerada`.

### Task 9: Classificador

**Files:** Modify `apps/web/lib/ia/classifier.ts`, `mock-classifier.ts`, `mock-classifier.test.ts` (criar se não existir), `anthropic-classifier.ts`, `anthropic-classifier.test.ts`.

**Produces:** `ClassifierKind` += `'documento_obra' | 'registro_obra'`; `extracted.categoria?: DocCategoria`, `extracted.resumo?: string`; `ClassifierInput.contexto.grupoObraId?: string | null`.

- [ ] Mock: testes das regras da §5.2; regra "pagamento vence" (mídia + valor → pagamento como hoje). Anthropic: `SaidaSchema` com kinds/categoria/resumo; prompt com as três regras; `montarSaida` propaga. Testes existentes verdes. Commit `feat(ia): documento_obra e registro_obra`.

### Task 10: Arquivar e registrar

**Files:** Create `apps/web/lib/services/arquivar.ts`, `arquivar.test.ts`.

**Produces:**
- `arquivarDocumentoDeObra(supabase, { mensagemId, obraId, categoria, tipo, storagePath, mime, userId, autorizadoId }): Promise<{ ok: true; documentoId; jaExistia } | { ok: false; motivo }>` — mesma mecânica de `anexarMidiaComoDocumento` (hash, 23505, cópia para `makeStoragePath`), `origem='whatsapp'`, sem pagamento; liga `mensagens_whats.documento_id`.
- `registrarNaObra(supabase, { mensagemId, obraId, texto, resumo, storagePath, mime, autorizadoId }): Promise<{ ok: true; registroId } | { ok: false; motivo }>` — insere `registros_obra` com `data_registro = hojeBR()`, liga `mensagens_whats.registro_id`; idempotente por `mensagem_id` (pré-checagem).
- `respostaArquivado(obraNome, categoria)` → `📁 ${obra} › ${rótulo} ✔`; `respostaRegistrado(obraNome)` → `📝 Anotado em ${obra} ✔`.

- [ ] Testes com cliente Supabase fake (padrão dos testes de `inbound-whatsapp.test.ts`). Commit `feat(whatsapp): arquivar documento e registrar na obra`.

### Task 11: classifyAndPersist + pendência de obra + inbound

**Files:** Modify `classify-and-persist.ts`, `confirmacoes.ts`, `inbound-whatsapp.ts`, `inbound-whatsapp.test.ts`, `uazapi.ts` (`enviarTexto(destino, ...)` aceita jid de grupo sem normalizar).

- [ ] `classifyAndPersist(mensagemId)` lê `chat_id`, `grupo_id` (→ `obra_id` do grupo), manda `apelidos` no contexto; trata os dois kinds conforme tabela §5.3; devolve `{ ok: true, status, kind, confirmacao: { id, pergunta } | null, resposta?: string }`.
- [ ] `confirmacoes.ts`: `aplicarConfirmacao` lê `tipo`; para `obra_*` exige `obraId` no ctx (vem da escolha) e chama Task 10; `aplicarEscolhaDeObra(supabase, { confirmacaoId, obraId, respostaBruta })`.
- [ ] `inbound-whatsapp.ts`: `remetente`/`destino`; `buscarGrupo`; `ignorada_grupo_nao_autorizado`; passo 4 ganha ramo: pendência aberta com `tipo != 'pagamento'` → `interpretarEscolha(texto, opcoes)`; respostas para `destino`; grava `chat_id`/`grupo_id`; envia `resposta` de arquivamento.
- [ ] Testes: grupo não cadastrado → ignorada; grupo ok → resposta vai para `chatId`; `documento_obra` com obra do grupo → arquiva e responde 📁; sem obra → pendência com `opcoes` e pergunta numerada; `"2"` → arquiva na obra 2; pagamento inalterado (testes existentes). Commit `feat(whatsapp): agente no grupo — arquiva, registra, pergunta a obra`.

### Task 12: Painel

**Files:** `app/(app)/obras/[id]/page.tsx` (+`pastas.tsx`, `diario.tsx`, `obra-acervo.css`); `app/(app)/documentos/*` (filtro, coluna, campo no form, action com `categoria`); `app/(app)/pendentes/*` (seção documentos sem pagamento + action `vincularDocumentoAPagamento`); `app/(app)/config/autorizados/page.tsx` + `grupos/` (lista, novo, editar, actions com Zod + `voltarComErro`); `lib/data/*` getters (`getDocumentosPorCategoria(obraId)`, `getRegistrosObra(obraId, limite)`, `getDocumentosSemPagamento()`, `listGrupos()`); `supabase/migrations/...` **não** — `busca_global` inclui categoria via SQL na mesma migration da Task 1 (voltar lá e acrescentar).

- [ ] Cada tela com `metadata.title`, `TelaDeEstado`/`EmptyState`, `data-label` nas tabelas, tokens de tema. Typecheck + build. Commit por tela.

### Task 13: Docs, verificação e PR

- [ ] `docs/SO-FALTA-VOCE.md`: seção nova com os 4 passos humanos da §9 do spec. `CLAUDE.md` §7 (estado) e §8 (armadilhas novas descobertas). `.env.example` se surgir variável.
- [ ] `graphify update .`
- [ ] Três comandos da §5 do `CLAUDE.md`; biome nos arquivos tocados; typecheck de novo.
- [ ] `git push -u origin feat/acervo-onedrive-e-agente-grupo`; `gh pr create` com o resumo e o aviso "**não mergear antes de 16/09 12:00**".
