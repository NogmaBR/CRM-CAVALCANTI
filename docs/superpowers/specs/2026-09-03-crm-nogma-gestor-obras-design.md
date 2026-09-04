# CRM Nogma — Gestor de Obras · Design Spec

- **Status:** Aprovado para planejamento
- **Data:** 2026-09-03
- **Autor:** Sessão de brainstorming (Claude Opus 4.7 + operacao@nogmacorp.com.br)
- **Cliente inicial:** Cavalcanti Construções
- **Fabricante:** Nogma (nogmacorp.com.br)
- **Escopo desta spec:** MVP máximo — 6 telas principais + bot WhatsApp funcional com IA + relatórios PDF + notificações email + integração OneDrive + dashboard financeiro avançado

---

## 1. Contexto e motivação

A Nogma desenvolve produtos de IA aplicada e atendimento via WhatsApp para PMEs brasileiras. A Cavalcanti Construções é o primeiro cliente do produto "Gestor de Obras" — um CRM interno para controle financeiro de canteiro de obras, cuja proposta de valor central é reduzir a fricção do registro de gastos usando o canal que a equipe de campo já usa: WhatsApp.

O fluxo de negócio real é:

1. Zelador ou responsável na obra tira foto do comprovante/nota fiscal.
2. Manda no grupo/DM do WhatsApp da construtora.
3. Um bot classifica automaticamente (obra, fornecedor, categoria, valor) via IA multimodal.
4. O gestor confere no painel web e libera aprovação/pagamento.

O sistema existe hoje como protótipo rodando em `localhost:5173` (screenshots analisados em `arquitetura.md` e `base-de-estrutura.md`), mas o código **não será reaproveitado** — reconstrução do zero.

## 2. Escopo

### 2.1 In-scope (MVP)

- **6 telas principais** (mesmas dos screenshots): Painel, Obras, Documentos, WhatsApp, Pendentes, Fornecedores.
- **Bot WhatsApp funcional** com classificação IA de texto, imagem e PDF.
- **CRUD completo** de obras, fornecedores, categorias, pagamentos, documentos, equipe autorizada.
- **Dashboard financeiro** com KPIs, gráficos (barras/área/donut) e feed de atividade em tempo real.
- **Sistema de pendências** (sem NF / sem comprovante / aguardando confirmação) com botão de lembrete via WhatsApp.
- **Relatórios PDF exportáveis** (obra completa, mês, fornecedor).
- **Notificações por email** (novo pagamento aguardando aprovação, alerta de estouro de orçamento).
- **Integração OneDrive** para espelhar documentos em pastas por obra (conforme `informacoes.md`).
- **Sistema de perfis** (admin, gestor, financeiro, leitura).
- **Toggle de tema** com 3 opções (A Light, B Black default, C Petroleum Dark).
- **Auditoria** de alterações críticas.

### 2.2 Non-goals (V2 ou depois)

- App mobile (React Native).
- Multi-tenant (segundo cliente Nogma).
- Reconciliação bancária automática (leitura de OFX / integração Open Finance).
- Assinatura eletrônica de contratos.
- Módulo de vendas/leads imobiliários (o `fases-construcao.md` menciona, mas está fora deste produto).
- CRM de relacionamento com cliente (contatos, pipeline, propostas).

### 2.3 Restrições explícitas

- Single-tenant (uma organização Cavalcanti).
- Português brasileiro em toda UI.
- Design 100% aderente ao design system Nogma (`nogmacorp.com.br/assets/css/nogma-tokens.css`).

## 3. Decisões arquiteturais

| Decisão | Escolha | Justificativa |
|---|---|---|
| Front-end | Next.js 15 (App Router) + React 19 + TypeScript | Server Components, Server Actions, deploy Vercel nativo |
| Estilização | Tailwind CSS v4 + tokens Nogma verbatim | Design system oficial da Nogma preservado |
| Componentes UI | shadcn/ui + Radix + Lucide icons | Copy-paste, controle total, acessível |
| Tabelas | TanStack Table v8 + wrapper shadcn | Densas, sticky columns, virtualização |
| Gráficos | Recharts 3 | Balance flexibilidade/curva de aprendizado |
| Banco de dados | Supabase Postgres 16 (managed) | Postgres + Auth + Storage + Realtime num pacote |
| Autenticação | Supabase Auth (email+senha, magic link opcional) | Integra com RLS Postgres |
| Storage arquivos | Supabase Storage (com espelho OneDrive via n8n) | Um bucket privado por tipo |
| Realtime | Supabase Realtime | Feed WhatsApp e Painel ao vivo sem WebSocket próprio |
| Backend/API | Route Handlers + Server Actions do Next.js | Menor overhead que NestJS separado |
| Orquestração automações | n8n self-hosted em Docker | Workflows visuais, editáveis sem redeploy |
| WhatsApp API | UAZAPI (SaaS não-oficial brasileira) | Custo baixo, sem verificação Meta, aceito pelo cliente |
| IA classificação | OpenAI GPT-4o-mini (vision + text) | Melhor custo/qualidade multimodal em PT-BR |
| PDF export | pdfmake ou @react-pdf/renderer | Roda no servidor Next.js |
| Rate limiting | Upstash Redis (free tier) | Sem infra extra, edge-friendly |
| Package manager | pnpm + workspaces | Monorepo com apps + packages |
| Testes unitários | Vitest | Rápido, TS-native |
| Testes e2e | Playwright | Cross-browser, screenshots, gravação |
| Lint/format | Biome | 10x mais rápido que ESLint+Prettier |
| CI | GitHub Actions | Padrão de mercado |
| Deploy front | Vercel Pro | Preview por PR, edge, TLS automático |
| Deploy backend automações | VPS StayCloud + Docker Compose + Caddy | R$40-80/mês, controle total |
| Observabilidade | Vercel logs + Docker logs + Supabase logs + Better Stack (opcional) | Suficiente para single-tenant |

