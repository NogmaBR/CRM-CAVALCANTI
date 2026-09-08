# Audit Backend — CRM Nogma-Cavalcanti

**Data:** 2026-09-08
**Scope:** Server actions · Services · API routes · Data layer · Error handling · Resilience · Tests
**Auditor:** Claude Code (automated review, no fixes applied)
**Base:** `apps/web` — Next.js + Supabase (Fases 0–11 implementadas)

---

## Sumário executivo

Codebase em excelente estado para um projeto em estágio early. Os padrões de erro, RLS, N+1, Zod e redirect são **consistentes em todos os 19 server actions e 17 data/service files** revisados. Os achados abaixo são principalmente edge cases de resiliência, um race condition real, e gaps de testes documentados — nada que inviabilize produção imediata, mas que vale resolver antes de volume real.

---

## 1 — Server Actions

### ✅ Padrões consistentes (todos os actions)

- `'use server'` em todos os 19 arquivos de actions.
- Zod validation em **todos** os inputs de FormData antes de qualquer I/O.
- `redirect()` como único mecanismo de saída — nunca `return value` (correto para Next 15+).
- `encodeURIComponent()` aplicado em **todos** os `?error=` e `?success=` redirects.
- `revalidatePath()` chamado após toda mutation bem-sucedida.
- `mapDbError` / `mapDbErrorWithContext` usados consistentemente; usuário nunca vê stack trace ou mensagem raw do Postgres.

---

### 🔴 BUG-01 — Race condition no `mergeFornecedoresAction`: operações sem transação

**Arquivo:** `apps/web/lib/services/merge-fornecedores.ts`
**Linhas:** 71–130

**Problema:** O merge de fornecedores executa 5 operações sequenciais independentes no banco (move pagamentos, move documentos, move apelidos, insere apelido do nome, soft-delete). Não há transação. Se o processo cair entre os passos 2 e 5, o estado fica inconsistente: pagamentos já foram movidos para `keep_id`, mas `drop` ainda está ativo. Inversamente, se o soft-delete acontecer mas o move de pagamentos falhar silenciosamente (errors são descartados — `data` em vez de checar `error`), referências ficam corrompidas.

**Agravante:** Os erros de `supabase.update()` em pagamentos e documentos (linhas 72–82) são **completamente ignorados** — o código captura `{ data: pagsMoved }` mas não verifica `error`. Se a FK falhar por qualquer razão, o service retorna `ok: true` com contagem incorreta.

**Impacto:** Dados corrompidos — pagamentos apontando para `drop_id` que foi soft-deleted, sem possibilidade de auditoria automática.

**Recomendação:**
1. Usar RPC Postgres (`supabase.rpc('merge_fornecedores', { keep_id, drop_id })`) envolvida em `BEGIN/COMMIT` para atomicidade.
2. Enquanto isso: checar `error` em cada step e abortar com rollback manual (restaurar `deleted_at = null` em drop) se qualquer step falhar.

```ts
// Problema — error ignorado:
const { data: pagsMoved } = await supabase
  .from('pagamentos')
  .update({ fornecedor_id: args.keepId })
  .eq('fornecedor_id', args.dropId)
  .select('id');
// Correto:
const { data: pagsMoved, error: pagsErr } = await ...
if (pagsErr) return { ok: false, error: pagsErr.message, ... };
```

---

### 🔴 BUG-02 — `confirmarPendencia`: pagamento criado sem verificar se `confirmacoes_pendentes` ainda está ativo após insert

**Arquivo:** `apps/web/app/(app)/pendentes/actions.ts`
**Linhas:** 89–108

**Problema:** Se duas tabs submetarem `confirmarPendencia` para a mesma `confirmacao_id` simultaneamente, ambas passam no check `if (confirmacao.resolvida)` (ambas lêem `false`). Ambas criam um `pagamento` novo. Só depois ambas marcam `resolvida = true`. Resultado: dois pagamentos duplicados para a mesma pendência WhatsApp.

