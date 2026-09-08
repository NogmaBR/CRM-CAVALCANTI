# Auditoria Consolidada — 2026-09-08

Consolidação das 3 auditorias paralelas (Security, Backend, Frontend+Infra).
**Total de findings: 31** — 1 crítico, 5 altos, 15 médios, 10 informativos.

**Reports detalhados por auditoria:**
- `docs/audit/2026-09-08-audit-security.md` — RLS + auth + secrets
- `docs/audit/2026-09-08-audit-backend.md` — server actions + services + APIs
- `docs/audit/2026-09-08-audit-frontend-infra.md` — XSS/CSRF + bundle + deploy

## Fixes aplicados nesta consolidação

### 🔴 F-01 (CRIT — Frontend audit): Security headers ausentes
**Fixed em** `apps/web/next.config.ts` (commit desta consolidação).
Adicionados 5 headers em `async headers()`:
- `X-Frame-Options: DENY` (clickjacking)
- `X-Content-Type-Options: nosniff` (MIME sniffing)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

CSP não incluído — requer nonces por-request (Recharts SVG + hCaptcha
iframe + Storage URLs quebram sem eles). Extensão futura.

### 🟠 HIGH-001 (Security audit): Math.random() em webhook secret
**Fixed em** `apps/web/lib/services/dispatch-webhook.ts`:
```diff
- return createHmac('sha256', Math.random().toString(36))
-   .update(Date.now().toString() + Math.random().toString(36))
-   .digest('hex');
+ return randomBytes(32).toString('hex');
```
CSPRNG do `node:crypto` — secret imprevisível.

### 🟠 HIGH-002 (Frontend audit): iframe sandbox permissivo em preview email
**Fixed em** `apps/web/app/(app)/notificacoes/[id]/page.tsx`:
```diff
- sandbox="allow-same-origin"
+ sandbox=""
```
HTML do email renderiza mas SEM scripts + SEM same-origin (não acessa
cookies/localStorage do app).

## Findings NÃO fixados (recomendados)

### 🟠 Backend BUG-01: merge-fornecedores sem transação
**Localização:** `apps/web/lib/services/merge-fornecedores.ts`
**Descrição:** 5 operações UPDATE/DELETE em sequência; se falhar no meio,
dados ficam parcialmente movidos.
**Recomendação:** wrap em Postgres transaction via RPC function ou
`supabase.rpc('merge_fornecedores_atomic', {keepId, dropId})`.
**Prioridade:** MÉDIA — merge é operação rara e admin-triggered.

### 🟠 Backend BUG-02: race condition em confirmarPendencia (duplo submit)
**Localização:** `apps/web/app/(app)/pendentes/actions.ts`
**Descrição:** Se user clica "Confirmar" 2x rápido, cria 2 pagamentos.
**Recomendação:** adicionar unique index em `pagamentos(criado_via_msg_id)`
ou check com `.eq('criado_via_msg_id', id).limit(1)` antes de INSERT.
**Prioridade:** MÉDIA.

### 🟠 Backend BUG-04: read-modify-write race em total_execucoes
**Localização:** `apps/web/lib/services/dispatch-webhook.ts`
**Descrição:** N webhooks em paralelo → RMW loop pode perder increments.
**Recomendação:** trocar por RPC `increment_webhook_counter(id)` OU
tolerar (contador aproximado).
**Prioridade:** BAIXA — cosmético.

### 🟠 HIGH-002 (Security audit): /api/exports whitelist
**Localização:** `apps/web/lib/supabase/middleware.ts:41`
**Descrição:** endpoint na whitelist perde defesa em profundidade.
**Rationale pra NÃO fixar:** removê-lo faria middleware retornar 307 HTML
redirect pra clients programáticos que esperam 401 JSON. Route handler tem
auth check via `createClient().auth.getUser()` — considerado suficiente.
**Prioridade:** BAIXA (design decision).

### 🟡 MED (Frontend): manifest.json + OpenGraph ausentes
**Localização:** `apps/web/app/layout.tsx`
**Descrição:** Sem PWA manifest, sem meta OG (compartilhamento de links
sem preview).
**Prioridade:** MÉDIA — impacto UX mobile.