## 4. Design System — Nogma

### 4.1 Fonte da verdade

Arquivo `apps/web/styles/nogma-tokens.css` é **cópia verbatim** de `https://nogmacorp.com.br/assets/css/nogma-tokens.css`, preservado em `.design-system/` do repo como referência histórica. Nunca editar direto — se a Nogma atualizar o design system, atualizamos aqui e recopiamos.

### 4.2 Paleta

- **Petroleum** `#0C4651` — brand primary (base escura)
- **Lime** `#CCFF00` — accent / attitude (nunca body text longo)
- **Petroleum scale** 950 (`#041F25`) → 050 (`#F1F7F8`)
- **Lime scale** 600 (`#A3CC00`) → 050 (`#FAFFE0`)
- **Neutral ramp** 0 (`#FFFFFF`) → 950 (`#000000`)
- **Semantic:** success `#2FA36B` · warning `#E8A317` · danger `#D6483B`

### 4.3 Tipografia

- **Agency** (display, uppercase eyebrows/labels, headlines de impacto)
- **Raleway** 300–900 (body, UI, hierarquia) — self-hosted em `apps/web/public/fonts/`
- Escala fluida `clamp()` de `--text-2xs` (11px) a `--text-6xl` (~88px)
- Heading weight 800 (extrabold), tracking `-0.015em`
- Eyebrow Agency uppercase, tracking `0.08em`

### 4.4 Espaçamento & radii

- Grid 4px, mobile-first 375px
- Radii `--radius-md 10px` default, `--radius-lg 14px`, `--radius-xl 20px`
- Section rhythm `clamp(3.5rem, 2rem + 7vw, 7rem)` — whitespace generoso é assinatura

### 4.5 Elevação & motion

- Sombras petroleum-tinted (`rgba(4,31,37,...)`)
- Assinatura **shadow-lime** `0 8px 24px rgba(163,204,0,0.35)` em CTAs primárias
- Easings `cubic-bezier(0.22,1,0.36,1)` (out), `cubic-bezier(0.65,0,0.35,1)` (in-out)
- Durações 120ms / 200ms / 360ms

### 4.6 Três temas via `data-theme`

Todos usam os mesmos tokens; muda apenas o mapeamento semântico:

| Tema | `data-theme` | Bg canvas | Text primary | Heading color | Accent CTA |
|---|---|---|---|---|---|
| **A · Light** | (default) | `--neutral-0` | `--petroleum-950` | `--petroleum-950` | petroleum |
| **B · Black** ★ default | `black` | `--black` | `--white` | `--lime-500` | lime + shadow-lime |
| **C · Petroleum Dark** | `dark` | `--petroleum-800` | `--white` | `--lime-500` | lime |

Toggle no `<Topbar>` persiste em `localStorage` (`nogma-theme`). Preferência inicial = `black`. Server-side lê cookie `nogma-theme` para evitar FOUC.

### 4.7 Motivos de marca

- Sublinhado lime `linear-gradient(transparent 62%, var(--lime-500) 62%)` (classe `.mark-lime`) em headings de impacto
- Selection `background: var(--lime-500); color: var(--petroleum-950)`
- Ícones Lucide monoline stroke=2, `stroke-linecap="round"`
- Logo: `logo-nogma-lime.png` (122×30) sobre fundos escuros; variante escura para light theme (a produzir)

## 5. Estrutura do repositório

