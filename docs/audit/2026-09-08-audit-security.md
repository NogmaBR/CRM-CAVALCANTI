# Auditoria de Segurança — 2026-09-08

> **Escopo:** Repositório `CRM-CONSTRUTORA-NOGMA` (branch `main`, commit `ff16552`).
> Apenas arquivos rastreados por git (`git ls-files --cached`). `.env.local` excluído (gitignored).
> Auditor: Claude Sonnet 4.6 via CLI.

---

## Resumo executivo

| Severidade | Qtd | Títulos |
|---|---|---|
| 🔴 CRÍTICO | 0 | — |
| 🟠 ALTO | 2 | Webhook secret gerado com PRNG fraco; `/api/exports/` exposto sem auth no middleware |
| 🟡 MÉDIO | 3 | MIME whitelist bypassável (magic bytes ausente); commitImport confia em PreviewRow do client; Storage SELECT anonimo |
| 🟢 INFO | 4 | .gitignore cobre .auth/ parcialmente; hCaptcha opcional por env; `anon` com SELECT em todas as tabelas; mapeamento de erro de DB exposto parcialmente |

**Bloqueadores de merge:** Nenhum crítico. Os dois ALTOs devem ser revisados antes de go-live em produção.

---

## Findings

### 🟠 HIGH-001: Webhook secret gerado com PRNG não-criptográfico (`Math.random`)

**Localização:** `apps/web/lib/services/dispatch-webhook.ts:183-185`

**Descrição:**
A função `generateWebhookSecret()` usa `Math.random()` como entrada do HMAC:

```ts
return createHmac('sha256', Math.random().toString(36))
  .update(Date.now().toString() + Math.random().toString(36))
  .digest('hex');
```

`Math.random()` é um PRNG determinístico, não adequado para geração de segredos criptográficos. Dependendo do engine V8 e do momento de execução, a entropia efetiva é muito menor que 64 bits. Um atacante com conhecimento aproximado do timestamp de criação do webhook poderia reduzir drasticamente o espaço de busca.

**Impacto:** Segredo de webhook calculável/adivinhável → falsificação de payloads HMAC → injeção de eventos maliciosos no CRM via webhook outbound (ex: criar pagamentos falsos via `pagamento_created`).

**Recomendação:** Substituir por `crypto.randomBytes`:

```ts
import { randomBytes } from 'node:crypto';
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex'); // 256 bits de entropia real
}
```

---

### 🟠 HIGH-002: Middleware deixa `/api/exports/` completamente público (sem auth server-side)

**Localização:** `apps/web/lib/supabase/middleware.ts:39-41`

**Descrição:**
O middleware classifica `/api/exports/` como `isPublicApi`, pulando o redirect para `/login`:

```ts
const isPublicApi =
  url.pathname.startsWith('/api/webhooks/') ||
  url.pathname.startsWith('/api/cron/') ||
  url.pathname.startsWith('/api/exports/');   // ← sem auth middleware
```

O handler de exports (`apps/web/app/api/exports/[tipo]/route.ts:121-127`) verifica autenticação internamente via `supabase.auth.getUser()`. Contudo, como a sessão Supabase é baseada em cookie, um request sem cookie válido retorna `user = null` e o handler responde 401 corretamente. **Isso está funcionando**, mas apenas porque o handler faz a verificação por conta própria.

O risco real: se em alguma refatoração futura o check interno for removido, o middleware não serve como camada de defesa de profundidade. Além disso, todos os endpoints sob `/api/exports/` ficam sem proteção CSRF implícita que o middleware poderia oferecer (Next.js middleware pode adicionar headers de segurança).

**Impacto (atual):** Baixo — o handler verifica auth. **Impacto (potencial):** Alto — regressão silenciosa expõe exports de dados financeiros completos a qualquer requester não autenticado.

**Recomendação:** Remover `/api/exports/` da whitelist `isPublicApi`. O handler já faz auth internamente, então não há impacto funcional. Alternativamente, manter na whitelist mas documentar explicitamente que o handler é responsável pela auth:

```ts
// Opção simples — remover exports da whitelist:
const isPublicApi =
  url.pathname.startsWith('/api/webhooks/') ||
  url.pathname.startsWith('/api/cron/');
  // exports: auth feita internamente no handler, mas incluir aqui como defesa extra seria melhor
```

---

