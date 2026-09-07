# Fase 12 — Testes E2E com Playwright

Estado: **infraestrutura shipada e discovered em prod**. 12 testes em
5 specs. **hCaptcha ativo em prod bloqueia execução automática** —
configuração local necessária pra rodar (ver seção "Rodar os testes").

## O que existe

- `apps/web/playwright.config.ts` — projects `setup` + `chromium`, single
  worker, storage state persistido em `.auth/admin.json`
- `apps/web/e2e/global.setup.ts` — login com AUTH_TEST_EMAIL, salva state
  (falha gracefully com diagnóstico se hCaptcha ativo)
- `apps/web/e2e/helpers.ts` — `E2E_PREFIX`, `uniqueId()`, `testName()`,
  `adminClient()` (service role), `cleanupAllE2E()` (ordem correta pra
  FKs: documentos → pagamentos → obras/fornecedores/etc)
- `scripts/e2e-cleanup.mjs` — script standalone Node de emergência
- `apps/web/e2e/auth.spec.ts` — 3 tests: redirect sem auth, login válido,
  login inválido
- `apps/web/e2e/cross-flow.spec.ts` — 1 teste full-flow: login → obra
  → fornecedor → pagamento aguardando → auditoria → relatório
- `apps/web/e2e/obras-crud.spec.ts` — 4 tests: create/edit/archive/list
- `apps/web/e2e/reports-download.spec.ts` — 3 tests: PDF/CSV endpoints,
  Content-Type check, tipo inválido 400

## Scripts NPM

```bash
# Root package.json:
pnpm test:e2e              # roda toda suite (webServer inicia dev auto)
pnpm test:e2e:ui           # abre Playwright UI mode (debug interativo)
pnpm test:e2e:install      # baixa Chromium browser (~115MB, uma vez)
pnpm e2e:cleanup           # emergency cleanup — remove tudo com prefixo e2e_test_
```

## Rodar os testes localmente

### 1. Baixar Chromium (uma vez)

```bash
pnpm test:e2e:install
```

### 2. Resolver hCaptcha (obrigatório)

Prod tem hCaptcha ativo. Playwright não resolve widget automaticamente.
Escolha uma opção:

**Opção A — desabilitar temporariamente no .env.local (recomendado):**
```
# Comente ou remova a linha:
# NEXT_PUBLIC_HCAPTCHA_SITE_KEY=db32a35a-6d22-45d2-99ae-fd2ed76e1bbc
```
Login funciona sem widget. **Não commit** essa alteração.

**Opção B — usar hCaptcha test key:**
```
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=10000000-ffff-ffff-ffff-000000000001
```
Widget aparece mas qualquer click passa (sitekey oficial de teste do
hCaptcha). Precisa também setar no Supabase Auth o secret de teste
(`0x0000000000000000000000000000000000000000`) senão o server rejeita.

**Opção C — bypass no código (dev only):**
Modificar `login-form.tsx` pra:
```ts
const siteKey = process.env.PLAYWRIGHT_TEST
  ? undefined
  : process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
```
Setar `PLAYWRIGHT_TEST=1` no env do run. Não commitar essa mudança.

### 3. Rodar suite completa

```bash
pnpm test:e2e
```

Ou apenas um spec:
```bash
pnpm test:e2e -- auth.spec.ts
pnpm test:e2e -- --grep "cria obra"
```

Ou UI interativo (debug):
```bash
pnpm test:e2e:ui
```

### 4. Ver report HTML

Após run, abre em navegador:
```
apps/web/e2e-report/index.html
```

Inclui screenshots + video + trace de qualquer falha.

## Rodar contra prod / preview

```bash
PLAYWRIGHT_BASE_URL=https://crm-cavalcanti.vercel.app pnpm test:e2e
```

**Cuidado:** cria carga real no banco prod. Use apenas se necessário
E rode `pnpm e2e:cleanup` após.

## Isolamento de dados