**Não há `SELECT ... FOR UPDATE` nem upsert com guard.** A confirmação de `resolvida` deveria ser feita com `UPDATE confirmacoes_pendentes SET resolvida=true WHERE id=? AND resolvida=false RETURNING id` — se retornar 0 linhas, outro processo ganhou a corrida.

**Impacto:** Pagamento duplicado em `pagamentos`. Em contexto de gestor apressado com dois devices, é cenário realista.

**Recomendação:**
```ts
// Usar update condicional como lock otimista:
const { data: locked } = await supabase
  .from('confirmacoes_pendentes')
  .update({ resolvida: true, respondida_em: new Date().toISOString() })
  .eq('id', confirmacao_id)
  .eq('resolvida', false) // guard — falha silenciosa se já resolvida
  .select('id')
  .maybeSingle();

if (!locked) {
  redirect('/pendentes?error=...');
}
// Só agora inserir pagamento
```

---

### 🔴 BUG-03 — `apelido-actions.ts`: raw `error.message` exposto ao usuário

**Arquivo:** `apps/web/app/(app)/fornecedores/[id]/apelido-actions.ts`
**Linha:** 53

**Problema:** Quando o insert de apelido falha com erro que não é `23505`, o código expõe `error.message` diretamente:

```ts
const msg =
  error.code === '23505'
    ? 'Apelido já existe para este fornecedor'
    : `Erro ao adicionar apelido: ${error.message}`; // <- raw DB message
redirect(`/fornecedores/${fornecedor_id}?error=${encodeURIComponent(msg)}`);
```

Este é o **único** lugar no codebase que vaza mensagem raw do banco para o usuário. Todos os outros 18 actions usam `mapDbError`. Inconsistência e risco de vazar nomes de constraint, colunas ou schema.

**Recomendação:**
```ts
: mapDbError(error, 'Erro ao adicionar apelido')
```

Idem linha 78 em `removerApelido` — mesmo padrão, mesma correção.

---

### 🟠 QUALITY-01 — `assertAdmin()` duplicado em 4 arquivos sem extração

**Arquivos:**
- `app/(app)/config/usuarios/actions.ts`
- `app/(app)/config/importar/actions.ts`
- `app/(app)/config/categorias/actions.ts`
- `app/(app)/config/webhooks/actions.ts`

**Problema:** A função `assertAdmin()` é copiada identicamente (com variações menores no redirect path) nos 4 arquivos. Se a lógica de verificação de papel mudar (ex: adicionar papel `super_admin`), é necessário alterar em 4 lugares.

**Variante:** `app/(app)/fornecedores/duplicatas/actions.ts` tem `assertAdminOrGestor()` — padrão similar mas distinto.

**Recomendação:** Extrair para `lib/auth/assert-role.ts`:
```ts
export async function assertRole(papeis: PapelUsuario[], redirectPath: string): Promise<string>
```

---

### 🟠 QUALITY-02 — `criarWebhook` expõe `secret` em URL de redirect

**Arquivo:** `apps/web/app/(app)/config/webhooks/actions.ts`
**Linha:** 97

```ts
redirect(`${BASE_PATH}?created=${wh.id}&secret=${encodeURIComponent(secret)}`);
```

E linha 200:
```ts
redirect(`${BASE_PATH}?secret=${encodeURIComponent(newSecret)}`);
```

**Problema:** O secret do webhook aparece na URL do browser após redirect. URLs são logadas em:
- Vercel access logs
- Browser history
- Referrer header em cliques subsequentes
- Analytics tools (se houver)

É uma exposição de segredo de assinatura via side channel. O padrão correto é exibir via estado de sessão (cookie `Set-Cookie` com `HttpOnly` ou `SameSite=Strict`), flash message via cookie de curto prazo, ou exibir na página de resposta diretamente sem passar pela URL.

**Recomendação:** Usar cookie `HttpOnly` de vida curta (60s) para transportar o secret até a próxima renderização. Isso já é a prática de `supabase-ssr`.

---

### 🟡 REFACTOR-01 — `formToRecord` duplicado em 5 arquivos de actions

