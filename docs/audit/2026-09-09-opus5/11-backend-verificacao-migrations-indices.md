# Auditoria Backend/DB — CRM Nogma-Cavalcanti (segunda passagem, migrations/índices)

> Segunda auditoria de back-end/DB rodada em 2026-09-09 (Sonnet 5) — a primeira (`04-backend-dados.md`,
> reconstrução completa do schema + 42 server actions) já tinha sido recuperada do crash do VS Code.
> Esta é complementar: foco em migrations, índices e integridade referencial que a primeira não detalhou.

**Escopo:** modelagem de dados, race conditions, RPCs Postgres, N+1, paginação, migrations, integridade referencial — `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA`
**Base lida antes de começar:** `docs/audit/2026-09-08-audit-backend.md` (19 server actions, 17 data/service files). Este relatório **não repete** achados já documentados lá e **verifica** os 3 fixes atômicos mencionados na tarefa.

---

## 1 — Resumo executivo

Verifiquei em código as 3 correções atômicas citadas — **todas confirmadas corretas e em produção**:

| Audit anterior | Migration | Status |
|---|---|---|
| BUG-01 merge sem transação | `20260908120000_merge_fornecedores_rpc.sql` | ✅ RPC `merge_fornecedores_atomic` com `FOR UPDATE` + rollback automático, chamada em `lib/services/merge-fornecedores.ts:53` |
| BUG-02 race em confirmarPendencia | `20260908100000_pagamentos_criado_via_msg_unique.sql` | ✅ unique index parcial + pre-check + catch `23505` em `app/(app)/pendentes/actions.ts:60-108` |
| BUG-04 counter race | `20260908110000_webhook_counter_rpc.sql` | ✅ RPC `increment_webhook_execution` (UPDATE atômico), chamada em `dispatch-webhook.ts:119-128` |
| BUG-05 PRNG fraco | (mesmo commit) | ✅ `randomBytes(32)` em `dispatch-webhook.ts:186` |
| BUG-03 raw error | (mesmo commit) | ✅ `apelido-actions.ts` usa `mapDbErrorWithContext`/`mapDbError` |

Indo além do que já foi auditado, esta passagem — focada em **schema, índices, RPCs e migrations** (área pouco coberta pela auditoria de 09-08, que era orientada a server actions/services) — encontrou **17 achados novos**, dos quais destaco 4 como prioritários: **ausência total de paginação nas 4 listagens principais**, **`confirmacoes_pendentes` sem nenhum índice** (impacta o hot-path do classificador de WhatsApp), **estado "arquivado" duplicado e dessincronizável** em `obras`/`fornecedores`, e **migrations não-idempotentes** rodadas por um script que não rastreia o que já foi aplicado.

Nenhum arquivo foi alterado (auditoria read-only).

---

## 2 — Findings por severidade

### 🔴 CRÍTICO

Nenhum novo — os 3 problemas de race condition originalmente críticos já foram corrigidos (ver seção 1).

---

### 🟠 ALTO

#### F-01 — `confirmacoes_pendentes`: zero índices além da PK, em tabela no hot-path do classificador

**Migration:** `supabase/migrations/20260903100300_pagamentos_documentos_mensagens.sql:84-93`
**Uso:** `lib/data/pendentes.ts:42-60` (`WHERE resolvida = false ORDER BY created_at DESC`, sem `.limit()`) e `lib/services/classify-and-persist.ts:152-155` (`SELECT count(*) ... WHERE resolvida = false`, executado a **cada mensagem WhatsApp classificada**).

Nenhum índice existe em `resolvida`, `created_at` ou `mensagem_id`. Toda carga da tela `/pendentes` e toda mensagem recebida via webhook UAZAPI força um seq scan + sort nessa tabela.

**Fix:**
```sql
CREATE INDEX idx_confirmacoes_pendentes_resolvida
  ON confirmacoes_pendentes(resolvida, created_at DESC)
  WHERE resolvida = false;
CREATE INDEX idx_confirmacoes_pendentes_mensagem
  ON confirmacoes_pendentes(mensagem_id);
```

#### F-02 — Paginação inexistente nas 4 listagens principais (obras, fornecedores, pagamentos, documentos)

**Arquivos:** `lib/data/obras.ts:14-36`, `lib/data/fornecedores.ts:16-43`, `lib/data/pagamentos.ts:21-53`, `lib/data/documentos.ts:18-43`

