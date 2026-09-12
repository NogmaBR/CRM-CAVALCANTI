# Auditoria de Segurança Adversarial — CRM-CONSTRUTORA-NOGMA

> Redisparada em 2026-09-09 (Sonnet 5) para repor a rodada perdida no crash do VS Code.

**Data:** 2026-09-09 | **Escopo:** `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA` (branch `feat/alinhamento-cavalcanti-16-09`) | **Modo:** read-only, nenhum arquivo alterado | **Terceira rodada** — não repete os 13 findings já fixados nas 2 rodadas anteriores (ver `docs/audit/AUDIT-CONSOLIDADO.md`)

> **Nota de acompanhamento:** C-2 (escalação de privilégio via self-signup) foi corrigido logo após esta
> auditoria — ver migration `20260909130000_fix_signup_privilege_escalation.sql`. C-1 (secrets vazados
> no histórico do git) segue **pendente de ação manual** (rotação de credenciais fora do alcance do agente).

## 1. Resumo por severidade

| Severidade | Qtd | Bloqueia produção? |
|---|---|---|
| Crítico | 2 | **Sim — ação imediata** |
| Alto | 4 | Sim, antes do próximo go-live/exposição pública |
| Médio | 7 | Recomendado resolver em 2-4 semanas |
| Baixo/Info | 6 | Hardening incremental |
| **Total** | **19** | |

---

## 2. Findings

### CRÍTICO

**C-1 — Senha real do banco de dados e secret HMAC commitados em texto plano no histórico do git público**

- **Evidência:** `git show ff16552:docs/PROJETO-STATUS.md` (commit original, 2026-09-03) contém em cleartext a senha do Postgres `BPGA…` e o secret HMAC `dcbb…`. Confirmado via `git log --all -S"BPGA…"` → commits `ff16552`, `1e59187`, `44d805a`. O commit `1e59187` ("scrub leaked pre-gen secrets") removeu os valores da versão atual do arquivo, mas o blob original em `ff16552` continua 100% acessível via `git show` — o remote é `github.com/NogmaBR/CRM-CAVALCANTI`, **público**.
- **Cenário de exploração:** Qualquer pessoa (ou bot scraper de secrets do GitHub) que já tenha clonado/visto o repo público antes do scrub, ou que rode `git log -p` no histórico, obtém a senha do Postgres e o secret de assinatura HMAC. `gh api repos/NogmaBR/CRM-CAVALCANTI/secret-scanning/alerts` retornou `[]` (sem alerta aberto), mas isso não prova que o valor não foi indexado por outro scraper/fork/cache enquanto o repo esteve público.
- **Fix (AÇÃO MANUAL — precisa de acesso ao dashboard/Vercel):**
  1. Confirmar AGORA no Supabase Dashboard que a senha do DB em produção não é `BPGA…` — resetar de qualquer forma.
  2. Confirmar que `WEBHOOK_HMAC_SECRET` em produção não é/deriva de `dcbb2015…93d` — regenerar com `openssl rand -hex 32`.
  3. Reescrever o histórico (`git filter-repo`/BFG) para parar re-exposição futura — mas isso **não desfaz** a exposição que já ocorreu; rotação é obrigatória independentemente disso.

**C-2 — Escalação de privilégio para admin via self-signup público confiando em `raw_user_meta_data.papel`** — CORRIGIDO 2026-09-09