**Arquivos:** `obras/actions.ts`, `fornecedores/actions.ts`, `pagamentos/actions.ts`, `documentos/actions.ts`, `config/perfil/actions.ts` (variante)

Cada arquivo define sua própria versão de `formToRecord`. A versão em `obras/actions.ts` tem lógica adicional de nested `endereco.*`, enquanto os outros são idênticos entre si.

**Recomendação:** Extrair o helper simples para `lib/util/form-data.ts`. A versão com `endereco` pode ficar local ou receber um `nestedKeys` option.

---

### 🟡 REFACTOR-02 — `login/actions.ts` expõe mensagem de erro do Supabase Auth

**Arquivo:** `apps/web/app/(auth)/login/actions.ts`
**Linha:** 27

```ts
redirect(`/login?error=${encodeURIComponent(error.message)}`);
```

Supabase Auth retorna mensagens técnicas como `"Invalid login credentials"` ou `"Email not confirmed"`. Não são stack traces, mas também não são mensagens localizadas. O padrão no resto do app é `mapDbError`. Inconsistente.

**Recomendação:** Mapear os erros comuns de auth para mensagens em português:
```ts
const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha inválidos.',
  'Email not confirmed': 'E-mail ainda não confirmado. Verifique sua caixa de entrada.',
};
const msg = AUTH_ERRORS[error.message] ?? 'Falha no login. Tente novamente.';
```

---

### 🟡 REFACTOR-03 — `definir-senha/actions.ts` expõe mensagem de erro do Supabase Auth

**Arquivo:** `apps/web/app/(auth)/definir-senha/actions.ts`
**Linha:** 38

```ts
redirect(`/definir-senha?error=${encodeURIComponent(`Falha ao definir senha: ${error.message}`)}`);
```

Mesmo padrão do login — mensagem raw de provider exposta. Mesma recomendação.

---

### 🟢 INFO — `previewImportCsv` aceita string arbitrária sem limite de tamanho

**Arquivo:** `apps/web/app/(app)/config/importar/actions.ts`
**Linha:** 31

A action recebe `csvText: string` diretamente (não é FormData, é chamada como server action com argumento tipado). Não há validação de tamanho máximo — um CSV de 100MB seria processado inteiro em memória no serverless. Para Vercel Hobby o payload máximo de server action é 4MB, então é improvável atingir volumes perigosos, mas vale documentar o limite implícito.

**Recomendação:** Adicionar guard `if (csvText.length > 4_000_000) throw new Error(...)` pra feedback explícito.

---

## 2 — Services

### ✅ Padrões consistentes

- **Best-effort pattern** corretamente documentado e implementado em `dispatch-webhook.ts` e `classify-and-persist.ts` via `Promise.allSettled` e `try/catch` silencioso.
- **Timeout 10s** em todos os fetches externos de webhook (via `AbortController`).
- **Idempotência** no webhook inbound UAZAPI: `upsert` com `onConflict: 'msg_id_uazapi'` garante que reentrega do provider é no-op.
- **Single responsibility** em todos os services — cada um faz uma coisa.

---

### 🔴 BUG-04 — `logWebhookExecution`: read-modify-write sem lock — race condition em `total_execucoes`

**Arquivo:** `apps/web/lib/services/dispatch-webhook.ts`
**Linhas:** 103–128

```ts
const { data: cur } = await supabase
  .from('webhooks_outbound')
  .select('total_execucoes')
  .eq('id', id)
  .maybeSingle();
await supabase
  .from('webhooks_outbound')
  .update({ total_execucoes: (cur?.total_execucoes ?? 0) + 1 })
  .eq('id', id);
```

Quando múltiplos webhooks disparam em paralelo via `Promise.allSettled` (que é a execução normal — um evento para N webhooks), cada uma lê o valor atual **antes** das outras terem atualizado. Todas lêem `total_execucoes = 42` e todas escrevem `43`. O contador fica errado por fator de N-1.

O próprio código comenta: `"Increment total_execucoes usando raw sql seria melhor"`.

**Impacto:** Métrica de execuções é imprecisa. Em ambientes com muitos webhooks, pode subestimar drasticamente.

