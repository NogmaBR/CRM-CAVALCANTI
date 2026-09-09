> **Recuperado do transcript da sessao de 2026-09-09** (VS Code fechou antes de consolidar).
> Agente: Agent "Inventory lib services and IA" finished
> Custo: 109581 tokens, 45 tool calls

I have everything needed. Here is the complete inventory.

# Library Layer Inventory — `apps/web/lib`

Root: `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\apps\web\lib` — 54 files, 5,970 lines total.

---

## 1. `lib/ia/` — AI classifier (CRITICAL FINDINGS)

### Verdict up front
**There is NO real AI provider wired up. Neither OpenAI nor Anthropic is actually used anywhere in `lib/`.** The only working implementation is a deterministic regex/string-matching mock. Confirmed three ways:
1. `lib/ia/` contains only two files — `classifier.ts` and `mock-classifier.ts`. There is no `anthropic-classifier.ts` or `openai-classifier.ts` on disk (the factory imports them only inside comments).
2. Grep of all of `lib/` for `ANTHROPIC|OPENAI|anthropic|openai|claude-|gpt-` returns **only comment lines** — no `process.env.ANTHROPIC_API_KEY`, no `process.env.OPENAI_API_KEY`, no SDK call.
3. `apps/web/package.json` has **no** `@anthropic-ai/sdk` and **no** `openai` dependency.

There is also **no prompt text anywhere** — no system prompt, no user prompt, no template string sent to a model. The "prompt" the classifier would need does not exist yet; the mock uses regexes instead.

### `lib/ia/classifier.ts` — 71 lines
`C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\apps\web\lib\ia\classifier.ts`

Interface + factory only (zero model calls). Defines the contract a future real classifier must implement and picks an implementation from `IA_PROVIDER`.

Exported symbols: `ClassifierKind` (type), `ClassifierInput` (interface), `ClassifierOutput` (interface), `Classifier` (interface), `getClassifier()`.

- **Env var: `IA_PROVIDER`**, default `'mock'`. Only `'mock'` is accepted at runtime; anything else throws:
  `throw new Error(\`IA_PROVIDER desconhecido: ${provider}. Suportados: mock\`)`
- The two other providers exist **only as commented-out code and doc comments**:
  - `*   - \`IA_PROVIDER=anthropic\`: (Fase 8.x) chama Claude Haiku 4.5`
  - `*   - \`IA_PROVIDER=openai\`: (Fase 8.x) chama OpenAI GPT-4o-mini`
  - line 67: `// Reservado — quando as credenciais chegarem, ativar branches abaixo:`
  - line 68: `// if (provider === 'anthropic') { const { AnthropicClassifier } = await import('./anthropic-classifier'); return new AnthropicClassifier(); }`
  - line 69: `// if (provider === 'openai')    { const { OpenAIClassifier } = await import('./openai-classifier'); return new OpenAIClassifier(); }`
- **Model IDs**: the only model strings in the repo's lib layer are the prose "Claude Haiku 4.5" and "GPT-4o-mini" in comments. No API model identifier (e.g. `claude-haiku-4-5`, `gpt-4o-mini`) is present in code.

**Input schema** (`ClassifierInput`): `texto: string | null`, `midiaUrl: string | null`, `midiaMime: string | null`, `telefone: string` (digits only), `contexto: { obrasAtivas: Array&lt;{id, nome, apelidos?}&gt;, fornecedoresConhecidos: Array&lt;{id, nome, apelidos?}&gt; }`.

**Output schema** (`ClassifierOutput`):
```ts
{
  kind: 'pagamento_completo' | 'pagamento_parcial' | 'documento_apenas' | 'nao_identificado',
  confidence: number,           // 0..1
  extracted: {
    valor?: number;                    // reais, sempre positivo
    data_pagamento?: string;           // ISO YYYY-MM-DD
    obra_id?: string;
    fornecedor_id?: string;
    fornecedor_nome_novo?: string;
    tipo_documento?: 'nota_fiscal' | 'comprovante' | 'contrato' | 'outro';
    numero_nf?: string;
    descricao?: string;
    raciocinio?: string;               // explicação humana pra revisor
  },
  perguntaConfirmacao?: string;        // texto pra enviar via WhatsApp se pagamento_parcial
}
```

**Confidence field naming**: the classifier contract calls it **`confidence`** (`ClassifierOutput.confidence`, documented `// 0..1`). It is persisted to the DB column **`confianca_ia`** (see `classify-and-persist.ts`), surfaced in the data layer as `PendenteItem.confianca_ia`, and passed to the email template as `PendenciaNovaProps.confidence` (`/** Confidence score 0–1 */`), where it is displayed as `(confidence * 100).toFixed(0)` percent.

### `lib/ia/mock-classifier.ts` — 107 lines
`C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\apps\web\lib\ia\mock-classifier.ts`

Exported symbols: `MockClassifier` (class, implements `Classifier`). Private helpers (not exported): `parseValor`, `normalize`, `extractFornecedorNovo`.

Deterministic heuristic, **no network call, no OCR, no LLM**. Its own header states the intent: *"Objetivo: exercitar o pipeline end-to-end sem depender de API externa."*