Nenhuma das 4 funções `list*` tem `.limit()` ou `.range()` — todas trazem o resultado filtrado **inteiro** para a Server Component em cada page load. Confirmado via grep: zero ocorrências de `.limit(`/`.range(` nesses 4 arquivos. Isso vai além do QUALITY-07/08 já documentado (que cobria só agregados do painel) — aqui é a listagem CRUD principal.

**Fix (cursor-based, recomendado sobre offset por causa dos filtros + soft-delete):**
```ts
export async function listPagamentos(
  filters: ListPagamentosFilters = {},
  page: { limit?: number; cursor?: string } = {},
): Promise<{ items: Pagamento[]; nextCursor: string | null }> {
  const limit = page.limit ?? 50;
  let query = supabase.from('pagamentos').select('*')
    .order('data_pagamento', { ascending: false })
    .order('id', { ascending: false }) // desempate — cursor estável
    .limit(limit + 1);
  if (page.cursor) query = query.lt('id', page.cursor); // requer chave composta estável
  // ...
}
```

#### F-03 — Unique constraint global (não-parcial) em `categorias.nome` e `autorizados.telefone_whats` conflita com padrão de soft-delete

**Migration:** `supabase/migrations/20260903100100_profiles_autorizados_categorias.sql:33,45`

`fornecedores.documento` e `documentos.chave_acesso_nf`/`hash_sha256` corretamente usam unique **parcial** `WHERE deleted_at IS NULL` (mesma migration de obras/fornecedores, linhas 38-39). `categorias.nome UNIQUE NOT NULL` e `autorizados.telefone_whats UNIQUE NOT NULL` são constraints de coluna **globais** — uma vez arquivada (soft-delete via `deleted_at`), o nome/telefone fica bloqueado para sempre, mesmo que a linha esteja "morta" para o app.

**Fix:**
```sql
ALTER TABLE categorias DROP CONSTRAINT categorias_nome_key;
CREATE UNIQUE INDEX idx_categorias_nome_unique ON categorias(nome) WHERE deleted_at IS NULL;

ALTER TABLE autorizados DROP CONSTRAINT autorizados_telefone_whats_key;
CREATE UNIQUE INDEX idx_autorizados_telefone_unique ON autorizados(telefone_whats) WHERE deleted_at IS NULL;
```

#### F-04 — Estado "arquivado" duplicado e sem sincronização garantida (`obras.status`/`deleted_at`, `fornecedores.ativo`/`deleted_at`)

**Schema:** `obras` tem `status obra_status` (inclui `'arquivada'`) **e** `deleted_at`; `fornecedores` tem `ativo BOOLEAN` **e** `deleted_at`.
**Actions dedicadas** (`app/(app)/obras/actions.ts:102-116` `archiveObra`, `app/(app)/fornecedores/actions.ts:119,135`) setam os dois campos juntos corretamente.
**Porém** as actions genéricas de edição aceitam os mesmos campos soltos: `ObraUpdateSchema` = `ObraCreateSchema.partial()` (`lib/schemas/obra.ts:54`) inclui `status`, e `updateObra` (`obras/actions.ts:60-95`) grava `status` isolado sem tocar `deleted_at`; o mesmo padrão existe em `updateFornecedor` (`fornecedores/actions.ts:93`) para `ativo`.

Resultado possível: uma obra com `status='arquivada'` mas `deleted_at IS NULL` continua aparecendo na listagem padrão ativa (`listObras` filtra por `deleted_at IS NULL`, não por `status`), mostrando rótulo "arquivada" numa lista que deveria conter só ativas — ou o inverso. Nenhum CHECK/trigger garante consistência entre os dois campos.

**Fix recomendado:** trigger de sincronização, ou eliminar a redundância tornando `deleted_at` a única fonte de verdade e derivando "arquivada"/`ativo` como coluna computada:
```sql
CREATE OR REPLACE FUNCTION sync_obra_archived_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'arquivada' AND NEW.deleted_at IS NULL THEN
    NEW.deleted_at := now();
  ELSIF NEW.status <> 'arquivada' AND OLD.status = 'arquivada' THEN
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_obras_sync_archived BEFORE UPDATE ON obras
  FOR EACH ROW EXECUTE FUNCTION sync_obra_archived_state();
-- análogo pra fornecedores.ativo
```

#### F-05 — Migrations não são idempotentes; script de deploy não rastreia o que já foi aplicado

**Arquivo:** `scripts/apply-migrations-staging.mjs:43-70`