**Recomendação:** Usar RPC ou raw SQL com `UPDATE ... SET total_execucoes = total_execucoes + 1`:
```ts
await supabase.rpc('increment_webhook_execucoes', { webhook_id: id });
```

Ou, no Postgres/PostgREST, usar o hint de atualização atômica via `rpc`.

---

### 🔴 BUG-05 — `generateWebhookSecret`: entropia insuficiente

**Arquivo:** `apps/web/lib/services/dispatch-webhook.ts`
**Linhas:** 182–186

```ts
export function generateWebhookSecret(): string {
  return createHmac('sha256', Math.random().toString(36))
    .update(Date.now().toString() + Math.random().toString(36))
    .digest('hex');
}
```

`Math.random()` é um PRNG não-criptograficamente seguro (PRNG determinístico). Usar HMAC sobre `Math.random` **não** transforma em CSPRNG — a entropia do output é limitada pelo espaço de estado do PRNG (52 bits no V8). Para um secret de webhook que autentica requisições de terceiros, isso é insuficiente.

**Recomendação:**
```ts
import { randomBytes } from 'node:crypto';
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex'); // 256 bits de entropia real
}
```

---

### 🟠 QUALITY-03 — `classify-and-persist.ts`: `classifyAndPersist` sem timeout — pode bloquear request indefinidamente

**Arquivo:** `apps/web/lib/services/classify-and-persist.ts`
**Linha:** 66

```ts
const out = await classifier.classify(input);
```

O classifier é chamado sem timeout. Com `IA_PROVIDER=mock` isso não é problema (retorno em < 1ms). Mas quando `IA_PROVIDER=anthropic` for ativado (Fase 8.x), uma chamada lenta ou travada pode manter o request do webhook UAZAPI aberto por tempo indefinido — ou até o timeout de 10s da Vercel Serverless Function matar a request, retornando 504 ao UAZAPI, que vai retryar, potencialmente criando processamento duplicado.

**Recomendação:** Envolver `classifier.classify` em `Promise.race` com um timeout explícito (ex: 8s), retornando `nao_identificado` com erro de timeout se exceder:

```ts
const classifyPromise = classifier.classify(input);
const timeoutPromise = new Promise<ClassifierOutput>((_, reject) =>
  setTimeout(() => reject(new Error('classifier timeout')), 8000)
);
const out = await Promise.race([classifyPromise, timeoutPromise]).catch(...);
```

---

### 🟠 QUALITY-04 — `detect-duplicates.ts` usa `serviceRoleClient` para leitura que RLS poderia cobrir

**Arquivo:** `apps/web/lib/services/detect-duplicates.ts`
**Linha:** 98

A query só lê `id, nome, documento` de fornecedores — dados que a RLS do usuário autenticado já cobre (admin/gestor têm SELECT em fornecedores). Usar service role para uma leitura que poderia ser feita com `createClient()` segue o princípio de menor privilégio ao contrário.

**Impacto:** Baixo — o code path está por trás de `assertAdminOrGestor()` na action. Mas aumenta a superfície de uso de service role desnecessariamente.

**Recomendação:** Passar o `supabase` de `createClient()` por parâmetro, ou trocar para `createClient()`. Reservar service role para operações que de fato precisam (writes cross-user, bypass de RLS).

---

### 🟡 REFACTOR-04 — `serviceRoleClient()` criado em 5 módulos distintos sem compartilhamento

**Arquivos:**
- `lib/services/dispatch-webhook.ts`
- `lib/services/classify-and-persist.ts`
- `lib/services/detect-duplicates.ts`
- `lib/services/merge-fornecedores.ts`
- `lib/services/import-pagamentos.ts`
- `lib/data/usuarios.ts`
- `lib/data/notificacoes.ts`
- `lib/storage/documents.ts`

Cada módulo define sua própria factory `serviceRoleClient()` com validação de env vars. A lógica é idêntica. Qualquer mudança (ex: adicionar opção `global.fetch`, mudar schema type) requer N edições.

**Recomendação:** Extrair para `lib/supabase/service-role.ts` e importar de lá.

