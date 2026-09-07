# Fase 11 — Auditoria

Estado: **shipada em prod** (LGPD compliance ready).

Captura automática de toda INSERT/UPDATE/DELETE em 6 tabelas de negócio
via Postgres triggers → `audit_log` → viewer `/auditoria` para
admin+gestor.

## Cobertura

Auditadas (trigger `trg_audit_<table>` em cada):
- `obras`
- `fornecedores`
- `pagamentos`
- `documentos`
- `categorias`
- `autorizados` (whatsapp)

Não auditadas (por design):
- `profiles` — managed via Supabase Auth trigger, sem CRUD manual
- `confirmacoes_pendentes` — system-generated pelo IA classifier
- `mensagens_whats` — inbound provider, tem próprio status tracking
- `notificacoes_email` — system-generated pelo email service
- `fornecedor_apelidos` — child table, auto (auditado indiretamente via fornecedor)
- `audit_log` — não auditamos a auditoria (evita recursão)
- `lembretes_agendados` — cron-managed
- `authn/auth.*` — Supabase-managed

## Fluxo técnico

```
User faz UPDATE via server action
  → RLS check
  → Postgres executa UPDATE
  → Trigger AFTER UPDATE dispara audit_log_trigger()
  → auth.uid() → user_id (JWT do Supabase-ssr)
  → jsonb_object_agg dos campos com valor DISTINCT FROM
  → INSERT em audit_log (SECURITY DEFINER, bypass RLS de escrita)
  → Log fica visível em /auditoria pra admin+gestor
```

**Coisas importantes:**
- Se `updated_at` é o único campo mudado, o log é **pulado** (evita ruído
  de re-saves sem alteração real).
- Diffs são **só campos que mudaram** (não full row) — reduz storage e
  facilita leitura.
- INSERT tem só `{ after: ... }`; DELETE tem só `{ before: ... }`.
- `updated_at` é sempre excluído dos diffs (auto-changing via trigger).
- Se operação vem via `service_role` (cron, webhook, admin scripts):
  `auth.uid()` retorna NULL → `user_id: null` no log → UI mostra "Sistema".

## RLS

Antes: só `admin` via `audit_admin_select`.
Depois (Fase 11): `admin+gestor` via `audit_admin_gestor_select`.

Financeiro/Leitura não veem `/auditoria`. Sistema (service_role) ainda
escreve via SECURITY DEFINER na função trigger.

## UI `/auditoria`

**List page (`page.tsx`):**
- Filtros server-driven via URL params: entidade, acao, from, to, user_id
- Empty state: ícone ShieldCheck
- Cada row: timestamp mono, badge de ação (success/warning/danger), badge
  de entidade, user_nome + user_papel (ou "Sistema"), preview dos campos
  alterados, botão "Ver diff"

**Detail page (`[id]/page.tsx`):**
- Fetch via `getAuditLog(id)`, notFound() se null
- Card metadata + diff viewer:
  - INSERT: tabela Campo | Valor (do after)
  - DELETE: tabela Campo | Valor (do before, muted)
  - UPDATE: tabela 3-colunas Campo | Antes | Depois com ArrowRight,
    mudanças destacadas (strikethrough+opacity em Antes, verde em Depois)
- Valores complexos (JSONB, arrays): `<code>JSON.stringify(v, null, 2)</code>`

## Extensões futuras (Fase 11.x)

- **Retenção**: cron mensal deletando logs > 12 meses (ou export
  arquivado antes de deletar) — LGPD art. 16 (não guardar além do
  necessário)
- **Export para compliance**: `/auditoria` botão "Exportar CSV" — reusa
  o pattern da Fase 9 (CSV UTF-8 BOM)
- **Alertas por padrão**: cron detecta padrões suspeitos (ex: 10+
  DELETE em 1min pelo mesmo user) → dispara email pra admin via Fase 10
- **Trigger em profiles.papel change**: log crítico quando alguém
  altera papel de outro user (elevação de privilégio)
- **Full-text search em diff**: index GIN em audit_log.diff pra
  procurar "quem alterou o CNPJ para X"
- **Audit log rotation**: mover logs > 6 meses pra tabela cold storage
  (audit_log_archive) — reduz table bloat

## Testar

Autenticado como admin/gestor:
1. Abrir `/auditoria` — vê registros das últimas alterações
2. Filtrar por entidade "obras" → vê só mudanças de obra
3. Filtrar por ação "delete" → vê arquivamentos (soft-delete)
4. Clicar "Ver diff" em uma linha UPDATE → vê tabela before/after

Autenticado como financeiro/leitura:
- `/auditoria` retorna lista vazia (RLS filtra) — cuidado: se o item de
  menu aparecer no sidebar, o UX é ruim. Considere condicionar item no
  sidebar por papel.

## Retenção e LGPD

- `audit_log.created_at` tem index nativo (BIGSERIAL id + created_at).
- LGPD art. 16: dados devem ser deletados quando finalidade atingida.
- Recomendação: reter logs 24 meses (compatibiliza com prazo de
  fiscalização SPED contábil brasileiro).
- Configurar cron sweeper (padrão Fase 7.5) — arquivo:
  `apps/web/app/api/cron/rotate-audit-log/route.ts` (não implementado
  ainda; reusa CRON_SECRET existente).

## Performance

- Trigger AFTER — não bloqueia a operação principal.
- Diff diff-only reduz tamanho médio de row de ~2KB → ~200B.
- Volume esperado MVP Cavalcanti: ~500 mudanças/mês → ~100KB/mês —
  irrelevante em Postgres.
- Query `/auditoria` com filtros → usa index em `entidade` +
  `entidade_id` (idx_audit_entidade) + `user_id` (idx_audit_user).
  Ordenação por created_at usa index implícito do BIGSERIAL.

## Segurança

- Trigger em SECURITY DEFINER + `SET search_path = public` (evita
  ataque via search_path hijack).
- `auth.uid()` em EXCEPTION WHEN OTHERS retorna NULL — nunca throw
  no trigger (não quebra operação primária).
- RLS `audit_admin_gestor_select` na leitura — sem bypass.
- INSERT na audit_log via trigger é sempre pelo próprio Postgres —
  não expõe endpoint direto.
- Financeiro/leitura não podem ler audit_log, mas o item de menu ainda
  aparece pra eles (comportamento a corrigir em Fase 11.x com condicional
  no sidebar por papel).