```
crm-nogma/
├── apps/
│   └── web/                    # Next.js 15 — deploy Vercel
│       ├── app/
│       │   ├── (auth)/         # login, logout, esqueci-senha
│       │   ├── (app)/          # rotas autenticadas
│       │   │   ├── painel/
│       │   │   ├── obras/
│       │   │   │   ├── page.tsx
│       │   │   │   ├── nova/page.tsx
│       │   │   │   └── [id]/page.tsx
│       │   │   ├── documentos/
│       │   │   ├── whatsapp/
│       │   │   ├── pendentes/
│       │   │   ├── fornecedores/
│       │   │   ├── config/     # configurações (novo)
│       │   │   └── relatorios/ # exports PDF (novo)
│       │   ├── api/
│       │   │   ├── webhooks/uazapi/route.ts   # inbound WhatsApp
│       │   │   ├── webhooks/n8n/route.ts      # callback n8n
│       │   │   └── exports/[tipo]/route.ts    # PDF/CSV
│       │   └── layout.tsx      # shell com sidebar
│       ├── components/
│       │   ├── ui/             # shadcn primitives
│       │   ├── charts/         # Recharts wrappers (BarChart, AreaChart, DonutChart)
│       │   ├── data-table/     # TanStack Table + shadcn wrapper
│       │   ├── layout/         # <Sidebar>, <Topbar>, <ThemeToggle>, <UserMenu>, <CommandK>
│       │   └── domain/         # <ObraCard>, <FornecedorRow>, <PendenciaBadge>, <WhatsMessageRow>, <WhatsFeedLive>
│       ├── lib/
│       │   ├── supabase/       # client, server, middleware clients
│       │   ├── ai/             # OpenAI client + prompt templates
│       │   ├── pdf/            # geradores de relatório
│       │   ├── formatters/     # BRL, datas, telefone
│       │   └── constants.ts
│       ├── server-actions/     # createObra, updatePagamento, mergeFornecedor...
│       ├── styles/
│       │   ├── nogma-tokens.css  # verbatim
│       │   ├── globals.css       # tailwind layers + resets
│       │   └── theme-overrides.css
│       ├── public/fonts/       # Agency.otf, Raleway-*.ttf
│       ├── middleware.ts       # Supabase auth check + rate limiting
│       ├── tailwind.config.ts
│       ├── next.config.ts
│       └── package.json
│
├── packages/
│   ├── db/                     # tipos gerados via `supabase gen types` + query helpers
│   ├── ai/                     # prompts, schemas Zod, adapter OpenAI (reusable pelo n8n Function node)
│   └── shared/                 # tipos, enums, utils compartilhados
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml  # n8n + uazapi + worker + caddy
│   │   ├── caddy/Caddyfile
│   │   ├── worker/Dockerfile   # Node worker pra jobs longos (OCR fallback, reprocessamentos batch)
│   │   └── .env.example
│   └── n8n/
│       └── workflows/          # JSON exportado, versionado, com annotations
│           ├── 01-inbound-whatsapp.json
│           ├── 02-classify-payment.json
│           ├── 03-onedrive-sync.json
│           ├── 04-remind-nf-missing.json
│           └── 05-health-check.json
│
├── supabase/
│   ├── migrations/             # timestamp_nome.sql
│   ├── seed.sql                # categorias base, primeiro admin, primeira obra exemplo
│   └── functions/              # edge functions se necessário (ex: geração de token temporário para download)
│
├── docs/
│   ├── superpowers/
│   │   ├── specs/              # este arquivo mora aqui
│   │   └── plans/              # planos de implementação (próximo passo)
│   ├── operacao/
│   │   ├── runbook.md          # como reiniciar bot, ver logs, adicionar categoria
│   │   ├── troubleshooting.md
│   │   └── backup-restore.md
│   └── design-system/
│       └── uso-tokens-nogma.md
│
├── tests/
│   └── e2e/                    # Playwright
│       ├── auth.spec.ts
│       ├── obras-crud.spec.ts
│       ├── whatsapp-flow.spec.ts (mock UAZAPI)
│       └── pendentes.spec.ts
│
├── .github/workflows/
│   ├── ci.yml                  # lint + typecheck + test + build
│   ├── deploy-vps.yml          # ssh + docker compose pull + up
│   └── e2e.yml                 # playwright em PR
│
├── .env.example
├── .gitignore
├── biome.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

## 6. Modelo de dados (Supabase Postgres)

Todas as tabelas: `id UUID DEFAULT gen_random_uuid()`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ` (trigger), `deleted_at TIMESTAMPTZ NULL` (soft-delete). RLS habilitado em todas.

### 6.1 Núcleo

```sql
-- Perfil de usuário (1:1 com auth.users)
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('admin','gestor','financeiro','leitura')),
  telefone TEXT,
  avatar_url TEXT,
  tema_preferido TEXT DEFAULT 'black' CHECK (tema_preferido IN ('light','black','dark'))
);

-- Equipe autorizada a mandar comprovante via WhatsApp
CREATE TABLE autorizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone_whats TEXT UNIQUE NOT NULL,     -- formato E.164 +5551...
  papel_obra TEXT,                          -- "Mestre de obra", "Zelador", "Comprador"
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT UNIQUE NOT NULL,
  cor TEXT,                                 -- hex ex: '#E8A317'
  icone TEXT                                -- nome do ícone Lucide
);

CREATE TABLE obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cliente TEXT,
  tipo TEXT CHECK (tipo IN ('nova','reforma')),
  orcamento NUMERIC(12,2),
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','concluida','arquivada')),
  data_inicio DATE,
  data_prevista_fim DATE,
  endereco JSONB,                           -- {rua, num, bairro, cidade, uf, cep, lat, lng}
  apelidos TEXT[] DEFAULT '{}',             -- para matching do bot: {"obra do Marcelo", "prédio Getúlio"}
  onedrive_folder_id TEXT,                  -- id da pasta espelhada
  observacoes TEXT
);

CREATE INDEX idx_obras_status ON obras(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_obras_apelidos_gin ON obras USING GIN(apelidos);

CREATE TABLE fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  razao_social TEXT,
  documento TEXT,                           -- CNPJ ou CPF (armazena sem máscara)
  documento_tipo TEXT CHECK (documento_tipo IN ('cnpj','cpf')),
  categoria_id UUID REFERENCES categorias(id),
  telefone TEXT,
  email TEXT,
  origem TEXT DEFAULT 'manual' CHECK (origem IN ('manual','auto_detectado')),
  ativo BOOLEAN DEFAULT true
);

CREATE UNIQUE INDEX idx_fornecedores_doc_unique ON fornecedores(documento)
  WHERE documento IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE fornecedor_apelidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  apelido TEXT NOT NULL,
  criado_por_ia BOOLEAN DEFAULT false,
  vezes_visto INTEGER DEFAULT 1
);
CREATE INDEX idx_apelidos_fornecedor ON fornecedor_apelidos(fornecedor_id);
CREATE INDEX idx_apelidos_texto ON fornecedor_apelidos(lower(apelido));
```

### 6.2 Pagamentos e documentos

