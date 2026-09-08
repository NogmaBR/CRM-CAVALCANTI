# N8N COMPLETO — Guia copy-paste-ready

Tudo que precisa estar no n8n pra deixar o CRM Nogma-Cavalcanti 100% sincronizado com WhatsApp + IA + integrações externas. Workflows JSON prontos pra importar, prompts de IA, código de validação HMAC, credenciais, prompts, testes.

📅 2026-09-08 · Commit prod: `f807df3` · Sync com `docs/operacao/n8n-integracao.md` + `docs/operacao/fase-8-integracao.md`

---

## 🧭 Sumário

- [🏗️ Arquitetura — 2 patterns](#-arquitetura--2-patterns)
- [⚙️ Setup n8n (cloud ou self-hosted)](#-setup-n8n-cloud-ou-self-hosted)
- [🔐 Credentials — 7 pra criar](#-credentials--7-pra-criar)
- [🧪 Código universal — HMAC validation](#-código-universal--hmac-validation)
- [📦 7 workflows prontos pra importar](#-7-workflows-prontos-pra-importar)
  - [WF1 — UAZAPI → CRM (bridge com HMAC assinado)](#wf1--uazapi--crm-bridge-com-hmac-assinado)
  - [WF2 — Slack notif: pagamento novo > R$5k](#wf2--slack-notif-pagamento-novo--r5k)
  - [WF3 — Google Sheets: log de todos os pagamentos](#wf3--google-sheets-log-de-todos-os-pagamentos)
  - [WF4 — OneDrive/Google Drive: sync de documentos](#wf4--onedrivegoogle-drive-sync-de-documentos)
  - [WF5 — WhatsApp reminder: NFs sem comprovante > 7d (cron diário)](#wf5--whatsapp-reminder-nfs-sem-comprovante--7d-cron-diário)
  - [WF6 — Weekly digest email (sexta 18h)](#wf6--weekly-digest-email-sexta-18h)
  - [WF7 — Confirmação automática WhatsApp (bot conversacional)](#wf7--confirmação-automática-whatsapp-bot-conversacional)
- [🤖 Prompts Claude — templates prontos](#-prompts-claude--templates-prontos)
- [🔧 Variáveis de ambiente do n8n](#-variáveis-de-ambiente-do-n8n)
- [✅ Checklist de teste end-to-end](#-checklist-de-teste-end-to-end)
- [🐛 Troubleshooting](#-troubleshooting)
- [💰 Custos + limites](#-custos--limites)
- [🔒 Segurança + backups](#-segurança--backups)

---

## 🏗️ Arquitetura — 2 patterns

Você tem **duas opções** de arquitetura. Escolha baseado em preferência:

### Pattern A — CRM direto (mais simples, recomendado se código é confortável)

```
[WhatsApp usuário]
      │
      ▼
[UAZAPI] ──POST HMAC──▶ [CRM /api/webhooks/uazapi]
                             │
                             │ classificador Claude
                             ▼
                        [Supabase: mensagens_whats + pagamentos]
                             │
                             │ webhooks outbound HMAC (opcional)
                             ▼
                        [n8n] → Slack / Sheets / Drive / Email
```

**Prós:** menos moving parts, IA roda direto no CRM (código TS já existe).
**Contras:** IA fica no serverless da Vercel (timeout 10s max).
**Quando usar:** você quer manter lógica de negócio centralizada no CRM.

### Pattern B — n8n como middleware (mais flexível, recomendado se prefere no-code)

```
[WhatsApp usuário]
      │
      ▼
[UAZAPI] ──POST──▶ [n8n /webhook/uazapi]
                        │
                        │ 1) Download mídia
                        │ 2) Claude classify
                        │ 3) Response WhatsApp
                        ▼
                   [CRM /api/webhooks/uazapi]  ← WF1 bridge
                        │
                   [Supabase persiste]
                        │
                        ▼
                   [n8n] → outbound automations
```

**Prós:** IA fora do serverless (sem timeout), fácil trocar provider, visual debugging.
**Contras:** mais latência (extra hop), custo de execução n8n.
**Quando usar:** você prefere ver o fluxo visualmente e não quer mexer no código do CRM.

---

## ⚙️ Setup n8n (cloud ou self-hosted)

### Opção 1 — n8n Cloud (10min, recomendado pra começar)

1. <https://n8n.cloud/register>
2. **Plano Starter** — US$20/mês, 2500 executions/mês, 5 workflows ativos.
3. Instance sobe em ~2min. URL fica tipo `https://nogma-crm.n8n.cloud`.
4. Login com Google/GitHub.

### Opção 2 — Self-hosted Docker (1-2h, mais barato longo prazo)

Salve como `docker-compose.yml` num VPS (StayCloud R$40/mês, Contabo €5, Digital Ocean US$6):

```yaml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=n8n.seudominio.com.br
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.seudominio.com.br
      - N8N_ENCRYPTION_KEY=SUBSTITUA_POR_32_CHARS_ALEATORIOS
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=SUBSTITUA_POR_SENHA_FORTE
      - GENERIC_TIMEZONE=America/Sao_Paulo
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=aws-0-sa-east-1.pooler.supabase.com
      - DB_POSTGRESDB_PORT=6543
      - DB_POSTGRESDB_DATABASE=postgres
      - DB_POSTGRESDB_USER=postgres.bbtejxugeeccywwhfpoc
      - DB_POSTGRESDB_PASSWORD=SUBSTITUA_DB_PASSWORD
      - DB_POSTGRESDB_SCHEMA=n8n
    volumes:
      - n8n_data:/home/node/.n8n
  caddy:
    image: caddy:latest
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
volumes:
  n8n_data:
  caddy_data:
  caddy_config:
```

Arquivo `Caddyfile` (proxy reverso + HTTPS automático):

```
n8n.seudominio.com.br {
  reverse_proxy n8n:5678
}
```

Comandos:

```bash
# no VPS
docker-compose up -d
# aguardar ~30s → certificado Let's Encrypt automático
docker-compose logs -f n8n
```

Antes precisa: DNS A record `n8n.seudominio.com.br` apontando pra IP do VPS.

---

## 🔐 Credentials — 7 pra criar

Vá em **Settings → Credentials → New** em cada uma:

### C1 — Supabase API (READ+WRITE direto)

- **Tipo:** Supabase API
- **Host:** `https://bbtejxugeeccywwhfpoc.supabase.co`
- **Service Role Key:** valor de `SUPABASE_SERVICE_ROLE_KEY` do seu `.env.local`

⚠️ Bypassa RLS. Cuidado com writes destrutivos. Prefira READ em workflows automáticos.

### C2 — Anthropic Claude API

- **Tipo:** HTTP Header Auth (n8n ainda não tem node oficial Anthropic — usamos HTTP Request)
- **Name:** `Anthropic Claude`
- **Header Name:** `x-api-key`
- **Header Value:** `sk-ant-api03-...` (sua ANTHROPIC_API_KEY)

Adicione também um segundo Header:
- **Name:** `anthropic-version`
- **Value:** `2023-06-01`

### C3 — CRM Webhook HMAC (secret compartilhado)

- **Tipo:** Generic Credential Type (aparece como "credential vazia" — use variáveis do n8n)
- **Name:** `CRM Webhook Secret`
- **Field:** `secret` → valor do `secret` mostrado UMA VEZ quando você criou o webhook em `/config/webhooks`

Guarde outro campo:
- **Field:** `webhook_hmac_secret` → valor de `WEBHOOK_HMAC_SECRET` do Vercel (usado pra assinar POSTs pro CRM inbound se usar Pattern B)

### C4 — UAZAPI outbound (envio de WhatsApp)

- **Tipo:** HTTP Header Auth
- **Name:** `UAZAPI Outbound`
- **Header Name:** `token`
- **Header Value:** `<UAZAPI_API_TOKEN do dashboard UAZAPI>`

### C5 — Slack (workspace Cavalcanti)

- **Tipo:** Slack API
- **Access Token:** OAuth do Slack workspace (criar app em <https://api.slack.com/apps>)
- Scopes mínimos: `chat:write`, `chat:write.public`, `files:write`

### C6 — Google Sheets (log de pagamentos)

- **Tipo:** Google Sheets OAuth2 API
- Clique **Sign in with Google** → autorizar acesso ao Sheets
- (Alternativa: Service Account com JSON key — melhor pra prod)

### C7 — OneDrive OU Google Drive (sync de documentos)

**OneDrive:**
- **Tipo:** Microsoft OAuth2 API
- Scopes: `Files.ReadWrite.All`

**Google Drive:**
- **Tipo:** Google Drive OAuth2 API
- Scope: `https://www.googleapis.com/auth/drive.file`

---

## 🧪 Código universal — HMAC validation

**Salve como Snippet reutilizável** — cole no primeiro **Code node** de todo workflow que recebe webhook do CRM.

```javascript
// Validação HMAC-SHA256 do X-Nogma-Signature — CRM Nogma outbound webhook
// Rejeita request se signature não bater com o secret armazenado.

const crypto = require('crypto');

// Pega o secret das credenciais salvas (C3)
const secret = $credentials.CRM_Webhook_Secret.secret;

// Body raw exatamente como recebido (JSON.stringify determinístico)
const body = JSON.stringify($json.body ?? $json);

// Header vem do node Webhook: $input.item.headers
const signature = $input.item.headers['x-nogma-signature'];

if (!signature) {
  throw new Error('Header X-Nogma-Signature ausente');
}

const expected = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(body, 'utf8')
  .digest('hex');

// Comparação time-constant pra evitar timing attacks
const a = Buffer.from(signature);
const b = Buffer.from(expected);
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
  throw new Error('Signature HMAC inválida — request rejeitada');
}

// OK — retorna payload pra próximos nodes
return $input.all();
```

**Como usar em cada workflow:** duplique este Code node como segundo passo depois do Webhook trigger. Se signature falhar, o workflow para automaticamente (throw = execução ERROR).

---

## 📦 7 workflows prontos pra importar

### Como importar

1. Abra n8n → **Workflows → New**.
2. Menu (3 pontos top-right) → **Import from clipboard**.
3. Cole o JSON abaixo.
4. Ajuste as credenciais (dropdown em cada node que ficou vazio).
5. **Salvar** → **Ativar** (toggle top-right).

Cada workflow abaixo tem sua URL de webhook (quando aplicável) copiada automaticamente na primeira ativação — copie ela.

---

### WF1 — UAZAPI → CRM (bridge com HMAC assinado)

**Quando usar:** Pattern B (n8n como middleware). Recebe payload UAZAPI, opcionalmente baixa mídia + roda Claude, assina HMAC e chama `/api/webhooks/uazapi` do CRM.

**Trigger:** POST `https://n8n.xxx.com/webhook/uazapi-inbound`

**Fluxo:**
```
[Webhook uazapi-inbound] 
  → [Code: normalize payload UAZAPI]
  → [IF: type == image/pdf?] 
      YES → [HTTP Request: download media] → [Set: base64] 
  → [HTTP Request: Claude Haiku classify] (opcional)
  → [Code: assinar HMAC + montar payload CRM]
  → [HTTP Request: POST /api/webhooks/uazapi do CRM]
  → [Respond to Webhook: 200 OK pra UAZAPI]
```

**JSON pra importar** (n8n → Import from clipboard):

```json
{
  "name": "WF1 · UAZAPI → CRM (HMAC bridge)",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "uazapi-inbound",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "webhook-uazapi",
      "name": "Webhook UAZAPI",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1.1,
      "position": [200, 300],
      "webhookId": "uazapi-inbound"
    },
    {
      "parameters": {
        "jsCode": "// Normaliza payload UAZAPI pro schema esperado pelo CRM.\n// UAZAPI pode enviar snake_case ou camelCase — padronizamos aqui.\n\nconst raw = $input.item.json.body ?? $input.item.json;\n\nconst normalized = {\n  id: raw.id ?? raw.messageId ?? raw.msg_id,\n  type: raw.type ?? raw.messageType ?? 'text',\n  timestamp: raw.timestamp ?? raw.messageTimestamp ?? Math.floor(Date.now() / 1000),\n  from: raw.from ?? raw.sender ?? raw.phone,\n  text: raw.text ?? raw.body ?? raw.caption ?? null,\n  media: raw.media ?? (raw.mediaUrl ? { url: raw.mediaUrl, mimetype: raw.mimeType, filename: raw.filename } : null),\n  raw,\n};\n\nif (!normalized.id || !normalized.from) {\n  throw new Error('Payload UAZAPI inválido: falta id ou from');\n}\n\nreturn { json: normalized };"
      },
      "id": "normalize",
      "name": "Normalize payload",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [400, 300]
    },
    {
      "parameters": {
        "jsCode": "// Assina o body com HMAC-SHA256 usando WEBHOOK_HMAC_SECRET do CRM.\n// Necessário pra CRM aceitar o POST (senão retorna 401).\n\nconst crypto = require('crypto');\nconst secret = $env.WEBHOOK_HMAC_SECRET;\n\nif (!secret) {\n  throw new Error('Env var WEBHOOK_HMAC_SECRET não configurada no n8n');\n}\n\nconst body = JSON.stringify($input.item.json);\nconst signature = crypto\n  .createHmac('sha256', secret)\n  .update(body, 'utf8')\n  .digest('hex');\n\nreturn {\n  json: {\n    body,\n    signature,\n    payload: $input.item.json,\n  },\n};"
      },
      "id": "sign-hmac",
      "name": "Sign HMAC",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [600, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://crm-cavalcanti.vercel.app/api/webhooks/uazapi",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "x-signature",
              "value": "={{ $json.signature }}"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "string",
        "jsonBody": "={{ $json.body }}",
        "options": {
          "timeout": 15000
        }
      },
      "id": "post-crm",
      "name": "POST → CRM",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [800, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { ok: true, forwarded: true, crm_status: $('POST → CRM').item.json } }}"
      },
      "id": "respond",
      "name": "Respond OK",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [1000, 300]
    }
  ],
  "connections": {
    "Webhook UAZAPI": {
      "main": [[{ "node": "Normalize payload", "type": "main", "index": 0 }]]
    },
    "Normalize payload": {
      "main": [[{ "node": "Sign HMAC", "type": "main", "index": 0 }]]
    },
    "Sign HMAC": {
      "main": [[{ "node": "POST → CRM", "type": "main", "index": 0 }]]
    },
    "POST → CRM": {
      "main": [[{ "node": "Respond OK", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}
```

**Env vars n8n necessárias:**
- `WEBHOOK_HMAC_SECRET` — mesmo valor do Vercel

**Setup no UAZAPI:** ao invés de apontar webhook do UAZAPI direto pro CRM, aponte pra `https://n8n.xxx.com/webhook/uazapi-inbound` (URL do WF1). Assim n8n intercepta.

**Teste:**
```powershell
curl -X POST https://n8n.xxx.com/webhook/uazapi-inbound `
  -H "Content-Type: application/json" `
  -d '{"id":"test-001","type":"text","from":"5511987654321","text":"Pagamento R$500 pedreiro obra centro","timestamp":1725840000}'
```

Deve retornar `{"ok":true,"forwarded":true,...}` e aparecer em `/whatsapp` do CRM.

---

### WF2 — Slack notif: pagamento novo > R$5k

**Quando usar:** avisar financeiro no Slack quando pagamento grande é registrado. Assine o webhook `pagamento_created` em `/config/webhooks` do CRM.

**Trigger:** POST `https://n8n.xxx.com/webhook/pagamento-created`

**Fluxo:**
```
[Webhook] → [Code: HMAC validate] → [IF: valor > 5000] → [Supabase: get obra + fornecedor] → [Slack: post to #financeiro]
```

**JSON:**

```json
{
  "name": "WF2 · Slack notif pagamento >R$5k",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "pagamento-created",
        "responseMode": "onReceived",
        "responseCode": 200,
        "options": {}
      },
      "id": "webhook",
      "name": "Webhook pagamento_created",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1.1,
      "position": [200, 300],
      "webhookId": "pagamento-created"
    },
    {
      "parameters": {
        "jsCode": "// Valida HMAC-SHA256 do CRM outbound.\nconst crypto = require('crypto');\nconst secret = $env.CRM_WEBHOOK_SECRET;\nif (!secret) throw new Error('Env CRM_WEBHOOK_SECRET ausente');\n\nconst body = JSON.stringify($input.item.json.body ?? $input.item.json);\nconst sig = $input.item.json.headers?.['x-nogma-signature'] ?? $input.first().json.headers?.['x-nogma-signature'];\nif (!sig) throw new Error('Header X-Nogma-Signature ausente');\n\nconst expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');\nconst a = Buffer.from(sig);\nconst b = Buffer.from(expected);\nif (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {\n  throw new Error('HMAC signature inválida');\n}\n\nreturn $input.all();"
      },
      "id": "validate-hmac",
      "name": "Validate HMAC",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [400, 300]
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "leftValue": "={{ $json.body.dados.valor }}",
              "rightValue": 5000,
              "operator": {
                "type": "number",
                "operation": "gt"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "id": "filter-valor",
      "name": "Filter valor > 5k",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [600, 300]
    },
    {
      "parameters": {
        "authentication": "serviceAccount",
        "resource": "row",
        "operation": "getAll",
        "tableId": "obras",
        "returnAll": false,
        "limit": 1,
        "filterType": "manual",
        "matchType": "allFilters",
        "filters": {
          "conditions": [
            {
              "keyName": "id",
              "condition": "eq",
              "keyValue": "={{ $('Webhook pagamento_created').item.json.body.dados.obra_id }}"
            }
          ]
        }
      },
      "id": "get-obra",
      "name": "Get obra",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [800, 200]
    },
    {
      "parameters": {
        "authentication": "serviceAccount",
        "resource": "row",
        "operation": "getAll",
        "tableId": "fornecedores",
        "returnAll": false,
        "limit": 1,
        "filterType": "manual",
        "matchType": "allFilters",
        "filters": {
          "conditions": [
            {
              "keyName": "id",
              "condition": "eq",
              "keyValue": "={{ $('Webhook pagamento_created').item.json.body.dados.fornecedor_id }}"
            }
          ]
        }
      },
      "id": "get-fornecedor",
      "name": "Get fornecedor",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [800, 400]
    },
    {
      "parameters": {
        "authentication": "accessToken",
        "resource": "message",
        "operation": "post",
        "channel": "#financeiro",
        "text": "=🚨 *Pagamento grande registrado*\\n\\n💰 *Valor:* R$ {{ $('Webhook pagamento_created').item.json.body.dados.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2}) }}\\n🏗️ *Obra:* {{ $('Get obra').item.json.nome }}\\n🏢 *Fornecedor:* {{ $('Get fornecedor').item.json.nome ?? 'não vinculado' }}\\n📅 *Data:* {{ $('Webhook pagamento_created').item.json.body.dados.data_pagamento }}\\n📊 *Status:* {{ $('Webhook pagamento_created').item.json.body.dados.status_pagto }}\\n🔗 <https://crm-cavalcanti.vercel.app/pagamentos/{{ $('Webhook pagamento_created').item.json.body.dados.id }}|Abrir no CRM>",
        "otherOptions": {}
      },
      "id": "slack-post",
      "name": "Slack post #financeiro",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 2.2,
      "position": [1000, 300]
    }
  ],
  "connections": {
    "Webhook pagamento_created": {
      "main": [[{ "node": "Validate HMAC", "type": "main", "index": 0 }]]
    },
    "Validate HMAC": {
      "main": [[{ "node": "Filter valor > 5k", "type": "main", "index": 0 }]]
    },
    "Filter valor > 5k": {
      "main": [[
        { "node": "Get obra", "type": "main", "index": 0 },
        { "node": "Get fornecedor", "type": "main", "index": 0 }
      ]]
    },
    "Get obra": {
      "main": [[{ "node": "Slack post #financeiro", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}
```

**Env vars n8n:**
- `CRM_WEBHOOK_SECRET` — secret que apareceu quando criou webhook em `/config/webhooks`

**Setup no CRM:**
1. `/config/webhooks` → **Novo**
2. Nome: `n8n slack pagamentos`
3. URL: `https://n8n.xxx.com/webhook/pagamento-created`
4. Eventos: ✅ `pagamento_created`
5. **Salvar** — copiar secret que aparece → colar em `CRM_WEBHOOK_SECRET` no n8n

---

### WF3 — Google Sheets: log de todos os pagamentos

**Quando usar:** ter uma planilha viva com todo histórico de pagamentos pra análise no Excel/Sheets sem depender do painel.

**Trigger:** webhook `pagamento_created`

**Fluxo:**
```
[Webhook] → [HMAC validate] → [Supabase: fetch obra+fornecedor+categoria] 
  → [Set: flatten pra 1 row] → [Google Sheets: Append row]
```

**JSON:**

```json
{
  "name": "WF3 · Sheets log pagamentos",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "log-pagamento",
        "responseMode": "onReceived",
        "responseCode": 200
      },
      "id": "webhook",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1.1,
      "position": [200, 300],
      "webhookId": "log-pagamento"
    },
    {
      "parameters": {
        "jsCode": "const crypto = require('crypto');\nconst secret = $env.CRM_WEBHOOK_SECRET;\nconst body = JSON.stringify($input.item.json.body ?? $input.item.json);\nconst sig = $input.item.json.headers?.['x-nogma-signature'];\nconst expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');\nif (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {\n  throw new Error('HMAC inválido');\n}\nreturn $input.all();"
      },
      "id": "hmac",
      "name": "HMAC validate",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [400, 300]
    },
    {
      "parameters": {
        "authentication": "serviceAccount",
        "resource": "row",
        "operation": "getAll",
        "tableId": "pagamentos",
        "returnAll": false,
        "limit": 1,
        "filterType": "manual",
        "matchType": "allFilters",
        "filters": {
          "conditions": [
            {
              "keyName": "id",
              "condition": "eq",
              "keyValue": "={{ $('Webhook').item.json.body.dados.id }}"
            }
          ]
        }
      },
      "id": "get-pagto",
      "name": "Get pagamento full",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [600, 300]
    },
    {
      "parameters": {
        "jsCode": "// Flatten pra 1 row no Sheets. Datas em pt-BR, valores formatados.\nconst p = $input.item.json;\nconst d = $('Webhook').item.json.body.dados;\n\nreturn {\n  json: {\n    'Data pagamento': p.data_pagamento,\n    'Data registro': new Date(p.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),\n    'ID': p.id,\n    'Obra ID': p.obra_id,\n    'Fornecedor ID': p.fornecedor_id ?? '',\n    'Categoria ID': p.categoria_id ?? '',\n    'Valor': p.valor,\n    'Status': p.status_pagto,\n    'Origem': p.origem,\n    'Descrição': p.descricao ?? '',\n    'Link CRM': `https://crm-cavalcanti.vercel.app/pagamentos/${p.id}`,\n  },\n};"
      },
      "id": "flatten",
      "name": "Flatten row",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [800, 300]
    },
    {
      "parameters": {
        "authentication": "oAuth2",
        "resource": "sheet",
        "operation": "append",
        "documentId": {
          "__rl": true,
          "value": "SUBSTITUA_ID_DA_PLANILHA",
          "mode": "id"
        },
        "sheetName": "Pagamentos",
        "columnToMatchOn": "A",
        "options": {}
      },
      "id": "sheets-append",
      "name": "Sheets Append",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.4,
      "position": [1000, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "HMAC validate", "type": "main", "index": 0 }]]
    },
    "HMAC validate": {
      "main": [[{ "node": "Get pagamento full", "type": "main", "index": 0 }]]
    },
    "Get pagamento full": {
      "main": [[{ "node": "Flatten row", "type": "main", "index": 0 }]]
    },
    "Flatten row": {
      "main": [[{ "node": "Sheets Append", "type": "main", "index": 0 }]]
    }
  }
}
```

**Setup:**
1. Criar Google Sheet com aba `Pagamentos` e headers na linha 1: Data pagamento, Data registro, ID, Obra ID, Fornecedor ID, Categoria ID, Valor, Status, Origem, Descrição, Link CRM.
2. Copiar Sheet ID da URL (`https://docs.google.com/spreadsheets/d/<ID>/edit`).
3. Substituir `SUBSTITUA_ID_DA_PLANILHA` no JSON.
4. Registrar webhook `n8n sheets log` em `/config/webhooks` apontando pra `https://n8n.xxx.com/webhook/log-pagamento`, evento `pagamento_created`.

---

### WF4 — OneDrive/Google Drive: sync de documentos

**Quando usar:** manter cópia de todos os documentos (NFs, comprovantes) num Drive corporativo pra backup + acesso offline.

**Trigger:** webhook `documento_created`

**Fluxo:**
```
[Webhook] → [HMAC] → [Supabase: get documento path + obra] 
  → [HTTP: get Signed URL do Supabase Storage] 
  → [HTTP: download bytes] 
  → [OneDrive/Drive: upload pra pasta /obras/{obra_nome}/]
  → [Supabase: UPDATE documentos SET external_backup_url = X]
```

**JSON:**

```json
{
  "name": "WF4 · Drive sync documentos",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "doc-sync",
        "responseMode": "onReceived",
        "responseCode": 200
      },
      "id": "webhook",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1.1,
      "position": [200, 300],
      "webhookId": "doc-sync"
    },
    {
      "parameters": {
        "jsCode": "const crypto = require('crypto');\nconst secret = $env.CRM_WEBHOOK_SECRET;\nconst body = JSON.stringify($input.item.json.body ?? $input.item.json);\nconst sig = $input.item.json.headers?.['x-nogma-signature'];\nconst expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');\nif (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {\n  throw new Error('HMAC inválido');\n}\nreturn $input.all();"
      },
      "id": "hmac",
      "name": "HMAC validate",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [400, 300]
    },
    {
      "parameters": {
        "authentication": "serviceAccount",
        "resource": "row",
        "operation": "getAll",
        "tableId": "documentos",
        "returnAll": false,
        "limit": 1,
        "filterType": "manual",
        "matchType": "allFilters",
        "filters": {
          "conditions": [
            {
              "keyName": "id",
              "condition": "eq",
              "keyValue": "={{ $('Webhook').item.json.body.dados.id }}"
            }
          ]
        }
      },
      "id": "get-doc",
      "name": "Get documento",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [600, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.SUPABASE_URL }}/storage/v1/object/sign/documents/{{ $json.storage_path }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "jsonBody": "={ \"expiresIn\": 60 }",
        "options": {}
      },
      "id": "sign-url",
      "name": "Get signed URL",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [800, 300]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{ $env.SUPABASE_URL }}{{ $json.signedURL }}",
        "options": {
          "response": {
            "response": {
              "responseFormat": "file"
            }
          }
        }
      },
      "id": "download",
      "name": "Download bytes",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1000, 300]
    },
    {
      "parameters": {
        "authentication": "oAuth2",
        "resource": "file",
        "operation": "upload",
        "driveId": {
          "__rl": true,
          "mode": "list",
          "value": "My Drive"
        },
        "folderId": {
          "__rl": true,
          "mode": "list",
          "value": "SUBSTITUA_FOLDER_ID_OBRAS"
        },
        "name": "={{ $('Get documento').item.json.nome_arquivo }}",
        "options": {}
      },
      "id": "drive-upload",
      "name": "Drive upload",
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [1200, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "HMAC validate", "type": "main", "index": 0 }]]
    },
    "HMAC validate": {
      "main": [[{ "node": "Get documento", "type": "main", "index": 0 }]]
    },
    "Get documento": {
      "main": [[{ "node": "Get signed URL", "type": "main", "index": 0 }]]
    },
    "Get signed URL": {
      "main": [[{ "node": "Download bytes", "type": "main", "index": 0 }]]
    },
    "Download bytes": {
      "main": [[{ "node": "Drive upload", "type": "main", "index": 0 }]]
    }
  }
}
```

**Env vars n8n:**
- `SUPABASE_URL` = `https://bbtejxugeeccywwhfpoc.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = valor do Vercel

**Setup:**
1. Criar pasta `/Obras` no Google Drive (ou OneDrive).
2. Copiar folder ID da URL do Drive.
3. Substituir `SUBSTITUA_FOLDER_ID_OBRAS`.
4. Registrar webhook em `/config/webhooks` apontando pra `https://n8n.xxx.com/webhook/doc-sync`, evento `documento_created`.

---

### WF5 — WhatsApp reminder: NFs sem comprovante > 7d (cron diário)

**Quando usar:** cobrar fornecedor automaticamente por WhatsApp se nota fiscal está aguardando há mais de 7 dias.

**Trigger:** Cron diário 09:00 (America/Sao_Paulo)

**Fluxo:**
```
[Cron 09h] → [Supabase: SELECT pagamentos WHERE status='aguardando' AND created_at < now() - 7d]
  → [Loop: pra cada] 
    → [Supabase: get fornecedor.telefone]
    → [HTTP: UAZAPI send message]
    → [Supabase: INSERT audit_log]
```

**JSON:**

```json
{
  "name": "WF5 · Cron reminder NFs aguardando",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 9 * * *"
            }
          ]
        }
      },
      "id": "cron",
      "name": "Cron 09h",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [200, 300]
    },
    {
      "parameters": {
        "authentication": "serviceAccount",
        "resource": "row",
        "operation": "getAll",
        "tableId": "pagamentos",
        "returnAll": true,
        "filterType": "manual",
        "matchType": "allFilters",
        "filters": {
          "conditions": [
            {
              "keyName": "status_pagto",
              "condition": "eq",
              "keyValue": "aguardando"
            },
            {
              "keyName": "deleted_at",
              "condition": "is",
              "keyValue": "null"
            },
            {
              "keyName": "created_at",
              "condition": "lt",
              "keyValue": "={{ $now.minus({days:7}).toISO() }}"
            }
          ]
        }
      },
      "id": "get-pagtos",
      "name": "Get aguardando > 7d",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [400, 300]
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "id": "loop",
      "name": "Loop each",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [600, 300]
    },
    {
      "parameters": {
        "authentication": "serviceAccount",
        "resource": "row",
        "operation": "getAll",
        "tableId": "fornecedores",
        "returnAll": false,
        "limit": 1,
        "filterType": "manual",
        "matchType": "allFilters",
        "filters": {
          "conditions": [
            {
              "keyName": "id",
              "condition": "eq",
              "keyValue": "={{ $json.fornecedor_id }}"
            }
          ]
        }
      },
      "id": "get-fornecedor",
      "name": "Get fornecedor",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [800, 300]
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "leftValue": "={{ $json.telefone }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "notEmpty"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": "has-tel",
      "name": "Tem telefone?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [1000, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.UAZAPI_BASE_URL }}/send/text",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpHeaderAuth",
        "sendBody": true,
        "jsonBody": "={\n  \"number\": \"{{ $json.telefone.replace(/\\\\D+/g, '') }}\",\n  \"text\": \"Olá {{ $json.nome }}!\\n\\nAqui é o Nogma CRM (Cavalcanti Construções). Estamos aguardando a nota fiscal do pagamento de R$ {{ $('Loop each').item.json.valor.toLocaleString('pt-BR') }} de {{ $('Loop each').item.json.data_pagamento }}.\\n\\nPor favor, envie a NF neste WhatsApp que eu registro automaticamente. Obrigado! 🏗️\"\n}",
        "options": {}
      },
      "id": "send-wa",
      "name": "UAZAPI send",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1200, 300],
      "credentials": {
        "httpHeaderAuth": {
          "id": "SUBSTITUA_CRED_ID_UAZAPI",
          "name": "UAZAPI Outbound"
        }
      }
    }
  ],
  "connections": {
    "Cron 09h": {
      "main": [[{ "node": "Get aguardando > 7d", "type": "main", "index": 0 }]]
    },
    "Get aguardando > 7d": {
      "main": [[{ "node": "Loop each", "type": "main", "index": 0 }]]
    },
    "Loop each": {
      "main": [[{ "node": "Get fornecedor", "type": "main", "index": 0 }]]
    },
    "Get fornecedor": {
      "main": [[{ "node": "Tem telefone?", "type": "main", "index": 0 }]]
    },
    "Tem telefone?": {
      "main": [
        [{ "node": "UAZAPI send", "type": "main", "index": 0 }],
        [{ "node": "Loop each", "type": "main", "index": 0 }]
      ]
    },
    "UAZAPI send": {
      "main": [[{ "node": "Loop each", "type": "main", "index": 0 }]]
    }
  }
}
```

**Env vars n8n:**
- `UAZAPI_BASE_URL` = `https://free.uazapi.com` (ou custom)

**Setup:**
- Ative a credential `UAZAPI Outbound` (C4) no node.
- Deixe workflow ativo — dispara automático 09:00 todo dia.

---

### WF6 — Weekly digest email (sexta 18h)

**Quando usar:** enviar resumo semanal dos pagamentos + obras + alertas pro gestor toda sexta.

**Trigger:** Cron `0 18 * * 5` (sexta 18h)

**Fluxo:**
```
[Cron sexta 18h] → [Supabase: SELECT pagamentos últimos 7d]
  → [Code: agrega por obra + categoria + status]
  → [HTML template] → [Send Email SMTP ou Resend HTTP]
```

**JSON:**

```json
{
  "name": "WF6 · Weekly digest sexta 18h",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 18 * * 5"
            }
          ]
        }
      },
      "id": "cron",
      "name": "Cron sexta 18h",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [200, 300]
    },
    {
      "parameters": {
        "authentication": "serviceAccount",
        "resource": "row",
        "operation": "getAll",
        "tableId": "pagamentos",
        "returnAll": true,
        "filterType": "manual",
        "matchType": "allFilters",
        "filters": {
          "conditions": [
            {
              "keyName": "created_at",
              "condition": "gt",
              "keyValue": "={{ $now.minus({days:7}).toISO() }}"
            },
            {
              "keyName": "deleted_at",
              "condition": "is",
              "keyValue": "null"
            }
          ]
        }
      },
      "id": "get-week",
      "name": "Get semana",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [400, 300]
    },
    {
      "parameters": {
        "jsCode": "// Agrega pagamentos por status + calcula totais + top 5 obras.\nconst pagamentos = $input.all().map(i => i.json);\n\nconst total = pagamentos.reduce((s, p) => s + Number(p.valor), 0);\nconst byStatus = {};\nfor (const p of pagamentos) {\n  byStatus[p.status_pagto] = (byStatus[p.status_pagto] || 0) + Number(p.valor);\n}\n\nconst byObra = {};\nfor (const p of pagamentos) {\n  byObra[p.obra_id] = (byObra[p.obra_id] || 0) + Number(p.valor);\n}\nconst top5 = Object.entries(byObra)\n  .sort((a, b) => b[1] - a[1])\n  .slice(0, 5);\n\nconst brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });\n\nconst html = `\n<!DOCTYPE html>\n<html><head><style>\nbody { font-family: -apple-system, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #222; }\nh1 { color: #0C4651; }\ntable { width: 100%; border-collapse: collapse; margin: 16px 0; }\nth, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }\nth { background: #f7f7f7; font-weight: 600; }\n.stat { display: inline-block; margin: 8px 16px 8px 0; }\n.stat strong { font-size: 24px; color: #0C4651; }\n.footer { color: #888; font-size: 12px; margin-top: 32px; }\n</style></head><body>\n<h1>📊 Resumo semanal · Nogma CRM</h1>\n<p>Últimos 7 dias — ${pagamentos.length} pagamentos, total ${brl(total)}.</p>\n\n<h2>Por status</h2>\n<div>\n  <div class=\"stat\"><strong>${brl(byStatus.confirmado || 0)}</strong><br>Confirmados</div>\n  <div class=\"stat\"><strong>${brl(byStatus.aguardando || 0)}</strong><br>Aguardando</div>\n  <div class=\"stat\"><strong>${brl(byStatus.erro || 0)}</strong><br>Erro</div>\n</div>\n\n<h2>Top 5 obras</h2>\n<table>\n<tr><th>Obra ID</th><th>Total</th></tr>\n${top5.map(([id, v]) => `<tr><td><code>${id}</code></td><td>${brl(v)}</td></tr>`).join('')}\n</table>\n\n<div class=\"footer\">\n<a href=\"https://crm-cavalcanti.vercel.app/painel\">Abrir painel</a> · <a href=\"https://crm-cavalcanti.vercel.app/relatorios\">Ver relatórios</a>\n</div>\n</body></html>`;\n\nreturn { json: { html, total, count: pagamentos.length } };"
      },
      "id": "aggregate",
      "name": "Aggregate + HTML",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [600, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.resend.com/emails",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $env.RESEND_API_KEY }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "jsonBody": "={\n  \"from\": \"Nogma CRM <no-reply@nogmacorp.com.br>\",\n  \"to\": [\"gestor@cavalcanti.com.br\", \"operacao@nogmacorp.com.br\"],\n  \"subject\": \"📊 Resumo semanal Nogma CRM · {{ $now.toFormat('dd/MM/yyyy') }}\",\n  \"html\": {{ JSON.stringify($json.html) }}\n}",
        "options": {}
      },
      "id": "send-email",
      "name": "Resend send",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [800, 300]
    }
  ],
  "connections": {
    "Cron sexta 18h": {
      "main": [[{ "node": "Get semana", "type": "main", "index": 0 }]]
    },
    "Get semana": {
      "main": [[{ "node": "Aggregate + HTML", "type": "main", "index": 0 }]]
    },
    "Aggregate + HTML": {
      "main": [[{ "node": "Resend send", "type": "main", "index": 0 }]]
    }
  }
}
```

**Env vars n8n:**
- `RESEND_API_KEY` = mesma do Vercel

---

### WF7 — Confirmação automática WhatsApp (bot conversacional)

**Quando usar:** quando classificador cria pendência, o CRM emite `confirmacao_pendente_created`. Este workflow manda pergunta de confirmação pro remetente WhatsApp automaticamente.

**Trigger:** webhook `confirmacao_pendente_created`

**Fluxo:**
```
[Webhook] → [HMAC] → [Supabase: get mensagem_whats + confirmacoes_pendentes]
  → [Format pergunta] → [UAZAPI send] → [Supabase: UPDATE msg_id_pergunta_uazapi]
```

**JSON:**

```json
{
  "name": "WF7 · Bot confirmação WhatsApp",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "confirm-ask",
        "responseMode": "onReceived",
        "responseCode": 200
      },
      "id": "webhook",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1.1,
      "position": [200, 300],
      "webhookId": "confirm-ask"
    },
    {
      "parameters": {
        "jsCode": "const crypto = require('crypto');\nconst secret = $env.CRM_WEBHOOK_SECRET;\nconst body = JSON.stringify($input.item.json.body ?? $input.item.json);\nconst sig = $input.item.json.headers?.['x-nogma-signature'];\nconst expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');\nif (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {\n  throw new Error('HMAC inválido');\n}\nreturn $input.all();"
      },
      "id": "hmac",
      "name": "HMAC validate",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [400, 300]
    },
    {
      "parameters": {
        "authentication": "serviceAccount",
        "resource": "row",
        "operation": "getAll",
        "tableId": "mensagens_whats",
        "returnAll": false,
        "limit": 1,
        "filterType": "manual",
        "matchType": "allFilters",
        "filters": {
          "conditions": [
            {
              "keyName": "id",
              "condition": "eq",
              "keyValue": "={{ $('Webhook').item.json.body.dados.mensagem_id }}"
            }
          ]
        }
      },
      "id": "get-msg",
      "name": "Get mensagem",
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [600, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.UAZAPI_BASE_URL }}/send/text",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpHeaderAuth",
        "sendBody": true,
        "jsonBody": "={\n  \"number\": \"{{ $json.telefone_from }}\",\n  \"text\": \"Recebi sua mensagem! 📩\\n\\nExtraí os seguintes dados:\\n💰 Valor: R$ {{ $('Webhook').item.json.body.dados.dados_extraidos.valor ?? 'não identificado' }}\\n🏗️ Obra: {{ $('Webhook').item.json.body.dados.dados_extraidos.obra_id ?? 'não identificada' }}\\n🏢 Fornecedor: {{ $('Webhook').item.json.body.dados.dados_extraidos.fornecedor_id ?? 'não identificado' }}\\n\\nPra confirmar responda *SIM*.\\nPra corrigir, escreva o que faltou.\\nPra cancelar responda *NÃO*.\\n\\nDúvidas? Acesse o painel: https://crm-cavalcanti.vercel.app/pendentes\"\n}",
        "options": {}
      },
      "id": "send-wa",
      "name": "UAZAPI send",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [800, 300],
      "credentials": {
        "httpHeaderAuth": {
          "id": "SUBSTITUA_CRED_ID_UAZAPI",
          "name": "UAZAPI Outbound"
        }
      }
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "HMAC validate", "type": "main", "index": 0 }]]
    },
    "HMAC validate": {
      "main": [[{ "node": "Get mensagem", "type": "main", "index": 0 }]]
    },
    "Get mensagem": {
      "main": [[{ "node": "UAZAPI send", "type": "main", "index": 0 }]]
    }
  }
}
```

**Setup:**
- Ativar credential UAZAPI (C4).
- Registrar webhook em `/config/webhooks` apontando pra `https://n8n.xxx.com/webhook/confirm-ask`, evento `confirmacao_pendente_created`.

---

## 🤖 Prompts Claude — templates prontos

Se optar pelo **Pattern B** (n8n roda Claude), use estes prompts. Os mesmos podem ser usados no código TS do CRM (Pattern A) — só copiar/colar.

### System prompt (fixo)

```
Você é um classificador financeiro para uma empresa brasileira de construção civil (Cavalcanti Construções). Recebe mensagens de WhatsApp de operadores de obra (zeladores, mestres, fornecedores) contendo texto e opcionalmente foto/PDF de comprovante de pagamento ou nota fiscal (NF-e).

Sua tarefa: extrair dados estruturados para lançamento no ERP.

Regras estritas:
1. Sempre responda no formato JSON usando o tool `classify_mensagem`.
2. Se não tiver certeza sobre um campo, deixe null. NUNCA invente valores.
3. Valor deve ser número em reais (ex: 1234.56 — sem "R$" ou vírgula pt-BR).
4. Data no formato ISO YYYY-MM-DD.
5. Se identificar obra pelo nome, retorne o UUID dela do contexto fornecido.
6. Se identificar fornecedor pelo nome, retorne o UUID dele do contexto.
7. Se fornecedor for NOVO (não está na lista), preencha `fornecedor_nome_novo` com o nome extraído.
8. Confidence ∈ [0, 1]: só use > 0.85 se TODOS os campos essenciais (valor + obra_id) estiverem preenchidos com alta certeza.
9. Se confidence < 0.85, também preencha `perguntaConfirmacao` em português amigável pra pedir esclarecimento ao remetente.
10. `raciocinio` deve ter 1-2 frases explicando como você chegou nos valores extraídos (auditável).

Tipos possíveis (`kind`):
- `pagamento_completo` — mensagem clara com valor + obra identificável + data
- `pagamento_parcial` — algum dado presente mas incompleto
- `documento_apenas` — só um documento anexado, sem contexto textual
- `nao_identificado` — não parece ser financeiro (ex: "bom dia", spam)

Formato brasileiro de valores: aceitar "R$ 1.234,56", "1234,56", "1234.56", "1.5k" (=1500), "mil e duzentos" (=1200).
```

### Schema JSON pra tool_use

```json
{
  "name": "classify_mensagem",
  "description": "Retorna a classificação estruturada da mensagem WhatsApp",
  "input_schema": {
    "type": "object",
    "properties": {
      "kind": {
        "type": "string",
        "enum": ["pagamento_completo", "pagamento_parcial", "documento_apenas", "nao_identificado"]
      },
      "confidence": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      },
      "extracted": {
        "type": "object",
        "properties": {
          "valor": { "type": ["number", "null"] },
          "data_pagamento": { "type": ["string", "null"], "format": "date" },
          "obra_id": { "type": ["string", "null"], "description": "UUID da obra reconhecida" },
          "fornecedor_id": { "type": ["string", "null"], "description": "UUID do fornecedor reconhecido" },
          "fornecedor_nome_novo": { "type": ["string", "null"], "description": "Nome do fornecedor se for novo" },
          "tipo_documento": {
            "type": ["string", "null"],
            "enum": ["nota_fiscal", "comprovante", "contrato", "outro", null]
          },
          "numero_nf": { "type": ["string", "null"] },
          "descricao": { "type": ["string", "null"], "description": "Descrição breve do pagamento" },
          "raciocinio": { "type": "string", "description": "1-2 frases explicando extração (auditoria)" }
        },
        "required": ["raciocinio"]
      },
      "perguntaConfirmacao": {
        "type": ["string", "null"],
        "description": "Pergunta amigável em pt-BR pra pedir dados faltantes (só se confidence < 0.85)"
      }
    },
    "required": ["kind", "confidence", "extracted"]
  }
}
```

### User prompt template (renderizado a cada mensagem)

```
Contexto — Obras ativas no ERP:
{{OBRAS_LIST}}

Contexto — Fornecedores já cadastrados (últimos 100 mais usados):
{{FORNECEDORES_LIST}}

Telefone do remetente: {{TELEFONE}}
Hora recebida: {{TIMESTAMP_ISO}}

Mensagem:
"{{TEXTO_BRUTO}}"

{{#SE_TEM_MIDIA}}
[Foto/PDF anexado — analise conteúdo pra extrair valores, CNPJ, número NF, data]
{{/SE_TEM_MIDIA}}

Classifique e extraia usando o tool `classify_mensagem`.
```

Renderização em n8n (Code node antes da chamada HTTP Anthropic):

```javascript
const OBRAS_LIST = $('Get obras ativas').all()
  .map(o => `- ${o.json.id}: ${o.json.nome}`)
  .join('\n');

const FORNECEDORES_LIST = $('Get fornecedores').all()
  .map(f => `- ${f.json.id}: ${f.json.nome}`)
  .join('\n');

const p = $('Normalize payload').item.json;

const userPrompt = `Contexto — Obras ativas no ERP:
${OBRAS_LIST}

Contexto — Fornecedores já cadastrados:
${FORNECEDORES_LIST}

Telefone do remetente: ${p.from}
Hora recebida: ${new Date(p.timestamp * 1000).toISOString()}

Mensagem:
"${p.text || '(sem texto)'}"

${p.media?.mimetype ? '[Anexo ' + p.media.mimetype + ' fornecido]' : ''}

Classifique e extraia usando o tool classify_mensagem.`;

return { json: { userPrompt, hasMedia: !!p.media?.url } };
```

### HTTP Request node — chamar Claude

**Method:** POST
**URL:** `https://api.anthropic.com/v1/messages`
**Auth:** Header Auth (credential C2)
**Body (JSON):**

```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 1024,
  "system": "COLA_AQUI_O_SYSTEM_PROMPT_INTEIRO",
  "tools": [{
    "name": "classify_mensagem",
    "description": "Retorna a classificação estruturada da mensagem WhatsApp",
    "input_schema": { "...COLA_SCHEMA_ACIMA": "..." }
  }],
  "tool_choice": { "type": "tool", "name": "classify_mensagem" },
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "={{ $json.userPrompt }}" }
    ]
  }]
}
```

Se mensagem tem imagem, adicione ao content:

```json
{
  "type": "image",
  "source": {
    "type": "url",
    "url": "={{ $('Normalize payload').item.json.media.url }}"
  }
}
```

Se tem PDF:

```json
{
  "type": "document",
  "source": {
    "type": "url",
    "url": "={{ $('Normalize payload').item.json.media.url }}"
  }
}
```

**Extrair resposta** (Code node depois):

```javascript
const resp = $input.item.json;
const toolUse = resp.content?.find(c => c.type === 'tool_use');
if (!toolUse) throw new Error('Claude não usou tool_use');
return { json: toolUse.input };
```

---

## 🔧 Variáveis de ambiente do n8n

**n8n Cloud:** Settings → Variables → Add
**Self-hosted:** setar no `docker-compose.yml` em `environment:` ou export shell antes do container.

| Variável | Valor | Usada em |
|---|---|---|
| `WEBHOOK_HMAC_SECRET` | mesmo do Vercel prod | WF1 (assinar POST pro CRM) |
| `CRM_WEBHOOK_SECRET` | secret mostrado ao criar webhook em `/config/webhooks` | WF2, WF3, WF4, WF7 (validar HMAC do CRM) |
| `SUPABASE_URL` | `https://bbtejxugeeccywwhfpoc.supabase.co` | WF4 (signed URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | mesmo do Vercel | WF4 (auth do signed URL) |
| `UAZAPI_BASE_URL` | `https://free.uazapi.com` (ou instância custom) | WF5, WF7 (send WhatsApp) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | WF opcional AI (via HTTP Request) |
| `RESEND_API_KEY` | `re_...` (mesmo do Vercel) | WF6 (weekly digest) |

⚠️ **Não hardcode secrets nos workflows JSON!** Use `$env.VAR_NAME` sempre.

---

## ✅ Checklist de teste end-to-end

Ordem sugerida pra validar tudo funcionando:

### Setup base
- [ ] n8n rodando (cloud ou self-hosted) — acesso HTTPS
- [ ] 7 credenciais criadas (Supabase, Anthropic, CRM secret, UAZAPI, Slack, Sheets, Drive)
- [ ] 7 env vars setadas na instância n8n
- [ ] WF1-WF7 importados

### WF1 · UAZAPI bridge (só Pattern B)
- [ ] Ativar workflow
- [ ] Copiar URL webhook (`https://n8n.xxx.com/webhook/uazapi-inbound`)
- [ ] No dashboard UAZAPI: apontar webhook inbound pra essa URL
- [ ] Enviar msg WhatsApp real pro número da instância UAZAPI
- [ ] Verificar em n8n **Executions** — deve aparecer 1 execução SUCCESS
- [ ] Verificar em `/whatsapp` do CRM — mensagem deve estar lá em < 10s

### WF2 · Slack pagamento
- [ ] Criar webhook em `/config/webhooks` apontando pra URL do WF2, evento `pagamento_created`
- [ ] Copiar secret que apareceu → colar em `CRM_WEBHOOK_SECRET` no n8n
- [ ] `/config/webhooks` → clicar **Testar** — payload dummy com valor 100 (não passa filtro > 5k, não vai pro Slack — OK)
- [ ] Criar pagamento real com valor > 5000 → deve aparecer em `#financeiro` do Slack

### WF3 · Sheets log
- [ ] Criar Google Sheet + copiar Sheet ID + substituir no JSON
- [ ] Credencial Google Sheets OAuth ativa
- [ ] Registrar webhook em `/config/webhooks`
- [ ] Criar pagamento no CRM → deve aparecer nova linha no Sheet em < 30s

### WF4 · Drive sync
- [ ] Criar pasta /Obras no Drive + copiar folder ID
- [ ] Registrar webhook `documento_created`
- [ ] Upload documento no CRM → deve aparecer no Drive em < 60s (upload + processamento)

### WF5 · Reminder NFs
- [ ] Deixar ativo — dispara automático 09:00 todo dia
- [ ] Pra testar antes: temporariamente mudar cron pra `*/2 * * * *` (a cada 2min) → validar → voltar pra `0 9 * * *`
- [ ] Verificar que pagamento aguardando >7d com fornecedor.telefone gera envio WhatsApp

### WF6 · Weekly digest
- [ ] Env var `RESEND_API_KEY` setada
- [ ] Ajustar emails destinatário no JSON pro real
- [ ] Testar manualmente: **Execute Workflow** (botão) → deve chegar email
- [ ] Ativar cron

### WF7 · Bot confirmação
- [ ] Ativar
- [ ] Registrar webhook em `/config/webhooks`, evento `confirmacao_pendente_created`
- [ ] Enviar mensagem ambígua no WhatsApp da instância → classifier marca como pendente → bot deve responder pedindo confirmação em < 15s

### Full flow WhatsApp end-to-end
- [ ] Enviar WhatsApp `"Paguei R$ 850 pro pedreiro Joao da obra centro"`
- [ ] UAZAPI recebe → posta em `/api/webhooks/uazapi` (ou `/webhook/uazapi-inbound` do n8n)
- [ ] CRM classifica com Claude → identifica valor, tenta match obra "centro" com contexto
- [ ] Se confidence >= 0.85: cria Pagamento em `/pagamentos` diretamente
- [ ] Se confidence < 0.85: cria pendência em `/pendentes` + WF7 dispara → bot pergunta no WhatsApp
- [ ] Se valor > 5k: WF2 posta no Slack
- [ ] WF3 registra em Sheets independente do valor

---

## 🐛 Troubleshooting

### "HMAC signature inválida" no Code node
- Confirme `CRM_WEBHOOK_SECRET` no n8n bate exatamente com o secret salvo em `webhooks_outbound.secret` no Supabase.
- Se perdeu o secret original, vá em `/config/webhooks/[id]/editar` → **Regenerar secret** → atualizar env var n8n.
- Cheque que o body está sendo lido raw (não estringificado com espaços diferentes). O código do WF2 usa `JSON.stringify` — igual ao CRM.

### Webhook n8n não dispara
- Em `/config/webhooks` do CRM, coluna **última execução** deve mostrar status HTTP. Se 404, URL do n8n está errada. Se 401, secret errado.
- No n8n, o workflow precisa estar **ativo** (toggle top-right). Workflow inativo aceita webhook mas não executa.
- Cloud n8n Free (não Starter) tem limite 100 workflow tests/dia — pode ter estourado.

### Supabase node retorna array vazio
- URL sem trailing slash (`https://xxx.supabase.co` sem `/`).
- Service role key correta (começa com `eyJ...`, é JWT longo).
- Table name correto (case-sensitive, ex `pagamentos` não `Pagamentos`).
- Filter `deleted_at IS NULL` importante — dados soft-deleted não aparecem.

### UAZAPI send retorna 401
- Header `token` (não `Authorization`) — UAZAPI usa esse.
- Verificar em <https://docs.uazapi.com/send> qual o path exato (`/send/text` vs `/message/send` etc muda por versão).
- Instância UAZAPI precisa estar **conectada** (QR code escaneado, status = "connected").

### Claude classifier retorna kind sempre `nao_identificado`
- System prompt está sendo enviado? Verificar body do HTTP Request node.
- Modelo correto — `claude-haiku-4-5-20251001` (não `claude-3-haiku-20240307` antigo).
- Contexto de obras/fornecedores vazio? Se lista `[]`, Claude não tem como fazer match.

### Google Sheets Append duplica linhas
- `columnToMatchOn: "A"` faz upsert — se linha com mesma coluna A existe, atualiza. Se append puro, remova o parâmetro.
- Sheet tem headers na linha 1? Nomes das colunas no Code node "Flatten row" batem com headers?

### Drive upload retorna 403 quota exceeded
- Free Google Drive tem 15GB total. Se estourou, use conta corporativa Workspace ou OneDrive.
- OAuth refresh token expirou (raro, mas acontece). Reautorizar credencial.

---

## 💰 Custos + limites

| Item | Custo | Limite |
|---|---|---|
| **n8n Cloud Starter** | US$20/mês | 2500 executions/mês (~83/dia). Cada webhook = 1 exec. |
| **n8n Cloud Pro** | US$50/mês | 10k executions/mês |
| **n8n Self-hosted** | R$40-80/mês VPS | ilimitado (limite = CPU/RAM do VPS) |
| **Anthropic Claude Haiku 4.5** | ~US$0.002/msg | R$10 dá ~2500 msgs classificadas |
| **UAZAPI** | R$50-150/mês | depende do plano — varia por provider |
| **Resend** | Free até 3k emails/mês, depois US$0.001/email | 100/dia no free |
| **Slack** | Free 90 dias msg history, paid US$8.75/user/mês | 10 apps grátis |
| **Google Sheets/Drive** | Free (15GB Drive) | quota API 300 req/min |

**Estimativa realista Cavalcanti** (1 obra ativa, 50 pagamentos/mês, 200 msgs WhatsApp/mês):
- n8n Starter: US$20
- Claude (200 classifications): US$0.40
- UAZAPI: R$100
- Resend: free (< 3k emails)
- **Total: ~R$220/mês**

---

## 🔒 Segurança + backups

### Segurança dos workflows

- **Nunca hardcode secrets** nos JSON — use `$env.VAR_NAME` sempre.
- Ative **Basic Auth** no self-hosted (`N8N_BASIC_AUTH_ACTIVE=true`).
- Use **credentials n8n** em vez de headers hardcoded pra APIs de terceiros.
- Rotacione tokens (UAZAPI, Anthropic, Vercel) a cada 90 dias.
- Se secret vazar, ir em `/config/webhooks/[id]/editar` → **Regenerar** → atualizar no n8n.

### Backup dos workflows

**Export automático:** salvar JSON de cada workflow no repo Git:

```bash
mkdir -p n8n-workflows
# Exportar via API n8n (Cloud tem endpoint /rest/workflows)
curl -H "X-N8N-API-KEY: SEU_TOKEN" https://n8n.xxx.com/api/v1/workflows > n8n-workflows/backup-$(date +%Y-%m-%d).json
```

Ou copiar JSON manualmente do UI (Menu → Download) e commitar em `docs/n8n-workflows/*.json`.

**Backup do banco n8n** (se self-hosted):
```bash
docker exec n8n_db pg_dump -U n8n n8n > n8n-backup-$(date +%Y-%m-%d).sql
```

Ou aponte n8n pro schema `n8n` no Supabase (config no `docker-compose.yml` acima) — aí backup vai junto com backup do CRM.

### Versionamento

Sempre que editar workflow em produção:
1. Testar em workflow duplicado com sufixo `-dev` primeiro.
2. Exportar JSON.
3. Commitar em `docs/n8n-workflows/` no repo Git.
4. Só então ativar em produção.

---

## 📚 Fontes

- Doc atual do repo: `docs/operacao/n8n-integracao.md`
- Doc de Fase 8: `docs/operacao/fase-8-integracao.md`
- Rota webhook inbound CRM: `apps/web/app/api/webhooks/uazapi/route.ts`
- Schema Zod UAZAPI: `apps/web/lib/schemas/uazapi.ts`
- Service dispatch outbound: `apps/web/lib/services/dispatch-webhook.ts`
- HMAC verify: `apps/web/lib/webhooks/hmac.ts`
- Docs oficiais:
  - n8n: <https://docs.n8n.io>
  - UAZAPI: <https://docs.uazapi.com>
  - Anthropic Messages API: <https://docs.anthropic.com/en/api/messages>
  - Supabase REST: <https://supabase.com/docs/guides/api>

---

**Última atualização:** 2026-09-08
**Commit prod:** `f807df3`
**Total workflows:** 7 JSON prontos pra importar
**Cobertura:** WhatsApp inbound (bridge) + Slack + Sheets + Drive + Cron reminders + Weekly digest + Bot conversacional