---

## 3 — API Routes

### ✅ Padrões consistentes

- `runtime = 'nodejs'` e `dynamic = 'force-dynamic'` em todas as 3 routes que usam service role ou fetch externo.
- HTTP status codes corretos: 400 (bad input), 401 (não autenticado), 500 (erros internos).
- HMAC verificado no webhook UAZAPI antes de qualquer processamento.
- Bearer token verificado no cron.
- Auth session verificada no exports antes de gerar dados.
- `Content-Type` headers corretos (pdf, csv, json) em todos os casos.
- `import 'server-only'` em todas as 3 routes de API.

---

### 🔴 BUG-06 — `webhooks/uazapi/route.ts`: status 200 retornado mesmo quando `classifyAndPersist` falha

**Arquivo:** `apps/web/app/api/webhooks/uazapi/route.ts`
**Linhas:** 95–100

```ts
const classifyResult = await classifyAndPersist(row.id).catch((err) => ({
  ok: false as const,
  error: err instanceof Error ? err.message : String(err),
}));

return NextResponse.json({ ok: true, mensagem_id: row.id, classify: classifyResult });
```

Se `classifyAndPersist` falhar, o webhook retorna HTTP 200 com `{ ok: true }` no body. O UAZAPI interpreta 200 como sucesso e **não** vai retryar. A mensagem ficará em status `recebida` (ou `processando`) sem nunca avançar.

Há uma trade-off intencional aqui: retornar 500 causaria retry infinito do UAZAPI (que pode ser pior). Porém, o status atual nem loga o erro em lugar algum quando a falha vem do `classifyAndPersist` — o `classifyResult.error` está apenas no JSON de resposta que o UAZAPI descarta.

**Recomendação:**
1. Manter 200 (decisão correta para evitar retry storms).
2. Mas adicionar `console.error` quando `classifyResult.ok === false`, para que apareça nos logs da Vercel.
3. Considerar atualizar `mensagens_whats.status = 'erro'` com `erro_msg` nesse path — o `classifyAndPersist` já faz isso em alguns casos, mas não todos.

---

### 🟠 QUALITY-05 — `/api/exports/[tipo]`: sem rate limiting — qualquer usuário autenticado pode gerar PDFs grandes indefinidamente

**Arquivo:** `apps/web/app/api/exports/[tipo]/route.ts`

`renderToBuffer` para um relatório de obra completa com centenas de pagamentos e documentos pode consumir memória e CPU significativos. Não há rate limiting por usuário ou por tipo de relatório. Um usuário (ou bug de frontend) pode disparar dezenas de requisições simultâneas.

**Recomendação:** Implementar rate limiting simples por `user.id` usando Vercel KV ou um token bucket em Redis. Na ausência de infra-redis, ao menos limitar via `Promise.race` com timeout de 30s por request.

**Nota:** Este é o único finding de rate limiting em todo o codebase — correto, as outras rotas têm autenticação implícita (session obrigatória para server actions).

---

### 🟠 QUALITY-06 — `theme/route.ts`: sem autenticação — qualquer request pode setar cookie de tema

**Arquivo:** `apps/web/app/api/theme/route.ts`

A route POST não verifica sessão. Qualquer origem (mesmo sem cookie de auth) pode enviar `{ theme: "dark" }` e setar o cookie `nogma-theme`. O cookie tem `sameSite: 'lax'` mas não `httpOnly`.

**Impacto:** Baixo — é apenas preferência visual, não acesso a dados. Mas é inconsistente com o padrão de auth do resto da app.

**Recomendação:** Adicionar verificação `await createClient(); supabase.auth.getUser()` antes de aceitar o request, ou mover a lógica de tema para um server action (que tem CSRF protection automática via Next.js).

---

## 4 — Data Layer

### ✅ Padrões consistentes — sem N+1 queries