Prefixo `e2e_test_` + suffix único por teste garante:
- Nunca colide com dados reais do cliente
- Cleanup automático via `cleanupAllE2E()` no `afterAll`
- Script `pnpm e2e:cleanup` remove tudo que ficou órfão

Ordem de cleanup respeita FKs:
1. documentos (filhos de obras)
2. pagamentos (filhos de obras)
3. obras / fornecedores / categorias / autorizados

## Cobertura de testes

| Spec | Testes | Cobertura |
|---|---|---|
| `auth.spec.ts` | 3 | Fase 2 (auth Supabase) |
| `cross-flow.spec.ts` | 1 | Fases 4+5+6+9+11 (obra + fornecedor + pagto + relatório + auditoria) |
| `obras-crud.spec.ts` | 4 | Fase 4 (Obras CRUD completo) |
| `reports-download.spec.ts` | 3 | Fase 9 (Relatórios PDF/CSV endpoint) |

**Não cobrem** (deferred pra Fase 12.x):
- Upload de documentos multipart (Fase 7)
- Webhook UAZAPI end-to-end (Fase 8)
- Confirmação de pendência via /pendentes (Fase 8)
- Envio real de email (Fase 10 — mock provider sempre retorna ok)
- Notificações UI (Fase 10 viewer)
- Fornecedores CRUD isolado (parcialmente coberto no cross-flow)

## CI (não implementado)

Não incluí `.github/workflows/e2e.yml` porque:
- hCaptcha bloqueia CI sem bypass configurado
- Playwright browser download é 115MB por run — cache é essencial
- Banco compartilhado dev=prod → precisa ambiente separado ou lock global

**Roadmap CI:**
1. Provisionar Supabase project staging separado
2. Adicionar test-mode hCaptcha secret no staging
3. GitHub Actions workflow com playwright-github-action + cache browsers
4. Roda em PRs (contra preview Vercel apontado pro staging DB)
5. Roda diariamente contra prod (smoke test)

## Extensões futuras (Fase 12.x)

- **Upload multipart**: teste que faz `page.setInputFiles()` com PDF fixture
- **Webhook UAZAPI**: teste chama `page.request.post()` com HMAC signature
  válida + fixture body, verifica que aparece em /pendentes
- **Confirmar pendência**: extend cross-flow adicionando confirmarPendencia
  action e verificar Pagamento criado
- **Visual regression**: `page.screenshot()` + Percy/Chromatic pra
  detectar mudanças de layout
- **Perf tests**: Playwright + Lighthouse CI pra core web vitals
- **A11y tests**: `@axe-core/playwright` pra WCAG compliance
- **Load tests**: k6 ou Artillery contra /api/exports (medir tempo de
  render PDF sob carga)

## Segurança

- `.auth/admin.json` (storage state com cookies do admin) — no gitignore
- `service_role` key só usada em helpers/cleanup — Playwright não
  consome via browser
- Prefixo `e2e_test_` visível em audit_log (todas as ações E2E ficam
  identificadas se um audit posterior for feito)
- `PLAYWRIGHT_TEST=1` env flag deve ser opt-in explícito em qualquer
  bypass de segurança temporário (código, hCaptcha, etc)

## Troubleshooting

**"Timeout waiting for label /email/i"**:
Nogma Input component usa `<label>` associado por `htmlFor`. Se ainda
não achar, use `page.locator('input[name="email"]')` como fallback.

**"Timeout waiting for /painel URL"**:
Login submeteu mas não redirecionou. Comum quando: (a) hCaptcha ativo
e não resolvido, (b) senha errada, (c) rate limit Supabase Auth.

**"row not found" em cleanupAllE2E**:
FK constraint violated. Adicione a tabela filha antes na ordem de
cleanup (edite `cleanupAllE2E()` em `helpers.ts`).

**Playwright report não abre**:
`e2e-report/` está no gitignore. Se você fez `git clean -fdx`, roda a
suite de novo.

**"Chromium not installed"**:
`pnpm test:e2e:install` (deve baixar 115MB, uma vez).
