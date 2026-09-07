# Fase 8 — Integração WhatsApp (UAZAPI) + IA classifier

Estado: **Foundation shipada** (Tasks 8.1–8.6). Falta plugar UAZAPI real
+ escolher provider de IA. Este doc é o passo-a-passo pra quando as
credenciais chegarem.

## O que já existe (pronto pra usar)

- Rota `POST /api/webhooks/uazapi` — recebe payload UAZAPI, verifica
  HMAC-SHA256 (`x-signature` header, secret `WEBHOOK_HMAC_SECRET`),
  faz upsert idempotente em `mensagens_whats` (chave `msg_id_uazapi`),
  e chama `classifyAndPersist(mensagem_id)`.
- Interface `Classifier` (`apps/web/lib/ia/classifier.ts`) com factory
  `getClassifier()` que escolhe implementação via env `IA_PROVIDER`.
  Default é `mock` (heurística determinística); branches `anthropic`
  e `openai` estão reservados no código, prontos pra ativar.
- Service `classifyAndPersist` (`apps/web/lib/services/classify-and-persist.ts`)
  — busca contexto (obras ativas, fornecedores), chama classifier, roteia:
  - `pagamento_completo` + confidence ≥ 0.85 + valor/obra: cria
    Pagamento com `origem='whatsapp'` e `criado_via_msg_id`.
  - Caso contrário: cria entrada em `confirmacoes_pendentes` pra
    revisão humana.
- UI `/pendentes` — gestor confirma ou rejeita mensagens IA-classificadas.
- UI `/whatsapp` — feed cronológico de todas as mensagens com filtros
  por status, com link cross-nav pra pagamento gerado ou fila /pendentes.
- Fixtures em `scripts/fixtures/uazapi/*.json` + harness `scripts/test-webhook-uazapi.mjs`.

## Passo 1 — Provisionar UAZAPI