```sql
CREATE TABLE pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id),
  fornecedor_id UUID REFERENCES fornecedores(id),
  categoria_id UUID REFERENCES categorias(id),
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  data_pagamento DATE NOT NULL DEFAULT current_date,
  origem TEXT NOT NULL CHECK (origem IN ('whatsapp','manual','importado')),
  status_pagto TEXT DEFAULT 'confirmado' CHECK (status_pagto IN ('confirmado','aguardando','erro')),
  criado_por_user_id UUID REFERENCES profiles(user_id),
  criado_via_msg_id UUID,                   -- FK para mensagens_whats (fraca, deferrable)
  observacoes TEXT
);
CREATE INDEX idx_pagamentos_obra_data ON pagamentos(obra_id, data_pagamento DESC);
CREATE INDEX idx_pagamentos_fornecedor ON pagamentos(fornecedor_id);
CREATE INDEX idx_pagamentos_status ON pagamentos(status_pagto);

CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id UUID REFERENCES pagamentos(id) ON DELETE SET NULL,
  obra_id UUID REFERENCES obras(id),
  fornecedor_id UUID REFERENCES fornecedores(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('nota_fiscal','comprovante','contrato','outro')),
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho_bytes BIGINT,
  storage_path TEXT NOT NULL,               -- path no Supabase Storage
  onedrive_file_id TEXT,                    -- id do arquivo no OneDrive (após sync)
  numero_nf TEXT,
  chave_acesso_nf TEXT UNIQUE,              -- chave de 44 dígitos NFe
  hash_sha256 TEXT UNIQUE                   -- detecta upload duplicado
);
CREATE INDEX idx_documentos_pagamento ON documentos(pagamento_id);
CREATE INDEX idx_documentos_obra ON documentos(obra_id);
CREATE INDEX idx_documentos_fornecedor ON documentos(fornecedor_id);
```

### 6.3 Bot WhatsApp

```sql
CREATE TABLE mensagens_whats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_id_uazapi TEXT UNIQUE NOT NULL,       -- idempotência
  telefone_from TEXT NOT NULL,
  autorizado_id UUID REFERENCES autorizados(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('texto','imagem','pdf','audio')),
  texto_bruto TEXT,
  midia_storage_path TEXT,
  midia_mime TEXT,
  recebida_em TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'recebida'
    CHECK (status IN ('recebida','processando','classificada','confirmada','erro')),
  dados_extraidos JSONB,                    -- {obra_id, fornecedor_id, categoria_id, valor, descricao, num_nf}
  confianca_ia NUMERIC(4,3),                -- 0..1
  erro_msg TEXT,
  pagamento_id UUID REFERENCES pagamentos(id),
  documento_id UUID REFERENCES documentos(id),
  tentativas_reprocessamento INTEGER DEFAULT 0
);
CREATE INDEX idx_msgs_status ON mensagens_whats(status);
CREATE INDEX idx_msgs_recebida_em ON mensagens_whats(recebida_em DESC);

CREATE TABLE confirmacoes_pendentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id UUID NOT NULL REFERENCES mensagens_whats(id) ON DELETE CASCADE,
  pergunta_enviada TEXT NOT NULL,
  msg_id_pergunta_uazapi TEXT,
  respondida_em TIMESTAMPTZ,
  resposta_bruta TEXT,
  resolvida BOOLEAN DEFAULT false
);
```

### 6.4 Suporte, auditoria, cron

```sql
CREATE TABLE notificacoes_email (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo TEXT NOT NULL,
  enviada_em TIMESTAMPTZ,
  erro TEXT,
  contexto JSONB                             -- {tipo, entidade_id}
);

CREATE TABLE lembretes_agendados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,                        -- 'nf_pendente', 'comprovante_pendente', ...
  alvo_id UUID,                              -- referência lógica
  cron_expressao TEXT NOT NULL,
  ultima_execucao TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(user_id),
  entidade TEXT NOT NULL,                    -- 'obras', 'pagamentos', etc
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL,                        -- 'insert', 'update', 'delete'
  diff JSONB,                                -- {campos_antes, campos_depois}
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_entidade ON audit_log(entidade, entidade_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
```

### 6.5 Views materializadas (Painel)

```sql
CREATE MATERIALIZED VIEW mv_gasto_por_obra AS
  SELECT o.id AS obra_id, o.nome, o.orcamento,
         COALESCE(SUM(p.valor), 0) AS gasto_total,
         COALESCE(SUM(p.valor), 0) / NULLIF(o.orcamento, 0) AS pct_orcamento
  FROM obras o
  LEFT JOIN pagamentos p ON p.obra_id = o.id AND p.deleted_at IS NULL AND p.status_pagto = 'confirmado'
  WHERE o.deleted_at IS NULL
  GROUP BY o.id, o.nome, o.orcamento;

CREATE MATERIALIZED VIEW mv_gasto_por_categoria AS
  SELECT c.id, c.nome, c.cor, COALESCE(SUM(p.valor), 0) AS total
  FROM categorias c
  LEFT JOIN pagamentos p ON p.categoria_id = c.id AND p.deleted_at IS NULL AND p.status_pagto = 'confirmado'
  GROUP BY c.id, c.nome, c.cor;

CREATE MATERIALIZED VIEW mv_evolucao_mensal AS
  SELECT date_trunc('month', data_pagamento) AS mes,
         SUM(valor) AS total
  FROM pagamentos
  WHERE deleted_at IS NULL AND status_pagto = 'confirmado'
    AND data_pagamento >= current_date - interval '12 months'
  GROUP BY mes ORDER BY mes;

-- Refresh via pg_cron a cada 5min
SELECT cron.schedule('refresh_mvs', '*/5 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_gasto_por_obra;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_gasto_por_categoria;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_evolucao_mensal;
$$);
```

### 6.6 RLS (políticas)

Como é single-tenant, política simplificada por papel:

