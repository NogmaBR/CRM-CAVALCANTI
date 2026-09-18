✅ Integração n8n — shipada e verificada em prod

3 tasks · 1 commit consolidado · 1 subagent sonnet · deploy READY em 91c3a16

#: N.1
Task: Migration + service + hooks
Approach: direct
Delivered: webhooks_outbound table + dispatchEvento
────────────────────────────────────────
#: N.2
Task: /config/webhooks CRUD
Approach: subagent sonnet
Delivered: list + novo + editar + 5 server actions + CSS
────────────────────────────────────────
#: N.3
Task: Handoff completo
Approach: direct
Delivered: docs/operacao/n8n-integracao.md — 4 workf troubleshooting

Arquitetura de integração:

CRM (Vercel)                    n8n (Cloud OR Docker
  │                              │
  ├─ Emite webhooks HMAC ────POST──▶ trigger workflo
  │  6 eventos suportados          ├─ Slack notif
  │                                 ├─ OneDrive sync
  ▼                                 ├─ Weekly digest
  Supabase ◀────────────────READ─── ├─ Reminder cron
     (via Supabase node)            └─ etc

Eventos wired hoje (com dispatchEvento):
- pagamento_created — em createPagamento action após
- confirmacao_pendente_created — em classifyAndPersist após pendência criada
- documento_created — em createDocumento após update

Eventos reservados (fácil adicionar futuramente):
- pagamento_updated, obra_created, obra_archived
- test — payload dummy do botão Testar

Payload signed (HMAC-SHA256):
Headers:
  X-Nogma-Signature: sha256=<hex>
  X-Nogma-Event: pagamento_created
  User-Agent: Nogma-Webhook/1.0

Body:
{
  "evento": "pagamento_created",
  "ocorrido_em": "2026-09-07T22:00:00.000Z",
  "dados": { ...event-specific... }
}

UI /config/webhooks (admin-only):
- Tabela com badge status HTTP (verde 2xx / amarelo relativo última execução + total execuções
- Novo webhook: form com 6 checkboxes de eventos + secret gerado auto e mostrado UMA VEZ em banner amber
- Editar: nome/url/eventos/ativo + fieldset separado
- Botão Testar dispara payload dummy + reporta latência/status
- Best-effort dispatch: nunca throw upstream, sempretima_execucao_*

Handoff completo em docs/operacao/n8n-integracao.md:

1. Setup — n8n Cloud US$20/mês OU self-hosted Docker
2. Conectar Supabase — node nativo com Service Role (bypassa RLS, cuidado)
3. Receber webhooks — Webhook node + Code node valid
4. 4 workflows exemplo completos:
  - Slack notification: novo pagamento > R$5k
  - OneDrive sync: documento novo → upload + update onedrive_file_id
  - Weekly digest: cron sexta 18h → SELECT + agrega
  - Reminder cron: pagamento aguardando > 7d → send WhatsApp
5. Segurança — HMAC inbound + rotate secret + Servic
6. Custos — n8n Cloud US$20 OR VPS R$40-80
7. Troubleshooting + extensões futuras

Como testar você mesmo agora:

1. Autentique como admin em https://crm-cavalcanti.v
2. Click "Novo webhook":
  - Nome: "Teste RequestBin"
  - URL: crie um teste em https://webhook.site e cole a URL
  - Eventos: marque test + pagamento_created
3. Salvar → copie o secret do banner
4. Click "Testar" → deve ver payload chegando no web
5. Crie um pagamento em /pagamentos/novo → segundo webhook chega automático

Cumulativo: 21/21 fases + integração n8n. Roadmap MVP completo + bridge pra automações externas.

Pendências manuais do usuário:
1. UAZAPI + AI creds — Fase 8 Integration (~4h)
2. Resend account — Fase 10 real emails (5min)
3. Supabase staging — Fase 15 (10min)
4. GitHub workflow file — Fase 12 CI (5min via UI)
5. n8n instance — se quiser usar automações.