- **Evidência:** `supabase/migrations/20260907170000_profiles_deleted_at_papel_metadata.sql:19-41` — o trigger `handle_new_user()` (disparado por `trg_on_auth_user_created AFTER INSERT ON auth.users`, definido em `20260903100100_profiles_autorizados_categorias.sql:25-27`) lia `papel` de `NEW.raw_user_meta_data->>'papel'` e só caía em `'leitura'` se ausente/inválido — substituindo a versão original (que sempre hardcodava `'leitura'`). `supabase/config.toml:171,216,219` tem `enable_signup = true` e `enable_confirmations = false`.
- **PoC:**
```
curl -X POST '<SUPABASE_URL>/auth/v1/signup' \
  -H 'apikey: <anon key>' -H 'Content-Type: application/json' \
  -d '{"email":"a@evil.com","password":"Senha12345","data":{"papel":"admin","nome":"x"}}'
```
  A `anon key` e a URL do Supabase são públicas (embutidas no bundle client). Se `enable_signup`/`enable_confirmations` do projeto hospedado espelharem o `config.toml` do repo, o atacante ganha sessão `papel='admin'` imediatamente — CRUD total sobre usuários, merge de fornecedores, todos os dados financeiros.
- **Fix aplicado:** migration `20260909130000_fix_signup_privilege_escalation.sql` redefine `handle_new_user()` para hardcodar `'leitura'` sempre, ignorando `raw_user_meta_data`. Atribuição de papel continua exclusiva de `inviteUsuarioAdmin` (`apps/web/lib/data/usuarios.ts:119-137`), que já usa a Admin API pós-`assertAdmin()`.
- **Pendente (ação manual):** confirmar no Studio do projeto de produção que `enable_signup`/confirmação de email estão de fato desabilitados — não depender só do código, e aplicar a migration em produção.

---

### ALTO

**A-1 — Senha de produção do DB é fraca (11 caracteres) e ainda não rotacionada**