```sql
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY obras_select_autenticado ON obras FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY obras_insert_gestor_admin ON obras FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()
            AND papel IN ('admin','gestor'))
  );

CREATE POLICY obras_update_gestor_admin ON obras FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()
                 AND papel IN ('admin','gestor')));

CREATE POLICY obras_delete_admin ON obras FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()
                 AND papel = 'admin'));
```

Padrão idêntico replicado para todas as tabelas de negócio.

## 7. Módulos e telas

### 7.1 Layout global (`app/(app)/layout.tsx`)

- Sidebar fixa à esquerda (240px desktop, drawer mobile)
  - Logo Nogma (variante por tema)
  - Navegação: Painel · Obras · Documentos · WhatsApp · Pendentes · Fornecedores
  - Separador
  - Configurações · Relatórios
  - Rodapé: `<UserMenu>` com avatar iniciais + nome + papel
- Topbar (56px)
  - Breadcrumb / título da página
  - `<CommandK>` (Cmd+K palette) — busca global multi-entidade
  - `<Bell>` (notificações in-app)
  - `<ThemeToggle>` (3 opções A/B/C)
  - `<UserMenu>` collapsed

### 7.2 Detalhamento por tela

Cada tela lista aqui componentes-chave e queries. Layouts fiéis aos screenshots analisados.

#### `/painel`
- `<AlertaTopo>` (laranja) — resumo de pendências (só se > 0)
- Grid 1x4 de `<KpiCard>`: Obras Ativas · Gasto no Mês · Total Acumulado · Pendentes NF
- Grid 2x2 de painéis:
  - `<BarChartHorizontal data={mv_gasto_por_obra}>` — Gastos por Obra
  - `<AreaChart data={mv_evolucao_mensal}>` — Evolução Mensal
  - `<DonutChart data={mv_gasto_por_categoria}>` — Distribuição por Categoria
  - `<WhatsFeedLive>` — feed realtime das últimas 20 msgs (Supabase Realtime subscription)

#### `/obras`
- Header: título + subtítulo (contador) + `<Button primary>+ Nova Obra</Button>`
- Row de 3 `<KpiCard>`: Obras Ativas · Total Investido · Total Obras
- `<DataTable>` com colunas: Obra · Cliente · Tipo · Orçamento · Gasto · % (barra inline) · Status · Início · Ações
- Row expandível abre drawer com Editar/Excluir/Duplicar
- Ações em massa: seleção → Arquivar / Exportar CSV

#### `/obras/[id]`
- Header com nome + status + botão Editar
- 4 `<KpiCard>`: Orçamento · Gasto · Saldo · Dias em Obra
- Tabs:
  - **Gastos** — `<DataTable>` de pagamentos dessa obra (com filtros por categoria/período)
  - **Documentos** — grid de docs anexos
  - **Timeline** — audit log filtrado
  - **Pendências** — subset das pendências dessa obra

#### `/fornecedores`
- Header + KPIs (Fornecedores · Auto-detectados · Total Pago)
- Toolbar: `<Button secondary>Mesclar</Button>` (dedup CNPJ) · `<Button primary>+ Novo Fornecedor</Button>`
- `<DataTable>` colunas: Nome/Razão Social · Doc · Categoria · Contato · Total Pago · # Pagtos · Obras (top 3 + count) · Origem (badge) · Ações
- Detalhe (drawer): abas Info · Apelidos (com opção de adicionar/remover) · Últimos Pagamentos

#### `/pendentes`
- 3 `<KpiCard>` + tabs correspondentes: Sem NF (N) · Sem Comprovante (N) · Aguardando (N)
- Filtro dropdown "Todas as obras"
- `<Button primary>Enviar Lembrete WhatsApp</Button>` — abre modal escolhendo destinatário (autorizados vinculados) e enviando via UAZAPI
- `<DataTable>` com badge "Dias Pendente" colorido (verde<7 · amarelo 7-15 · vermelho >15)

#### `/documentos`
- 4 `<KpiCard>`: NFs · Comprovantes · Fornecedores · Total Docs
- Toggle: `<TabsSegmented>` "Por Fornecedor" / "Por Obra"
- Busca + dropdown de tipo
- `<Accordion>` agrupado com header (nome + contadores + total R$) e conteúdo (lista de docs com preview em modal)
- Ações por linha: baixar · abrir OneDrive · desvincular

#### `/whatsapp`
- 4 `<KpiCard>`: Processadas · Na Fila · Taxa de Acerto · Erros
- Tabs de status: Todas · Confirmadas · Processando · Classificadas · Na Fila · Erros
- `<DataTable>` colunas: Tipo (ícone) · Mensagem (preview) · Dados Extraídos (chips) · Quando · Estado (badge colorido) · Ações
- Row expandível mostra: preview da mídia · JSON completo extraído · botão Reprocessar · botão Confirmar Manual · edição inline dos campos extraídos

#### `/config`
- Tabs:
  - **Perfil** (nome, avatar, senha)
  - **Aparência** — toggle tema A/B/C (persiste em profile + localStorage)
  - **Equipe autorizada** — CRUD de `autorizados`
  - **Categorias** — CRUD de `categorias`
  - **Integrações** — status UAZAPI · status n8n · status OneDrive · reconectar
  - **Usuários** (só admin) — CRUD de `profiles`

#### `/relatorios`
- Cards de relatório: "Fechamento Mensal" · "Consolidado por Obra" · "Ranking de Fornecedores" · "Estouros de Orçamento"
- Cada card abre modal com filtros → Gera PDF ou CSV via server action
- Histórico de gerações abaixo