1. Criar conta em [uazapi.com](https://uazapi.com) (ou plano brasileiro escolhido).
2. Provisionar uma instância (nome livre, ex: `nogma-cavalcanti-prod`) —
   isso registra um número WhatsApp Business.
3. Coletar credenciais:
   - **Instance ID** / API base URL (ex: `https://free.uazapi.com` ou custom)
   - **API token** (para chamadas outbound — enviar mensagens)
4. Configurar webhook inbound no dashboard UAZAPI:
   - URL: `https://crm-cavalcanti.vercel.app/api/webhooks/uazapi`
   - Método: POST
   - Content-Type: `application/json`
   - Header custom: `x-signature: {{HMAC_SHA256(body, WEBHOOK_HMAC_SECRET)}}`
     (o exato mecanismo depende do provider — se UAZAPI não suporta HMAC
     custom, avaliar signature deles + adaptar `verifyHmacSignature`).
5. Testar via dashboard UAZAPI: envie uma msg de teste pro número da
   instância → verifica que aparece em `/whatsapp` do CRM.

**Variáveis de env a adicionar (`.env.local` + Vercel):**

```
UAZAPI_BASE_URL=https://free.uazapi.com
UAZAPI_INSTANCE_ID=<id-da-instancia>
UAZAPI_API_TOKEN=<token-outbound>
```

Provisionar no Vercel via API (usar padrão dos secrets anteriores) ou dashboard.

## Passo 2 — Escolher provider IA

**Recomendação: Claude Haiku 4.5** (`claude-haiku-4-5-20251001`).

| Fator | Claude Haiku 4.5 | OpenAI GPT-4o-mini |
|---|---|---|
| Custo/1M tokens (input) | ~US$0.80 | ~US$0.15 |
| Custo/1M tokens (output) | ~US$4.00 | ~US$0.60 |
| PT-BR | Excelente | Excelente |
| Vision (imagem) | Nativa (multimodal) | Nativa (multimodal) |
| PDF direto | Sim (nativo) | Requer conversão pra imagem |
| Latência típica | 500-1500ms | 800-2000ms |
| Contexto | 200k | 128k |

**Trade-off:** OpenAI é mais barato, Claude tem melhor OCR de documento
brasileiro (nota fiscal, boleto) e suporta PDF nativo. Pra este caso de
uso (classificação de comprovantes/NF de obra) o custo extra do Claude
compensa a acurácia maior — errar um pagamento importante custa mais
que a diferença.

## Passo 3 — Implementar `AnthropicClassifier`

Criar `apps/web/lib/ia/anthropic-classifier.ts`:

```ts
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { Classifier, ClassifierInput, ClassifierOutput } from './classifier';

const SYSTEM_PROMPT = `Você é um classificador financeiro para uma empresa
de construção civil. Recebe mensagens de WhatsApp de operadores de obra
(zeladores, mestres) contendo texto + opcional foto/PDF de comprovante ou
NF, e extrai dados estruturados para lançamento no ERP.

Sempre responda em JSON estrito seguindo o schema informado. Se não tiver
certeza sobre um campo, deixe null. Nunca invente valores.`;

const CLASSIFICATION_TOOL = {
  name: 'classify_mensagem',
  description: 'Retorna a classificação estruturada da mensagem',
  input_schema: {
    type: 'object',
    properties: {
      kind: { enum: ['pagamento_completo', 'pagamento_parcial', 'documento_apenas', 'nao_identificado'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      extracted: {
        type: 'object',
        properties: {
          valor: { type: 'number' },
          data_pagamento: { type: 'string', format: 'date' },
          obra_id: { type: 'string' },
          fornecedor_id: { type: 'string' },
          fornecedor_nome_novo: { type: 'string' },
          tipo_documento: { enum: ['nota_fiscal', 'comprovante', 'contrato', 'outro'] },
          numero_nf: { type: 'string' },
          descricao: { type: 'string' },
          raciocinio: { type: 'string' },
        },
      },
      perguntaConfirmacao: { type: 'string' },
    },
    required: ['kind', 'confidence', 'extracted'],
  },
};

export class AnthropicClassifier implements Classifier {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  async classify(input: ClassifierInput): Promise<ClassifierOutput> {
    const userContent: Anthropic.MessageParam['content'] = [];

    // Contexto de obras+fornecedores → texto
    userContent.push({
      type: 'text',
      text: [
        `Obras ativas:\n${input.contexto.obrasAtivas.map((o) => `- ${o.id}: ${o.nome}`).join('\n')}`,
        `Fornecedores conhecidos:\n${input.contexto.fornecedoresConhecidos.map((f) => `- ${f.id}: ${f.nome}`).join('\n')}`,
        `Telefone remetente: ${input.telefone}`,
        input.texto ? `Texto: "${input.texto}"` : 'Sem texto.',
      ].join('\n\n'),
    });

    // Mídia (imagem ou PDF)
    if (input.midiaUrl && input.midiaMime?.startsWith('image/')) {
      userContent.push({
        type: 'image',
        source: { type: 'url', url: input.midiaUrl },
      });
    }
    if (input.midiaUrl && input.midiaMime === 'application/pdf') {
      userContent.push({
        type: 'document',
        source: { type: 'url', url: input.midiaUrl },
      });
    }

    const resp = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [CLASSIFICATION_TOOL],
      tool_choice: { type: 'tool', name: 'classify_mensagem' },
      messages: [{ role: 'user', content: userContent }],
    });

    const toolUse = resp.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Claude não retornou tool_use');
    }
    return toolUse.input as ClassifierOutput;
  }
}
```

Ativar no factory (`classifier.ts`):

```ts
if (provider === 'anthropic') {
  const { AnthropicClassifier } = await import('./anthropic-classifier');
  return new AnthropicClassifier();
}
```

Instalar SDK:
```
pnpm --filter web add @anthropic-ai/sdk
```

**Variáveis de env:**
```
IA_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

## Passo 4 — Download + upload de mídia pro Storage

Hoje `classifyAndPersist` recebe apenas `midia_mime`; não baixa o arquivo.
Antes de chamar o classifier real, precisa:

1. Fazer fetch da URL do provider (UAZAPI serve URLs temporárias, ~10min TTL).
2. Upload pro bucket `documents` via `uploadDocumentBuffer` (já existe em
   `apps/web/lib/storage/documents.ts`), path `whatsapp/{mensagem_id}/{filename}`.
3. Atualizar `mensagens_whats.midia_storage_path`.
4. Gerar signed URL 60s (via `getSignedUrl`) pra passar como `input.midiaUrl`
   pro classifier (Claude/OpenAI faz fetch da URL).

Alternativa (mais robusta): baixar bytes, base64-encodar, e passar
`source: { type: 'base64', ... }` pro Claude. Trade-off: mais bytes na
request mas evita dependência de URL pública.

Fazer isso em `classifyAndPersist` antes do `classifier.classify(input)`.

## Passo 5 — Enviar resposta de confirmação via WhatsApp

Quando o classifier retorna `perguntaConfirmacao`, o bot deveria mandar
essa pergunta de volta pro remetente pra confirmar. Precisa cliente
outbound UAZAPI:

```ts
// apps/web/lib/whatsapp/uazapi-client.ts
export async function enviarMensagem(telefone: string, texto: string): Promise<string> {
  const res = await fetch(`${process.env.UAZAPI_BASE_URL}/send/text`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      token: process.env.UAZAPI_API_TOKEN!,
    },
    body: JSON.stringify({ number: telefone, text: texto }),
  });
  if (!res.ok) throw new Error(`UAZAPI send failed: ${res.status}`);
  const j = await res.json();
  return j.messageId ?? j.id ?? ''; // salvar em confirmacoes_pendentes.msg_id_pergunta_uazapi
}
```

E no `classifyAndPersist`, após inserir em `confirmacoes_pendentes`,
chamar `enviarMensagem(msg.telefone_from, out.perguntaConfirmacao)`,
depois update `msg_id_pergunta_uazapi` com o id retornado.

## Passo 6 — Processar resposta de confirmação inbound

Quando o remetente responde "sim" / "não" / "não, era X", cai no mesmo
webhook. Precisa lógica extra:

1. Após upsert em `mensagens_whats`, se `texto_bruto` matches padrão de
   resposta (curta, começa com S/N/Sim/Não), buscar `confirmacoes_pendentes`
   ativa (resolvida=false) pra este `telefone_from`.
2. Se encontrar: parse resposta ("sim" → promove pra Pagamento; "não" →
   marca `resolvida=true` + `status='erro'`; correção livre → re-chama
   classifier com resposta como contexto adicional).

Isso é uma iteração — não bloqueante. Enquanto não implementado, o gestor
resolve tudo pelo painel `/pendentes`.

## Passo 7 — Testar

**Local (Next.js rodando em localhost:3000):**

```bash
export WEBHOOK_HMAC_SECRET=<valor do .env.local>
node scripts/test-webhook-uazapi.mjs text-simples
node scripts/test-webhook-uazapi.mjs image-nf --url http://localhost:3000
```

Verificar em `/whatsapp` que a mensagem apareceu; em `/pendentes` que
gerou entrada de confirmação (mock classifier sempre gera).

**Prod:**

```bash
export WEBHOOK_HMAC_SECRET=<mesma coisa da Vercel>
node scripts/test-webhook-uazapi.mjs text-simples --url https://crm-cavalcanti.vercel.app
```

## Checklist final Fase 8 "completa"

- [ ] UAZAPI provisionado + webhook URL configurada
- [ ] `UAZAPI_*` env vars provisionadas em Vercel (3 scopes)
- [ ] `IA_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` provisionadas
- [ ] `AnthropicClassifier` implementado + `pnpm --filter web add @anthropic-ai/sdk`
- [ ] Download+upload de mídia implementado em `classifyAndPersist`
- [ ] Client outbound UAZAPI + envio de `perguntaConfirmacao`
- [ ] E2E real: msg → webhook → classificação → confirmação painel → pagamento criado
- [ ] Bot responde ao remetente com decisão do gestor
- [ ] Logs estruturados (Vercel Log Drain?) pra observability
- [ ] Alerta se `mensagens_whats.status='erro'` cresce (Slack/email)

## Segurança

- `WEBHOOK_HMAC_SECRET` foi rotacionado 2026-09-07 (Fase 7.5 hardening).
  Anteriores (dcbb2015…, 221299…) estão queimados — nunca reusar.
- Rate-limit da rota `/api/webhooks/uazapi`: hoje não tem. Se abrir pra
  webhook público, considerar Upstash Redis + `@upstash/ratelimit` por IP
  (60 req/min razoável pro caso UAZAPI genuíno, bloqueia scan).
- Middleware `/api/webhooks/*` já bypassa auth (Fase 2 whitelist).
