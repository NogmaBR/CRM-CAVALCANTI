# Integração n8n

Estado: **infra shipada**. CRM emite webhooks HMAC-signed em 6 eventos
+ n8n pode ler Supabase direto via node nativo.

## Arquitetura

```
┌──────────────────┐        ┌─────────────────┐
│  CRM Nogma       │─────▶ │  n8n (self OR   │
│  (Vercel + SB)   │  POST │   n8n.cloud)    │
│                  │ HMAC  └────┬────────────┘
│  Emite webhooks: │            │
│  - pagamento_    │            │ Executa:
│    created       │            │ - Slack notif
│  - documento_    │            │ - OneDrive sync
│    created       │            │ - Google Sheets export
│  - confirmacao_  │            │ - Email digest
│    pendente_     │            │ - WhatsApp lembrete
│    created       │            │
│  - obra_created  │            │
│  - obra_archived │            │
│  - test          │            │
└──────────────────┘            │
        ▲                       │
        │                       │
        │ READ direto           │
        │ via Supabase node     │
        │ (SELECT/INSERT)       │
        └───────────────────────┘
```

## Setup n8n

### Opção A — n8n Cloud (recomendado, US$20/mês)

1. Criar conta em <https://n8n.cloud>
2. Escolher plano Starter (US$20/mo, 2500 executions)
3. Instance sobe em ~2 min
4. Pronto pra usar

### Opção B — Self-hosted Docker

```yaml
# docker-compose.yml
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=n8n.seu-dominio.com
      - WEBHOOK_URL=https://n8n.seu-dominio.com
      - N8N_ENCRYPTION_KEY=<random-32-char-string>
    volumes:
      - n8n_data:/home/node/.n8n
volumes:
  n8n_data:
```

- Sobe em VPS (StayCloud R$40/mês, Contabo €5/mês, etc)
- Configurar Caddy/Nginx pra HTTPS
- Backup regular do volume

## Conectar Supabase (READ direto)

n8n tem node nativo Supabase. Config:

1. **Credentials → New → Supabase API**
   - URL: `https://bbtejxugeeccywwhfpoc.supabase.co` (prod) ou staging
   - Service Role Key: pega do Vercel env ou `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`) — atenção: **bypassa RLS**, usar com cuidado
2. **Workflow → add Supabase node**
   - Operation: Get All / Insert / Update / Delete
   - Table: pagamentos / obras / etc
   - Filters: por qualquer coluna

**Exemplo:** query pagamentos aguardando aprovação
```
Supabase: pagamentos
Operation: Get All
Where: status_pagto = 'aguardando' AND deleted_at IS NULL
Return: id, obra_id, valor, fornecedor_id
```

## Receber webhooks do CRM (INBOUND para n8n)

CRM emite POST HMAC-signed em eventos. Setup:

### 1. Criar webhook no n8n

- Workflow → node **Webhook**
- HTTP Method: POST
- Path: livre (ex: `/webhook/pagamento`)
- Copia URL gerada (ex: `https://n8n.xxx.com/webhook/pagamento`)

### 2. Registrar URL no CRM

- `/config/webhooks` (admin only)
- Novo webhook: nome, URL do n8n, eventos [checkbox]
- Salvar → **secret aparece UMA VEZ** — copia
- **Guarda secret** em n8n como credential (usada pra validar signature)

### 3. Validar signature no n8n (opcional mas recomendado)

Depois do node Webhook, adicione **Code node** com:

```javascript
const crypto = require('crypto');
const secret = 'seu-secret-copiado-do-crm';
const body = JSON.stringify($json);
const signature = $input.item.headers['x-nogma-signature'];

const expected = 'sha256=' + crypto.createHmac('sha256', secret)
  .update(body).digest('hex');

if (signature !== expected) {
  throw new Error('Signature inválida');
}
return $input.all();
```

### 4. Testar

- `/config/webhooks` → botão **Testar** (envia payload dummy)
- n8n vê execução chegando → workflow roda
- Status/latência aparece no `/config/webhooks`

## Payload dos webhooks

Todo POST tem:

```
Headers:
  Content-Type: application/json
  X-Nogma-Signature: sha256=<hex>
  X-Nogma-Event: pagamento_created
  User-Agent: Nogma-Webhook/1.0

Body:
{
  "evento": "pagamento_created",
  "ocorrido_em": "2026-09-07T22:00:00.000Z",
  "dados": {
    "id": "uuid",
    "obra_id": "uuid",
    "fornecedor_id": "uuid | null",
    "valor": 1234.56,
    "data_pagamento": "2026-09-07",
    "origem": "manual|whatsapp|importado",
    "status_pagto": "confirmado|aguardando|erro"
  }
}
```