O script itera **todos** os `.sql` de `supabase/migrations/` em ordem e faz `POST` de cada um contra o endpoint SQL admin da Supabase, **sem nenhuma tabela de controle** (diferente do `supabase db push`, que usa `supabase_migrations.schema_migrations`). Rodá-lo duas vezes contra o mesmo banco falha na primeira migration (`process.exit(2)` no primeiro erro HTTP) porque 14 dos 19 arquivos usam `CREATE TABLE`/`CREATE TYPE`/`CREATE POLICY`/`CREATE INDEX` **sem** `IF NOT EXISTS`/`DROP ... IF EXISTS` (todas as de `20260903*` + `20260907190000_webhooks_outbound.sql`). Só as migrations a partir de `20260907170000` adotaram consistentemente o padrão idempotente (`IF NOT EXISTS`, `DO $$...$$`, `DROP POLICY IF EXISTS`).

Comentário do próprio script (linha 15-17) afirma "idempotência checkable" — não é verdade para o conjunto completo hoje.

**Fix:** ou (a) adotar `supabase db push`/CLI como único caminho de deploy (que já rastreia o histórico), documentando `apply-migrations-staging.mjs` como fallback só-para-DB-vazio; ou (b) retrofit `IF NOT EXISTS` nos 14 arquivos legados; ou (c) fazer o script consultar `supabase_migrations.schema_migrations` antes de reenviar cada arquivo.

---

### 🟡 MÉDIO

#### F-06 — FK sem `ON DELETE` em `pagamentos.criado_por_user_id` e `documentos.criado_por_user_id`

**Migrations:** `20260903100300_pagamentos_documentos_mensagens.sql:37`, `20260907140000_documentos_criado_por.sql:7`

Ambas `REFERENCES profiles(user_id)` sem cláusula `ON DELETE` → default `NO ACTION`. O mesmo padrão em `webhooks_outbound.criado_por_user_id` (`20260907190000_webhooks_outbound.sql:27`) corretamente usa `ON DELETE SET NULL`. Hoje o app nunca chama `admin.deleteUser` (confirmado via grep em `lib/data/usuarios.ts`), então o risco só se materializa se um admin apagar um `auth.users` diretamente no Supabase Studio — o `CASCADE` de `profiles.user_id REFERENCES auth.users(id) ON DELETE CASCADE` vai falhar com violação de FK se esse usuário já criou algum pagamento/documento, abortando a exclusão.

**Fix:**
```sql
ALTER TABLE pagamentos DROP CONSTRAINT pagamentos_criado_por_user_id_fkey,
  ADD CONSTRAINT pagamentos_criado_por_user_id_fkey
    FOREIGN KEY (criado_por_user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE documentos DROP CONSTRAINT documentos_criado_por_user_id_fkey,
  ADD CONSTRAINT documentos_criado_por_user_id_fkey
    FOREIGN KEY (criado_por_user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
```

#### F-07 — CHECK constraints ausentes em colunas numéricas/score

**Migrations diversas.** `mensagens_whats.confianca_ia NUMERIC(4,3)` (score de IA, deveria ser 0..1) sem `CHECK`; `obras.orcamento NUMERIC(12,2)` sem `CHECK (>= 0)` no DB (só há validação Zod client-side em `lib/schemas/obra.ts:31` — gap de defesa em profundidade); `fornecedor_apelidos.vezes_visto INTEGER` sem `CHECK (>= 0)`; `documentos.tamanho_bytes BIGINT` sem `CHECK (>= 0)`.

**Fix:**
```sql
ALTER TABLE mensagens_whats ADD CONSTRAINT chk_confianca_ia CHECK (confianca_ia IS NULL OR confianca_ia BETWEEN 0 AND 1);
ALTER TABLE obras ADD CONSTRAINT chk_orcamento_nao_negativo CHECK (orcamento IS NULL OR orcamento >= 0);
ALTER TABLE fornecedor_apelidos ADD CONSTRAINT chk_vezes_visto CHECK (vezes_visto >= 0);
ALTER TABLE documentos ADD CONSTRAINT chk_tamanho_bytes CHECK (tamanho_bytes IS NULL OR tamanho_bytes >= 0);
```

#### F-08 — `webhooks_outbound.eventos TEXT[]` sem validação de valores permitidos

**Migration:** `20260907190000_webhooks_outbound.sql:13-15` (comentário lista 5 eventos válidos, mas a coluna é `TEXT[]` livre). `dispatch-webhook.ts:64` filtra com `.contains('eventos', [evento])` — um typo no cadastro (ex.: `pagamento_criado` em vez de `pagamento_created`) nunca dispara, e nada no schema acusa o erro.