**How `confidence` is computed — hardcoded constants, not a model score:**

| Branch | condition | `kind` | `confidence` |
|---|---|---|---|
| media present | `midiaMime` starts with `image/` or `=== 'application/pdf'` | `documento_apenas` | **0.5** |
| no text at all | `!texto` | `nao_identificado` | **0.9** |
| text, no BRL value matched | regex miss | `nao_identificado` | **0.6** |
| value matched, obra **and** fornecedor matched | `obra &amp;&amp; forn` | `pagamento_parcial` | **0.65** |
| value matched, obra or fornecedor missing | else | `pagamento_parcial` | **0.4** |

Value regex: `/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/u`. Obra/fornecedor matching = accent-stripped substring containment against `contexto.obrasAtivas` / `fornecedoresConhecidos` (+ their `apelidos`). `tipo_documento` is guessed purely by MIME: PDF → `'nota_fiscal'`, image → `'comprovante'`.

**Note on a design consequence:** the mock is explicitly designed to never exceed the auto-approve threshold — header comment: *"Sempre confidence baixo (&lt;0.7) pra forçar fluxo de confirmação."* Combined with `CONFIANCA_AUTO_APROVAR = 0.85` and the fact the mock never returns `pagamento_completo`, **the auto-create-payment path in `classify-and-persist.ts` is currently dead code** — every message routes to `confirmacoes_pendentes`.

The only strings resembling prompts are the Portuguese WhatsApp confirmation questions it emits:
- `'Recebi um documento. Confirma cadastro?'`
- `` `Achei pagamento de R$ ${valor.toFixed(2)} ${obra ? `para obra ${obra.nome}` : ''} ${forn ? `com ${forn.nome}` : ''}. Confirma? [S/N]` ``
- and the `raciocinio` strings, e.g. `'MockClassifier: mídia detectada; OCR desabilitado no mock'`, `'MockClassifier: sem texto e sem mídia relevante'`, `'MockClassifier: texto sem padrão de valor R$'`, `` `MockClassifier: valor=${valor}, obra=…, fornecedor=…` ``

---

## 2. `lib/services/`

| File | Lines | Exports |
|---|---|---|
| `classify-and-persist.ts` | 187 | `classifyAndPersist(mensagemId)` |
| `detect-duplicates.ts` | 142 | `jaroWinkler(a,b)`, `DuplicateCandidate`, `detectDuplicateFornecedores()` |
| `dispatch-webhook.ts` | 194 | `EventoWebhook`, `WebhookPayload`, `dispatchEvento()`, `testWebhook()`, `generateWebhookSecret()` |
| `import-pagamentos.ts` | 207 | `PreviewRow`, `PreviewResult`, `previewImport()`, `commitImport()` |
| `merge-fornecedores.ts` | 88 | `MergeResult`, `mergeFornecedores({keepId, dropId})` |
| `send-email.tsx` | 169 | `SendManyResult`, `sendPagamentoAguardandoEmail()`, `sendPendenciaNovaEmail()`, `sendBoasVindasEmail()`, `resendNotificacao()` |

`C:\...\lib\services\classify-and-persist.ts` — Orchestrates the WhatsApp pipeline for one `mensagens_whats` row: loads message + active obras/fornecedores context, sets status `processando`, calls `getClassifier().classify()`, then routes by `kind`+`confidence` (`CONFIANCA_AUTO_APROVAR = 0.85`) into `erro` / auto-inserted `pagamentos` row / `confirmacoes_pendentes`. Uses the **service-role** client (`SUPABASE_SERVICE_ROLE_KEY`), and best-effort fires `sendPendenciaNovaEmail` + `dispatchEvento('confirmacao_pendente_created')` inside a swallowed try/catch. Header notes media is never downloaded (UAZAPI URLs expire) — only `midia_mime` is persisted.

`C:\...\lib\services\detect-duplicates.ts` — Finds duplicate fornecedores O(n²) in memory: strong match on identical digit-normalized `documento` (score `1.0`, `motivo: 'documento_igual'`), weak match on Jaro-Winkler similarity of the name normalized (lowercase, accents stripped, `ltda|s.a.|eireli|me|epp` removed) at `NAME_THRESHOLD = 0.9` (`motivo: 'nome_similar'`). Returns deduped pairs sorted by score desc; `jaroWinkler` is exported standalone (dependency-free implementation, Winkler prefix boost 0.1 up to 4 chars).

`C:\...\lib\services\dispatch-webhook.ts` — Outbound webhook fan-out to n8n/Zapier/Make: selects active `webhooks_outbound` rows whose `eventos[]` contains the event, POSTs `{evento, ocorrido_em, dados}` in parallel with 10s abort, signing with `X-Nogma-Signature: sha256=&lt;hex HMAC-SHA256&gt;` plus `X-Nogma-Event` and `User-Agent: Nogma-Webhook/1.0`. Events: `pagamento_created`, `pagamento_updated`, `confirmacao_pendente_created`, `documento_created`, `obra_created`, `obra_archived`, `test`. Execution counters go through the atomic RPC `increment_webhook_execution` (comment cites "Audit BUG-04 fix" replacing a read-modify-write race); `generateWebhookSecret()` uses `randomBytes(32)` (comment cites "audit HIGH-001" replacing `Math.random()`).