### 7.3 Componentes reutilizáveis chave

| Componente | Props principais | Notas |
|---|---|---|
| `<KpiCard>` | label, valor, delta, sub, icon | Uppercase label, valor em Agency para tema Black |
| `<DataTable>` | columns, data, pagination, filters, densityToggle, columnResize | Wrapper TanStack v8, sticky header, virtualização em > 100 linhas |
| `<BarChartHorizontal>`, `<AreaChart>`, `<DonutChart>` | data, height | Recharts com theme observer para trocar cores no toggle |
| `<StatusBadge>` | status, size | Cores semânticas por status |
| `<WhatsFeedLive>` | limit | Subscribe Realtime, gera item por evento |
| `<CommandK>` | (global) | Busca fuzzy multi-entidade (obras/fornecedores/pagamentos) |
| `<ThemeToggle>` | (global) | 3 estados, ícone sol/luz/petroleum |
| `<Money>` | value | Formata BRL corretamente |
| `<Cnpj>` / `<Cpf>` | value | Formata com máscara |

## 8. Fluxo end-to-end do bot WhatsApp

### 8.1 Diagrama

```
[Zelador Cavalcanti]
      │ envia foto de comprovante
      ▼
[WhatsApp da construtora]
      │
      ▼
[UAZAPI (VPS)] ──webhook──▶ [n8n workflow "inbound"]
                              │
                              ├─ Verifica autorizados.telefone_whats
                              │  se não achou: responde "não autorizado" + sai
                              │
                              ├─ Baixa mídia → upload Supabase Storage
                              │
                              ├─ INSERT mensagens_whats (status=recebida)
                              │
                              └─ Dispara workflow "classify"

[n8n workflow "classify"]
      │
      ├─ UPDATE status=processando (via Supabase JS)
      │
      ├─ Carrega contexto:
      │    - SELECT id, nome, apelidos FROM obras WHERE status='ativa'
      │    - SELECT f.id, f.nome, array_agg(a.apelido) FROM fornecedores f
      │      LEFT JOIN fornecedor_apelidos a ON a.fornecedor_id=f.id
      │      WHERE f.ativo GROUP BY f.id, f.nome
      │    - SELECT id, nome FROM categorias
      │
      ├─ Chama OpenAI GPT-4o-mini (vision) com prompt estruturado:
      │    SYSTEM: "Você extrai gastos de comprovantes de obra..."
      │    USER: [imagem] + texto do zelador + lista contextual
      │    Response format: JSON Schema Zod {
      │      obra_id?: string, obra_confidence: number,
      │      fornecedor_id?: string, fornecedor_confidence: number,
      │      categoria_id?: string, valor: number,
      │      descricao: string, numero_nf?: string,
      │      confidence_overall: number
      │    }
      │
      ├─ Se todos IDs válidos e confidence_overall >= 0.85:
      │    - INSERT pagamentos + documentos
      │    - UPDATE mensagens_whats SET status=confirmada, pagamento_id, documento_id
      │    - Responde "✅ Registrado: FerroForte, Garibaldi, R$2.350"
      │
      ├─ Se algum ID ausente ou confidence baixa:
      │    - INSERT confirmacoes_pendentes
      │    - Envia pergunta: "Achei: [dados]. Confirma? [S/N] ou responde 'não, era X'"
      │    - UPDATE status=classificada (aguardando)
      │
      └─ Se OpenAI erro / IDs inválidos:
           - UPDATE status=erro + erro_msg
           - Notifica admin via email
           - Cron a cada 2min reprocessa até 3 tentativas

[Resposta do zelador]
      │
      ▼
[UAZAPI] ──▶ [n8n workflow "confirmation"]
              │
              ├─ Match confirmacoes_pendentes ativa
              ├─ Parse resposta ("sim" / "não, era X" / correção livre)
              ├─ Se sim: promove para confirmada
              ├─ Se correção: chama IA de novo com correção como contexto
              └─ Se aprender fornecedor novo: adiciona apelido em fornecedor_apelidos
```

### 8.2 Auto-aprendizado

- Se apelido novo aparece 3+ vezes e é confirmado por humano, promove a `fornecedor_apelidos.criado_por_ia=true`.
- Se fornecedor novo (CNPJ inédito) é confirmado, cria `fornecedores.origem='auto_detectado'`.
- Se obra é referenciada por apelido não cadastrado, sugere adicionar em `obras.apelidos` (notificação in-app).

### 8.3 Prompts e schemas

- Prompts versionados em `packages/ai/prompts/`, com testes Vitest usando fixtures reais.
- Schema Zod em `packages/ai/schemas.ts` — mesmo schema alimenta a chamada OpenAI (structured outputs) e valida a resposta.
- Sistema de "prompt eval": planilha CSV com 50+ mensagens reais + resposta esperada, roda em CI, mede acurácia — se cair abaixo de 85%, quebra o build.

### 8.4 Fallback e resiliência

- **UAZAPI offline:** n8n health-check a cada 1min; se falhar 3x, dispara alerta email + WhatsApp para admin (via número de backup).
- **OpenAI offline:** mensagens ficam em `status=recebida`; cron reprocessa quando voltar.
- **n8n offline:** UAZAPI acumula webhooks; ao voltar, n8n reprocessa em ordem (idempotência garantida por `msg_id_uazapi UNIQUE`).
- **Supabase offline:** front mostra banner de degradação; UAZAPI/n8n retêm mensagens em fila (Redis leve no VPS).

## 9. Segurança e permissões