- **Todos os data files** com lookup de entidades relacionadas usam `batched lookup via Map`: coletar IDs únicos em `Set`, fazer 1 query com `.in()`, construir `Map`, resolver em loop local.
- Exemplos verificados: `lib/data/reports.ts` (todos os 4 relatórios), `lib/data/painel.ts` (atividade recente), `lib/data/pendentes.ts`, `lib/data/auditoria.ts`.
- `sanitizeSearchQuery` aplicado em **todos** os free-text search (obras, fornecedores, pagamentos, documentos).
- `createClient` (RLS ativa) usado para reads de usuário; `serviceRoleClient` reservado para writes cross-user e admin API.

---

### 🟠 QUALITY-07 — `lib/data/painel.ts: getKpisResumo()`: carrega TODAS as obras e TODOS os pagamentos sem limit

**Arquivo:** `apps/web/lib/data/painel.ts`
**Linhas:** 107–119

```ts
const [obrasR, pagsR, msgsR, pagsTodosR] = await Promise.all([
  supabase.from('obras').select('id, created_at, deleted_at'),
  supabase.from('pagamentos').select('valor, data_pagamento, status_pagto, created_at')
    .eq('status_pagto', 'confirmado').is('deleted_at', null),
  ...
  supabase.from('pagamentos').select('valor').eq('status_pagto', 'confirmado').is('deleted_at', null),
]);
```

Sem `.limit()`. Para uma construtora com 2 anos de operação e 5000+ pagamentos, isso fetcha a tabela inteira para calcular somas e trends. O cálculo de trend (8 meses) e de `gastoTotal` é feito client-side em JS.

**Impacto médio prazo:** Com volume real, o dashboard vai degradar progressivamente.

**Recomendação:** Mover os agregados para RPCs Postgres ou queries com `gte('data_pagamento', eightMonthsAgo)`. O `pagsTodosR` (gasto total histórico) é o pior caso — deveria ser uma query `SELECT SUM(valor)`.

---

### 🟠 QUALITY-08 — `sumPagamentosBy` faz fetch de todos os valores para somar client-side

**Arquivo:** `apps/web/lib/data/pagamentos.ts`
**Linhas:** 76–102

O próprio comentário documenta: `"Supabase JS não tem SUM native"`. A solução atual fetcha todos os valores e soma com `reduce`. Para datasets pequenos (< 10k) é OK como anotado, mas não há guard que impeça uso em contextos de volume maior.

**Recomendação:** Criar RPC Postgres `sum_pagamentos(obra_id, status_pagto, from, to)` que retorna escalar. Enquanto isso, adicionar `.limit(10000)` com nota de que acima disso o sum será incorreto.

---

### 🟡 REFACTOR-05 — `lib/data/usuarios.ts: getUsuario()` busca lista completa para encontrar 1 item

**Arquivo:** `apps/web/lib/data/usuarios.ts`
**Linhas:** 107–109

```ts
export async function getUsuario(userId: string): Promise<UsuarioItem | null> {
  const usuarios = await listUsuarios(true);
  return usuarios.find((u) => u.user_id === userId) ?? null;
}
```

`listUsuarios` faz 2 queries (profiles + auth.admin.listUsers com `perPage: 1000`) e retorna todos os usuários para filtrar 1 por ID em JS. Chamado em `reenviarConvite` (toda vez que um convite é reenviado).

**Recomendação:**
```ts
export async function getUsuario(userId: string): Promise<UsuarioItem | null> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (!profile) return null;
  const admin = serviceRoleClient();
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  // ... enrich
}
```

---

## 5 — Error Handling

### ✅ Padrões consistentes

- `try/catch com rollback` implementado corretamente em `createDocumento` (4 steps: insert → upload → update path → cleanup em cada falha).
- Erros de DB nunca expostos raw ao usuário (exceto BUG-03 acima).
- Erros de email logados em `notificacoes_email.erro` via `logNotificacao`.
- Erros de webhook logados em `webhooks_outbound.ultima_execucao_erro`.
- Data layer throws `new Error(...)` (não expõe detalhes do Supabase) para consumo por Server Components.

---

### 🟠 QUALITY-09 — `classify-and-persist.ts`: email/webhook dispatched dentro do `try/catch` principal — falha silenciosa sem log