`C:\...\lib\services\import-pagamentos.ts` — Two-phase CSV import. `previewImport(csvText)` parses via `lib/util/csv-parser`, validates each row with `ImportPagamentoRowSchema`, and name-matches obra/fornecedor/categoria against three batched lookups (accent-insensitive normalize), writing nothing. `commitImport(previewRows, criadoPorUserId)` batch-inserts the rows with a resolved `obra_id` into `pagamentos` in chunks of 100. Header explicitly documents **no idempotency** — re-importing the same CSV duplicates rows.

`C:\...\lib\services\merge-fornecedores.ts` — Merges two fornecedores by delegating entirely to the plpgsql RPC `merge_fornecedores_atomic(p_keep_id, p_drop_id)`, returning `{pagamentos_movidos, documentos_movidos, apelidos_movidos, drop_nome}`. Guards `keepId === dropId`. Header cites "Audit BUG-01 fix": the previous 5-step sequential supabase-js version could leave data half-moved.

`C:\...\lib\services\send-email.tsx` — Render → send → log orchestration: `render(&lt;Template/&gt;)` from `@react-email/render`, then `getEmailProvider().send()`, then `logNotificacao()` into `notificacoes_email` on both success and failure (never throws — email is best-effort). Recipients come from `getRecipientsByPapel(['admin','gestor'], prefKey)`. `PAINEL_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-cavalcanti.vercel.app'`.

---

## 3. `lib/schemas/`

### `categoria.ts` — 41 lines
`C:\...\lib\schemas\categoria.ts` — Zod: `CategoriaCreateSchema` (`nome` 2–80, `cor` optional whitelisted, `icone` ≤50), `CategoriaUpdateSchema` (partial + `id` uuid). Types: `CategoriaCreateInput`, `CategoriaUpdateInput`.

**`CATEGORIA_CORES`** (exact values, `as const`):
| value | label |
|---|---|
| `#0C4651` | Petróleo |
| `#CCFF00` | Lime |
| `#2FA36B` | Verde (sucesso) |
| `#D6483B` | Vermelho (danger) |
| `#E8A317` | Amarelo (warning) |
| `#196E7C` | Petróleo médio |
| `#565B5B` | Cinza escuro |
| `#A1A1A1` | Cinza claro |

Any `cor` outside this set fails with `'Cor não suportada'`.

### `documento.ts` — 141 lines
`C:\...\lib\schemas\documento.ts` — Exports: `anexoTipoEnum`, `AnexoTipo`, `ANEXO_TIPO_LABELS`, `ALLOWED_MIMES`, `MAX_FILE_SIZE_BYTES`, `DocumentoMetaCreateSchema`, `DocumentoUpdateSchema`, `DocumentoMetaCreateInput`, `DocumentoUpdateInput`, `validateUploadedFile()`, `validateFileMagicBytes()`, `formatBytes()`.