Eventos suportados hoje:
- `pagamento_created` — novo pagamento (qualquer origem/status)
- `confirmacao_pendente_created` — mensagem WhatsApp aguarda revisão
- `documento_created` — novo documento anexado
- `pagamento_updated`, `obra_created`, `obra_archived` — reservados (não wired ainda; fácil adicionar em actions futuras)
- `test` — payload dummy quando clica Testar

## 4 workflows exemplo pra copiar

### 1. Slack notification: novo pagamento

```
[Webhook trigger] → [Code: validate signature]
  → [Filter: dados.valor > 5000]
  → [Slack: post to #financeiro]
     "Novo pagamento R$ {{dados.valor}} · Obra {{dados.obra_id}}"
```

### 2. OneDrive sync: novo documento

```
[Webhook trigger] → [Code: validate]
  → [Supabase: get documento by id → pega storage_path]
  → [Supabase Storage: download from bucket 'documents']
  → [OneDrive: upload to /obras/{obra_nome}/{filename}]
  → [Supabase: UPDATE documentos SET onedrive_file_id = X]
```

### 3. Weekly digest: cron

```
[Cron: sexta 18h]
  → [Supabase: SELECT pagamentos WHERE created_at > 7d]
  → [Function: agrega por obra/categoria]
  → [Send Email: template com HTML]
```

### 4. Reminder cron: NFs sem comprovante > 7d

```
[Cron: diário 09h]
  → [Supabase: SELECT pagamentos WHERE status='aguardando' AND created_at < 7d]
  → [Loop: pra cada]
     → [UAZAPI: send WhatsApp pro fornecedor.telefone]
       "Olá! Aguardamos NF do pagamento R$ X de {{data}}"
```

## Autenticação de segurança

**Inbound (n8n → CRM):**
- CRM não expõe endpoint pra n8n escrever direto (usa Supabase node)
- Se precisar, criar `/api/n8n/*` com Bearer token dedicado (Fase futura)

**Outbound (CRM → n8n):**
- HMAC-SHA256 no header `X-Nogma-Signature`
- Secret armazenado em `webhooks_outbound.secret` (única vez visível)
- Regenerar secret: `/config/webhooks/[id]/editar` → botão Regenerar

**Supabase direto:**
- Service Role Key bypassa RLS — dá acesso total
- Alternativa mais segura: gerar token JWT customizado com claims limitados
- Pra MVP: Service Role tá OK, mas rotate periodicamente

## Custos + Performance

- **n8n Cloud Starter**: US$20/mês (2500 executions/mês — cabe 80 execuções/dia)
- **n8n Self-hosted VPS**: R$40-80/mês (custo do servidor)
- CRM outbound: sem overhead adicional (best-effort, timeout 10s)
- Retry: hoje NÃO tem — se n8n cai, evento perdido. Extensão futura:
  webhook queue (Vercel Queue OR tabela `webhooks_pending` + cron retry)

## Troubleshooting

**"signature inválida" no n8n**: 
- Confirme que secret no n8n bate com o que foi mostrado no CRM
- HMAC calculado sobre JSON.stringify(body) exato — não whitespace differences

**"webhook não dispara"**:
- Check `/config/webhooks` — coluna "última execução" mostra erro
- Confirme `ativo=true` + evento certo listado

**"Supabase node não conecta"**:
- URL sem trailing slash
- Service role key completa (começa com `eyJ...` — legacy JWT)

**"OneDrive upload falha"**:
- OAuth Microsoft Graph precisa refresh token — configurar em n8n Credentials

## Extensões futuras

- **API `/api/n8n/*`** dedicated com Bearer token limitado (Fase futura)
- **Retry queue** pra webhooks falhados
- **Rate limiting** no outbound (evita flood se algo dispara 1000 events/s)
- **Webhook history viewer** em `/config/webhooks/[id]/historico` — audit
  de todos os POSTs enviados + response bodies
- **Templates de workflow n8n** exportados (JSON) pra 1-click import
- **n8n → CRM inbound** endpoint `/api/webhooks/n8n` (HMAC verify) —
  n8n dispara updates no CRM