**Arquivo:** `apps/web/lib/services/classify-and-persist.ts`
**Linhas:** 151–184

O bloco `try { sendPendenciaNovaEmail(); dispatchEvento(); } catch { /* Silencioso */ }` captura **qualquer** erro dos dois calls juntos. Se o `sendPendenciaNovaEmail` falhar, o `dispatchEvento` pode nem chegar a ser executado — e nem saberemos qual falhou.

**Comparação:** Em `pagamentos/actions.ts`, email e webhook têm `try/catch` separados (email inline, webhook separado). Padrão inconsistente.

**Recomendação:** Separar os dois calls em `Promise.allSettled` ou em dois `try/catch` independentes, e adicionar `console.error` em cada falha:

```ts
await Promise.allSettled([
  sendPendenciaNovaEmail(...).catch((e) => console.error('pendencia email failed', e)),
  dispatchEvento(...).catch((e) => console.error('pendencia webhook failed', e)),
]);
```

---

## 6 — Resilience

### ✅ Padrões consistentes

- Webhook cascade: `Promise.allSettled` garante que falha em 1 webhook não bloqueia os outros. ✅
- Email trigger best-effort: `try/catch` silencioso em todas as actions que disparam email. ✅
- Cron sweeper: falha retorna 500 mas não afeta outros requests; próxima execução (diária) recupera. ✅
- Rollback de documento: 4-step com dual rollback (delete storage + delete DB row). ✅

---

### 🟡 REFACTOR-06 — `archiveObra` e `archiveFornecedor` não verificam se registro existe antes de update

**Arquivos:** `obras/actions.ts` linhas 102–116, `fornecedores/actions.ts` linhas 112–126

Se um ID inválido (não-UUID, ou UUID de outra tabela) for enviado como FormData, o Supabase executa `UPDATE ... WHERE id = 'garbage'` que afeta 0 rows sem retornar erro. O action então prossegue com `revalidatePath` e `redirect` como se tivesse sucesso.

**Comparação:** `archivePagamento` e `archiveDocumento` têm o mesmo comportamento — consistentemente silencioso em relação a "não encontrado".

**Impacto:** Baixo (RLS cobre — usuário só vê seus registros), mas o UX recebe redirect de sucesso quando nada aconteceu.

**Recomendação:** Verificar `data?.length` ou usar `.select('id')` e checar se retornou linha, ou ao menos validar UUID format (Zod) antes de enviar ao banco.

---

### 🟢 INFO — Vercel cold start

Server actions típicas (CRUD simples) completam em 150–500ms warm, 600–1500ms cold. Para o fluxo de `createDocumento` (hash SHA-256 + upload Storage + 2 DB ops), cold start pode adicionar 1–2s. Aceitável para a UX atual (redirecionamento pós-submit).

O fluxo mais pesado é `getKpisResumo` no painel (4 queries paralelas + processamento JS). Candidato a cache estático de curta duração (`revalidate: 60`) se dashboard for percebido como lento.

---

## 7 — Test Coverage Gaps (documentação — não requer implementação)

### Cobertos (Fase 12 — Playwright happy path)
- Fases 4, 5, 6, 9, 11: obras CRUD, fornecedores CRUD, pagamentos CRUD, pendentes, auditoria.

### Gaps documentados

| Área | Gap | Severidade |
|------|-----|-----------|
| Upload documentos (Fase 7) | Nenhum teste de upload, rollback em falha de Storage, dedup SHA-256 | Alta |
| Webhook UAZAPI (Fase 8) | Nenhum teste de HMAC verification, payload inválido, idempotência por `msg_id_uazapi` | Alta |
| Notificações email (Fase 10) | Nenhum teste de `sendPagamentoAguardandoEmail`, `logNotificacao`, prefs de email | Média |
| Exportações (Fase 11) | Nenhum teste de `application/pdf` nem `text/csv` response headers | Média |
| Import CSV (Fase ?) | Nenhum teste de `previewImportCsv` / `commitImportCsv` com CSV malformado | Média |
| Merge de fornecedores | Nenhum teste do fluxo de merge (mais complexo do codebase) | Alta |
| Race condition pendentes | Nenhum teste de submit duplo simultâneo | Alta |
| Cron sweeper | Nenhum teste de cleanup de rows pendentes | Baixa |
| Rate limiting / auth tema | Não testado | Baixa |