**Fix:**
```sql
ALTER TABLE webhooks_outbound ADD CONSTRAINT chk_eventos_validos CHECK (
  eventos <@ ARRAY['pagamento_created','pagamento_updated','confirmacao_pendente_created',
                    'documento_created','obra_created','obra_archived','test']::TEXT[]
);
```

#### F-09 — `audit_log` e `notificacoes_email` sem índice em `created_at`, apesar de queries default ordenarem por ele com `LIMIT 200`

**Migration:** `20260903100400_audit_notif_lembretes.sql` — `audit_log` só tem `idx_audit_entidade`/`idx_audit_user`; `notificacoes_email` não tem nenhum índice.
**Uso:** `lib/data/auditoria.ts:59-69` (`ORDER BY created_at DESC LIMIT 200`, sem filtro na maioria dos acessos) e `lib/data/notificacoes.ts:108-124` (idem). Ambas fazem seq scan + sort completo da tabela a cada carga sem filtro.

**Fix:**
```sql
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_notificacoes_email_created_at ON notificacoes_email(created_at DESC);
```

#### F-10 — Busca `ILIKE '%...%'` sem índice de suporte (trigram)

**Arquivos:** `lib/data/obras.ts:29`, `fornecedores.ts:36`, `pagamentos.ts:46`, `documentos.ts:36` — todas usam `sanitizeSearchQuery` + `.or('col.ilike.%q%,...')`. Nenhuma migration cria `pg_trgm`/índice GIN trigram nessas colunas (`nome`, `cliente`, `razao_social`, `descricao`, `observacoes`, `nome_arquivo`, `numero_nf`). Combinado com F-02 (sem paginação), cada busca de texto é sequential scan completo, e vai piorar proporcionalmente ao volume.