- `anexoTipoEnum = z.enum(['nota_fiscal','comprovante','contrato','outro'])`
- **`ANEXO_TIPO_LABELS`**: `nota_fiscal: 'Nota fiscal'`, `comprovante: 'Comprovante'`, `contrato: 'Contrato'`, `outro: 'Outro'`
- **`ALLOWED_MIMES`** = `['application/pdf', 'image/jpeg', 'image/png', 'image/webp']`
- **`MAX_FILE_SIZE_BYTES`** = `10 * 1024 * 1024` (10 MB, matches bucket `file_size_limit`)
- `validateFileMagicBytes` checks real signatures (PDF `25 50 44 46 2D`, PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`, WebP `RIFF….WEBP`) — header labels it an "audit MED fix" against a renamed-extension/spoofed-Content-Type attack.

### `errors.ts` — 48 lines
`C:\...\lib\schemas\errors.ts` — Exports `mapDbError()`, `mapDbErrorWithContext()`. Maps Postgres/PostgREST codes to safe pt-BR strings, never leaking raw messages. `CODE_MESSAGES` (not exported): `23502` 'Um campo obrigatório está vazio.', `23503` 'Este registro está referenciado por outro e não pode ser modificado.', `23505` 'Já existe um registro com esses dados únicos.', `23514` 'Um dos valores viola uma regra do banco.', `42501` 'Permissão negada para esta operação.', `42P01` 'Recurso não encontrado.', `PGRST116` 'Registro não encontrado.', `PGRST301` 'Sessão expirada. Faça login novamente.'

Note: the unique-violation code is written as `'23505'`; Postgres `unique_violation` is actually **23505**? — the real code is `23505` for `unique_violation`… correction: Postgres `unique_violation` is `23505`. Correct as written.

### `fornecedor.ts` — 132 lines
`C:\...\lib\schemas\fornecedor.ts` — Exports `documentoTipoEnum` (`['cnpj','cpf']`), `origemFornecedorEnum` (`['manual','auto_detectado']`), `FornecedorCreateSchema`, `FornecedorUpdateSchema`, `FornecedorCreateInput`, `FornecedorUpdateInput`, `DocumentoTipo`, `formatDocumento()`. Contains full CPF (11-digit) and CNPJ (14-digit) check-digit validators; the `documento` field transforms a masked string into `{documento: digits, documento_tipo: 'cpf'|'cnpj'}` and rejects repeated-digit sequences. `ativo` is coerced from the HTML checkbox `'on'`/`'true'`.

### `import-pagamento.ts` — 102 lines
`C:\...\lib\schemas\import-pagamento.ts` — Exports `ImportPagamentoRowSchema` (`.strict()`), `ImportPagamentoRow`, `CSV_TEMPLATE`. Columns: `obra` (required), `fornecedor?`, `categoria?`, `valor` (pt-BR or EN number parsing), `data_pagamento` (`YYYY-MM-DD` or `DD/MM/YYYY`), `origem` default `'importado'` ∈ `whatsapp|manual|importado`, `status_pagto` default `'confirmado'` ∈ `confirmado|aguardando|erro`, `descricao?`, `observacoes?`.

**`CSV_TEMPLATE`** (CRLF-joined, exact):
```
obra,fornecedor,categoria,valor,data_pagamento,origem,status_pagto,descricao,observacoes
Obra Alpha,Casa das Tintas,Material,"R$ 1.250,00",15/09/2026,manual,confirmado,Cimento CP-2,
```

### `obra.ts` — 61 lines
`C:\...\lib\schemas\obra.ts` — Exports `obraTipoEnum` (`['nova','reforma']`), `obraStatusEnum` (`['ativa','pausada','concluida','arquivada']`), `ObraCreateSchema`, `ObraUpdateSchema`, `ObraCreateInput`, `ObraUpdateInput`, `ObraStatus`, `ObraTipo`. Includes a partial nested `endereco` object (cep/rua/numero/bairro/cidade/uf), `status` defaults `'ativa'`, and `apelidos` parsed from a comma-separated string into `string[]`. No label map here.

### `pagamento.ts` — 77 lines
`C:\...\lib\schemas\pagamento.ts` — Exports `pagamentoOrigemEnum` (`['whatsapp','manual','importado']`), `pagamentoStatusEnum` (`['confirmado','aguardando','erro']`), `PagamentoCreateSchema`, `PagamentoUpdateSchema`, `PagamentoCreateInput`, `PagamentoUpdateInput`, `PagamentoOrigem`, `PagamentoStatus`, `formatBRL()`. Defaults: `origem: 'manual'`, `status_pagto: 'confirmado'`; `valor` accepts `"1.234,56"` and `"1234.56"`.

**There is no `PAGAMENTO_STATUS_LABELS`/`PAGAMENTO_ORIGEM_LABELS` map in this file** — the status enum values are raw. The only label maps in `lib/` are `ANEXO_TIPO_LABELS`, `TEMA_LABELS`, `EMAIL_PREF_LABELS`, `AUDIT_ENTIDADE_LABELS`, `AUDIT_ACAO_LABELS`, `PAPEL_LABELS`, `PAPEL_DESCRIPTIONS` (last four live under `lib/data/`). Payment-status display labels, if they exist, are outside `lib/`.

### `perfil.ts` — 66 lines
`C:\...\lib\schemas\perfil.ts` — Exports `temaEnum`, `Tema`, `TEMA_LABELS`, `TIMEZONE_OPTIONS`, `EmailPrefsSchema`, `EmailPrefs`, `DEFAULT_EMAIL_PREFS`, `EMAIL_PREF_LABELS`, `PerfilUpdateSchema`, `PerfilUpdateInput`.

- `temaEnum = z.enum(['light','black','dark'])` (mirrors Postgres `tema_preferido`)
- **`TEMA_LABELS`**: `light: 'Claro'`, `black: 'Preto (padrão Nogma)'`, `dark: 'Petróleo (dark alt)'`
- **`TIMEZONE_OPTIONS`** (whitelist, `as const`):
  `America/Sao_Paulo` → `'São Paulo (UTC−03)'`; `America/Manaus` → `'Manaus (UTC−04)'`; `America/Belem` → `'Belém (UTC−03)'`; `America/Fortaleza` → `'Fortaleza (UTC−03)'`; `America/Cuiaba` → `'Cuiabá (UTC−04)'`; `America/Rio_Branco` → `'Rio Branco (UTC−05)'`; `America/Noronha` → `'Fernando de Noronha (UTC−02)'`; `UTC` → `'UTC (referência global)'`
- **`DEFAULT_EMAIL_PREFS`**: `pagamentos_aguardando: true`, `pendencias_novas: true`, `digest_semanal: false`
- **`EMAIL_PREF_LABELS`**: `pagamentos_aguardando: 'Novo pagamento aguardando minha aprovação'`, `pendencias_novas: 'Nova mensagem WhatsApp na fila de pendências'`, `digest_semanal: 'Resumo semanal por email (Fase futura)'`
- `PerfilUpdateSchema`: all-optional `nome` (2–100), `telefone` (digits-stripped, 10–13 or empty), `tema`, `timezone` (whitelist-refined), `email_prefs`.

### `uazapi.ts` — 86 lines
`C:\...\lib\schemas\uazapi.ts` — Exports `MsgTipoUazapi`, `mapTipoToDb()`, `UazapiInboundSchema`, `UazapiInbound`, `normalizeTelefone()`, `toIsoDate()`. Permissive (`.passthrough()`) inbound WhatsApp webhook schema: `id` (idempotency key), `type` ∈ `text|image|document|audio|video|sticker|location`, `timestamp` (number|string), `from`, `text?`, `media?{url,mimetype,filename,size}`, `raw?`. `mapTipoToDb` collapses provider types onto the DB `msg_tipo` enum (`text→texto`, `image→imagem`, `document→pdf`, `audio→audio`, everything else → `texto`).

---

## 4. `lib/email/`

**Real vs mock**: `ResendEmailProvider` is a genuine implementation (calls the `resend` npm SDK, v`^6.26.0`). `MockEmailProvider` is the **default** and sends nothing. Selection is by `EMAIL_PROVIDER`; unknown values throw.

| File | Lines | Exports |
|---|---|---|
| `provider.ts` | 54 | `EmailInput`, `EmailResult`, `EmailProvider`, `getEmailProvider()`, `defaultFromAddress()` |
| `mock-provider.ts` | 30 | `MockEmailProvider` |
| `resend-provider.ts` | 48 | `ResendEmailProvider` |
| `templates/index.ts` | 27 | barrel (re-exports below with `buildPagamento*`/`buildPendencia*`/`buildBoasVindas*` aliases) |
| `templates/base-layout.tsx` | 96 | `EmailLayout`, `EmailLayoutProps` |
| `templates/pagamento-aguardando.tsx` | 174 | `PagamentoAguardandoProps`, `buildSubject`, `buildText`, `PagamentoAguardandoEmail` |
| `templates/pendencia-nova.tsx` | 199 | `PendenciaNovaProps`, `buildSubject`, `buildText`, `PendenciaNovaEmail` |
| `templates/boas-vindas.tsx` | 150 | `PapelUsuario`, `BoasVindasProps`, `buildSubject`, `buildText`, `BoasVindasEmail` |

**Env vars**: `EMAIL_PROVIDER` (default `'mock'`; accepts `mock`|`resend`), `RESEND_API_KEY` (required to construct `ResendEmailProvider`, else it throws), `EMAIL_FROM` (default `'Nogma Gestor de Obras &lt;no-reply@nogmacorp.com.br&gt;'`), `NEXT_PUBLIC_APP_URL` (used by `send-email.tsx` for CTA links), `NODE_ENV` (mock only logs outside production).

`resend-provider.ts` never throws on send — API errors become `{ok: false, error: 'Resend: &lt;name&gt; — &lt;message&gt;'}`. `mock-provider.ts` returns a fake id `mock_&lt;base36 ts&gt;_&lt;random&gt;`.

**Templates and when each is sent:**

| Template | Subject | Trigger |
|---|---|---|
| `PagamentoAguardandoEmail` | `Novo pagamento aguardando aprovação — ${obra_nome}` | `sendPagamentoAguardandoEmail()` — a payment is created with `status='aguardando'`; sent to `admin`+`gestor` who opted into `pagamentos_aguardando`. CTA → `${painel_url}/pagamentos/${pagamento_id}` |
| `PendenciaNovaEmail` | `Mensagem WhatsApp aguardando classificação — ${pendencia_count} pendente(s)` | `sendPendenciaNovaEmail()` — called from `classify-and-persist.ts` after a `confirmacoes_pendentes` row is inserted; `admin`+`gestor` with `pendencias_novas`. Shows `(confidence*100)%`, valor estimado, obra provável. CTA → `${painel_url}/pendentes` |
| `BoasVindasEmail` | `Bem-vindo ao Gestor de Obras Nogma` | `sendBoasVindasEmail()` — new user created; sent to that user's own address. Lists next steps `/obras`, `/fornecedores`, `/relatorios`; extra warning block if `papel === 'leitura'`. CTA → `${painel_url}/painel` |
| `EmailLayout` | — | Shared shell: bg `#F7F8F8`, card `#FFFFFF` w/ `1px solid #E1E4E4`, header rule `2px solid #0C4651`, brand text `#0C4651` with `#A3CC00` dot, footer `#565B5B` — "Nogma Corp · Gestor de Obras para Cavalcanti Construções" |

All three CTAs use the lime button `backgroundColor: '#CCFF00'`, `color: '#041F25'`. Every template ships a plain-text `buildText()` twin for deliverability.

---

## 5. Storage, webhooks, Supabase, theme, util

`C:\...\lib\storage\documents.ts` — **62 lines**. Exports `sha256Hex()`, `makeStoragePath()`, `uploadDocumentFile()`, `uploadDocumentBuffer()`, `deleteDocumentFile()`, `getSignedUrl()`. Service-role Supabase Storage wrapper for the `documents` bucket; path convention `{obra_id}/{documento_id}/{sanitized filename ≤200 chars}`, `upsert: false`, signed URLs default 60s TTL, delete used for rollback when the DB insert fails.

`C:\...\lib\webhooks\hmac.ts` — **31 lines**. Exports `verifyHmacSignature()`, `signHmac()`. Inbound signature check: strips an optional `sha256=` prefix, requires `^[0-9a-f]{64}$`, compares HMAC-SHA256 of the **raw** body with `timingSafeEqual`; returns `false` on any missing/invalid input rather than throwing.

`C:\...\lib\supabase\client.ts` — **9 lines**. Exports `createClient()` — browser client via `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

`C:\...\lib\supabase\server.ts` — **28 lines**. Exports `createClient()` — async RSC/server-action client via `createServerClient` + `next/headers` `cookies()`, swallowing `setAll` failures when invoked from a Server Component.

`C:\...\lib\supabase\middleware.ts` — **53 lines**. Exports `updateSession(request)` — refreshes the session cookie then gates routing: unauthenticated users are redirected to `/login` unless on `/login`, `/definir-senha`, `/`, or the public APIs `/api/webhooks/*`, `/api/cron/*`, `/api/exports/*`; authenticated users hitting `/login` go to `/painel`.

`C:\...\lib\theme.ts` — **12 lines**. Exports `Theme` (`'light'|'black'|'dark'`), `THEME_COOKIE = 'nogma-theme'`, `DEFAULT_THEME = 'black'`, `getServerTheme()` — reads/validates the theme cookie server-side.

`C:\...\lib\util\csv-parser.ts` — **102 lines**. Exports `ParsedCsv`, `parseCsv()`, `rowsToObjects()`. Dependency-free RFC 4180 parser: BOM strip, `,`/`;` auto-detection from the first line, CRLF/LF, quoted fields with `""` escapes and embedded newlines; drops all-blank rows. Header explains PapaParse (600 KB) was deliberately avoided.

`C:\...\lib\util\search.ts` — **17 lines**. Exports `sanitizeSearchQuery(raw)` — strips PostgREST filter metacharacters `, ( ) \ % * :` (replacing with spaces) to prevent `.or('col.ilike.%…%')` filter injection. Used by `data/obras.ts`, `data/fornecedores.ts`, `data/pagamentos.ts`, `data/documentos.ts`.

---

## 6. `lib/reports/`

**PDF library: `@react-pdf/renderer` `^4.9.0`** (not Puppeteer, not pdfkit directly). All PDFs are A4 portrait, Helvetica (bundled), with `Font.registerHyphenationCallback` disabling hyphenation. Custom brand font is explicitly deferred.

`C:\...\lib\reports\csv.ts` — **241 lines**. Exports `toCsv()`, `obraCompletaToCsv()`, `mesToCsv()`, `fornecedorToCsv()`, `atividadeToCsv()`. Emits UTF-8 BOM + CRLF + RFC 4180 escaping so Excel pt-BR opens it correctly; numbers formatted `1234,56`, dates `dd/mm/yyyy`. Each function writes a `#` title block, then `##` sections mirroring the PDF layout.

`C:\...\lib\reports\pdf\primitives.tsx` — **303 lines**. Exports `styles` (StyleSheet), `NogmaHeader`, `NogmaFooter`, `NogmaDoc`, `ReportTitle`, `Section`, `KpiCard`, `KpiGrid`, `formatBRL()`, `formatDate()`, `formatDateTime()`. Shared A4 chrome: fixed header (`NOGMA · Gestor de Obras` + "Emitido …"), fixed footer (`Nogma · Cavalcanti Construções · Documento confidencial` + `Página X de Y`), document metadata `author`/`creator` = "Nogma Gestor de Obras".

**The four reports** (each exports exactly one render function taking the matching `lib/data/reports.ts` shape and returning a `ReactElement`):

| File | Lines | Export | Title / sections |
|---|---|---|---|
| `obra-completa.tsx` | 226 | `renderObraCompletaPdf(data)` | `Relatório da Obra: ${obra.nome}` — Informações da obra, Pagamentos, Documentos, Consolidado por categoria, Consolidado por fornecedor |
| `mes.tsx` | 156 | `renderMesPdf(data)` | `Fechamento Mensal — ${titulo}` — Pagamentos do mês, Por obra, Por categoria |
| `fornecedor.tsx` | 174 | `renderFornecedorPdf(data)` | `Histórico do Fornecedor: ${fornecedor.nome}` — Dados do fornecedor, Primeira e última compra, Pagamentos, Consolidado por obra |
| `atividade.tsx` | 101 | `renderAtividadePdf(data)` | `Relatório de Atividade` — Eventos |

`C:\...\lib\reports\pdf\theme.ts` — **53 lines**. Exports `nogmaColors`, `spacing`, `fontSizes`. Mirrors `styles/tokens/colors.css` because `@react-pdf/renderer` has no CSS-variable support; light context (white paper).

**`nogmaColors` exact values:**
```
petroleum    #0C4651     lime      #CCFF00     neutral50   #F7F8F8
petroleum950 #041F25     lime600   #A3CC00     neutral100  #EEF0F0
petroleum800 #0C4651     lime050   #FAFFE0     neutral200  #E1E4E4
petroleum600 #196E7C     black     #000000     neutral300  #C9CDCD
petroleum100 #E1EEF0     white     #FFFFFF     neutral400  #A1A1A1
petroleum050 #F1F7F8                           neutral600  #565B5B
                                               neutral800  #232626
success #2FA36B   successBg #E7F5EE
warning #E8A317   warningBg #FBF1DC
danger  #D6483B   dangerBg  #FBE9E7
```
`spacing` = `{xs:2, sm:4, md:8, lg:12, xl:16, xxl:24}`; `fontSizes` = `{micro:7, caption:8, body:10, bodyLg:11, h4:12, h3:14, h2:18, h1:22, display:28}`.

---

## 7. `lib/data/` — 14 files, one line each

All are `import 'server-only'`, typed against `Database` from `@nogma/db`, and use RLS-respecting `createClient()` from `lib/supabase/server` unless noted.

| File | Lines | One-line purpose + main exports |
|---|---|---|
| `apelidos.ts` | 35 | `fornecedor_apelidos` (WhatsApp nickname aliases) reads — `FornecedorApelido`, `listApelidosByFornecedor()` (ordered by `vezes_visto`), `findApelidoConflict()` (case-insensitive global uniqueness check) |
| `auditoria.ts` | 152 | `audit_log` browsing/filtering with actor resolution — `AuditLog`, `AuditAcao`, `AUDIT_ENTIDADES`, `AUDIT_ENTIDADE_LABELS`, `AUDIT_ACAO_LABELS`, `AuditListFilters`, `AuditListItem`, `listAuditLog()`, `getAuditLog()`, `getEntidadeUrl()`, `extractChangedKeys()`; uses a service-role client for user emails |
| `categorias.ts` | 75 | Expense categories — `Categoria`, `CategoriaComContagem`, `listCategorias(includeArchived)`, `getCategoria()`, `listCategoriasComContagem()` |
| `documentos.ts` | 50 | Document/attachment listing with filters + sanitized search — `Documento`, `ListDocumentosFilters`, `listDocumentos()`, `getDocumento()` |
| `fornecedores.ts` | 61 | Suppliers + their aliases — `Fornecedor`, `FornecedorApelido`, `ListFornecedoresFilters`, `listFornecedores()`, `getFornecedor()`, `listFornecedorApelidos()` |
| `mensagens.ts` | 61 | WhatsApp message feed (latest N, default 100) enriched with the linked payment's valor/obra via batched lookup — `MensagemWhats`, `MsgStatus`, `MsgTipo`, `MensagemFeedItem`, `listMensagens()` |
| `notificacoes.ts` | 131 | Email notification log + recipient resolution — `NotificacaoEmail`, `PapelUsuario`, `getRecipientsByPapel(papeis, prefKey)` (service role, joins `auth.users` for emails, honors `email_prefs` opt-in, excludes archived), `logNotificacao()`, `listNotificacoes()`, `getNotificacao()` |
| `obras.ts` | 43 | Construction projects list/detail with status+search filters — `Obra`, `ListObrasFilters`, `listObras()`, `getObra()` |
| `pagamentos.ts` | 102 | Payments list/detail plus aggregation — `Pagamento`, `ListPagamentosFilters`, `listPagamentos()`, `getPagamento()`, `SumPagamentosFilters`, `sumPagamentosBy()` (fetch + client-side reduce; no SQL SUM) |
| `painel.ts` | 411 | Dashboard aggregates (replaced earlier MOCK data) — `KpiCard`, `KpisResumo`, `SerieMensalPoint`, `CategoriaGasto`, `AtividadeItem`, `getKpisResumo()`, `getSerieMensal(nMeses=12)`, `getGastoPorCategoria(topN=5)`, `getAtividadeRecente(limit=10)`, `relativeTime()` |
| `pendentes.ts` | 129 | Pending WhatsApp confirmation queue joined to messages + resolved obra/fornecedor names — `ConfirmacaoPendente`, `MensagemWhats`, `DadosExtraidos` (mirrors `ClassifierOutput.extracted`), `PendenteItem` (carries `confianca_ia`), `listPendentes()` |
| `perfil.ts` | 55 | Current user's own profile + email preferences — `Profile`, `MyProfile`, `getMyProfile()`, `parseEmailPrefs()` (falls back to `DEFAULT_EMAIL_PREFS`) |
| `reports.ts` | 447 | Query layer for the 4 official reports, returning the exact shapes the PDF/CSV generators consume — `ObraCompletaData`/`getObraCompletaData()`, `MesData`/`getMesData(ano,mes)`, `FornecedorData`/`getFornecedorData()`, `AtividadeItem`, `AtividadeData`/`getAtividadeData(from,to)` |
| `usuarios.ts` | 209 | User administration via Supabase Auth Admin API (service role) — `Profile`, `PapelUsuario`, `UsuarioItem`, `PAPEL_LABELS` (`admin:'Administrador'`, `gestor:'Gestor'`, `financeiro:'Financeiro'`, `leitura:'Leitura'`), `PAPEL_DESCRIPTIONS`, `listUsuarios()`, `getUsuario()`, `inviteUsuarioAdmin()`, `resendInviteAdmin()`, `updateUsuarioPapelAdmin()`, `archiveUsuarioAdmin()`, `restoreUsuarioAdmin()` |

---

## 8. Grep results: TODO / FIXME / mock / stub / placeholder / "not implemented" / `@ts-expect-error`

**`@ts-expect-error`: 0 hits.** Also 0 hits for `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, `FIXME`, `HACK`, `XXX`, `WIP`, `placeholder`, `stub`, and any literal "not implemented"/"não implementado" in the entire `lib/` tree.

Every `TODO`-looking hit is a false positive — the Portuguese word **`TODOS`** ("all"):
- `lib\services\detect-duplicates.ts:9` — ` *  1. Query TODOS os fornecedores ativos (com documento se tiver)`
- `lib\services\dispatch-webhook.ts:50` — ` * Dispatch um evento pra TODOS os webhooks_outbound ativos que`

**`mock` / `Mock` hits (all real):**

| file:line | content |
|---|---|
| `lib\ia\classifier.ts:11` | ` *   - \`MockClassifier\` (default hoje): heurística determinística para dev/testes.` |
| `lib\ia\classifier.ts:57` | ` *   - \`IA_PROVIDER=mock\` (default): MockClassifier determinístico` |
| `lib\ia\classifier.ts:62` | `  const provider = process.env.IA_PROVIDER ?? 'mock';` |
| `lib\ia\classifier.ts:63` | `  if (provider === 'mock') {` |
| `lib\ia\classifier.ts:64` | `    const { MockClassifier } = await import('./mock-classifier');` |
| `lib\ia\classifier.ts:65` | `    return new MockClassifier();` |
| `lib\ia\classifier.ts:70` | `  throw new Error(\`IA_PROVIDER desconhecido: ${provider}. Suportados: mock\`);` |
| `lib\ia\mock-classifier.ts:5` | ` * MockClassifier — heurística determinística para dev/testes.` |
| `lib\ia\mock-classifier.ts:20` | `export class MockClassifier implements Classifier {` |
| `lib\ia\mock-classifier.ts:24` | `    // Documento (imagem ou PDF) — não tenta OCR no mock` |
| `lib\ia\mock-classifier.ts:32` | `          raciocinio: 'MockClassifier: mídia detectada; OCR desabilitado no mock',` |
| `lib\ia\mock-classifier.ts:42` | `        extracted: { raciocinio: 'MockClassifier: sem texto e sem mídia relevante' },` |
| `lib\ia\mock-classifier.ts:56` | `          raciocinio: 'MockClassifier: texto sem padrão de valor R$',` |
| `lib\ia\mock-classifier.ts:79` | `        raciocinio: \`MockClassifier: valor=${valor}, obra=${obra?.nome ?? '?'}, fornecedor=${forn?.nome ?? '?'}\`,` |
| `lib\email\provider.ts:5` | ` * (factory) permite alternar entre mock (default para dev/testes) e` |
| `lib\email\provider.ts:8` | ` * Se Fase 8 usa \`IA_PROVIDER=anthropic\|mock\`, aqui usa` |
| `lib\email\provider.ts:9` | ` * \`EMAIL_PROVIDER=resend\|mock\` — mesma convenção.` |
| `lib\email\provider.ts:33` | ` *   - EMAIL_PROVIDER=mock (default): apenas loga em notificacoes_email` |
| `lib\email\provider.ts:39` | `  const provider = process.env.EMAIL_PROVIDER ?? 'mock';` |
| `lib\email\provider.ts:40` | `  if (provider === 'mock') {` |
| `lib\email\provider.ts:41` | `    const { MockEmailProvider } = await import('./mock-provider');` |
| `lib\email\provider.ts:42` | `    return new MockEmailProvider();` |
| `lib\email\provider.ts:48` | `  throw new Error(\`EMAIL_PROVIDER desconhecido: ${provider}. Suportados: mock, resend\`);` |
| `lib\email\mock-provider.ts:5` | ` * MockEmailProvider — retorna ok=true sem enviar nada real.` |
| `lib\email\mock-provider.ts:14` | `export class MockEmailProvider implements EmailProvider {` |
| `lib\email\mock-provider.ts:19` | `      console.info('[email:mock] would send:', {` |
| `lib\email\mock-provider.ts:27` | `      providerId: \`mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}\`,` |
| `lib\services\send-email.tsx:21` | ` * Send service — orquestra render (React Email) → provider (Resend/mock)` |
| `lib\data\painel.ts:7` | ` * Substitui dados MOCK por queries reais agregadas.` (historical note — this file is real queries) |

**Other deferred-work markers found:**
- `lib\ia\classifier.ts:67` — `  // Reservado — quando as credenciais chegarem, ativar branches abaixo:`
- `lib\reports\pdf\primitives.tsx:10` — ` * (deferido; requer hospedar TTF acessível).`
- `lib\schemas\perfil.ts:43` — `  digest_semanal: 'Resumo semanal por email (Fase futura)',`
- `lib\services\classify-and-persist.ts:24-26` — header note that media download/upload to Storage is deferred to "task 8.x quando UAZAPI for provisionado"; only `midia_mime` is persisted.