---

## Índice de findings por severidade

| ID | Severidade | Arquivo | Título |
|----|-----------|---------|--------|
| BUG-01 | 🔴 BUG | `lib/services/merge-fornecedores.ts` | Merge sem transação + errors ignorados |
| BUG-02 | 🔴 BUG | `app/(app)/pendentes/actions.ts` | Race condition em confirmarPendencia |
| BUG-03 | 🔴 BUG | `app/(app)/fornecedores/[id]/apelido-actions.ts` | Raw DB error message exposto ao usuário |
| BUG-04 | 🔴 BUG | `lib/services/dispatch-webhook.ts` | Race condition em total_execucoes counter |
| BUG-05 | 🔴 BUG | `lib/services/dispatch-webhook.ts` | generateWebhookSecret usa PRNG não-criptográfico |
| BUG-06 | 🔴 BUG | `app/api/webhooks/uazapi/route.ts` | Classify failure sem log, UAZAPI não retryará |
| QUALITY-01 | 🟠 QUALITY | 4 action files | assertAdmin() duplicado sem extração |
| QUALITY-02 | 🟠 QUALITY | `config/webhooks/actions.ts` | Webhook secret em URL de redirect |
| QUALITY-03 | 🟠 QUALITY | `lib/services/classify-and-persist.ts` | Classifier sem timeout |
| QUALITY-04 | 🟠 QUALITY | `lib/services/detect-duplicates.ts` | serviceRoleClient para leitura desnecessária |
| QUALITY-05 | 🟠 QUALITY | `app/api/exports/[tipo]/route.ts` | Sem rate limiting em geração de PDF |
| QUALITY-06 | 🟠 QUALITY | `app/api/theme/route.ts` | Sem autenticação |
| QUALITY-07 | 🟠 QUALITY | `lib/data/painel.ts` | Fetch sem limit para KPIs |
| QUALITY-08 | 🟠 QUALITY | `lib/data/pagamentos.ts` | SUM client-side sem guard de volume |
| QUALITY-09 | 🟠 QUALITY | `lib/services/classify-and-persist.ts` | Email e webhook em try/catch compartilhado |
| REFACTOR-01 | 🟡 REFACTOR | 5 action files | formToRecord duplicado |
| REFACTOR-02 | 🟡 REFACTOR | `app/(auth)/login/actions.ts` | Auth error message não localizada |
| REFACTOR-03 | 🟡 REFACTOR | `app/(auth)/definir-senha/actions.ts` | Auth error message não localizada |
| REFACTOR-04 | 🟡 REFACTOR | 8 service/data files | serviceRoleClient factory duplicada |
| REFACTOR-05 | 🟡 REFACTOR | `lib/data/usuarios.ts` | getUsuario fetcha lista completa |
| REFACTOR-06 | 🟡 REFACTOR | múltiplos actions | archive sem verificação de existência |

**Totais:** 6 BUG · 9 QUALITY · 6 REFACTOR · 2 INFO

---

## Prioridade de correção recomendada

**Sprint imediato (antes de produção com volume real):**
1. BUG-05 — entropia de secret (1 linha)
2. BUG-03 — raw error message (1 linha)
3. BUG-02 — race condition pendentes (refatoração pequena)
4. BUG-06 — logging de classify failure (2 linhas)

**Sprint seguinte:**
5. BUG-01 — merge sem transação (requer RPC ou rollback explícito)
6. BUG-04 — counter race (requer RPC)
7. QUALITY-02 — secret em URL (cookie flash)
8. QUALITY-03 — timeout classifier

**Backlog:**
- Extrações de código duplicado (REFACTOR-01, REFACTOR-04, QUALITY-01)
- Test coverage gaps (Fase 12 extensão)
- Performance (QUALITY-07, QUALITY-08)