- **Auth:** Supabase Auth com email+senha (primeira senha via magic link), refresh cookie HttpOnly.
- **RLS:** políticas por papel em todas as tabelas de negócio (§6.6).
- **Webhooks:** UAZAPI → Next.js `/api/webhooks/uazapi` protegido com header `x-signature` HMAC-SHA256 + secret em `.env`. n8n → callbacks idem.
- **Uploads:**
  - Validação MIME + magic bytes (não confiar em `Content-Type`)
  - Limite 20MB por arquivo
  - Dedup por SHA256 antes de gravar
  - Extensões bloqueadas: `.exe`, `.bat`, `.js`, `.html`, etc
  - Bucket privado, URLs de download geradas via `signed URLs` de 5min
- **Rate limiting:** middleware Next.js + Upstash Redis. Regras:
  - `/api/webhooks/*`: 100 req/min por IP
  - `/api/exports/*`: 10 req/min por user
  - Login: 5 tentativas / 15min por email
- **Auditoria:** trigger Postgres `AFTER UPDATE OR DELETE` em tabelas críticas grava `audit_log` com `diff JSONB`.
- **Secrets:** todos em Vercel env (front/API) e `.env` no VPS (n8n/uazapi). `.env.example` com placeholders versionado. Nunca committar `.env`.
- **CORS:** restringido ao domínio da Vercel + `localhost:3000` em dev.
- **CSP:** cabeçalhos restritivos, `report-uri` para monitorar.
- **HTTPS:** Vercel auto TLS. VPS via Caddy auto TLS (Let's Encrypt).

## 10. Testes, DX e observabilidade

### 10.1 Testes

- **Vitest** para: queries Supabase, formatters (BRL, CNPJ, telefone), prompts IA (com fixtures), lógica de dedup.
- **Playwright** e2e para golden path:
  - Login → criar obra → adicionar pagamento manual → ver em Pendentes → anexar NF → sai de Pendentes.
  - Simular webhook UAZAPI com fixture de imagem → verificar aparece em WhatsApp/Painel → confirmar → gera pagamento.
- Coverage-alvo: 70% unit, golden paths cobertos em e2e.

### 10.2 CI (GitHub Actions)

- `ci.yml`: lint (Biome), typecheck (`tsc`), Vitest, build. Roda em toda PR.
- `e2e.yml`: Playwright em headless com Supabase local (via CLI). Roda em PR para `main`.
- `deploy-vps.yml`: em push para `main`, faz `ssh vps 'cd /opt/nogma && docker compose pull && docker compose up -d'`.
- Vercel: preview deploy automático por PR + auto-deploy em merge.

### 10.3 DX

- **Biome** para lint+format (10× mais rápido que ESLint+Prettier).
- **Husky + lint-staged** só em pre-push (não pre-commit — atrito).
- **VS Code workspace settings** committados: formatOnSave, Biome como default.
- **`pnpm dev`** sobe: Next dev, `supabase start` (local Postgres+Auth+Storage), n8n em Docker local, UAZAPI mock (webhook simulator).
- **Storybook** para componentes de UI (opcional MVP, mas planejado).

### 10.4 Observabilidade

- **Front/API:** Vercel logs (30 dias no Pro).
- **Bot/n8n/UAZAPI:** Docker logs + Loki opcional depois.
- **Postgres:** Supabase Studio + query performance dashboard.
- **Uptime:** health check da UAZAPI a cada 1min por n8n workflow → alerta email se cair.
- **Better Stack** free tier (opcional, 10GB) para agregar logs.
- **Sentry** free tier para erros front/back.

## 11. Roadmap fásico

Baseado no `fases-construcao.md`, mas comprimido e re-priorizado para o produto real. Cada fase deve terminar deployável.

| # | Fase | Duração alvo | Entregável | Termina quando |
|---|---|---|---|---|
| 0 | Kickoff & repo | 1 dia | Monorepo, GitHub, Vercel conectado, Supabase criado, VPS StayCloud provisionado | `pnpm dev` roda; preview Vercel abre |
| 1 | Design system | 2 dias | tokens Nogma copiados, Tailwind configurado, 3 temas via `data-theme`, shadcn instalado, layout global (Sidebar + Topbar + ThemeToggle) | Página em branco renderiza com identidade Nogma em todos os 3 temas |
| 2 | Auth & perfis | 1 dia | Supabase Auth, login/logout, tabela `profiles`, papéis, middleware protegido | Não-autenticado é redirecionado; papel controla acesso |
| 3 | Schema base | 2 dias | Migrations 6.1-6.4, seed inicial, tipos TS gerados, RLS habilitado | `supabase db push` limpo, tipos disponíveis em `packages/db` |
| 4 | Obras (CRUD) | 2 dias | `/obras`, `/obras/nova`, `/obras/[id]` funcionais | Playwright golden path passa |
| 5 | Fornecedores + Categorias | 2 dias | `/fornecedores` + `/config/categorias` + `<MergeFornecedor>` | CRUD + dedup por CNPJ funciona |
| 6 | Pagamentos manuais | 1 dia | Criar pagamento avulso, listar em `/obras/[id]` | Aparece em KPIs |
| 7 | Documentos + upload | 2 dias | `/documentos`, upload, dedup por hash, preview em modal | Upload funciona, agrupamento OK |
| 8 | Painel & métricas | 2 dias | Views materializadas, gráficos Recharts, feed live | Números batem com dados |
| 9 | Pendências | 1 dia | `/pendentes` com 3 abas + botão lembrete (envio manual sem UAZAPI ainda) | Aparece o que deve aparecer |
| 10 | VPS + Docker + Caddy | 2 dias | docker-compose com n8n + placeholder UAZAPI + Caddy TLS | n8n abre em `n8n.nogma-cavalcanti.com.br` |
| 11 | UAZAPI + webhook inbound | 2 dias | Número conectado, webhook fluindo, `mensagens_whats` grava eventos | Mensagem real do WhatsApp aparece na tela WhatsApp |
| 12 | IA classificação | 3 dias | Prompt + schema Zod + workflow n8n "classify" + OpenAI | Foto de comprovante vira pagamento com >80% acurácia em fixtures |
| 13 | Confirmação interativa | 2 dias | `confirmacoes_pendentes`, workflow "confirmation", auto-aprendizado apelidos | Fluxo completo end-to-end funciona |
| 14 | Relatórios PDF/CSV | 2 dias | `/relatorios` com 4 relatórios base | PDFs geram, download funciona |
| 15 | Notificações email | 1 dia | Resend/SES, templates, notificar aprovações e estouro | Email chega |
| 16 | Integração OneDrive | 3 dias | OAuth Microsoft Graph, workflow n8n sync, estruturação de pastas por obra | Novo documento aparece na pasta correta do OneDrive |
| 17 | Auditoria + Config avançada | 2 dias | Triggers audit_log, tela de auditoria, config completa | Todas as alterações são rastreáveis |
| 18 | Observabilidade + hardening | 2 dias | Sentry, health checks, rate limiting, secrets audit | Alertas funcionam, secrets scan limpo |
| 19 | Testes e2e completos + docs | 2 dias | Playwright cobrindo todos os fluxos, runbook, troubleshooting | CI verde, docs completas |
| 20 | Beta com Cavalcanti + ajustes | 5 dias | Cavalcanti usando em produção, ajustes de feedback | Cavalcanti confirma que substitui o processo atual |

**Total estimado:** ~40 dias úteis (~8 semanas) para MVP completo em produção, single-desenvolvedor. Com paralelização (front + bot em paralelo) pode ir para ~5-6 semanas.

## 12. Riscos e mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| UAZAPI banida pelo WhatsApp | Alto (bot para) | Média | Fallback manual pela tela WhatsApp; ter Meta Cloud API como plano B pré-configurado |
| OpenAI GPT-4o-mini erra classificação com frequência | Médio (fricção) | Baixa | Prompt eval no CI, confidence threshold ajustável, fallback humano na fila |
| Cavalcanti não usa (não muda hábito) | Alto (projeto morre) | Média | Design espelhado no fluxo atual (WhatsApp), zero fricção; onboarding assistido |
| Custo OpenAI explode | Baixo | Baixa | Cache de contexto (obras/fornecedores injetados uma vez por dia), rate limit por autorizado |
| Supabase cai | Alto (front cai) | Muito baixa | 99.9% SLA; backups diários; plano de restauração documentado |
| VPS StayCloud cai | Médio (bot cai) | Baixa | Docker Compose reprodutível em 15min; snapshot semanal; Railway como fallback |
| Vazamento de dados fiscais (LGPD) | Muito alto | Muito baixa | RLS + auth obrigatório + audit log + HTTPS + secrets em vault + política de senhas |

## 13. Extras V2 (fora deste MVP)

- App mobile (React Native + Expo) — reusa `packages/db` e `packages/ai`
- Multi-tenant (Nogma vender pra outras construtoras) — inclusão de `organization_id` retroativa via migration
- Reconciliação bancária (OFX / Open Finance) — módulo novo `financeiro`
- Assinatura eletrônica de contratos (D4Sign / Clicksign)
- Dashboard executivo com previsão de fluxo de caixa (ML)
- Integração com ERPs (Sienge, Sofis) via importação
- Módulo de compras (cotação → pedido → recebimento)

## 14. Referências

- Design system Nogma: `https://nogmacorp.com.br/assets/css/nogma-tokens.css` (cópia em `.design-system/nogma-tokens.css`)
- Screenshots analisados: `arquitetura.md`, `base-de-estrutura.md` (mesmos conteúdos, análise de 6 telas do CRM protótipo)
- Kickoff planilha: `informacoes.md`
- Roadmap origem: `fases-construcao.md`
- shadcn/ui: `https://ui.shadcn.com`
- TanStack Table: `https://tanstack.com/table`
- UAZAPI: `https://uazapi.com`
- Supabase: `https://supabase.com/docs`
- n8n: `https://docs.n8n.io`

---

## Anexo A — Variáveis de ambiente (`.env.example`)

```dotenv
# ---- App
NEXT_PUBLIC_APP_URL=https://crm.cavalcanti.com.br
NEXT_PUBLIC_APP_NAME="Gestor de Obras · Nogma"

# ---- Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # server-side only

# ---- OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# ---- UAZAPI (VPS)
UAZAPI_BASE_URL=
UAZAPI_TOKEN=
UAZAPI_INSTANCE=

# ---- n8n (VPS)
N8N_WEBHOOK_URL=
N8N_HMAC_SECRET=

# ---- Webhooks incoming
WEBHOOK_HMAC_SECRET=

# ---- OneDrive (Microsoft Graph)
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
ONEDRIVE_ROOT_FOLDER=

# ---- Email (Resend)
RESEND_API_KEY=
EMAIL_FROM="Nogma <noreply@nogmacorp.com.br>"

# ---- Rate limit (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ---- Observability
SENTRY_DSN=
BETTER_STACK_SOURCE_TOKEN=
```

---

*Fim do design spec. Próximo passo: gerar plano de implementação via `superpowers:writing-plans`.*