### 🟡 MED-001: Upload de documento não valida magic bytes — MIME spoofável pelo cliente

**Localização:** `apps/web/lib/schemas/documento.ts:57-66`

**Descrição:**
`validateUploadedFile()` verifica `file.type`, que é o MIME type declarado pelo browser (header `Content-Type` do multipart). Este valor é **controlável pelo cliente**. Um atacante pode enviar um arquivo `.html` com `Content-Type: application/pdf` e ele passará pela validação, sendo armazenado no bucket Supabase como "PDF".

```ts
if (!ALLOWED_MIMES.includes(file.type as (typeof ALLOWED_MIMES)[number])) {
  return { ok: false, error: `Tipo não suportado: ${file.type ...` }; // bypassável
}
```

O bucket Supabase (`supabase/migrations/20260907120000_storage_documents_rls_tighten.sql`) aplica RLS mas não restringe tipos de arquivo no nível de storage bucket policy (não há `allowed_mime_types` definido nas policies SQL vistas). O comentário no schema menciona "bucket allowed_mime_types (Task 7.0 migration)" mas essa migration não está no repo.

**Impacto:** Armazenamento de arquivos maliciosos (HTML com scripts, SVG com XSS, executáveis) no bucket. Se signed URLs forem usadas para servir esses arquivos diretamente ao browser sem Content-Disposition: attachment, pode haver XSS stored.

**Recomendação:** Adicionar validação de magic bytes no server action antes do upload:

```ts
// Checar primeiros bytes do buffer
const magicMap: Record<string, Uint8Array> = {
  'application/pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
  'image/jpeg': new Uint8Array([0xFF, 0xD8, 0xFF]),
  'image/png': new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
  'image/webp': new Uint8Array([0x52, 0x49, 0x46, 0x46]), // RIFF
};
const header = new Uint8Array(buffer.slice(0, 8));
const magic = magicMap[file.type];
if (!magic || !magic.every((b, i) => header[i] === b)) {
  redirect(`/documentos/novo?error=${encodeURIComponent('Conteúdo do arquivo não corresponde ao tipo declarado.')}`);
}
```

Adicionalmente, garantir que o bucket Supabase tenha `allowed_mime_types` configurado via `supabase storage update` ou migration de bucket config.

---

### 🟡 MED-002: `commitImportCsv` recebe `PreviewRow[]` do client sem revalidar dados contra DB

**Localização:** `apps/web/app/(app)/config/importar/actions.ts:41-48` e `apps/web/lib/services/import-pagamentos.ts:159-206`

**Descrição:**
O fluxo de importação é dividido em duas fases:
1. `previewImportCsv(csvText)` — server action, valida CSV, resolve IDs
2. `commitImportCsv(previewRows: PreviewRow[])` — server action, recebe `PreviewRow[]` do cliente

Na Fase 2, o `commitImport` constrói os inserts direto do objeto `PreviewRow` recebido:

```ts
const rows = insertable.map((r) => ({
  obra_id: r.matched.obra_id!,           // UUID vem do client
  fornecedor_id: r.matched.fornecedor_id ?? null,  // UUID vem do client
  categoria_id: r.matched.categoria_id ?? null,     // UUID vem do client
  valor: r.data!.valor,
  ...
}));
```

Um usuário admin mal-intencionado (ou com sessão comprometida) poderia manipular o corpo da server action para passar `obra_id`, `fornecedor_id`, `categoria_id` arbitrários que não foram retornados pelo preview, referenciando entidades de outros tenants — embora neste sistema não haja multi-tenancy, o risco é de inserção de pagamentos com referências FK inválidas ou manipuladas. A validação Zod em `ImportPagamentoRowSchema` é aplicada apenas nos dados do CSV bruto (`r.data`), não nas `matched` IDs.

**Impacto:** Usuário admin pode inserir pagamentos com `obra_id` de qualquer obra ativa (sem ser a do CSV), potencialmente manipulando relatórios financeiros. O RLS do Supabase cobre INSERT com `has_role(['admin','gestor','financeiro'])`, então o acesso ao banco está correto — mas a integridade semântica dos dados (qual obra/fornecedor é associado) depende exclusivamente da validação client-side do preview.

**Recomendação:** Na Fase 2, revalidar as `matched` IDs contra o banco (re-executar o matching por nome, ou no mínimo verificar que os UUIDs existem e pertencem a entidades ativas) antes de inserir. Alternativamente, em vez de receber `PreviewRow[]` no commit, receber apenas o CSV text novamente e reprocessar server-side — eliminando a superfície de manipulação.

---

### 🟡 MED-003: Storage SELECT permitido para qualquer usuário autenticado — sem isolamento por documento

**Localização:** `supabase/migrations/20260907120000_storage_documents_rls_tighten.sql:13-16`

**Descrição:**
A policy de Storage para SELECT permite que **qualquer usuário autenticado** liste e acesse objetos no bucket `documents`:

```sql
CREATE POLICY documents_authenticated_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');
```

Isso significa que um usuário com papel `leitura` pode gerar uma URL assinada diretamente via Supabase Storage SDK para qualquer arquivo do bucket se souber o path, sem passar pela server action `downloadDocumento` (que verifica ownership via `getDocumento` + RLS na tabela `documentos`).

A proteção real é que os paths seguem o padrão `{obra_id}/{documento_id}/{filename}` e o usuário precisaria adivinhar/descobrir o path. Mas se conseguir o path (ex: via acesso à tabela `documentos` pela RLS de SELECT que permite qualquer autenticado), pode baixar qualquer arquivo diretamente.

**Impacto:** Bypass do controle de acesso a nível de documento — qualquer usuário autenticado (incluindo `leitura`) pode acessar documentos de qualquer obra se souber o storage path, sem passar pela lógica de autorização da server action.

**Recomendação:** Restringir o SELECT no Storage também por role, ou migrar para signed URLs com verificação server-side exclusiva (removendo acesso direto ao storage para usuários `leitura`):

```sql
-- Opção: restringir SELECT a roles com permissão de leitura de documentos
CREATE POLICY documents_authenticated_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND has_role(ARRAY['admin','gestor','financeiro']::papel_usuario[])
  );
```

Se o papel `leitura` precisa baixar documentos, fazer isso exclusivamente via server action com signed URL, não via acesso direto ao storage.

---

### 🟢 INFO-001: `.gitignore` não cobre `.auth/` explicitamente na raiz

**Localização:** `.gitignore:46`

**Descrição:**
O `.gitignore` cobre `apps/web/e2e/.auth/` (pasta de sessões Playwright) mas não tem entrada genérica para `.auth/` na raiz. Se ferramentas de auth local (Supabase CLI, OAuth flows) criarem `.auth/` em outros locais do repo, seriam commitadas.

**Recomendação:** Adicionar ao `.gitignore`:
```
.auth/
```

---

### 🟢 INFO-002: hCaptcha é condicional por env — login sem CAPTCHA possível em staging

**Localização:** `apps/web/app/(auth)/login/login-form.tsx:15` e `apps/web/app/(auth)/login/actions.ts:15-17`

**Descrição:**
O hCaptcha é opcional: se `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` não estiver definida, o widget não renderiza. A server action verifica `!captchaToken` e bloqueia, mas o form client não envia token se o widget não existir — então com SITE_KEY ausente, o login falha sempre. O design é correto (falha segura), mas sem `captchaToken` o redirect é para `/login?error=Confirme o captcha`, confundindo usuários em ambiente sem captcha.

**Recomendação:** Documentar que `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` é **obrigatória em produção**. Adicionar ao `.env.example`. Considerar um bypass explícito para dev via env flag em vez de ausência silenciosa.

---

### 🟢 INFO-003: `anon` role tem SELECT em todas as tabelas públicas

**Localização:** `supabase/migrations/20260905120000_grants_authenticated.sql:16`

**Descrição:**
```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
```

O role `anon` (não autenticado) tem permissão de SELECT em todas as tabelas. As RLS policies bloqueiam acesso real (policies usam `auth.uid() IS NOT NULL` para SELECT), mas o grant existe. Se uma policy for configurada incorretamente no futuro, dados ficarão expostos sem autenticação.

**Recomendação:** Remover o grant de `anon` se não houver rotas públicas que precisem acessar dados sem auth. Manter apenas `authenticated`:
```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
```

---

### 🟢 INFO-004: Erros de DB parcialmente expostos nas respostas de erro

**Localização:** `apps/web/app/api/webhooks/uazapi/route.ts:89-92` e `apps/web/app/api/cron/sweep-pending-documentos/route.ts:48`

**Descrição:**
Erros internos do Supabase são expostos diretamente nas respostas JSON:

```ts
{ error: 'db upsert failed', code: upsertErr?.code, msg: upsertErr?.message }
{ error: error.message, code: error.code }
```

Isso pode vazar informações de schema (nomes de tabelas, constraints, tipos de dados) para o caller do webhook/cron.

**Impacto:** Baixo — webhook e cron são autenticados (HMAC e Bearer token respectivamente). O risco é de information disclosure para um atacante que já tenha comprometido o secret.

**Recomendação:** Em produção, logar o erro server-side e retornar mensagem genérica:
```ts
console.error('[uazapi] db error', upsertErr);
return NextResponse.json({ error: 'internal error' }, { status: 500 });
```

---

## Áreas checadas ✅

- [x] **Secrets scan** — Nenhum secret real em arquivos commitados. Docs contêm apenas prefixos placeholder (`sbp_...`, `vcp_...`, `sk-ant-...`) sem valores reais.
- [x] **`.gitignore` coverage** — Cobre `.env`, `.env.*`, `.env.local`, `.env.staging`, `apps/web/e2e/.auth/`. Parcialmente incompleto (INFO-001).
- [x] **RLS coverage** — Todas as 14 tabelas têm `ENABLE ROW LEVEL SECURITY`. Todas têm policies. Nenhuma tabela com RLS sem policy.
- [x] **Auth middleware** — `updateSession` usa `supabase.auth.getUser()` (não `getSession()` que é bypassável). Whitelist de rotas públicas é restrita.
- [x] **Login hCaptcha** — Token validado server-side via `options: { captchaToken }` no `signInWithPassword`.
- [x] **`definir-senha` actions** — Zod validation com min 8, max 72, matching de confirmação. Correto.
- [x] **HMAC webhook inbound** — Usa `timingSafeEqual` corretamente. Sem timing attack.
- [x] **Cron secret** — `GET /api/cron/sweep-pending-documentos` exige `Authorization: Bearer <CRON_SECRET>`. Correto.
- [x] **Server actions — admin check** — `config/usuarios`, `config/importar`, `config/webhooks` todas têm `assertAdmin()` chamado antes de qualquer mutação.
- [x] **Server actions — Zod validation** — Todas as actions com input externo validam via schemas Zod.
- [x] **`NEXT_PUBLIC_*` expostos** — Apenas `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, `HCAPTCHA_SITE_KEY`. Nenhum secret sensível com prefixo `NEXT_PUBLIC_`.
- [x] **`SUPABASE_SERVICE_ROLE_KEY` — isolamento server-only** — Usado apenas em `lib/services/*`, `lib/data/usuarios.ts`, `lib/storage/documents.ts`, `lib/data/notificacoes.ts` — todos com `import 'server-only'` no topo.
- [x] **File upload — MIME whitelist** — Existe whitelist de MIME types. Ausência de magic bytes é MED-001.
- [x] **File upload — size limit** — 10 MB verificado no servidor antes do upload.
- [x] **URL params em rotas dinâmicas** — IDs validados como UUID via Zod nos schemas relevantes.
- [x] **Cookie de sessão** — Supabase SSR configura automaticamente `HttpOnly`, `Secure`, `SameSite=Lax` em produção via `@supabase/ssr`.
- [x] **Docs scan** — Nenhum HMAC secret real, token ou senha em docs commitados.

## Não checadas / diferidas

- [ ] **Rate limit em reset de senha** — Supabase Auth tem built-in (configurável no dashboard), não verificável no código do repo.
- [ ] **Bucket config `allowed_mime_types`** — Referenciado no código (`Task 7.0 migration`) mas a migration de config do bucket não está no repo (provavelmente feita via dashboard). Verificar manualmente no Supabase Dashboard.
- [ ] **Audit triggers** — Fase 11, migrations existem (`20260907160000_audit_triggers.sql`) mas o conteúdo não foi auditado em profundidade para SQL injection nos triggers.
- [ ] **Penetration test das exports com sessão válida** — Verificar se RLS nas queries de reports (`lib/data/reports.ts`) filtra dados por usuário ou retorna tudo para qualquer autenticado.
- [ ] **SSRF via webhook URL** — `dispatch-webhook.ts` faz `fetch(wh.url, ...)` para URL configurada por admin. Admin-only, mas se admin for comprometido, SSRF interno é possível. Mitigação: allowlist de domínios.