**Fix:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_obras_nome_trgm ON obras USING GIN (nome gin_trgm_ops);
CREATE INDEX idx_fornecedores_nome_trgm ON fornecedores USING GIN (nome gin_trgm_ops);
-- repetir para razao_social, descricao, nome_arquivo conforme uso real
```

#### F-11 — `has_role()` (usado em quase toda policy de INSERT/UPDATE/DELETE) não é `STABLE`

**Migration:** `20260903100500_rls_policies.sql:17-23` — `CREATE OR REPLACE FUNCTION has_role(...) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$...$$;` sem marcação `STABLE` (default é `VOLATILE`). Essa função roda no `USING`/`WITH CHECK` de praticamente todas as 9 tabelas de negócio. Sem `STABLE`, o planner não pode assumir que o resultado é constante dentro da mesma instrução, o que penaliza operações em lote como `bulkArchiveObras`/`bulkArchiveFornecedores` (reavalia a subquery em `profiles` por linha, em vez de uma vez por statement).

**Fix:**
```sql
CREATE OR REPLACE FUNCTION has_role(roles papel_usuario[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND papel = ANY(roles));
$$;
```

#### F-12 — Sem índice nas colunas FK `mensagens_whats.autorizado_id`, `.pagamento_id`, `.documento_id`

**Migration:** `20260903100300_pagamentos_documentos_mensagens.sql:6,16-17,79-82`. Apenas `idx_msgs_status` e `idx_msgs_recebida_em` existem nessa tabela (compare com `documentos.pagamento_id`, que tem `idx_documentos_pagamento`). Baixo impacto hoje (poucas queries filtram por esses campos), mas relevante quando o `ON DELETE SET NULL` desses FKs dispara em volume (delete de um `autorizado`/`pagamento`/`documento` teria que localizar as linhas de `mensagens_whats` afetadas).

**Fix:**
```sql
CREATE INDEX idx_msgs_autorizado ON mensagens_whats(autorizado_id) WHERE autorizado_id IS NOT NULL;
CREATE INDEX idx_msgs_pagamento ON mensagens_whats(pagamento_id) WHERE pagamento_id IS NOT NULL;
```

---

### 🟢 BAIXO / INFO

#### F-13 — `confirmarPendencia`: updates finais sem checar `error` (silencioso)

**Arquivo:** `app/(app)/pendentes/actions.ts:127-141` — depois do insert de pagamento (cuja lógica de erro é cuidadosa, incluindo tratamento de `23505`), os dois `UPDATE`s seguintes (`mensagens_whats.status`, `confirmacoes_pendentes.resolvida`) não capturam/checam `error`. Não é race condition (idempotente por natureza — mesmos valores em re-tentativa), mas quebra o padrão de tratamento cuidadoso do resto da função; uma falha aqui deixaria o pagamento criado mas a mensagem presa em `status='processando'` sem log.

#### F-14 — `lembretes_agendados.alvo_id` é referência polimórfica sem FK/CHECK

**Migration:** `20260903100400_audit_notif_lembretes.sql:24-32`. `alvo_id UUID` livre, sem `tipo`→tabela mapeado por constraint. Baixa prioridade: confirmado via grep que a tabela **não é usada em nenhum lugar do código TypeScript** — feature ainda não implementada (Fase de lembretes citada em `docs/operacao/` mas não construída). Documentar a regra de integridade antes de implementar o consumidor.

#### F-15 — Migrations não têm rollback ("down")

Padrão aceitável para workflow append-only do Supabase, mas nenhuma migration documenta como desfazer (ex: `20260907180000_profiles_email_prefs_timezone.sql` é a única que comenta "Rollback trivial: DROP COLUMN"). Recomendo adotar esse comentário como convenção obrigatória em toda migration nova.

#### N+1 queries (item 5 do escopo) — **nenhum achado novo**

Revisei `lib/data/*.ts` e `lib/services/*.ts` por completo: todos os pontos de enriquecimento (obra→pagamentos→fornecedor/categoria, auditoria→profiles, mensagens→pagamento→obra, pendentes→obra/fornecedor) usam consistentemente o padrão `Set` de IDs únicos → 1 query `.in()` → `Map` de lookup. Confirma e reforça o veredito da auditoria de 09-08 — nenhuma regressão encontrada.

---

## 3 — Tabela de prioridades

| ID | Severidade | Local | Achado | Esforço |
|---|---|---|---|---|
| F-04 | 🟠 Alto | `obras.status`/`deleted_at`, `fornecedores.ativo`/`deleted_at` | Estado arquivado duplicado, dessincronizável via edição genérica | Médio (trigger) |
| F-02 | 🟠 Alto | `lib/data/{obras,fornecedores,pagamentos,documentos}.ts` | Zero paginação nas listagens principais | Alto (API + UI) |
| F-01 | 🟠 Alto | `confirmacoes_pendentes` | Sem índice em `resolvida`/`created_at`, hot-path do classificador | Baixo (1 migration) |
| F-03 | 🟠 Alto | `categorias.nome`, `autorizados.telefone_whats` | Unique global trava reuso após soft-delete | Baixo (1 migration) |
| F-05 | 🟠 Alto | `scripts/apply-migrations-staging.mjs` + 14 migrations | Não-idempotente, sem rastreio de aplicação | Médio |
| F-10 | 🟡 Médio | 4 data files | Busca ILIKE sem índice trigram | Baixo (1 migration) |
| F-09 | 🟡 Médio | `audit_log`, `notificacoes_email` | Falta índice em `created_at` | Baixo (1 migration) |
| F-11 | 🟡 Médio | `has_role()` | Falta `STABLE` — penalidade em bulk ops | Baixo (1 migration) |
| F-06 | 🟡 Médio | `pagamentos`/`documentos.criado_por_user_id` | FK sem `ON DELETE` | Baixo (1 migration) |
| F-07 | 🟡 Médio | `confianca_ia`, `orcamento`, `vezes_visto`, `tamanho_bytes` | CHECKs ausentes | Baixo (1 migration) |
| F-08 | 🟡 Médio | `webhooks_outbound.eventos` | Sem CHECK de valores válidos | Baixo (1 migration) |
| F-12 | 🟡 Médio | `mensagens_whats` | FKs sem índice | Baixo (1 migration) |
| F-13 | 🟢 Baixo | `pendentes/actions.ts` | Updates finais sem checar error | Baixo |
| F-14 | 🟢 Baixo | `lembretes_agendados` | FK polimórfica sem validação | N/A (feature não implementada) |
| F-15 | 🟢 Info | migrations | Sem convenção de rollback documentada | Baixo (processo) |

**Recomendação de ordem de execução:** F-01, F-03, F-06, F-07, F-08, F-09, F-11, F-12 podem ir numa única migration de manutenção (todas são `ALTER`/`CREATE INDEX` de baixo risco, sem downtime). F-05 é organizacional (mudar processo de deploy). F-04 e F-02 são as únicas que tocam lógica de aplicação e merecem planejamento à parte.
