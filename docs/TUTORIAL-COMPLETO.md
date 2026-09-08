# TUTORIAL COMPLETO — CRM Nogma-Cavalcanti

Passo-a-passo de tudo: acessar o sistema, usar cada tela, convidar
equipe, integrar automações. **Leia do início ao fim uma vez.**

Produção: <https://crm-cavalcanti.vercel.app>

---

## Índice

1. [Primeiro acesso (admin)](#1-primeiro-acesso-admin)
2. [Tour pelas telas](#2-tour-pelas-telas)
3. [Convidar equipe](#3-convidar-equipe)
4. [Preferências pessoais](#4-preferências-pessoais)
5. [Cadastros iniciais](#5-cadastros-iniciais)
6. [Registrar pagamentos](#6-registrar-pagamentos)
7. [Anexar documentos](#7-anexar-documentos)
8. [Import CSV em massa](#8-import-csv-em-massa)
9. [Baixar relatórios](#9-baixar-relatórios)
10. [Auditoria e histórico](#10-auditoria-e-histórico)
11. [Notificações email](#11-notificações-email)
12. [Fornecedores: apelidos + duplicatas](#12-fornecedores-apelidos--duplicatas)
13. [WhatsApp + IA (Fase 8 — aguarda creds)](#13-whatsapp--ia-fase-8--aguarda-creds)
14. [Integração n8n](#14-integração-n8n)
15. [Ativar Resend (email real)](#15-ativar-resend-email-real)
16. [Ativar staging + CI](#16-ativar-staging--ci)
17. [Troubleshooting](#17-troubleshooting)
18. [Referências completas](#18-referências-completas)

---

## 1. Primeiro acesso (admin)

**Usuário admin já existe:**
- Email: `admin@nogmacorp.com.br`
- Senha: veja em `.env.local` root (`AUTH_TEST_PASSWORD`)

**Como logar:**

1. Abra <https://crm-cavalcanti.vercel.app/login>
2. Preencha email + senha
3. Resolva hCaptcha (checkbox "Sou humano")
4. Click **Entrar** — vai pra `/painel`

**Se esqueceu senha:**
- Hoje não tem fluxo "esqueci minha senha" público (Fase 13.x)
- Contate outro admin OU acesse Supabase Dashboard → Auth → Users →
  Reset password

---

## 2. Tour pelas telas

**Sidebar esquerda (navegação principal):**

| Ícone | Rota | O que faz |
|---|---|---|
| Home | `/painel` | KPIs + charts + timeline atividade |
| Obras | `/obras` | Lista de obras (CRUD) |
| Fornecedores | `/fornecedores` | Lista de fornecedores (CRUD) |
| Pagamentos | `/pagamentos` | Lista de pagamentos (CRUD) |
| Documentos | `/documentos` | NFs/comprovantes anexados |
| WhatsApp | `/whatsapp` | Feed de mensagens recebidas |
| Pendentes | `/pendentes` | Msgs aguardando sua confirmação |
| Relatórios | `/relatorios` | Baixar PDF/CSV |
| Notificações | `/notificacoes` | Log de emails enviados |
| Auditoria | `/auditoria` | Histórico de alterações |
| Configurações | `/config` | Menu de gestão (usuários, perfil, etc) |

**Topbar:**
- Título da página + subtítulo
- Botão de ação principal (varia por página)
- Menu do usuário (canto direito)

**Painel `/painel`:**
- 4 KPIs: obras ativas, gasto do mês, total acumulado, pendências
- Sparklines com últimos 8 meses
- Delta % vs mês anterior (verde/vermelho)
- **Análises**: 3 charts
  - Barras: pagamentos por mês (12m)
  - Donut: gasto por categoria (top 5 + outros)
  - Área: total acumulado
- **Atividade recente**: timeline unificada últimas 48h

---

## 3. Convidar equipe

**Só admin faz isso.**

**Passo-a-passo:**

1. Sidebar → **Configurações** (item genérico)
2. Navegue para `/config/usuarios` (via URL)
3. Click **Convidar** (botão primary, canto sup direito)
4. Preencha form:
   - Email do convidado
   - Nome completo
   - Papel (dropdown): admin / gestor / financeiro / leitura
5. Click **Enviar convite**
6. Sistema envia email do Supabase Auth com link único
7. Convidado clica → cai em `/definir-senha?code=X`
8. Ele define senha → cai em `/painel` como o papel definido

**Papéis:**

| Papel | Pode |
|---|---|
| admin | Acesso TOTAL — gerencia usuários, configurações, tudo |
| gestor | Cria/edita obras, pagamentos; aprova; NÃO gerencia usuários |
| financeiro | Visualiza + edita pagamentos e documentos |
| leitura | Apenas visualização (não muda nada) |

**Gerenciar depois:**
- `/config/usuarios` mostra lista com filtros (Ativos / Convites pendentes / Arquivados)
- **Reenviar convite** — se convidado não recebeu email
- **Editar papel** — promove/rebaixa (nunca a si mesmo)
- **Arquivar** — revoga sessions ativas do user

---

## 4. Preferências pessoais

**Qualquer usuário faz isso.**

1. Sidebar → **Meu perfil** (item User)
2. Ou navegue `/config/perfil`
3. 4 fieldsets:
   - **Informações**: nome, telefone, email readonly, papel readonly
   - **Aparência**: escolha tema (Claro / Preto Nogma / Petróleo dark)
   - **Fuso horário**: default São Paulo; disponíveis 7 BR + UTC
   - **Notificações email**: 3 checkboxes opt-in:
     - Novo pagamento aguardando minha aprovação
     - Nova mensagem WhatsApp na fila de pendências
     - Resumo semanal (Fase futura)
4. Click **Salvar preferências**

**Nota:** tema salvo funciona a partir da PRÓXIMA session (precisa
recarregar). Fix client-side é extensão Fase 14.x.

---

## 5. Cadastros iniciais

### 5.1 Cadastrar Obra

1. Sidebar → **Obras** → **Nova Obra**
2. Preencha:
   - **Nome** (obrigatório, min 2)
   - **Cliente** (opcional)
   - **Status**: ativa / pausada / concluída / arquivada
   - **Tipo**: nova / reforma
   - **Data início** e **Data prevista fim**
   - **Orçamento** (R$)
   - **Endereço** (opcional, JSON — logradouro, cidade, UF)
   - **Apelidos** (para IA classificar mensagens)
3. Salvar → redireciona pra `/obras/{id}` (detail)

### 5.2 Cadastrar Fornecedor

1. Sidebar → **Fornecedores** → **Novo Fornecedor**
2. Preencha:
   - **Nome** (obrigatório)
   - **Razão social** (opcional)
   - **Documento tipo** (CNPJ ou CPF) + **Documento** (com máscara)
   - **Categoria** (dropdown — cadastre em `/config/categorias` antes)
   - **Telefone** e **Email**
   - **Origem**: manual / auto_detectado
3. Salvar

### 5.3 Categorias contábeis

Sistema já tem 8 seed. Para adicionar/editar:

1. `/config/categorias` (admin only)
2. Novo → nome + escolha cor da paleta (8 opções) + ícone opcional
3. Salvar

**Antes de arquivar** — sistema mostra quantos pagamentos usam.

---

## 6. Registrar pagamentos

### 6.1 Manual (form)

1. Sidebar → **Pagamentos** → **Novo Pagamento**
2. Preencha:
   - **Obra** (dropdown)
   - **Fornecedor** (opcional)
   - **Categoria** (opcional)
   - **Valor** (R$ — formato pt-BR: `1.234,56`)
   - **Data pagamento** (date picker)
   - **Origem**: manual / whatsapp / importado
   - **Status**: confirmado / aguardando / erro
   - **Descrição** + **Observações**
3. Salvar

**Se status = aguardando:**
- Dispara email pra admins+gestores com opt-in (Fase 10)
- Dispara webhook outbound se configurado (Fase n8n)

### 6.2 Editar

- `/pagamentos/{id}` → botão **Editar**
- Cada alteração fica registrada em `/auditoria`

### 6.3 Arquivar

- `/pagamentos/{id}` → botão **Arquivar**
- Soft-delete (`deleted_at` preenchido)
- Restaurar via `/pagamentos?status=arquivado` → detail → Restaurar

---

## 7. Anexar documentos

### 7.1 Upload novo

1. Sidebar → **Documentos** → **Novo Documento** (ou botão em obra/pagamento)
2. Form:
   - **Arquivo** (PDF/JPG/PNG/WebP, máx 10 MB)
   - **Obra** (obrigatório)
   - **Pagamento** (opcional — link)
   - **Fornecedor** (opcional)
   - **Tipo**: nota_fiscal / comprovante / contrato / outro
   - **Número NF** + **Chave acesso NF** (44 dígitos, opcional)
3. Salvar
- Sistema calcula SHA-256 → se duplicado, avisa
- Upload pro Storage bucket privado

### 7.2 Baixar

- `/documentos/{id}` → botão **Baixar**
- Gera signed URL (válida 60s) → redirect

### 7.3 Arquivar

- Detail → **Arquivar**
- Arquivados **não podem ser baixados** (bloqueio explícito)

---

## 8. Import CSV em massa

**Admin only.**

1. `/config/importar`
2. Click **Baixar template** (arquivo `template-pagamentos.csv`)
3. Abra no Excel/Google Sheets
4. Preencha (use nome EXATO de obra/fornecedor/categoria):

| obra | fornecedor | categoria | valor | data_pagamento | origem | status_pagto | descricao |
|---|---|---|---|---|---|---|---|
| Obra Alpha | Casa das Tintas | Material | 1250,00 | 15/09/2026 | manual | confirmado | Cimento |

5. **Salvar como CSV UTF-8** (Excel: "CSV UTF-8 (Comma delimited)")
6. Volte pra `/config/importar` → escolha arquivo → **Analisar**
7. Preview mostra linhas com erros destacados
   - Obra não encontrada = **bloqueia** linha
   - Fornecedor/categoria não encontrada = **importa sem** (warning)
8. Se OK → **Confirmar import** → batch insert
9. Banner "X inseridos · Y falharam"

---

## 9. Baixar relatórios

Sidebar → **Relatórios** → 4 cards:

### 9.1 Relatório da Obra
- Selecione obra → **Baixar PDF** ou **CSV**
- Contém: dados obra + todos pagamentos + documentos + consolidado por categoria/fornecedor

### 9.2 Fechamento Mensal
- Escolha mês (input) → PDF/CSV
- Contém: pagamentos do mês + breakdown por obra/categoria/origem

### 9.3 Histórico do Fornecedor
- Selecione fornecedor + date range opcional → PDF/CSV
- Contém: histórico + ticket médio + primeira/última compra

### 9.4 Atividade Recente
- Date range obrigatório → PDF/CSV
- Contém: timeline pagamentos + documentos criados no período

**Formato:**
- PDF branded Nogma (identidade visual)
- CSV UTF-8 BOM (abre correto no Excel pt-BR)

---

## 10. Auditoria e histórico

**Admin/gestor only.**

1. Sidebar → **Auditoria** (`/auditoria`)
2. Filtros no topo: entidade / ação / data range / user
3. Cada linha: timestamp + user (ou "Sistema") + ação badge + entidade badge + preview
4. Click **Ver diff** → detail com:
   - INSERT: valores criados
   - UPDATE: 3 colunas Campo | Antes | Depois (highlights)
   - DELETE: valores antes de arquivar

**Cobertura:** obras, fornecedores, pagamentos, documentos, categorias, autorizados WhatsApp, webhooks_outbound.

---

## 11. Notificações email

### 11.1 Log

Sidebar → **Notificações** (`/notificacoes`):
- Filtros: Todas / Enviadas / Falhas / Pendentes
- Cada card: destinatário + timestamp + assunto + badge status
- Click **Ver conteúdo** → preview do HTML enviado
- Se falha: botão **Reenviar**

### 11.2 Triggers automáticos

- Novo pagamento com status **aguardando** → email pra admins/gestores com opt-in
- Nova mensagem WhatsApp criando pendência → email pra admins/gestores

### 11.3 Opt-in por usuário

Cada user controla em `/config/perfil` (fieldset Notificações).

**Nota:** hoje usa **mock provider** — emails aparecem em `/notificacoes`
como "enviados" mas não vão pra inbox real. Ver [seção 15](#15-ativar-resend-email-real).

---

## 12. Fornecedores: apelidos + duplicatas

### 12.1 Apelidos

Nomes alternativos usados pela IA (WhatsApp) pra bater texto com fornecedor.

1. `/fornecedores/{id}` → role até seção **Apelidos**
2. Input "Ex: CDT, Casa Tintas" → **Adicionar**
3. Pills mostram apelidos + badge "IA" se criado pela IA + counter "visto Nx"
4. X pra remover

### 12.2 Auto-detect duplicatas

**Admin/gestor only.**

1. `/fornecedores/duplicatas`
2. Sistema roda Jaro-Winkler similarity + match por documento
3. Cards mostram pares:
   - Score badge (100% = doc igual, 90-99% = nome similar)
   - 2 botões: "Manter A · arquivar B" OU "Manter B · arquivar A"
4. Confirm → **merge**:
   - Move todos pagamentos + documentos do drop → keep
   - Move apelidos + adiciona drop.nome como novo apelido
   - Arquiva drop

**Merge é irreversível manual** — cuidado.

---

## 13. WhatsApp + IA (Fase 8 — aguarda creds)

**Status atual:** Foundation completa com **mock classifier**.
Webhook público `POST /api/webhooks/uazapi` já funciona.

**Como testar mock localmente:**

```bash
export WEBHOOK_HMAC_SECRET=<valor do .env.local>
node scripts/test-webhook-uazapi.mjs text-simples --url https://crm-cavalcanti.vercel.app
```

Deve retornar HTTP 200 + mensagem aparece em `/whatsapp` e `/pendentes`.

**Como ativar Integration real (2 partes):**

### 13.1 UAZAPI

1. Criar conta em <https://uazapi.com>
2. Provisionar instância (número WhatsApp)
3. Configurar webhook inbound:
   - URL: `https://crm-cavalcanti.vercel.app/api/webhooks/uazapi`
   - Header: `x-signature: sha256=<HMAC_do_body>` (WEBHOOK_HMAC_SECRET)
4. Vars a adicionar na Vercel (via API ou dashboard):
   - `UAZAPI_BASE_URL`
   - `UAZAPI_INSTANCE_ID`
   - `UAZAPI_API_TOKEN`

### 13.2 IA (Anthropic Claude Haiku 4.5 — recomendado)

1. Criar conta em <https://console.anthropic.com>
2. Gerar API key
3. Implementar `apps/web/lib/ia/anthropic-classifier.ts` (skeleton completo em `docs/operacao/fase-8-integracao.md`)
4. `pnpm --filter web add @anthropic-ai/sdk`
5. Vars Vercel:
   - `IA_PROVIDER=anthropic`
   - `ANTHROPIC_API_KEY=sk-ant-...`
6. Redeploy

Detalhes: **`docs/operacao/fase-8-integracao.md`** — 7-step passo-a-passo
completo com código pronto.

---

## 14. Integração n8n

Automações externas (Slack, OneDrive, Google Sheets, lembretes).

### 14.1 Setup n8n

**Cloud (recomendado):** <https://n8n.cloud> plano Starter US$20/mês (2500 executions/mês).

**Self-hosted:** Docker em VPS. Ver `docs/operacao/n8n-integracao.md` (docker-compose completo).

### 14.2 Registrar webhook do CRM no n8n

1. n8n → New Workflow → adicione node **Webhook**
2. Method: POST, Path: livre (ex: `/pagamento`)
3. Copie URL gerada (`https://n8n.xxx.com/webhook/pagamento`)

### 14.3 Configurar no CRM

1. `/config/webhooks` (admin only) → **Novo webhook**
2. Preencha:
   - Nome: "n8n — pagamentos"
   - URL: cole a URL do n8n
   - Eventos: marque os que quer (checkbox)
3. Salvar → **secret aparece UMA VEZ** — copie e guarde
4. Volte pra n8n → adicione Code node depois do Webhook pra validar HMAC:

```javascript
const crypto = require('crypto');
const secret = '<secret-copiado-do-crm>';
const body = JSON.stringify($json);
const signature = $input.item.headers['x-nogma-signature'];
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
if (signature !== expected) throw new Error('Signature invalida');
return $input.all();
```

### 14.4 Testar

1. `/config/webhooks` → seu webhook → botão **Testar**
2. n8n recebe payload dummy
3. Status/latência atualiza no CRM

### 14.5 Ler dados do CRM no n8n

n8n tem node nativo **Supabase**:
1. Credentials → new Supabase API
2. URL: `https://bbtejxugeeccywwhfpoc.supabase.co`
3. Service Role Key: pegue no `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`)
   ⚠️ bypassa RLS — total acesso
4. Add node Supabase → Get All / Insert / Update / Delete

### 14.6 4 workflows exemplo

**Exemplo 1 — Slack notification:**
```
[Webhook] → [Code: validate] → [Filter: valor > 5000]
  → [Slack: post to #financeiro]
    "Pagamento R$ {{dados.valor}} · Obra {{dados.obra_id}}"
```

**Exemplo 2 — OneDrive sync:**
```
[Webhook documento_created] → [Supabase: get documento]
  → [Storage: download] → [OneDrive: upload /obras/{obra}/{file}]
  → [Supabase: UPDATE documentos SET onedrive_file_id = X]
```

**Exemplo 3 — Weekly digest:**
```
[Cron sexta 18h] → [Supabase: SELECT pagamentos WHERE created_at > 7d]
  → [Function: agrega] → [Send Email HTML template]
```

**Exemplo 4 — Reminder cron:**
```
[Cron diário 09h] → [Supabase: SELECT pagamentos aguardando > 7d]
  → [Loop] → [UAZAPI: send WhatsApp pro fornecedor.telefone]
```

Detalhes completos em `docs/operacao/n8n-integracao.md`.

---

## 15. Ativar Resend (email real)

Hoje emails ficam em log `/notificacoes` mas não vão pra inbox.

**Passo-a-passo (10 min):**

1. Criar conta <https://resend.com> (free 3k email/mês)
2. Dashboard → **Domains** → Add `nogmacorp.com.br`
3. Adicione 3 registros DNS (SPF, DKIM, DMARC) que Resend fornece
4. Aguarde propagação (~15-30 min) até status "Verified"
5. Dashboard → **API Keys** → Create → copie `re_xxx`
6. Provisionar vars na Vercel (via API ou dashboard):
   ```
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxx
   EMAIL_FROM=Nogma Gestor de Obras <no-reply@nogmacorp.com.br>
   ```
7. Redeploy Vercel
8. Teste: crie pagamento status=aguardando → email real chega em `/notificacoes` + inbox dos admins/gestores com opt-in

Detalhes: **`docs/operacao/fase-10-emails.md`**.

---

## 16. Ativar staging + CI

Ambiente separado pra testes E2E automatizados em PRs.

**Passo-a-passo (10 min):**

1. Supabase Dashboard → **New Project**
   - Nome: `CRM-CAVALCANTI-STAGING`
   - Region: São Paulo (`sa-east-1`)
   - Plan: Free
2. Aguarde ~2 min provisionar
3. Copie: Project URL, anon key, service_role key, reference ID
4. No repo local:
   ```powershell
   cp .env.staging.example .env.staging
   # Edite .env.staging com valores acima
   ```
5. Aplique migrations:
   ```powershell
   $env:STAGING_SUPABASE_PROJECT_REF="<ref>"
   $env:STAGING_SUPABASE_ACCESS_TOKEN="<sbp_ do .env.local>"
   pnpm staging:apply-migrations
   ```
6. Provisione Vercel Preview env vars:
   ```powershell
   $env:STAGING_SUPABASE_URL="https://<ref>.supabase.co"
   $env:STAGING_SUPABASE_ANON_KEY="<...>"
   $env:STAGING_SUPABASE_SERVICE_ROLE_KEY="<...>"
   pnpm staging:setup-vercel
   ```
7. Criar user admin no staging (dashboard Auth) + disable hCaptcha
8. Add workflow GitHub `.github/workflows/e2e.yml` (existe local mas precisa PAT com workflow scope pra commit) OU via GitHub web UI (Actions → New workflow → paste)
9. Add 6 secrets no repo GitHub: `VERCEL_TOKEN`, `STAGING_AUTH_*`, `STAGING_SUPABASE_*`

Detalhes: **`docs/operacao/fase-15-staging.md`**.

---

## 17. Troubleshooting

**Não consigo logar:**
- hCaptcha bloqueando? Resolva o checkbox
- Senha errada? Reset via Supabase Dashboard → Auth → Users
- Sessão expirada? Delete cookies + tente de novo

**"Erro ao processar" em qualquer form:**
- Check `/notificacoes` (se admin) — pode ter erro logado
- Console DevTools do navegador (F12) — mostra erro exato do server action

**Documento não faz upload:**
- Máx 10 MB
- Formatos: PDF, JPG, PNG, WebP
- Nome muito longo? Sistema trunca em 200 chars

**Emails não chegam:**
- Provider = mock (default)? Ver [seção 15](#15-ativar-resend-email-real) para ativar Resend
- `/notificacoes` mostra "Enviada" mas nada na inbox? Confirme opt-in em `/config/perfil`

**Webhook n8n não recebe:**
- `/config/webhooks` mostra "última execução" com erro?
- Signature inválida no n8n? Confira que secret bate

**WhatsApp não classifica:**
- Ainda usa mock (Fase 8 Foundation)
- Ver [seção 13](#13-whatsapp--ia-fase-8--aguarda-creds) pra ativar real

**"Categoria/fornecedor não encontrado" no import CSV:**
- Cadastre em `/config/categorias` ou `/fornecedores` PRIMEIRO
- Nome deve bater EXATO (case-insensitive)

**Página `/config/usuarios` retorna 404:**
- Você não é admin
- Contate admin

**Deploy falhou no Vercel:**
- Dashboard Vercel → última deploy → logs
- Comum: env var faltando (adicione + redeploy)

---

## 18. Referências completas

Handoff docs por fase (consulte quando precisar):

- **Setup inicial** — `docs/operacao/handoff-fase-0.md`
- **Vercel** — `docs/operacao/handoff-vercel-parceiro.md`
- **Supabase** — `docs/operacao/setup-supabase.md`
- **Fase 8 Integration (WhatsApp+IA)** — `docs/operacao/fase-8-integracao.md`
- **Fase 10 Emails (Resend)** — `docs/operacao/fase-10-emails.md`
- **Fase 11 Auditoria** — `docs/operacao/fase-11-auditoria.md`
- **Fase 12 E2E tests** — `docs/operacao/fase-12-e2e.md`
- **Fase 13 Usuários** — `docs/operacao/fase-13-usuarios.md`
- **Fase 14 Preferências** — `docs/operacao/fase-14-preferencias.md`
- **Fase 15 Staging** — `docs/operacao/fase-15-staging.md`
- **Fase 16 Categorias** — `docs/operacao/fase-16-categorias.md`
- **Fase 17 Dashboard** — `docs/operacao/fase-17-dashboard.md`
- **Fase 18 Bulk ops** — `docs/operacao/fase-18-bulk.md`
- **Fase 19 Apelidos+duplicatas** — `docs/operacao/fase-19-apelidos-duplicatas.md`
- **Fase 20 A11y+WCAG** — `docs/operacao/fase-20-a11y-polish.md`
- **n8n Integração** — `docs/operacao/n8n-integracao.md`

**Status do projeto:** `docs/PROJETO-STATUS.md`
**Spec original:** `docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md`

---

## Check-list rápido pra deixar tudo funcionando 100%

- [ ] Login funciona (email + senha do `.env.local`)
- [ ] Cadastrei 1 obra teste
- [ ] Cadastrei 1 fornecedor teste
- [ ] Registrei 1 pagamento (aparece em `/painel`)
- [ ] Anexei 1 documento
- [ ] Baixei PDF em `/relatorios`
- [ ] Vi histórico em `/auditoria`
- [ ] Convidei 2ª pessoa da equipe (admin OU teste com meu 2º email)
- [ ] Ajustei preferências (tema/notificações) em `/config/perfil`
- [ ] Configurei 1 webhook n8n (opcional — se vai usar automações)
- [ ] Ativei Resend (opcional — se quer emails reais)
- [ ] Provisionei staging (opcional — se vai contribuir código)
- [ ] Configurei UAZAPI + Claude (pra usar WhatsApp real)

**Se todos os itens obrigatórios ✅ → CRM tá em uso produtivo.**

Contato dúvidas técnicas: <operacao@nogmacorp.com.br>