- **Evidência:** `docs/recuperacao/2026-09-09/inventario-documentacao.md:81,163` (datado de hoje) admite: "DB password is weak (11 chars) — recomendável rotacionar". Combinado com C-1 (senha antiga vazada) e o project ref `bbtejxugeeccywwhfpoc` publicado em 15+ arquivos commitados (`docs/PROJETO-STATUS.md`, `MANUAL-PENDENCIAS.md`, `N8N-COMPLETO.md`, `operacao/handoff-fase-0.md` etc.), um atacante já tem host+username do pooler Postgres e só precisa forçar bruta uma senha de 11 chars.
- **Fix:** Rotacionar para 32+ chars aleatórios agora (o próprio time já tem isso como item #11 pendente); atualizar `SUPABASE_DB_URL` no Vercel e `.env.local` fora do horário de pico.

**A-2 — RLS de Storage do bucket `documents` permite bypass total da autorização de aplicação**

- **Evidência:** `supabase/migrations/20260907120000_storage_documents_rls_tighten.sql:13-16` — policy `documents_authenticated_select` = `USING (bucket_id = 'documents')`, sem checar role ou `documentos.deleted_at`. A tabela `documentos` também tem `SELECT ... USING (auth.uid() IS NOT NULL)` (`20260903100500_rls_policies.sql:44`), sem restrição de papel.
- **PoC:** De uma sessão autenticada com papel `leitura` (via `apps/web/lib/supabase/client.ts`, cliente browser padrão):
```js
const { data: docs } = await supabase.from('documentos').select('id,storage_path,obra_id').limit(1000);
const { data } = await supabase.storage.from('documents').createSignedUrl(docs[0].storage_path, 3600);
```
  Isso baixa qualquer NF/comprovante/contrato de qualquer obra, contornando completamente `downloadDocumento` (`apps/web/app/(app)/documentos/actions.ts:227-248`) — inclusive documentos **arquivados** (`deleted_at != null`), que a server action bloqueia mas o Storage não.
- **Fix:** Policy de SELECT em `storage.objects` deve validar via join com `public.documentos` (`deleted_at IS NULL` + papel), não apenas `bucket_id = 'documents'`.

**A-3 — Secret HMAC de webhook trafega e persiste na query string da URL**

- **Evidência:** `apps/web/app/(app)/config/webhooks/actions.ts:97` (`criarWebhook`) e `:200` (`regenerarSecret`) — redirect com o secret em cleartext na query string, renderizado em `apps/web/app/(app)/config/webhooks/page.tsx:141,171-193`.
- **Cenário:** O secret de 256 bits fica na URL da barra de endereço → histórico do navegador, logs de acesso do Vercel, qualquer proxy/CDN/analytics futuro, extensões de browser. Sobrevive a refresh/bookmark.
- **Fix:** Substituir por mecanismo flash server-side one-time (cookie de curta duração ou re-fetch via token de uso único) em vez de redirect com o secret na URL.

**A-4 — SSRF: URL de webhook outbound configurada por admin sem allowlist**

- **Evidência:** `apps/web/app/(app)/config/webhooks/actions.ts:40-59` valida só com `z.string().url()` + `.startsWith('http')`; `apps/web/lib/services/dispatch-webhook.ts:84` (`dispatchEvento`) e a função `testWebhook` fazem `fetch(wh.url, ...)` sem checar IP interno/metadata endpoint. Esse gap já constava em "Não checadas / diferidas" na auditoria anterior — confirmado ainda aberto.
- **PoC:** Admin (ou sessão admin comprometida) cria webhook com `url: "http://169.254.169.254/latest/meta-data/..."` ou `http://10.0.0.5:6379`. `testarWebhook` dispara o request a partir da function serverless do Vercel e reflete `status`/`latency_ms` na UI (`webhooks_outbound.ultima_execucao_erro`) — oráculo de SSRF cego contra a rede interna do host.
- **Fix:** Resolver o hostname e rejeitar ranges RFC1918/loopback/link-local (incl. `169.254.0.0/16`) na criação **e** a cada dispatch (proteção contra DNS rebinding), ou manter allowlist de domínios administrada.

---

### MÉDIO

**M-1 — `commitImportCsv` confia em IDs (`obra_id`/`fornecedor_id`/`categoria_id`) vindos do client sem revalidar no servidor**
`apps/web/app/(app)/config/importar/actions.ts:40-48` + `apps/web/lib/services/import-pagamentos.ts:159-207`. `commitImport` usa `serviceRoleClient()` (bypassa RLS) e insere direto de `r.matched.*` sem re-executar o matching por nome. Gated por `assertAdmin()`, mas um admin (ou XSS na página) pode adulterar o payload e atribuir pagamentos a obra/fornecedor/categoria diferentes do CSV original. **Fix:** revalidar/re-resolver `matched.*` a partir de `r.data` (nome) dentro de `commitImport`, não confiar no round-trip do client.

**M-2 — Policy de DELETE do Storage mais permissiva que a da tabela `documentos`**
`storage.objects` policy `documents_role_delete` (`20260907120000:39-45`) permite `admin`,`gestor`,`financeiro`; a tabela `documentos` só permite DELETE para `admin` (`20260903100500_rls_policies.sql:47`). Um `gestor`/`financeiro` não consegue `DELETE FROM documentos` via RLS, mas pode chamar `supabase.storage.from('documents').remove([path])` diretamente e apagar o arquivo físico, deixando a linha órfã. **Fix:** alinhar `documents_role_delete` para `has_role(ARRAY['admin'])` apenas.

**M-3 — Ausência total de rate limiting**
Grep em `apps/web` por `ratelimit`/`upstash`: zero ocorrências. Login, `definir-senha`, `/api/exports/*`, `/api/webhooks/uazapi`, `/api/cron/*` — nenhum tem limite de taxa. Já era item de backlog da auditoria anterior; confirmado ainda 100% não implementado. **Fix:** Upstash Redis rate limit, priorizando login e exports.

**M-4 — Erros brutos da Admin API/Postgres expostos ao client em `config/usuarios/actions.ts`**
5 locais (`convidarUsuario:69`, `reenviarConvite:98`, `alterarPapelUsuario:128`, `arquivarUsuario:151`, `restaurarUsuario:170`) fazem redirect com mensagem vinda direto de `error.message` (`apps/web/lib/data/usuarios.ts:134,153,171,191,207`), sem passar por `mapDbError`/`mapDbErrorWithContext` como o resto do código. Mesma classe de bug do BUG-03 já fixado em `apelido-actions.ts`, mas não replicado aqui. Impacto baixo (atrás de `assertAdmin()`), mas inconsistente. **Fix:** rotear pelos helpers padrão.

**M-5 — Erro de DB exposto em JSON nos webhooks/cron (INFO-004 da auditoria anterior, ainda não corrigido)**
`apps/web/app/api/webhooks/uazapi/route.ts:89-92` e `apps/web/app/api/cron/sweep-pending-documentos/route.ts:48` continuam retornando `{error, code, msg}` com detalhes brutos do Postgres. Recomendação da rodada anterior não foi aplicada em nenhuma das duas rodadas de fix. **Fix:** `console.error` server-side + resposta genérica `{error:'internal error'}`.

**M-6 — Papel `leitura` tem SELECT irrestrito em 100% das tabelas de negócio, incluindo financeiro e mensagens WhatsApp**
`SELECT ... USING (auth.uid() IS NOT NULL)` em `pagamentos`, `documentos`, `mensagens_whats`, `obras`, `fornecedores` (`20260903100500_rls_policies.sql:44`) — sem diferenciação por papel. Pode ser design intencional ("leitura" = leitura total), mas bate exatamente no padrão de policy permissiva demais em tabela sensível pedido no escopo. **Recomendação:** confirmar com o negócio se `leitura` deveria ver 100% dos pagamentos/mensagens ou um subconjunto; se não, adicionar filtro por papel.

**M-7 — Screenshot não rastreado `crm-cavalcanti-logado.png` não coberto por `.gitignore`**
Está na raiz do repo, `git check-ignore -v` retorna vazio (não ignorado) — diferente de `.playwright-mcp/`, que está corretamente ignorado. Um `git add -A` casual commitaria ao repo público um screenshot nomeado "logado" (potencialmente com estado de sessão/dados visíveis). Conteúdo da imagem não foi inspecionado nesta auditoria (fora do escopo textual). **Fix:** deletar o arquivo ou adicionar regra ao `.gitignore` antes de qualquer `git add` futuro.

---

### BAIXO / INFORMATIVO

**B-1** — Webhook inbound (`apps/web/app/api/webhooks/uazapi/route.ts`) não tem janela de replay (timestamp+tolerância) — mitigado por unique constraint em `msg_id_uazapi`/`criado_via_msg_id`, mas replay ainda força re-classificação IA. Hardening opcional: assinar timestamp e rejeitar >5min.

**B-2** — Mesmo endpoint não impõe cap explícito de tamanho de body (depende do limite padrão do runtime Vercel, ~4.5MB). Hardening opcional: checar `Content-Length` antes do `.text()`.

**B-3** — Ausência de CSP em `next.config.ts` — já documentado/deferido na rodada anterior com racional (Recharts/hCaptcha/Storage quebram sem nonces). Mitigante confirmado nesta rodada: nenhuma injeção de HTML bruto no client (grep pela API de injeção do React) encontrada em `app`/`components` → zero ocorrências, reduzindo a exposição real hoje.

**B-4** — `.playwright-mcp/` (121 arquivos de log/snapshot Playwright) está corretamente coberto por `.gitignore:63`; spot-check em ~15 arquivos não encontrou tokens/senhas. Risco residual só via `git add -f`. Recomenda-se nota no CLAUDE.md/README para não forçar o add desse diretório.

**B-5** — Comentário impreciso em `apps/web/lib/data/auditoria.ts:55` ("RLS ativa admin/gestor via audit_admin_gestor_select") não bate com a policy real `audit_admin_select` (`20260903100500_rls_policies.sql:52-53`), que é admin-only. Não explorável (é mais restritivo que o documentado), mas pode induzir erro em mudança futura.

**B-6** — Project ref `bbtejxugeeccywwhfpoc` repetido em 15+ docs commitados — não é secret por si, mas facilita recon de um atacante mirando a senha fraca do DB (A-1). Nenhuma ação além da rotação de senha.

---

## 3. Confirmado sem regressão (já fixado nas rodadas anteriores)

- Headers de segurança em `next.config.ts:16-22,32-34` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS) — presentes e aplicados a `/(.*)`.
- Secret de webhook via `randomBytes(32)` (`dispatch-webhook.ts:192-193`) — CSPRNG correto.
- HMAC inbound/outbound usa `timingSafeEqual` em todos os pontos (`lib/webhooks/hmac.ts:22`).
- Magic bytes de upload (`validateFileMagicBytes`) realmente encadeado antes do insert/upload em `documentos/actions.ts:53-108`; bucket também tem `allowed_mime_types` (pdf/jpeg/png/webp) — defesa em profundidade real.
- `merge_fornecedores_atomic` e `increment_webhook_execution`: `SECURITY DEFINER`, `search_path` fixo, `REVOKE ALL FROM PUBLIC` + grant só a `service_role` — não invocáveis por `authenticated`/`anon`.
- Todas as 14 tabelas com RLS habilitada; nenhuma tabela sem policy.
- `middleware.ts` usa `getUser()` (não `getSession()`); `/api/exports/` continua com auth check interno correto (HIGH-002 anterior, decisão de design mantida sem regressão).
- `pnpm audit` (raiz e `apps/web/`) → 0 vulnerabilidades high/critical em 307 dependências; `next` 16.3.4, `react` 19.2.8, `@supabase/*` atualizados.
- `.env.local`/`apps/web/.env.local` corretamente cobertos por `.gitignore`; nunca foram commitados com valores reais (só os `.env.example` placeholder).
- Nenhum `.rpc()` com concatenação de string; path traversal em upload bloqueado por sanitização de filename (`makeStoragePath`); nenhum CORS permissivo em `app/api/**`; nenhuma rota state-changing sob `app/api/**` sem auth própria.