### 🟡 MED (Security): magic bytes não validados no upload
**Localização:** `apps/web/lib/schemas/documento.ts:validateUploadedFile`
**Descrição:** só valida MIME declarado (`file.type`) — bypassável.
**Recomendação:** adicionar magic bytes check (primeiros 8 bytes do buffer)
antes de aceitar upload. Libs: `file-type` (~15KB) ou manual check dos
formatos aceitos (PDF: %PDF, PNG: 89 50 4E 47, etc).
**Prioridade:** MÉDIA — atacante autenticado.

### 🟡 MED (Backend BUG-03): apelido-actions expõe error.message raw
**Localização:** `apps/web/app/(app)/fornecedores/[id]/apelido-actions.ts`
**Descrição:** único lugar que não usa mapDbErrorWithContext.
**Recomendação:** trocar por padrão consistente.
**Prioridade:** BAIXA.

### 🟡 MED (Frontend): StatusBanner ecoa raw ?error= (message injection)
**Localização:** `apps/web/components/nogma/StatusBanner.tsx`
**Descrição:** URL query params são renderizados como-é. Atacante manda
link `?error=Sua senha foi resetada — abra este link X` e user pode ser
enganado.
**Recomendação:** whitelist de mensagens conhecidas OU truncate + sanitize.
**Prioridade:** MÉDIA.

### 🟡 MED (Frontend): loading.tsx ausente em todas as rotas
**Localização:** vários
**Descrição:** blank screen durante fetch server-side.
**Recomendação:** adicionar `loading.tsx` skeleton em cada segmento.
**Prioridade:** BAIXA (UX polish).

### 🟢 INFO — pontos positivos (não requer ação)

- HMAC com `timingSafeEqual` correto em todos os 3 lugares que usam
- Todas as tabelas com RLS enabled + policies
- Service role isolado com `import 'server-only'` guard em 32 módulos
- Admin checks em TODAS as actions privilegiadas via `assertAdmin()`
- Nenhum secret real em arquivos commitados
- Padrões Zod + mapDbError + revalidatePath consistentes em 19 actions
- CSRF: Server Actions com proteção nativa Next.js + HMAC em webhooks +
  Bearer CRON_SECRET
- Fase 20 A11y: skip-link, focus-visible, reduced-motion, sr-only OK
- `font-display: swap` em todos os `@font-face`
- `next/image` usado corretamente

## Recomendações estratégicas

### Curto prazo (próximas 2 semanas):
1. Fixar 4 findings 🟠 HIGH restantes (mesmo com ratio pra 2 deles)
2. Adicionar magic bytes check em upload docs
3. Adicionar `loading.tsx` em `/painel`, `/relatorios`, `/pagamentos` (páginas com fetch pesado)
4. Corrigir race condition em `confirmarPendencia`

### Médio prazo (próximo mês):
5. Wrap merge-fornecedores em Postgres RPC transacional
6. Adicionar Content-Security-Policy com nonces
7. Adicionar rate limiting em `/api/exports/*` e `/api/webhooks/uazapi` (Upstash Redis)
8. Adicionar manifest.json + OG meta
9. Setup Sentry OU Vercel Analytics pra error tracking

### Longo prazo (roadmap):
10. Testes de segurança automatizados (axe-core + OWASP ZAP em CI)
11. Penetration test terceirizado
12. LGPD compliance completo (data export request, right to be forgotten)
13. SOC 2 / ISO 27001 se contrato exigir

## Timeline de fixes desta sessão

| Finding | Severidade | Status |
|---|---|---|
| F-01 Security headers | 🔴 CRIT | ✅ Fixed |
| HIGH-001 Math.random secret | 🟠 HIGH | ✅ Fixed |
| HIGH-002 iframe sandbox | 🟠 HIGH | ✅ Fixed |
| HIGH-002 /api/exports whitelist | 🟠 HIGH | ⚠️ Justificado (design) |
| BUG-01 merge sem transação | 🟠 HIGH | 📋 Backlog |
| BUG-02 race confirmarPendencia | 🟠 HIGH | 📋 Backlog |
| BUG-04 RMW total_execucoes | 🟠 HIGH | 📋 Backlog |
| 15 outros médios/info | 🟡🟢 | 📋 Backlog |

**Conclusão:** projeto em bom estado de segurança. Zero findings críticos
de vazamento de dados ou execução remota. Os 3 fixes desta sessão elevam
o baseline. Recomendações restantes são hardening incremental que não
bloqueiam produção.
