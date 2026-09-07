# Fase 10 — Notificações Email

Estado: **shipada** (Foundation com mock provider ativo em prod).
Falta apenas trocar `EMAIL_PROVIDER=mock` → `resend` quando Resend
account estiver provisionada.

## Fluxo end-to-end

1. **Trigger** dispara em ponto crítico (novo pagamento aguardando
   ou nova pendência WhatsApp).
2. **Send service** (`lib/services/send-email.tsx`) busca destinatários
   via `getRecipientsByPapel(['admin','gestor'])` (usa Admin API pra
   pegar emails de `auth.users`).
3. **Template** (React Email) renderiza HTML branded (Nogma DS colors).
4. **Provider** (`lib/email/provider.ts` factory):
   - `mock` (default): não envia, retorna ok. Loga em `notificacoes_email`.
   - `resend`: envia via Resend API. Loga sucesso/falha.
5. **Log** em `notificacoes_email` com `destinatario/assunto/corpo/
   contexto/enviada_em/erro`.
6. **Viewer** em `/notificacoes` mostra histórico + reenvio manual de
   falhas.

## Templates disponíveis

| Template | Trigger | Recipient |
|---|---|---|
| `PagamentoAguardandoEmail` | `createPagamento` com `status_pagto='aguardando'` | admin+gestor |
| `PendenciaNovaEmail` | `classifyAndPersist` → `confirmacoes_pendentes` insert | admin+gestor |
| `BoasVindasEmail` | User criado (não wired ainda — chamar manualmente ou hook em Supabase auth trigger futura) | próprio user |

## Como plugar Resend (produção)

### 1. Criar conta

- Ir em <https://resend.com/signup>
- Free tier: 100 emails/dia, 3k/mês — mais que suficiente pra MVP
- Confirmar email da conta

### 2. Verificar domínio (recomendado)

**Opção A — domínio custom (`nogmacorp.com.br`):**
1. Resend dashboard → Domains → Add Domain
2. Adicionar 3 registros DNS que eles fornecem (SPF, DKIM, DMARC)
3. Aguardar propagação (~15-30 min)
4. Uma vez verificado, from address vira `no-reply@nogmacorp.com.br`

**Opção B — subdomínio de teste (`resend.dev`):**
- Zero configuração
- From address: `onboarding@resend.dev`
- Fica bom pra testar, mas pra prod prefira Opção A (evita spam folder)

### 3. Provisionar env vars

Adicionar em `.env.local`:
```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Nogma Gestor de Obras <no-reply@nogmacorp.com.br>
```

Adicionar nas 3 envs Vercel (production/preview/development) via API:

```powershell
$body = @{
    key = "RESEND_API_KEY"
    value = "re_xxxxxxxxxxxxxxxxxxxxxxxx"
    type = "sensitive"
    target = @("production", "preview", "development")
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/prj_z1pt9zxdish8cmqM2oAaFRB0qSM7/env?teamId=team_2A3cAOheq9LYalV1OoxEp47S" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $env:VERCEL_TOKEN"; "Content-Type" = "application/json" } `
    -Body $body

# Repetir pra EMAIL_PROVIDER e EMAIL_FROM (não sensitive)
```

### 4. Redeploy Vercel

Push commit vazio ou clicar Redeploy no dashboard — vars novas exigem
novo build.

### 5. Testar

Autenticado no painel:
1. Ir em `/pagamentos/novo`
2. Criar pagamento com `status_pagto='aguardando'`
3. Abrir `/notificacoes` — deve aparecer registro `enviada_em` preenchido
4. Verificar inbox dos admin+gestor cadastrados no CRM

Se algo falhar, olhar `notificacoes_email.erro` (aparece em vermelho
em `/notificacoes`).

## Arquitetura de arquivos

- `lib/email/provider.ts` — interface `EmailProvider` + factory
  `getEmailProvider()` via `EMAIL_PROVIDER` env
- `lib/email/mock-provider.ts` — no-op, retorna ok
- `lib/email/resend-provider.ts` — Resend SDK wrapper
- `lib/email/templates/base-layout.tsx` — `<EmailLayout>` shared
- `lib/email/templates/pagamento-aguardando.tsx` + 2 outros
- `lib/email/templates/index.ts` — barrel exports
- `lib/services/send-email.tsx` — orquestrador (render → provider → log)
- `lib/data/notificacoes.ts` — `listNotificacoes/logNotificacao/
  getRecipientsByPapel/getNotificacao`
- `app/(app)/notificacoes/{page.tsx, [id]/page.tsx, actions.ts,
  notificacoes.css}` — UI viewer
- `components/layout/sidebar-nav.tsx` — link novo pra `/notificacoes`

## Padrões de deliverability (recomendações)

- **From address consistente**: usar sempre `no-reply@nogmacorp.com.br`
  (nunca variar) — evita marcar como spam.
- **Reply-To** (não implementado): setar `Reply-To: suporte@nogmacorp.com.br`
  se quiser resposta automática do gestor. Trocar em `resend-provider.ts`.
- **Text version**: todos os templates já geram `text` plain — Resend
  usa como fallback pra clientes que não renderizam HTML. Ajuda spam score.
- **Preview text** (30-90 chars): já vem via `<Preview>` no base layout,
  aparece no snippet do inbox.
- **Rate limit Resend**: 100/dia free, 10/segundo geral — se atingir
  aparece `429 Too Many Requests` em `notificacoes_email.erro`.

## Extensões futuras (Fase 10.x)

- **Reply-To** configurável por template
- **Templates adicionais**: budget alert (obra passa 90% orçamento),
  boas-vindas quando user é criado (hook Supabase auth trigger),
  relatório semanal (cron sábado 09:00 com KPIs)
- **Preferências por user**: `profiles.email_prefs JSONB` com opt-in/out
  por tipo — respeita se user quer receber notif de pagamento X mas não
  de pendência
- **Batch digest**: acumular pendências em 1 email/dia em vez de 1 por
  evento — configurável por user
- **Cron de retry**: buscar `notificacoes_email` com `erro != null AND
  created_at < now() - 5min AND retry_count < 3`, retenta, incrementa
  retry_count. Padrão idêntico ao cron sweeper Fase 7.5.
- **Webhook Resend**: receber callbacks de open/click/bounce/complaint
  → atualizar `notificacoes_email` com esse status. Route
  `/api/webhooks/resend` (adicionar ao middleware whitelist).
- **Templates test harness**: script `pnpm email:preview` que abre
  React Email preview server local, renderiza cada template com props
  de fixture.

## Segurança

- Service role só usado em `logNotificacao` e `getRecipientsByPapel`
  (system ops) — RLS ativa em toda leitura via `/notificacoes` UI.
- Iframe de preview no detail page usa `sandbox="allow-same-origin"`
  (sem scripts) — mesmo que o HTML tenha código malicioso injetado
  via context, não executa.
- Emails de admin/gestor no `getRecipientsByPapel` — não expostos ao
  client; enviados diretamente do server.
- Content-Security-Policy: emails têm CSP diferente do web app;
  Resend garante headers apropriados no envio.

## Custo estimado

- Resend free tier: **US\$0/mês até 3.000 email/mês** (100/dia)
- Volume esperado MVP Cavalcanti: 50-200 emails/mês → free tier folgado
- Se ultrapassar: Pro US\$20/mês por 50.000 emails/mês
- Nenhuma dep adicional paga