---

## 4. Checklist acionável (por prioridade)

**Imediato (hoje) — precisa de você, não pode ser feito só pelo código:**
- [ ] Rotacionar senha do Postgres em produção (C-1 + A-1) — 32+ chars aleatórios
- [ ] Rotacionar/confirmar `WEBHOOK_HMAC_SECRET` de produção não é o valor vazado (C-1)
- [ ] Confirmar no Supabase Studio de produção: `enable_signup=false` e aplicar a migration do fix de C-2
- [x] Deletar `crm-cavalcanti-logado.png` ou adicioná-lo ao `.gitignore` antes de qualquer commit (M-7) — feito nesta sessão

**Esta semana:**
- [ ] Corrigir policy `documents_authenticated_select` para checar papel/ownership via join com `documentos` (A-2)
- [ ] Corrigir `documents_role_delete` para `admin`-only, espelhando a tabela (M-2)
- [ ] Trocar entrega de secret de webhook por mecanismo flash one-time, tirar da query string (A-3)
- [ ] Adicionar allowlist/blocklist de IP interno na URL de webhook outbound (A-4)

**Próximas 2-4 semanas:**
- [ ] Revalidar `matched.*` IDs server-side em `commitImport` (M-1)
- [ ] Rotear os 5 error paths de `config/usuarios/actions.ts` por `mapDbError` (M-4)
- [ ] Sanitizar respostas de erro em `/api/webhooks/uazapi` e `/api/cron/sweep-pending-documentos` (M-5)
- [ ] Implementar rate limiting (Upstash) em login, `definir-senha`, `/api/exports/*`, `/api/webhooks/uazapi` (M-3)
- [ ] Confirmar com o negócio o escopo de leitura do papel `leitura` (M-6)
- [ ] Purgar histórico do git (`git filter-repo`) após rotação de secrets, para parar re-exposição futura (C-1)

**Backlog (hardening):**
- [ ] Janela de replay + cap de body size no webhook inbound (B-1, B-2)
- [ ] CSP com nonces (B-3, já mitigado parcialmente)
- [ ] Corrigir comentário em `auditoria.ts:55` (B-5)
