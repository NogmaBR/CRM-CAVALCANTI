# Auditoria Back-end / Dados — CRM Nogma-Cavalcanti

**Data:** 2026-09-09
**Escopo:** `supabase/migrations/**` (20 migrations), `apps/web/lib/data/**` (14 módulos), `apps/web/lib/schemas/**`, `apps/web/lib/services/**`, `apps/web/app/**/actions.ts` (42 server actions), `apps/web/app/api/**` (4 route handlers), `packages/db/src/types.ts`.
**Método:** leitura integral das migrations + reconstrução do schema; leitura integral da camada de dados e das actions; `pnpm -r typecheck` (passa) e `pnpm -r test` (falha — ver F-22).
**Nenhum código-fonte foi alterado e nenhuma migration foi aplicada.**

---

## 1. Schema reconstruído

### 1.1 Tipos ENUM (`20260903100000_init.sql`)

| Tipo | Valores |
|---|---|
| `papel_usuario` | admin, gestor, financeiro, leitura |
| `tema_preferido` | light, black, dark |
| `origem_fornecedor` | manual, auto_detectado |
| `documento_tipo` | cnpj, cpf |
| `obra_tipo` | nova, reforma |
| `obra_status` | ativa, pausada, concluida, arquivada |
| `pagamento_origem` | whatsapp, manual, importado |
| `pagamento_status` | confirmado, aguardando, erro |
| `anexo_tipo` | nota_fiscal, comprovante, contrato, outro |
| `msg_tipo` | texto, imagem, pdf, audio |
| `msg_status` | recebida, processando, classificada, confirmada, erro |

### 1.2 Tabelas

#### `profiles` — 1:1 com `auth.users`
| Coluna | Tipo | Null | Default |
|---|---|---|---|
| user_id (PK) | UUID → `auth.users(id)` **ON DELETE CASCADE** | não | — |
| nome | TEXT | não | — |
| papel | `papel_usuario` | não | 'leitura' |
| telefone, avatar_url | TEXT | sim | — |
| tema_preferido | `tema_preferido` | sim | 'black' |
| created_at / updated_at | TIMESTAMPTZ | sim | now() |
| deleted_at | TIMESTAMPTZ | sim | — (mig. `...170000`) |
| email_prefs | JSONB | **não** | `{"pagamentos_aguardando":true,"pendencias_novas":true,"digest_semanal":false}` |
| timezone | TEXT | **não** | 'America/Sao_Paulo' + CHECK `char_length>0` |

Índices: PK + `idx_profiles_papel_active(papel) WHERE deleted_at IS NULL`.
Triggers: `trg_profiles_updated` (updated_at); `trg_on_auth_user_created` em `auth.users` → `handle_new_user()` (SECURITY DEFINER, `search_path=public`, ON CONFLICT DO NOTHING).
**Sem trigger de auditoria** — mudança de papel não é logada.

#### `autorizados`
`id` UUID PK · `nome` TEXT NN · `telefone_whats` TEXT **UNIQUE** NN · `papel_obra` TEXT · `ativo` BOOL=true · created/updated/deleted_at.
Índices: PK + unique implícito de `telefone_whats`. Trigger updated_at + auditoria.

#### `categorias`
`id` UUID PK · `nome` TEXT **UNIQUE** NN · `cor`, `icone` TEXT · created/updated/deleted_at.
⚠️ O UNIQUE em `nome` é **global**, não parcial: arquivar "Material" e recriar "Material" dispara 23505.
Trigger updated_at + auditoria.

#### `obras`
`id` UUID PK · `nome` TEXT NN · `cliente` TEXT · `tipo` obra_tipo · **`orcamento NUMERIC(12,2)`** · `status` obra_status='ativa' · `data_inicio`/`data_prevista_fim` DATE · `endereco` JSONB · `apelidos` TEXT[]='{}' · `onedrive_folder_id`, `observacoes` TEXT · created/updated/deleted_at.
Índices: `idx_obras_status(status) WHERE deleted_at IS NULL`, `idx_obras_apelidos_gin` GIN(apelidos).
Trigger updated_at + auditoria.

#### `fornecedores`
`id` UUID PK · `nome` TEXT NN · `razao_social` TEXT · `documento` TEXT · `documento_tipo` · **`categoria_id` → categorias ON DELETE SET NULL** · `telefone`, `email` TEXT · `origem`='manual' · `ativo` BOOL=true · created/updated/deleted_at.
Índices: `idx_fornecedores_doc_unique(documento) WHERE documento IS NOT NULL AND deleted_at IS NULL`.
❌ **`categoria_id` sem índice.**

#### `fornecedor_apelidos`
`id` UUID PK · **`fornecedor_id` → fornecedores ON DELETE CASCADE** NN · `apelido` TEXT NN · `criado_por_ia` BOOL=false · `vezes_visto` INT=1 · created_at.
Índices: `idx_apelidos_fornecedor(fornecedor_id)`, `idx_apelidos_texto(lower(apelido))`.
❌ Sem UNIQUE `(fornecedor_id, lower(apelido))` — a RPC de merge depende de "IF NOT EXISTS → INSERT" sem garantia.

#### `mensagens_whats`
`id` UUID PK · `msg_id_uazapi` TEXT **UNIQUE** NN · `telefone_from` TEXT NN · **`autorizado_id` → autorizados SET NULL** · `tipo` msg_tipo NN · `texto_bruto` TEXT · `midia_storage_path`, `midia_mime` TEXT · `recebida_em` TIMESTAMPTZ NN · `status` msg_status NN='recebida' · `dados_extraidos` JSONB · **`confianca_ia NUMERIC(4,3)`** · `erro_msg` TEXT · **`pagamento_id` → pagamentos SET NULL DEFERRABLE** · **`documento_id` → documentos SET NULL DEFERRABLE** · `tentativas_reprocessamento` INT=0 · created/updated_at.
Índices: `idx_msgs_status(status)`, `idx_msgs_recebida_em(recebida_em DESC)`.
❌ `autorizado_id`, `pagamento_id`, `documento_id` **sem índice**. ❌ Sem `deleted_at`. ❌ Sem trigger de auditoria.

#### `pagamentos` — tabela financeira central
| Coluna | Tipo | Null | ON DELETE |
|---|---|---|---|
| id | UUID PK | | |
| obra_id | UUID → obras | **não** | **RESTRICT** ✅ |
| fornecedor_id | UUID → fornecedores | sim | SET NULL |
| categoria_id | UUID → categorias | sim | SET NULL |
| descricao, observacoes | TEXT | sim | |
| **valor** | **NUMERIC(12,2) NOT NULL CHECK (valor >= 0)** | não | |
| data_pagamento | DATE NOT NULL | não | DEFAULT `current_date` |
| origem | pagamento_origem NOT NULL | não | |
| status_pagto | pagamento_status | **sim** | DEFAULT 'confirmado' |
| criado_por_user_id | UUID → profiles(user_id) | sim | **NO ACTION** |
| criado_via_msg_id | UUID → mensagens_whats DEFERRABLE | sim | **NO ACTION** |
| created/updated/deleted_at | TIMESTAMPTZ | sim | |

Índices: `idx_pagamentos_obra_data(obra_id, data_pagamento DESC)`, `idx_pagamentos_fornecedor`, `idx_pagamentos_status`, `idx_pagamentos_criado_via_msg_unique(criado_via_msg_id) WHERE NOT NULL` (unique parcial).
❌ `categoria_id` e `criado_por_user_id` **sem índice**. ❌ **Sem índice em `data_pagamento` isolado** (ver F-10).

#### `documentos`
`id` UUID PK · **`pagamento_id` → pagamentos SET NULL** · **`obra_id` → obras SET NULL** · **`fornecedor_id` → fornecedores SET NULL** · `tipo` anexo_tipo NN · `nome_arquivo`, `mime_type`, `storage_path` TEXT NN · `tamanho_bytes` BIGINT · `onedrive_file_id`, `numero_nf`, `chave_acesso_nf`, `hash_sha256` TEXT · `criado_por_user_id` → profiles (NO ACTION) · created/updated/deleted_at.
Índices: unique parcial em `chave_acesso_nf` e em `hash_sha256` (ambos WHERE NOT NULL AND deleted_at IS NULL); `idx_documentos_pagamento/obra/fornecedor`; `idx_documentos_criado_por` parcial.

#### `confirmacoes_pendentes`
`id` UUID PK · **`mensagem_id` → mensagens_whats ON DELETE CASCADE** NN · `pergunta_enviada` TEXT NN · `msg_id_pergunta_uazapi` TEXT · `respondida_em` TIMESTAMPTZ · `resposta_bruta` TEXT · `resolvida` BOOL=false · created_at.
❌ **`mensagem_id` sem índice, com CASCADE** → DELETE em `mensagens_whats` faz seq scan. ❌ Sem unique parcial `(mensagem_id) WHERE resolvida=false`. ❌ Sem índice em `resolvida`.

#### `audit_log`
`id` BIGSERIAL PK · `user_id` UUID → profiles SET NULL · `entidade` TEXT NN · `entidade_id` UUID NN · `acao` TEXT NN CHECK IN (insert,update,delete) · `diff` JSONB · created_at.
Índices: `idx_audit_entidade(entidade, entidade_id)`, `idx_audit_user(user_id)`.
❌ **Sem índice em `created_at`** — a query principal (`ORDER BY created_at DESC LIMIT 200`) faz scan+sort completo.
RLS: só SELECT (admin+gestor). Sem policies de INSERT/UPDATE/DELETE → `authenticated` não escreve, mas **`service_role` tem GRANT DELETE e bypassa RLS**.

#### `notificacoes_email`
`id` UUID PK · `destinatario`, `assunto`, `corpo` TEXT NN · `enviada_em` TIMESTAMPTZ · `erro` TEXT · `contexto` JSONB · created_at. **Sem índices além da PK** (query ordena por `created_at DESC LIMIT 200`).

#### `lembretes_agendados`
`id` UUID PK · `tipo` TEXT NN · `alvo_id` UUID (sem FK) · `cron_expressao` TEXT NN · `ultima_execucao` TIMESTAMPTZ · `ativo` BOOL=true · created_at. Tabela órfã — nenhuma query no código a referencia.

#### `webhooks_outbound`
`id` UUID PK · `nome`, `url` TEXT NN · `eventos` TEXT[] NN='{}' · **`secret` TEXT NN** · `ativo` BOOL NN=true · `ultima_execucao_em/status/erro` · `total_execucoes` INT NN=0 · created/updated/deleted_at · `criado_por_user_id` → profiles SET NULL.
Índices: `idx_webhooks_eventos_gin` GIN(eventos) WHERE ativo AND deleted_at IS NULL.
❌ `criado_por_user_id` sem índice. ❌ Sem CHECK em `eventos` nem em `url`.
Trigger auditoria: **grava a linha inteira, incluindo `secret`** (ver F-06).

### 1.3 Veredicto sobre os pontos obrigatórios do escopo

| Pergunta | Resposta |
|---|---|
| **Valores monetários são float?** | **NÃO.** `pagamentos.valor` e `obras.orcamento` são `NUMERIC(12,2)`; `confianca_ia` é `NUMERIC(4,3)`. Zero `float`/`double precision` no schema. ✅ **Porém**: PostgREST serializa `numeric` como número JSON e o app soma tudo em `Number()` (double IEEE-754) — ver **F-15**. |
| **Timezone** | Todas as colunas de instante são `TIMESTAMPTZ` ✅. Restam 2 problemas de fuso: `data_pagamento DATE DEFAULT current_date` (UTC no Supabase) e as janelas `T00:00:00.000Z` nos relatórios — ver **F-14**. |
| **FKs sem índice** | 7: `fornecedores.categoria_id`, `pagamentos.categoria_id`, `pagamentos.criado_por_user_id`, `mensagens_whats.autorizado_id/pagamento_id/documento_id`, `confirmacoes_pendentes.mensagem_id` (CASCADE!), `webhooks_outbound.criado_por_user_id`. |
| **ON DELETE errado** | `pagamentos.obra_id RESTRICT` está correto. `documentos.pagamento_id SET NULL` órfãna NF fiscal se um pagamento for hard-deleted (o app só faz soft-delete; risco latente). `profiles.user_id CASCADE` + `pagamentos.criado_por_user_id NO ACTION` = deletar um usuário no dashboard Supabase é bloqueado por 23503 após seq scan (ver F-30). |
| **CHECK faltando** | `valor > 0` (hoje `>= 0`), `orcamento >= 0`, `data_prevista_fim >= data_inicio`, `confianca_ia BETWEEN 0 AND 1`, `tamanho_bytes > 0`, `vezes_visto >= 0`, `eventos` contra whitelist, `url` https, `chave_acesso_nf` 44 dígitos. |
| **Soft delete em `profiles`** | Filtrado em `listUsuarios` (`usuarios.ts:60`) e `getRecipientsByPapel` (`notificacoes.ts:51`). **NÃO filtrado** em `has_role()` (RLS), nos `assertAdmin()` das actions, nem no middleware — ver **F-05**. |

---

## 2. Matriz das server actions

42 server actions (o briefing estimava ~19). `Zod` = valida entrada com schema; `Auth` = verifica sessão; `Papel` = verifica papel explicitamente no código (✅) ou delega à RLS (RLS); `mapDb` = usa `mapDbError*`; `Reval` = `revalidatePath`; `Idem` = idempotente; `Tipo` = retorno consistente.

| # | Action | Arquivo | Zod | Auth | Papel | mapDb | Reval | Idem | Tipo | Desvios |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `criarCategoria` | config/categorias/actions.ts:32 | ✅ | ✅ | ✅ admin | ✅ | ✅ | ❌ | redirect | — |
| 2 | `atualizarCategoria` | :65 | ✅ | ✅ | ✅ admin | ✅ | ✅ | ✅ | redirect | **F-21** apaga cor/icone |
| 3 | `arquivarCategoria` | :102 | ❌ id cru | ✅ | ✅ admin | ✅ | ✅ | ✅ guard | redirect | sem `.select()` → F-07 |
| 4 | `restaurarCategoria` | :127 | ❌ id cru | ✅ | ✅ admin | ✅ | ✅ | ✅ | redirect | sem guard `deleted_at NOT NULL` |
| 5 | `previewImportCsv` | config/importar/actions.ts:31 | ✅ por linha | ✅ | ✅ admin | ❌ | n/a | ✅ | objeto | — |
| 6 | `commitImportCsv` | :40 | ❌ **confia no payload do client** | ✅ | ✅ admin | ❌ | ✅ | ❌ | objeto | **F-02 crítico** |
| 7 | `salvarPerfil` | config/perfil/actions.ts:12 | ✅ | ✅ | n/a self | ✅ | ✅ | ✅ | redirect | — |
| 8 | `convidarUsuario` | config/usuarios/actions.ts:43 | ✅ | ✅ | ✅ admin | ❌ string-match | ✅ | ~ | redirect | erro por `includes('already')` |
| 9 | `reenviarConvite` | :81 | ✅ | ✅ | ✅ admin | ❌ | ✅ | ✅ | redirect | `getUsuario` carrega TODOS (F-23) |
| 10 | `alterarPapelUsuario` | :110 | ✅ | ✅ | ✅ admin | ❌ | ✅ | ✅ | redirect | service_role → audit anônimo (F-16) |
| 11 | `arquivarUsuario` | :135 | ✅ | ✅ | ✅ admin | ❌ | ✅ | ✅ | redirect | **F-05** não bane no auth |
| 12 | `restaurarUsuario` | :158 | ✅ | ✅ | ✅ admin | ❌ | ✅ | ✅ | redirect | — |
| 13 | `criarWebhook` | config/webhooks/actions.ts:61 | ✅ | ✅ | ✅ admin | ❌ | ✅ | ❌ | redirect | **F-06 secret na URL** |
| 14 | `atualizarWebhook` | :100 | ✅ | ✅ | ✅ admin | ❌ | ✅ | ✅ | redirect | — |
| 15 | `arquivarWebhook` | :141 | ❌ id cru | ✅ | ✅ admin | ❌ | ✅ | ✅ guard | redirect | — |
| 16 | `testarWebhook` | :164 | ❌ id cru | ✅ | ✅ admin | ❌ | ✅ | ✅ | redirect | SSRF: URL arbitrária (fora de escopo) |
| 17 | `regenerarSecret` | :179 | ❌ id cru | ✅ | ✅ admin | ❌ | ✅ | ❌ | redirect | **F-06 secret na URL** |
| 18 | `createDocumento` | documentos/actions.ts:31 | ✅ | ~ getUser opcional | RLS | ✅ | ✅ | ❌ | redirect | **F-11** rollback negado por RLS |
| 19 | `updateDocumento` | :151 | ✅ | ❌ | RLS | ✅ | ✅ | ✅ | redirect | **F-07** |
| 20 | `archiveDocumento` | :191 | ❌ | ❌ | RLS | ✅ | ✅ | ❌ | redirect | **F-07**, sem guard |
| 21 | `restoreDocumento` | :207 | ❌ | ❌ | RLS | ✅ | ✅ | ✅ | redirect | **F-07** |
| 22 | `downloadDocumento` | :227 | ❌ | ❌ | RLS | ❌ | n/a | ✅ | redirect | — |
| 23 | `createFornecedor` | fornecedores/actions.ts:27 | ✅ | ❌ | RLS | ✅ | ✅ | ❌ | redirect | — |
| 24 | `updateFornecedor` | :69 | ✅ | ❌ | RLS | ✅ | ✅ | ✅ | redirect | **F-07** |
| 25 | `archiveFornecedor` | :112 | ❌ | ❌ | RLS | ✅ | ✅ | ❌ | redirect | **F-07** |
| 26 | `restoreFornecedor` | :128 | ❌ | ❌ | RLS | ✅ | ✅ | ✅ | redirect | **F-07** |
| 27 | `mergeFornecedoresAction` | fornecedores/duplicatas/actions.ts:38 | ✅ | ✅ | ✅ admin/gestor | ❌ | ✅ | ✅ RPC | redirect | audit anônimo (F-16) |
| 28 | `reenviarNotificacao` | notificacoes/actions.ts:8 | ❌ | ❌ | RLS | ❌ | ✅ | ❌ | redirect | idempotência zero |
| 29 | `createObra` | obras/actions.ts:26 | ✅ | ❌ | RLS | ✅ | ✅ | ❌ | redirect | — |
| 30 | `updateObra` | :61 | ✅ | ❌ | RLS | ✅ | ✅ | ✅ | redirect | **F-07** |
| 31 | `archiveObra` | :102 | ❌ | ❌ | RLS | ✅ | ✅ | ❌ | redirect | **F-07**, sem guard |
| 32 | `bulkArchiveObras` | :118 | ❌ JSON.parse cru | ❌ | RLS | ✅ | ✅ | ✅ guard | redirect | IDs sem validação UUID |
| 33 | `restoreObra` | :147 | ❌ | ❌ | RLS | ✅ | ✅ | ✅ | redirect | **F-20** força status='ativa' |
| 34 | `createPagamento` | pagamentos/actions.ts:20 | ✅ | ~ | RLS | ✅ | ✅ | ❌ | redirect | **F-01**, e-mail fora de try (F-31) |
| 35 | `updatePagamento` | :100 | ✅ | ❌ | RLS | ✅ | ✅ | ✅ | redirect | **F-07**, **F-01** |
| 36 | `archivePagamento` | :143 | ❌ | ❌ | RLS | ✅ | ✅ | ❌ | redirect | **F-07** |
| 37 | `restorePagamento` | :160 | ❌ | ❌ | RLS | ✅ | ✅ | ✅ | redirect | **F-07** |
| 38 | `confirmarPendencia` | pendentes/actions.ts:9 | ❌ id cru | ~ | RLS | ✅ | ✅ | ✅ | redirect | **F-12** 3 mutações não-atômicas |
| 39 | `rejeitarPendencia` | :147 | ❌ | ❌ | RLS | ❌ | ✅ | ✅ | redirect | **F-08 IDOR** |
| 40 | `definirSenha` | (auth)/definir-senha/actions.ts:17 | ✅ | ✅ | n/a | ❌ | ❌ | ✅ | redirect | vaza `error.message` do GoTrue |
| 41 | `login` | (auth)/login/actions.ts:7 | ❌ manual | n/a | n/a | ❌ | ✅ | ✅ | redirect | vaza `error.message` do GoTrue |
| 42 | `logout` | :33 | n/a | n/a | n/a | n/a | ❌ | ✅ | redirect | — |

**Padrão dominante de desvio:** 24 das 42 actions não validam o `id` com Zod (só `String(...).trim()`), 19 não fazem nenhuma checagem de auth/papel no código (delegam 100% à RLS) e **nenhuma** verifica quantas linhas foram efetivamente afetadas — origem do F-07.

---

## 3. Findings

### F-01 — CRÍTICO · Parser de valor pt-BR converte "1.500" em 1,50

**Local:** `apps/web/lib/schemas/pagamento.ts:16-19`; `apps/web/lib/schemas/import-pagamento.ts:18-29`; `apps/web/lib/schemas/obra.ts:26-31`.

```ts
// pagamento.ts:16-19
const normalized = v.includes(',')
  ? v.replace(/\./gu, '').replace(',', '.')
  : v;                      // <-- sem vírgula, o ponto é tratado como decimal
const n = Number(normalized);
```

**Cenário de falha concreto:** o gestor lança um pagamento e digita `1.500` no campo Valor (grafia pt-BR usual para mil e quinhentos reais, sem centavos). Não há vírgula → a string passa direta → `Number("1.500") === 1.5` → `INSERT INTO pagamentos (valor) VALUES (1.50)`. O banco aceita (é `NUMERIC(12,2)`, e `1.50 >= 0`). O pagamento de **R$ 1.500,00 fica registrado como R$ 1,50** — erro de 1000×, silencioso, sem nenhuma validação que o pegue.

Variantes do mesmo defeito:
- `import-pagamento.ts:27-28` — `parseValorBR("1.500")` → `1.5`. Num CSV de 500 linhas com valores redondos sem centavos, **todas** são corrompidas de uma vez.
- `obra.ts:30` — `Number("1.500.000")` → `NaN` → o `.refine` rejeita com "Orçamento deve ser ≥ 0" (mensagem enganosa); e `Number("1.500")` → orçamento de R$ 1,50, o que faz `percentualOrcamento` (`reports.ts:111`) explodir para 100.000%.
- Nenhum dos três parsers arredonda para 2 casas: `"10,555"` → `10.555` → o Postgres arredonda para `10.56` sem avisar.
- Nenhum valida o teto de `NUMERIC(12,2)`: `"99999999999999"` → erro `22003` que **não está mapeado** em `errors.ts` → o usuário vê "Erro ao processar. Tente novamente."

**Impacto:** corrupção monetária silenciosa na tabela financeira central. Contamina painel, relatórios PDF/CSV e fechamento mensal.

**Correção (pronta):**

```ts
// apps/web/lib/util/money.ts  (novo)
/**
 * Parser único de moeda pt-BR/EN. Regra: o ÚLTIMO separador ( . ou , )
 * seguido de exatamente 1-2 dígitos é o decimal; todo o resto é milhar.
 * Sem separador decimal identificável, o número é inteiro.
 */
export function parseMoneyBR(raw: string): number | null {
  const s = raw.trim().replace(/^R\$\s*/iu, '').replace(/\s/gu, '');
  if (s === '' || !/^-?[\d.,]+$/u.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const sepIdx = Math.max(lastComma, lastDot);

  let intPart = s;
  let decPart = '';
  if (sepIdx > -1) {
    const tail = s.slice(sepIdx + 1);
    if (/^\d{1,2}$/u.test(tail)) {           // decimal de verdade
      intPart = s.slice(0, sepIdx);
      decPart = tail;
    }                                         // senão: era milhar ("1.500")
  }
  const digits = intPart.replace(/[.,]/gu, '');
  if (!/^-?\d+$/u.test(digits)) return null;

  const n = Number(`${digits}.${decPart.padEnd(2, '0')}`);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;           // 2 casas, sempre
}

export const MAX_NUMERIC_12_2 = 9_999_999_999.99;
```

```ts
// pagamento.ts — substituir valorRequired
const valorRequired = z.string().trim().min(1, 'Valor é obrigatório')
  .transform((v, ctx) => {
    const n = parseMoneyBR(v);
    if (n === null || n <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom,
        message: 'Valor inválido. Use 1.234,56 ou 1234.56 (deve ser maior que zero)' });
      return z.NEVER;
    }
    if (n > MAX_NUMERIC_12_2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valor acima do limite (R$ 9.999.999.999,99)' });
      return z.NEVER;
    }
    return n;
  });
```
Aplicar o mesmo em `import-pagamento.ts` e `obra.ts` (`orcamento`). Acompanhar da **Migration A** (CHECK `valor > 0`) e de testes unitários (F-22).

**Esforço:** 3h (parser + 3 call sites + suíte de testes de tabela).

---

### F-02 — CRÍTICO · Import CSV não é idempotente e o servidor confia no payload do cliente

**Local:** `apps/web/app/(app)/config/importar/actions.ts:40-48`; `apps/web/lib/services/import-pagamentos.ts:160-207`.

A action recebe `previewRows: PreviewRow[]` **diretamente do componente cliente** e repassa a `commitImport`, que insere com o **service_role client** (`import-pagamentos.ts:20-27`, bypassa RLS) usando `r.data!.valor`, `r.matched.obra_id!` — sem reprocessar por Zod, sem revalidar que os UUIDs existem, sem nenhuma chave de deduplicação.

**Cenário de falha concreto 1 (duplicação):** o admin importa `fechamento-agosto.csv` com 480 linhas / R$ 1.240.000. A resposta demora (~8s, 5 chunks de 100). O admin acha que travou e clica "Importar" de novo. Não há guard, não há chave única em `pagamentos`, e `commitImport` é um `INSERT` puro → **960 pagamentos, R$ 2.480.000** no fechamento de agosto. O único jeito de reverter é achar as 480 linhas duplicadas manualmente (o `created_at` é o mesmo minuto).

**Cenário de falha concreto 2 (bypass de validação):** o payload do POST da server action é montado no browser. Alterando-o (DevTools, ou XSS numa sessão admin), envia-se `{data:{valor: -50000, origem:'manual', status_pagto:'confirmado', data_pagamento:'2099-01-01'}, matched:{obra_id:'<uuid válido>'}, errors:[]}`. Nada revalida: nem Zod, nem RLS (é service_role). Só o CHECK `valor >= 0` do banco barra o negativo; data no futuro, origem arbitrária e valor acima de qualquer alçada passam.

**Impacto:** dobra/tripla contabilização financeira por duplo clique — o cenário mais provável de todos os findings — e superfície de escrita com service_role dirigida por input do cliente.

**Correção:**
1. Re-parsear no servidor: `commitImport` deve receber apenas `csvText` + a lista de índices aprovados, e refazer `previewImport` internamente (fonte da verdade no servidor).
2. Chave de idempotência por lote: gerar `import_batch_id` (hash SHA-256 do CSV) no preview, guardar em `pagamentos.observacoes`/nova coluna, e um `UNIQUE` parcial que impeça o mesmo lote duas vezes — ver **Migration F**.
3. Trocar o service_role pelo client autenticado (`createClient()`): o import é feito por admin, a RLS já permite INSERT.

```ts
// import-pagamentos.ts — assinatura sugerida
export async function commitImport(
  csvText: string,
  aprovadas: number[],            // números de linha aprovados na UI
  criadoPorUserId: string | null,
  batchId: string,                // sha256(csvText)
): Promise<{ inserted: number; failed: number; errors: string[] }> {
  const preview = await previewImport(csvText);       // revalida TUDO no servidor
  const rows = preview.rows.filter(r => aprovadas.includes(r.linha) && r.data && r.matched.obra_id);
  // ... insert com import_batch_id: batchId
}
```

**Esforço:** 5h.

---

### F-03 — ALTO · Redelivery do webhook UAZAPI regride mensagem já confirmada

**Local:** `apps/web/app/api/webhooks/uazapi/route.ts:68-86`.

```ts
.upsert({
  msg_id_uazapi: p.id,
  ...
  status: 'recebida',        // <-- sobrescreve 'confirmada'
  dados_extraidos: null,     // <-- apaga o que a IA extraiu
  confianca_ia: null,        // <-- apaga
}, { onConflict: 'msg_id_uazapi' })
```

**Cenário de falha concreto:** o encarregado manda "Paguei 3.200 pra Casa das Tintas na Obra Alpha". A mensagem é classificada, vira pendência, o gestor confirma em `/pendentes` → `pagamentos` criado, `mensagens_whats.status='confirmada'`, `pagamento_id` preenchido. Duas horas depois a UAZAPI reentrega o mesmo `msg_id` (retry por timeout de rede na primeira resposta — comportamento normal de provider). O `upsert` bate no conflito e **faz UPDATE**: `status` volta a `'recebida'`, `dados_extraidos` e `confianca_ia` viram `NULL`. Em seguida `classifyAndPersist` roda de novo, agora sem contexto, e insere **nova linha em `confirmacoes_pendentes`**. Resultado: uma pendência fantasma na fila para um pagamento que já foi lançado, o histórico da extração da IA perdido, e o feed `/whatsapp` mostrando a mensagem como "recebida" apesar de `pagamento_id` estar preenchido.

**Impacto:** perda de dados de auditoria da IA + fila de pendências poluída + risco de o gestor "confirmar" de novo (o guard de `criado_via_msg_id` evita o pagamento duplicado, mas ele verá "Pagamento criado com sucesso" sem nada novo ter acontecido).

**Correção:** o upsert deve ser *insert-only-on-conflict-do-nothing*, e a classificação só deve rodar em linha realmente nova.

```ts
// route.ts — trocar o upsert por insert + tratamento de 23505
const insert = await supabase.from('mensagens_whats').insert({ /* mesmos campos */ })
  .select('id').single();

let mensagemId: string;
let novaMensagem = true;
if (insert.error) {
  if (insert.error.code !== '23505') {
    return NextResponse.json({ error: 'db insert failed', code: insert.error.code }, { status: 500 });
  }
  const { data: existente } = await supabase
    .from('mensagens_whats').select('id, status')
    .eq('msg_id_uazapi', p.id).single();
  if (!existente) return NextResponse.json({ error: 'conflito irrecuperável' }, { status: 500 });
  mensagemId = existente.id;
  novaMensagem = false;
} else {
  mensagemId = insert.data.id;
}

const classifyResult = novaMensagem
  ? await classifyAndPersist(mensagemId).catch(e => ({ ok: false as const, error: String(e) }))
  : { ok: true as const, skipped: 'já processada' };
```

**Esforço:** 1h30.

---

### F-04 — ALTO · `confirmacoes_pendentes` duplicadas para a mesma mensagem

**Local:** `apps/web/lib/services/classify-and-persist.ts:134-137`; migration `20260903100300_...sql:84-92`.

```ts
await supabase.from('confirmacoes_pendentes').insert({
  mensagem_id: mensagemId,
  pergunta_enviada: pergunta,
});   // sem checar se já existe pendência aberta; sem constraint no banco
```

**Cenário de falha concreto:** qualquer reexecução de `classifyAndPersist` para a mesma mensagem (retry do provider — F-03; reprocessamento manual futuro; timeout do Vercel entre o `insert` e o `update` da linha 139) cria uma segunda pendência. A tela `/pendentes` (`lib/data/pendentes.ts:39-60`, filtra `resolvida=false`) mostra a mesma mensagem duas vezes; o gestor confirma a primeira (cria o pagamento, marca `resolvida=true` **só na confirmação que ele clicou**) e a segunda **continua aberta para sempre**, porque `confirmarPendencia` aborta em `mensagem.status === 'confirmada'` (`pendentes/actions.ts:44-46`) com a mensagem "Esta pendência já foi resolvida" — sem nunca marcar a linha órfã como resolvida. A fila acumula lixo permanente.

**Impacto:** fila de pendências com itens impossíveis de resolver pela UI; e-mails duplicados aos gestores (`sendPendenciaNovaEmail`); contagem `pendencia_count` inflada nos e-mails e no KPI do painel.

**Correção:** constraint no banco (**Migration D**) + tratamento no serviço.

```ts
// classify-and-persist.ts — trocar o insert por upsert idempotente
const { error: pendErr } = await supabase
  .from('confirmacoes_pendentes')
  .insert({ mensagem_id: mensagemId, pergunta_enviada: pergunta });
if (pendErr && pendErr.code !== '23505') {
  // 23505 = já existe pendência aberta para esta mensagem → ok, segue
  return { ok: false, error: pendErr.message };
}
```
E, em `confirmarPendencia`, resolver **todas** as pendências da mensagem, não só a clicada:
```ts
await supabase.from('confirmacoes_pendentes')
  .update({ resolvida: true, respondida_em: new Date().toISOString(),
            resposta_bruta: 'confirmado via painel' })
  .eq('mensagem_id', mensagem.id)      // <-- por mensagem, não por confirmacao_id
  .eq('resolvida', false);
```

**Esforço:** 2h.

---

### F-05 — ALTO · Usuário arquivado continua com acesso total (RLS não conhece `deleted_at`)

**Local:** `supabase/migrations/20260903100500_rls_policies.sql:17-23` (`has_role`); `apps/web/lib/supabase/middleware.ts:43-46`; `apps/web/lib/data/usuarios.ts:181-199` (`archiveUsuarioAdmin`); `assertAdmin()` em todas as actions de config (ex.: `config/usuarios/actions.ts:26-33`).

```sql
-- 20260903100500:19-23 — nenhuma referência a deleted_at
CREATE OR REPLACE FUNCTION has_role(roles papel_usuario[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND papel = ANY(roles));
$$;
```

**Cenário de falha concreto:** o financeiro é desligado. O admin vai em `/config/usuarios` e clica "Arquivar". `archiveUsuarioAdmin` faz `profiles.deleted_at = now()` e `auth.admin.signOut(userId)` (revoga os refresh tokens ativos). **O registro em `auth.users` não é banido nem deletado, e a senha continua válida.** No dia seguinte o ex-funcionário abre o CRM, digita e-mail e senha, `signInWithPassword` retorna 200, o middleware (`middleware.ts:43`) só verifica `if (!user)` → deixa passar, o `(app)/layout.tsx` não tem guard nenhum, e `has_role(['admin','gestor','financeiro'])` continua retornando `true` porque ignora `deleted_at`. **Ele volta a criar, editar e arquivar pagamentos e obras normalmente.** O único lugar onde o arquivamento tem efeito é na lista de usuários e no envio de e-mails.

O mesmo vale para um admin arquivado: `assertAdmin()` (`config/usuarios/actions.ts:26-33`) lê `papel` sem filtrar `deleted_at`, então ele mantém acesso a `/config/usuarios`, `/config/webhooks` e ao import CSV.

**Impacto:** revogação de acesso é puramente cosmética. É o finding com maior consequência de compliance/segurança do banco.

**Correção (3 camadas):**
1. **Migration B** — `has_role()` passa a exigir `deleted_at IS NULL` (fecha a RLS de uma vez para todas as tabelas).
2. `assertAdmin()` / `assertAdminOrGestor()` passam a selecionar `papel, deleted_at` e a rejeitar `deleted_at != null`.
3. `archiveUsuarioAdmin` passa a banir no GoTrue, não só encerrar sessão:
```ts
await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' }); // ~100 anos
await admin.auth.admin.signOut(userId);
// restoreUsuarioAdmin: { ban_duration: 'none' }
```
4. Opcional (defesa em profundidade): no middleware, checar `profiles.deleted_at` em rotas `(app)`.

**Esforço:** 3h.

---

### F-06 — ALTO · Secret HMAC do webhook vaza na URL e no `audit_log`

**Local:** `apps/web/app/(app)/config/webhooks/actions.ts:97` e `:200`; migration `20260907190000_webhooks_outbound.sql:50-52` + `20260907160000_audit_triggers.sql:49,103-106`.

```ts
// actions.ts:97
redirect(`${BASE_PATH}?created=${wh.id}&secret=${encodeURIComponent(secret)}`);
// actions.ts:200
redirect(`${BASE_PATH}?secret=${encodeURIComponent(newSecret)}`);
```

**Cenário de falha concreto (vazamento 1 — URL):** o admin cria um webhook para o n8n. A chave HMAC de 64 hex chars vai na query string. Ela fica gravada em: histórico do navegador; logs de acesso da Vercel (que registram o path completo); header `Referer` de qualquer recurso externo carregado naquela página; e no histórico do próprio browser de um notebook compartilhado no escritório. Quem obtém o secret consegue **forjar `X-Nogma-Signature` e injetar eventos falsos** de `pagamento_created` no fluxo n8n.

**Cenário de falha concreto (vazamento 2 — audit_log):** a migration `20260907190000:50-52` liga `audit_log_trigger()` em `webhooks_outbound`, e o trigger grava `to_jsonb(NEW) - 'updated_at'` (`20260907160000:49`), ou seja, **a linha inteira, incluindo a coluna `secret` em texto puro**. A policy de leitura foi relaxada para `admin + gestor` (`20260907160000:103-106`). Portanto **qualquer gestor** abre `/auditoria`, filtra por entidade `webhooks_outbound` e lê todos os secrets HMAC — mesmo sem ter permissão para ver a tabela `webhooks_outbound` (cuja RLS é admin-only).

O mesmo mecanismo grava linhas inteiras de `pagamentos`, `fornecedores` (CPF/CNPJ) e `documentos` no `audit_log` — o log é uma cópia irrestrita de dados sensíveis com permissão de leitura mais ampla que a das tabelas de origem.

**Impacto:** escalonamento lateral de gestor → controle da integração externa; secret comprometido em logs de terceiros.

**Correção:**
1. Não passar o secret pela URL — exibir uma única vez via cookie efêmero (`httpOnly` não serve; usar um cookie de sessão `__Host-` com `maxAge: 60` lido pelo server component e imediatamente apagado) ou renderizar o secret na resposta de um dialog server-side.
2. **Migration C** — mascarar colunas sensíveis no trigger de auditoria (`- 'secret'`) e restringir a leitura de `audit_log` de `webhooks_outbound` a admin.

**Esforço:** 3h.

---

### F-07 — ALTO · UPDATE barrado pela RLS retorna "sucesso" (falso positivo sistêmico)

**Local:** 19 actions — ex.: `pagamentos/actions.ts:148-157`, `obras/actions.ts:107-115`, `fornecedores/actions.ts:117-125`, `documentos/actions.ts:196-204`.

```ts
const { error } = await supabase.from('pagamentos')
  .update({ deleted_at: new Date().toISOString() }).eq('id', id);
if (error) redirect(`...?error=...`);
revalidatePath(...); redirect(`/pagamentos/${id}`);   // <-- "sucesso" mesmo com 0 linhas
```

**Cenário de falha concreto:** um usuário com papel `leitura` abre `/pagamentos/<id>` (a RLS de SELECT permite: `auth.uid() IS NOT NULL`) e clica em "Arquivar". A policy `pagamentos_update` exige `has_role(['admin','gestor','financeiro'])` → **0 linhas casam**. O PostgREST responde `204 No Content` **sem erro** (RLS filtra linhas, não gera 42501 em UPDATE). O código vê `error === null`, revalida o cache e redireciona. A UI recarrega mostrando o pagamento ainda ativo, sem mensagem alguma. O usuário conclui que o sistema travou, clica de novo, abre chamado. O mesmo vale para editar um pagamento com id de outra linha, restaurar, arquivar obra etc.

**Impacto:** o app afirma ter gravado o que não gravou. É o defeito que mais gera desconfiança operacional e chamados falsos.

**Correção (padrão a aplicar nas 19 actions):**

```ts
const { data, error } = await supabase.from('pagamentos')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', id)
  .is('deleted_at', null)      // idempotência
  .select('id');               // <-- devolve as linhas afetadas

if (error) redirect(`/pagamentos/${id}?error=${encodeURIComponent(mapDbError(error))}`);
if (!data || data.length === 0) {
  redirect(`/pagamentos/${id}?error=${encodeURIComponent(
    'Nada foi alterado: o registro não existe, já está arquivado, ou você não tem permissão.')}`);
}
```

Recomenda-se extrair um helper `assertAffected(data, msg)` em `lib/util/db.ts` e usá-lo em todas.

**Esforço:** 4h (19 call sites + helper).

---

### F-08 — ALTO · `rejeitarPendencia`: sem auth e sem vínculo entre `mensagem_id` e `confirmacao_id` (IDOR)

**Local:** `apps/web/app/(app)/pendentes/actions.ts:147-174`.

```ts
export async function rejeitarPendencia(formData: FormData) {
  const confirmacao_id = String(formData.get('confirmacao_id') ?? '').trim();
  const mensagem_id  = String(formData.get('mensagem_id') ?? '').trim();   // <-- vem do cliente
  ...
  await supabase.from('mensagens_whats')
    .update({ status: 'erro', erro_msg: 'Rejeitada pelo gestor no painel' })
    .eq('id', mensagem_id);            // <-- nenhuma checagem de que pertence à confirmação
```

Além disso: nenhuma chamada a `getUser()`, nenhum `assertAdmin*`, **nenhum dos dois `await` verifica `error`**, e no fim sempre redireciona com "Pendência rejeitada."

**Cenário de falha concreto:** um usuário `financeiro` (papel legítimo, permissão de UPDATE em `mensagens_whats` pela RLS) copia o form da tela `/pendentes` e reenvia com `confirmacao_id` de uma pendência qualquer e `mensagem_id` de **outra mensagem — inclusive uma já confirmada e ligada a um pagamento de R$ 80.000**. O UPDATE aplica: aquela mensagem passa a `status='erro'` com `erro_msg='Rejeitada pelo gestor no painel'`. O pagamento continua existindo, mas a trilha WhatsApp→pagamento fica marcada como rejeitada, e o feed `/whatsapp` e o KPI "Pendências" do painel (`painel.ts:114-117`, filtra `status IN ('recebida','classificada')`) passam a mentir. Para o usuário `leitura`, o mesmo POST não altera nada (RLS) mas mostra "Pendência rejeitada." (F-07).

**Impacto:** corrupção dirigida do estado de qualquer mensagem + mensagem de sucesso falsa.

**Correção:**

```ts
export async function rejeitarPendencia(formData: FormData) {
  const parsed = z.object({ confirmacao_id: z.string().uuid() })
    .safeParse({ confirmacao_id: String(formData.get('confirmacao_id') ?? '').trim() });
  if (!parsed.success) redirect(`/pendentes?error=${encodeURIComponent('ID inválido.')}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // mensagem_id SEMPRE derivado do banco, nunca do form
  const { data: conf } = await supabase.from('confirmacoes_pendentes')
    .select('id, mensagem_id, resolvida').eq('id', parsed.data.confirmacao_id).maybeSingle();
  if (!conf) redirect(`/pendentes?error=${encodeURIComponent('Confirmação não encontrada.')}`);
  if (conf.resolvida) redirect(`/pendentes?error=${encodeURIComponent('Pendência já resolvida.')}`);

  const { data: msgUpd, error: msgErr } = await supabase.from('mensagens_whats')
    .update({ status: 'erro', erro_msg: 'Rejeitada pelo gestor no painel' })
    .eq('id', conf.mensagem_id).neq('status', 'confirmada')   // nunca rebaixa confirmada
    .select('id');
  if (msgErr || !msgUpd?.length) {
    redirect(`/pendentes?error=${encodeURIComponent(
      'Não foi possível rejeitar (sem permissão ou já confirmada).')}`);
  }
  // ... update da confirmação, também com .select() checado
}
```
Idealmente a rejeição inteira vira uma RPC (ver F-12).

**Esforço:** 2h.

---

### F-09 — ALTO · Nenhuma listagem tem paginação

**Local:** `lib/data/obras.ts:16`, `pagamentos.ts:23-27`, `fornecedores.ts:18`, `documentos.ts:20`, `categorias.ts:14`, `usuarios.ts:59`, `reports.ts:50-61,153-159,268-273,369-382`, `painel.ts:107-119,238-244,274-281`.
Busca por `.range(` no repositório: **zero ocorrências**. Só existem 7 `.limit()` (auditoria 200, mensagens 100, notificações 200, atividade recente 10×3, apelidos 1).

**Cenário de falha concreto:** `listPagamentos()` sem filtro faz `SELECT * FROM pagamentos ORDER BY data_pagamento DESC, created_at DESC` sem teto. Uma linha de pagamento serializada tem ~350 bytes de JSON.
- **~5.000 pagamentos** (≈1 ano de operação com 20 lançamentos/dia): ~1,8 MB de JSON por request, o React Server Component serializa tudo no payload RSC → a página `/pagamentos` passa de ~200 ms para 2-4 s e o TanStack Table renderiza 5.000 linhas no cliente.
- **~50.000 pagamentos**: ~18 MB por request. Somando o pico do parser JSON, a lambda da Vercel (1 GB) entra em risco de OOM; na prática a rota começa a estourar o timeout de 10s (plano Hobby) bem antes disso.
- `getKpisResumo()` (`painel.ts:107-119`) é pior: dispara **duas queries que carregam a tabela inteira de pagamentos confirmados** (`pagsR` e `pagsTodosR` — filtros idênticos, só a lista de colunas muda) **a cada F5 do painel**, que é a home do sistema.
- `getMesData` carrega `SELECT *` de todos os pagamentos do mês para gerar o PDF — aceitável hoje, quebra junto com o resto.

**Ponto de quebra estimado:** degradação perceptível a partir de **~3.000 registros**; falha dura (timeout/OOM) entre **30.000 e 60.000**.

**Correção:**
1. Adicionar `page`/`pageSize` às `ListXFilters` e `.range(offset, offset + pageSize - 1)` com `{ count: 'exact' }`, expondo o total na UI.
2. Trocar `getKpisResumo` e `sumPagamentosBy` por agregação no banco (o Postgres soma `numeric` sem transferir linha alguma) — ver **Migration H** (`kpis_pagamentos()` / `serie_mensal_pagamentos()`).
3. Deduplicar a query redundante `pagsR`/`pagsTodosR` em `painel.ts:110-118`.

**Esforço:** 8h.

---

### F-10 — ALTO · O índice de pagamentos por data não serve a nenhuma query do painel/relatórios

**Local:** índice `idx_pagamentos_obra_data(obra_id, data_pagamento DESC)` (`20260903100300:44`) vs. as queries `painel.ts:110-113,238-244,274-281`, `pagamentos.ts:80-96`, `reports.ts:153-159`.

O único índice que cobre `data_pagamento` tem `obra_id` como **coluna líder**. Todas as queries de dashboard e de fechamento mensal filtram **apenas por data** (sem `obra_id`):

```ts
// painel.ts:238-244 (getSerieMensal)
.eq('status_pagto','confirmado').is('deleted_at', null).gte('data_pagamento', inicio)
// reports.ts:153-159 (getMesData)
.gte('data_pagamento', inicio).lt('data_pagamento', fim).is('deleted_at', null)
```

O planner não consegue usar um B-tree composto sem predicado sobre a primeira coluna (só via index-only scan degenerado, que ele descarta) → **Seq Scan em `pagamentos` em toda carga do painel e em todo relatório mensal**. Com 50k linhas e o painel sendo a home, isso é o gargalo dominante.

**Cenário de falha concreto:** 50.000 pagamentos, painel aberto por 6 usuários simultâneos = 12 seq scans concorrentes (2 queries por load) na tabela mais quente do banco, cada uma lendo ~20 MB. No plano Supabase Micro/Small, a latência do painel sai de ~150 ms para 3-6 s e o pool de conexões satura.

**Correção:** **Migration A** cria `idx_pagamentos_data_ativos(data_pagamento DESC) WHERE deleted_at IS NULL` e `idx_pagamentos_status_data(status_pagto, data_pagamento DESC) WHERE deleted_at IS NULL`.

**Esforço:** 15 min (é só aplicar a migration).

---

### F-11 — ALTO · Rollback de upload de documento é negado pela RLS para gestor/financeiro

**Local:** `apps/web/app/(app)/documentos/actions.ts:107-125`; policy `documentos_delete` (`20260903100500:47` — `FOR DELETE USING has_role(['admin'])`).

```ts
try { await uploadDocumentBuffer(path, buffer, file.type); }
catch (uploadErr) {
  try { await supabase.from('documentos').delete().eq('id', documentoId); } catch { /* best effort */ }
  redirect(`/documentos/novo?error=...`);
}
```

O client usado é o **autenticado** (`createClient()`, linha 61). A policy de DELETE em `documentos` é **admin-only**. Para um usuário `gestor` ou `financeiro`, o `.delete()` casa 0 linhas, **não lança erro**, e o `catch` nunca dispara.

**Cenário de falha concreto:** um `financeiro` sobe a NF `nf-4471.pdf` (2 MB) numa hora de rede instável. O `INSERT` grava a linha com `storage_path='pending'` e `hash_sha256='ab12...'` (o índice `idx_documentos_hash` é UNIQUE parcial). O upload para o Storage falha. O rollback é silenciosamente negado pela RLS → **a linha órfã permanece**. Ele tenta de novo com o mesmo arquivo → o hash colide → mensagem `"Arquivo idêntico já existe (mesmo conteúdo). Verifique documentos anteriores."` (`documentos/actions.ts:88`). O usuário fica travado, olhando uma lista onde o documento não aparece (a UI filtra por `deleted_at`, mas a linha `pending` **aparece** na listagem com `storage_path='pending'`), e o único desbloqueio é o cron `sweep-pending-documentos` — que roda **1× por dia às 03:00 UTC** (limite do plano Hobby, documentado em `route.ts:16-18`). Ou seja: até ~24h de bloqueio para reanexar aquela nota fiscal.

**Impacto:** bloqueio operacional de até 24h no anexo de documentos fiscais + linhas fantasma na listagem.

**Correção:**
1. Fazer o rollback com o service_role client (mesmo caminho do sweeper), que é quem já é usado para o Storage (`lib/storage/documents.ts:14-21`):
```ts
import { deleteDocumentoRow } from '@/lib/storage/documents';  // novo helper com serviceClient()
...
catch (uploadErr) {
  await deleteDocumentoRow(documentoId).catch(() => {});
  redirect(...);
}
```
2. Excluir linhas `storage_path='pending'` da listagem (`lib/data/documentos.ts:20`): `.neq('storage_path', 'pending')`.
3. Tornar o índice de hash tolerante a rascunho: **Migration E** recria `idx_documentos_hash` com `AND storage_path <> 'pending'`.
4. Reduzir a janela do sweeper para 15 min quando o plano permitir.

**Esforço:** 2h30.

---

### F-12 — MÉDIO/ALTO · `confirmarPendencia`: 3 mutações não atômicas, 2 sem verificação de erro

**Local:** `apps/web/app/(app)/pendentes/actions.ts:75-144`.

A sequência é: (1) `INSERT pagamentos`; (2) `UPDATE mensagens_whats SET status='confirmada', pagamento_id=...`; (3) `UPDATE confirmacoes_pendentes SET resolvida=true`. As etapas 2 e 3 são `await` **sem capturar `error`** (linhas 125-138).

**Cenário de falha concreto:** o pagamento é inserido; a lambda da Vercel atinge o timeout (ou a rede cai) entre as etapas 1 e 2. Estado resultante: **pagamento de R$ X existe e conta no painel e nos relatórios**, mas `mensagens_whats.status` continua `'classificada'` sem `pagamento_id`, e a pendência continua `resolvida=false` na fila. O gestor volta em `/pendentes`, vê o mesmo item, clica em Confirmar de novo — aí o guard de `criado_via_msg_id` (`actions.ts:64-73`) encontra o pagamento existente e o fluxo se autocorrige. **Porém**, se a falha ocorrer entre 2 e 3, a mensagem já está `'confirmada'` e o `confirmarPendencia` aborta em `:44-46` com "Esta pendência já foi resolvida" — e a linha em `confirmacoes_pendentes` **nunca fica resolvida**, ficando permanentemente na fila (mesmo efeito do F-04).

**Impacto:** fila de pendências com itens insolúveis; mensagens de sucesso quando nada foi ligado.

**Correção:** encapsular as três operações numa RPC plpgsql (transação única) — ver **Migration G** (`confirmar_pendencia_atomic`). O TypeScript vira:

```ts
const { data, error } = await supabase.rpc('confirmar_pendencia_atomic', {
  p_confirmacao_id: confirmacao_id,
  p_user_id: userId,
  p_hoje: hoje,
});
if (error) redirect(`/pendentes?error=${encodeURIComponent(mapDbErrorWithContext(error, {
  '23503': 'Obra ou fornecedor referenciado não existe.',
  '23502': 'Faltam dados obrigatórios (valor e obra).',
}))}`);
```

**Esforço:** 4h.

---

### F-13 — MÉDIO/ALTO · Relatórios somam todos os status; o painel só soma `confirmado`

**Local:** `lib/data/reports.ts:50-55` (obra), `:153-159` (mês), `:268-275` (fornecedor), `:369-375` (atividade) — nenhum filtra `status_pagto`.
`lib/data/painel.ts:110-113` e `:238-243` — ambos filtram `.eq('status_pagto','confirmado')`.

**Cenário de falha concreto:** em setembro há R$ 900.000 em pagamentos `confirmado`, R$ 120.000 `aguardando` (aprovação pendente) e R$ 15.000 marcados `erro` (lançamento que a IA errou e ninguém apagou). O painel exibe "Gasto no mês: **R$ 900.000**". O gestor exporta `/api/exports/mes?ano=2026&mes=9&format=pdf` e o PDF de fechamento traz **R$ 1.035.000**. Diferença de R$ 135.000 entre duas telas do mesmo sistema, no mesmo dia, sem explicação na UI.

Efeito colateral em `getObraCompletaData` (`reports.ts:110-111`): `percentualOrcamento = valorTotalPago / orcamento` também inclui `aguardando` e `erro` → a obra aparece estourando o orçamento antes de estourar de fato.

**Impacto:** dois números oficiais divergentes para a mesma pergunta financeira. Erosão de confiança no relatório entregue ao cliente.

**Correção:** decidir a semântica (recomendo: relatórios somam `confirmado` como total principal e exibem `aguardando` numa linha separada "a aprovar") e aplicar:

```ts
// reports.ts — em getObraCompletaData / getMesData / getFornecedorData
.in('status_pagto', ['confirmado'])          // total oficial
// e uma segunda query/agrupamento para 'aguardando', exibido em separado
```
E, em `getMesData`, adicionar `porStatus` ao objeto `totais` para o PDF explicitar a composição.

**Esforço:** 3h (inclui ajustar 4 templates PDF + 4 geradores CSV).

---

### F-14 — MÉDIO · Fuso horário: `current_date` em UTC e janelas de relatório em `Z`

**Local:** `20260903100300_...sql:34` (`data_pagamento DATE NOT NULL DEFAULT current_date`); `lib/data/reports.ts:372-373,379-380`; `app/(app)/pendentes/actions.ts:59`; `lib/services/classify-and-persist.ts:94`.

Todas as colunas de instante são `TIMESTAMPTZ` (correto). Os dois furos são:

1. **`DEFAULT current_date`** — o banco Supabase roda em UTC. Um `INSERT` sem `data_pagamento` explícito às **21h30 de Brasília** grava `current_date` = **o dia seguinte**. Hoje o caminho da UI sempre envia a data (Zod exige), mas o caminho WhatsApp não: `classify-and-persist.ts:94` usa `new Date().toISOString().slice(0,10)` — que é a data **UTC** do servidor. **Cenário concreto:** o encarregado manda "paguei 2.400 na areia" às 21h50 de 30/09 (BRT). O classificador lança o pagamento com `data_pagamento = 2026-10-01`. **O gasto sai do fechamento de setembro e entra em outubro.** O mesmo em `pendentes/actions.ts:59` (`hoje`).

2. **Janelas UTC nos relatórios de atividade** — `getAtividadeData(from, to)` monta `` `${from}T00:00:00.000Z` `` e `` `${to}T23:59:59.999Z` ``. Um relatório "01/09 a 30/09" na verdade cobre de **30/08 21:00 BRT** até **30/09 20:59:59 BRT**: inclui 3 horas do dia 31/08 e **perde as últimas 3 horas do dia 30/09** — exatamente a janela em que os lançamentos de fim de expediente acontecem.

**Correção:**
```ts
// lib/util/date-br.ts (novo)
export const TZ_BR = 'America/Sao_Paulo';
/** Data 'YYYY-MM-DD' no fuso de São Paulo, independente do fuso do servidor. */
export function hojeBR(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_BR }).format(d); // en-CA => YYYY-MM-DD
}
/** Limites UTC de um dia civil brasileiro, para filtrar TIMESTAMPTZ. */
export function diaBRParaUtc(dia: string): { inicio: string; fim: string } {
  return { inicio: `${dia}T00:00:00-03:00`, fim: `${dia}T23:59:59.999-03:00` };
}
```
Substituir `new Date().toISOString().slice(0,10)` por `hojeBR()` em `classify-and-persist.ts:94` e `pendentes/actions.ts:59`; usar `diaBRParaUtc` em `reports.ts:372-373,379-380`. No banco, **Migration A** troca o default para `(now() AT TIME ZONE 'America/Sao_Paulo')::date`.

**Esforço:** 2h30.

---

### F-15 — MÉDIO · Toda soma monetária é feita em float IEEE-754 no Node

**Local:** `reports.ts:92-97,300,435`; `painel.ts:147,252,295,162`; `pagamentos.ts:100`; `categorias.ts:63`.

O schema está correto (`NUMERIC(12,2)`), mas o PostgREST serializa `numeric` como número JSON e o supabase-js entrega `number` (double). Todas as agregações são `reduce((s, p) => s + Number(p.valor), 0)`.

**Cenário de falha concreto:** 1.200 pagamentos de valores como `1234.57`, `89.95`, `0.10`. A soma em double acumula erro de representação: `0.1 + 0.2 = 0.30000000000000004`. Com ~1.200 parcelas o desvio típico fica na casa de 1e-9 a 1e-7 — invisível no `toLocaleString` do painel (arredonda), **mas visível no CSV** (`lib/reports/csv.ts` exporta o número cru) e na conciliação com o razão contábil: o CSV do fechamento sai `1035000.0000000002` enquanto o Postgres, somando `numeric`, daria `1035000.00` exato. Um contador que importa o CSV no Excel/ERP vê a diferença de centavo e questiona o relatório.

**Impacto:** ruído em exportações contábeis; impossibilidade de bater o total do CRM com o extrato bancário no centavo.

**Correção:**
1. Agregar no banco (RPC `SUM(valor)::numeric`) — **Migration H**. O Postgres soma em `numeric` (decimal exato).
2. Enquanto isso, somar em centavos inteiros no TS:
```ts
// lib/util/money.ts
export function somaBRL(valores: Array<number | string>): number {
  const cents = valores.reduce((acc, v) => acc + Math.round(Number(v) * 100), 0);
  return cents / 100;
}
```
Substituir os 9 `reduce` listados acima.

**Esforço:** 2h (curto prazo) / incluído na Migration H (definitivo).

---

### F-16 — MÉDIO · `audit_log`: autor anônimo em service_role, sem append-only, sem índice de tempo

**Local:** `20260907160000_audit_triggers.sql:38-44,78-79`; `20260903100400:1-11`; consumidores em `lib/data/auditoria.ts:65-69`.

Três problemas distintos:

**(a) Autoria perdida.** A função lê `auth.uid()`, que é `NULL` sempre que a operação vem do `service_role`. E as operações mais sensíveis do sistema usam justamente service_role:
- `updateUsuarioPapelAdmin` (`usuarios.ts:165-173`) — promover alguém a admin;
- `archiveUsuarioAdmin` / `restoreUsuarioAdmin`;
- `mergeFornecedores` → `merge_fornecedores_atomic` (`merge-fornecedores.ts:53-56`) — funde dois cadastros e move pagamentos;
- `commitImport` (`import-pagamentos.ts:194`) — insere centenas de pagamentos;
- `classifyAndPersist` — cria pagamentos vindos do WhatsApp.

**Cenário concreto:** o admin funde "Casa das Tintas" com "Casa das Tintas LTDA", movendo 340 pagamentos. O `audit_log` registra 340 UPDATEs em `pagamentos` **com `user_id = NULL`**, e a `/auditoria` mostra tudo como autor em branco. Quando o cliente perguntar "quem mudou o fornecedor desses lançamentos?", não há resposta.

**(b) Não é append-only.** `20260907150000:11` concede `DELETE` em todas as tabelas de `public` ao `service_role`, e o service_role bypassa RLS. Qualquer código do app (ou qualquer um com a chave em mãos) pode `DELETE FROM audit_log`. Um log de auditoria mutável não serve como evidência.

**(c) Sem índice em `created_at`.** `listAuditLog` faz `ORDER BY created_at DESC LIMIT 200` — Seq Scan + Sort de todo o log. Com 6 tabelas auditadas e uso normal, o `audit_log` cresce ~10-50× mais rápido que `pagamentos`; a `/auditoria` fica lenta antes de qualquer outra tela.

**(d) Grava a linha inteira**, incluindo `webhooks_outbound.secret`, `fornecedores.documento` (CPF/CNPJ) e todos os valores de pagamento, com leitura liberada para `admin + gestor` (mais ampla que a RLS da tabela de origem, no caso de webhooks). Ver F-06.

**Correção:** **Migration C** — (1) parâmetro de contexto `app.actor_id` que o service_role seta antes de escrever; (2) revogar `UPDATE, DELETE` de `audit_log` de todos os papéis + trigger `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`; (3) índice em `created_at DESC`; (4) máscara de colunas sensíveis. No TypeScript, as funções que usam service_role passam a chamar:

```ts
// lib/supabase/service.ts (novo helper)
export async function withActor<T>(sb: SupabaseClient<Database>, userId: string | null,
                                   fn: () => Promise<T>): Promise<T> {
  if (userId) await sb.rpc('set_audit_actor', { p_user_id: userId });
  return fn();
}
```

**Esforço:** 5h.

---

### F-17 — MÉDIO · RPCs: revisão de `merge_fornecedores_atomic` e `increment_webhook_execution`

**Local:** `20260908120000_merge_fornecedores_rpc.sql`; `20260908110000_webhook_counter_rpc.sql`.

**O que está correto (verificado):**

| Critério | `merge_fornecedores_atomic` | `increment_webhook_execution` |
|---|---|---|
| `SECURITY DEFINER` | ✅ sim | ✅ sim |
| `SET search_path = public` | ✅ sim (linha 29) | ✅ sim (linha 23) |
| `REVOKE ALL FROM PUBLIC` | ✅ linha 126 | ✅ linha 38 |
| `GRANT EXECUTE` | ✅ **só** `service_role` (127) | ✅ **só** `service_role` (39) |
| **Chamável por `authenticated` via PostgREST?** | ❌ **NÃO** — sem GRANT, o PostgREST responde `42883/PGRST202` | ❌ **NÃO** |
| Validação de entrada | ✅ `keep <> drop`, existência + `FOR UPDATE` em ambos | ⚠️ nenhuma (mas os parâmetros vêm só de código server-only) |

**Conclusão:** **não há vetor de escalonamento via PostgREST nessas duas RPCs.** A autorização real vive em `assertAdminOrGestor()` (`fornecedores/duplicatas/actions.ts:15-36`), o que é aceitável desde que o service_role nunca seja exposto.

**Problemas remanescentes (menores):**

1. **Deadlock em merges concorrentes.** A RPC trava `p_drop_id` e depois `p_keep_id` na ordem recebida (linhas 45-57). Dois admins executando `merge(A,B)` e `merge(B,A)` simultaneamente travam em ordens opostas → `40P01 deadlock detected`, que **não está mapeado em `errors.ts`** → o usuário vê "Erro ao processar. Tente novamente." Correção: ordenar os locks (`LEAST/GREATEST`) antes de travar.
2. **`IF NOT EXISTS → INSERT` na linha 101-108** é o padrão exato de race que o próprio código combate em outros lugares. Sem UNIQUE em `fornecedor_apelidos(fornecedor_id, lower(apelido))`, dois merges concorrentes para o mesmo `keep` inserem o apelido duplicado. Correção: **Migration D** cria o UNIQUE e a RPC passa a usar `ON CONFLICT DO NOTHING`.
3. **Autoria perdida** — ver F-16(a).
4. `merge_fornecedores_atomic` **não move `documentos.pagamento_id`-independentes já movidos** — na verdade move `documentos` corretamente (linha 73-79). ✅ Sem problema.
5. `increment_webhook_execution` sem validação: um `p_status` arbitrário (ex.: `999999`) entra sem CHECK. Correção incluída na **Migration A** (CHECK `ultima_execucao_status BETWEEN 0 AND 599`).

**Esforço:** 1h30.

---

### F-18 — MÉDIO · Faltam CHECK constraints básicos

**Local:** todas as migrations de DDL. Constraints existentes hoje: `pagamentos.valor >= 0`, `audit_log.acao IN (...)`, `profiles.timezone char_length > 0`. Só isso.

**Cenários concretos:**
- `valor = 0`: `PagamentoCreateSchema` aceita `n >= 0` (`pagamento.ts:21`) e o banco também. Um pagamento de **R$ 0,00** entra na base, aparece no relatório e no ticket médio do fornecedor (`reports.ts:302` divide pela quantidade) — puxando a média para baixo sem representar nada. Note a incoerência: o import CSV exige `n > 0` (`import-pagamento.ts:56`), o formulário não.
- `data_prevista_fim < data_inicio`: nem Zod nem o banco checam. A obra "Alpha" pode ter início 01/10/2026 e previsão de fim 15/09/2026, e nenhuma tela reclama.
- `confianca_ia`: `NUMERIC(4,3)` aceita `9.999`. Se o classificador retornar `1.5` por bug de prompt, o auto-aprovar (`classify-and-persist.ts:83`, `>= 0.85`) dispara e o pagamento entra sozinho.
- `webhooks_outbound.eventos`: array TEXT livre. Um evento digitado errado nunca dispara e ninguém descobre.
- `url` sem exigir `https` — `CriarWebhookSchema` (`webhooks/actions.ts:43`) aceita `http://`, enviando o payload assinado em texto puro.
- `documentos.tamanho_bytes` pode ser negativo.

**Correção:** **Migration A**.

**Esforço:** 1h (aplicar + verificar dados existentes com as queries de pré-checagem incluídas na migration).

---

### F-19 — MÉDIO · FKs sem índice (7 colunas)

Já listadas em §1.3. O caso mais crítico é **`confirmacoes_pendentes.mensagem_id`**, que é `ON DELETE CASCADE`: qualquer `DELETE` em `mensagens_whats` obriga o Postgres a varrer `confirmacoes_pendentes` inteira para achar os filhos. E `pagamentos.criado_por_user_id`, cujo FK `NO ACTION` obriga um Seq Scan em `pagamentos` na tentativa de deletar um profile.

**Cenário concreto:** um admin apaga um usuário pelo dashboard do Supabase. O `ON DELETE CASCADE` de `profiles.user_id → auth.users` tenta remover o profile; o FK `pagamentos.criado_por_user_id → profiles` (NO ACTION) força a verificação → **Seq Scan em `pagamentos`** (50k linhas) → e no fim retorna `23503 update or delete on table "profiles" violates foreign key constraint`. O admin não entende o erro, tenta de novo, e o banco leva vários segundos a cada tentativa.

**Correção:** **Migration A**.

**Esforço:** 15 min.

---

### F-20 — MÉDIO · `restoreObra` sobrescreve o status original

**Local:** `apps/web/app/(app)/obras/actions.ts:147-160`.

```ts
.update({ status: 'ativa', deleted_at: null })
```

**Cenário concreto:** a obra "Residencial Cavalcanti II" é entregue e marcada `concluida`. Meses depois é arquivada. Alguém precisa consultar um documento e clica em "Restaurar". A obra volta como **`ativa`** — entra de novo na contagem "Obras ativas" do painel (`painel.ts:126`), na lista de obras do formulário de pagamento (`pagamento-form.tsx:45`) e no contexto do classificador de WhatsApp (`classify-and-persist.ts:50`, que filtra `status='ativa'`). A IA passa a considerar uma obra encerrada como destino válido de novos lançamentos.

Espelho do problema: `archiveObra` (`:109`) grava `status='arquivada'` **sem preservar** o status anterior em lugar nenhum.

**Correção:** preservar o status anterior. Sem coluna nova, dá para reconstruir do `audit_log`, mas o correto é uma coluna:

```sql
-- incluído na Migration A
ALTER TABLE obras ADD COLUMN IF NOT EXISTS status_antes_arquivo obra_status;
```
```ts
// archiveObra
const { data: atual } = await supabase.from('obras').select('status').eq('id', id).maybeSingle();
await supabase.from('obras')
  .update({ status: 'arquivada', status_antes_arquivo: atual?.status ?? 'ativa',
            deleted_at: new Date().toISOString() })
  .eq('id', id).is('deleted_at', null).select('id');

// restoreObra
const { data: atual } = await supabase.from('obras')
  .select('status_antes_arquivo').eq('id', id).maybeSingle();
await supabase.from('obras')
  .update({ status: atual?.status_antes_arquivo ?? 'ativa',
            status_antes_arquivo: null, deleted_at: null })
  .eq('id', id).select('id');
```

**Esforço:** 1h30.

---

### F-21 — MÉDIO · `atualizarCategoria` apaga cor e ícone quando não enviados

**Local:** `apps/web/app/(app)/config/categorias/actions.ts:85-89`.

```ts
.update({
  nome: parsed.data.nome,
  cor:   parsed.data.cor   ?? null,     // <-- undefined vira NULL
  icone: parsed.data.icone ?? null,     // <-- undefined vira NULL
})
```

`CategoriaUpdateSchema` é `CategoriaCreateSchema.partial()`, então `cor` e `icone` podem legitimamente vir `undefined`. O `?? null` transforma "campo ausente" em "apagar o campo".

**Cenário concreto:** qualquer requisição parcial (form alterado, integração futura, ou o próprio form se o `<select>` de cor estiver desabilitado/vazio) que envie só `id` + `nome` **zera a cor da categoria**. O donut do painel (`painel.ts:290`) cai no fallback `#A1A1A1` e todas as fatias ficam cinza. Note o contraste com o padrão correto usado em `updateObra`/`updatePagamento`/`updateFornecedor`, que fazem `...(x !== undefined ? { x } : {})`.

**Correção:** adotar o mesmo padrão spread condicional das outras actions:
```ts
.update({
  ...(parsed.data.nome  !== undefined ? { nome: parsed.data.nome } : {}),
  ...(parsed.data.cor   !== undefined ? { cor: parsed.data.cor } : {}),
  ...(parsed.data.icone !== undefined ? { icone: parsed.data.icone } : {}),
})
.eq('id', parsed.data.id).select('id');
```

**Esforço:** 20 min.

---

### F-22 — MÉDIO · Zero testes unitários; `vitest` sequer está instalado

**Evidência (executado nesta auditoria):**

```
$ pnpm -r test
apps/web test$ vitest run
apps/web test: 'vitest' não é reconhecido como um comando interno ou externo
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] web@0.0.1 test: `vitest run`  → Exit status 1
```

`apps/web/package.json` declara `"test": "vitest run"` mas **`vitest` não consta em `devDependencies`**. Não existe `vitest.config.*` nem um único arquivo `*.test.ts` no workspace (só 4 specs Playwright em `apps/web/e2e/`, que exigem ambiente rodando). Cobertura unitária: **0%**.

`pnpm -r typecheck` **passa** nos dois pacotes — o TypeScript está saudável, mas typecheck não pega nenhum dos bugs desta auditoria.

**Os 5 módulos que mais precisam de teste, ordenados por risco financeiro:**

| # | Módulo | Por quê | Casos mínimos |
|---|---|---|---|
| 1 | `lib/schemas/pagamento.ts` + `lib/schemas/import-pagamento.ts` (parsers de valor) | **F-01**: erro de 1000× em valor monetário, silencioso, sem detecção possível a jusante. É a única barreira entre o teclado do gestor e a coluna `valor`. | tabela: `"1.500"`→1500, `"1.500,00"`→1500, `"1234.56"`→1234.56, `"1,234.56"`→1234.56, `"R$ 89,90"`→89.9, `"10,555"`→10.56, `"0"`→erro, `"abc"`→erro, `"1e999"`→erro, `""`→erro |
| 2 | `lib/services/import-pagamentos.ts` | **F-02**: um clique duplicado dobra o fechamento mensal. Sem teste de idempotência, a regressão volta em qualquer refactor. | mesmo lote 2× → 1 inserção; linha com obra inexistente → não inserida; CSV com BOM/CRLF; chunking em 100 |
| 3 | `lib/data/reports.ts` | **F-13/F-15**: é o artefato que sai da empresa para o cliente. Divergência painel×PDF e centavos flutuantes. | total do mês só com `confirmado`; soma exata em centavos; `percentualOrcamento` com orçamento 0/null; janelas de data em fuso BR |
| 4 | `lib/services/classify-and-persist.ts` | **F-03/F-04/F-14**: cria pagamentos **sem humano no meio** (auto-aprovar em `confidence >= 0.85`). Um bug aqui lança dinheiro sozinho. | confidence 0.849 vs 0.851; `valor` ausente → não auto-aprova; reprocessamento não duplica pendência; data usa fuso BR |
| 5 | `app/(app)/pendentes/actions.ts` | **F-08/F-12**: transição de estado que materializa dinheiro (pendência → pagamento) com 3 mutações e um IDOR. | duplo submit → 1 pagamento; `mensagem_id` forjado → rejeitado; falha no passo 2 → sem estado órfão |

**Correção:**
```bash
pnpm --filter web add -D vitest @vitest/coverage-v8
```
```ts
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'],
                thresholds: { lines: 60, functions: 60 } },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```
Começar pelo módulo 1 (é puro, sem I/O — dá 100% de cobertura em 1h).

**Esforço:** 1h de setup + 8h para os 5 módulos.

---

### F-23 — MÉDIO · `auth.admin.listUsers({perPage:1000})` em caminho quente e em busca unitária

**Local:** `lib/data/usuarios.ts:67,107-110`; `lib/data/notificacoes.ts:55-57`.

```ts
// usuarios.ts:107-110 — buscar UM usuário carrega TODOS
export async function getUsuario(userId: string): Promise<UsuarioItem | null> {
  const usuarios = await listUsuarios(true);
  return usuarios.find((u) => u.user_id === userId) ?? null;
}
```

**Cenário concreto 1:** `reenviarConvite` (`config/usuarios/actions.ts:91`) chama `getUsuario(id)`, que executa `SELECT * FROM profiles` **e** uma chamada HTTP à Admin API do GoTrue trazendo até 1.000 usuários — para ler um único e-mail.

**Cenário concreto 2 (pior):** `createPagamento` com `status_pagto='aguardando'` chama `sendPagamentoAguardandoEmail` → `getRecipientsByPapel` → `listUsers({perPage:1000})`. **Toda vez que alguém lança um pagamento aguardando aprovação**, o app faz um round-trip completo à Admin API. Isso está no caminho crítico da UX (comentário em `pagamentos/actions.ts:60-61` reconhece o await).

**Cenário concreto 3 (correção silenciosa):** `perPage: 1000` é um teto rígido. No usuário nº 1.001, `getRecipientsByPapel` simplesmente não encontra o e-mail (`notificacoes.ts:60,74` filtra `email.length > 0`) e o gestor **para de receber notificações sem nenhum erro**. Improvável nesta operação, mas é uma bomba-relógio silenciosa.

**Correção:** cachear o mapa `user_id → email` por request (`React.cache`) e paginar de verdade:
```ts
// lib/data/usuarios.ts
import { cache } from 'react';
export const getAuthUserMap = cache(async () => {
  const admin = serviceRoleClient();
  const map = new Map<string, { email: string; last_sign_in_at: string | null; email_confirmed_at: string | null }>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data.users.length) break;
    for (const u of data.users) map.set(u.id, {
      email: u.email ?? '', last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null });
    if (data.users.length < 1000) break;
  }
  return map;
});
export async function getUsuario(userId: string) { /* consulta 1 profile + getAuthUserMap() */ }
```
No médio prazo, replicar `email` em `profiles` (via `handle_new_user`) e eliminar a Admin API do caminho de leitura.

**Esforço:** 2h.

---

### F-24 — BAIXO/MÉDIO · Taxonomia de erros incompleta

**Local:** `apps/web/lib/schemas/errors.ts:15-24`.

Cobertura atual: `23502, 23503, 23505, 23514, 42501, 42P01, PGRST116, PGRST301`. Mensagens em pt-BR, sem vazar nome de constraint/coluna ✅, com fallback seguro ✅. O uso de `mapDbErrorWithContext` para diferenciar `23505` por contexto (`documentos/actions.ts:86-92`) é um bom padrão.

**Códigos relevantes que faltam** (todos alcançáveis por este app):

| Código | Quando ocorre aqui | Hoje o usuário vê |
|---|---|---|
| `22P02` | `bulkArchiveObras` com id não-UUID (`obras/actions.ts:135`); filtro de enum inválido na querystring | "Erro ao processar. Tente novamente." |
| `22003` | `valor` acima de `NUMERIC(12,2)` (F-01) | idem |
| `22007/22008` | data malformada num filtro de relatório | idem |
| `40001` | serialization failure sob concorrência | idem |
| `40P01` | deadlock em merges concorrentes (F-17.1) | idem |
| `57014` | statement timeout — provável nas queries sem paginação (F-09) | idem |
| `PGRST202` | RPC inexistente/sem GRANT (ex.: se `increment_webhook_execution` perder o grant) | idem |
| `PGRST204` | coluna do payload não existe (types dessincronizados) | idem |
| `PGRST103` | `.range()` inválido — passará a importar após F-09 | idem |

**Correção:**
```ts
const CODE_MESSAGES: Record<string, string> = {
  '22003': 'Valor numérico fora do limite permitido.',
  '22007': 'Data em formato inválido.',
  '22008': 'Data fora do intervalo permitido.',
  '22P02': 'Um dos valores enviados está em formato inválido.',
  '23502': 'Um campo obrigatório está vazio.',
  '23503': 'Este registro está referenciado por outro e não pode ser modificado.',
  '23505': 'Já existe um registro com esses dados únicos.',
  '23514': 'Um dos valores viola uma regra do banco.',
  '40001': 'Conflito de concorrência. Tente novamente.',
  '40P01': 'Duas operações conflitaram. Tente novamente.',
  '42501': 'Permissão negada para esta operação.',
  '42P01': 'Recurso não encontrado.',
  '57014': 'A consulta demorou demais e foi cancelada. Refine os filtros.',
  PGRST103: 'Intervalo de paginação inválido.',
  PGRST116: 'Registro não encontrado.',
  PGRST202: 'Operação indisponível no servidor. Avise o suporte.',
  PGRST204: 'Campo desconhecido enviado ao banco. Avise o suporte.',
  PGRST301: 'Sessão expirada. Faça login novamente.',
};
```
Adicionar também `console.error` estruturado (code + message + contexto) antes do `return`, já que hoje a mensagem crua é descartada sem log — dificultando o diagnóstico em produção.

**Esforço:** 45 min.

---

### F-25 — BAIXO/MÉDIO · Zod × constraints do banco: divergências

Confronto schema-a-schema (nenhum caso de "Zod aceita mais que a coluna" clássico — todas as colunas de texto são `TEXT` ilimitado, então os `max()` do Zod são **mais** restritivos, o que é seguro). As divergências reais são de **semântica**:

| Campo | Zod | Banco | Divergência / risco |
|---|---|---|---|
| `pagamentos.valor` | `>= 0` (`pagamento.ts:21`) | CHECK `>= 0` | ✅ coerentes — mas **ambos deveriam ser `> 0`**; e o import exige `> 0` (`import-pagamento.ts:56`) → **dois caminhos com regras diferentes** |
| `pagamentos.valor` | sem teto | `NUMERIC(12,2)` (máx 9.999.999.999,99) | erro `22003` não tratado (F-01/F-24) |
| `obras.orcamento` | `Number(v)`, sem parser BR | `NUMERIC(12,2)` | "1.500.000,00" → `NaN` → erro enganoso (F-01) |
| `documentos.chave_acesso_nf` | `max(50)` | TEXT + UNIQUE parcial | a chave NF-e tem **exatamente 44 dígitos**; hoje aceita "123" e ocupa o slot único |
| `documentos.numero_nf` | `max(50)` | TEXT | ok |
| `obras.data_inicio/data_prevista_fim` | regex ISO, sem relação entre si | DATE, sem CHECK | fim antes do início passa nos dois (F-18) |
| `mensagens_whats.confianca_ia` | não validado (vem da IA) | `NUMERIC(4,3)`, sem CHECK | valor > 1 aciona auto-aprovação (F-18) |
| `categorias.nome` | `max(80)`, sem normalização | TEXT **UNIQUE global** | "Material" e "material " são distintos para o UNIQUE; e recriar uma categoria arquivada dá 23505 |
| `webhooks_outbound.url` | `.url()` + `startsWith('http')` | TEXT sem CHECK | aceita `http://` (payload assinado em claro) e `http://169.254.169.254/...` (SSRF) |
| `webhooks_outbound.eventos` | `z.enum(EVENTOS_VALIDOS)` ✅ | TEXT[] sem CHECK | escrita direta no banco não é validada |
| `profiles.timezone` | whitelist de 8 valores ✅ | CHECK `char_length>0` | Zod mais estrito ✅ |
| `profiles.email_prefs` | `EmailPrefsSchema` estrito ✅ | JSONB sem validação | leitura defensiva em `parseEmailPrefs` ✅ |

**Sobre o parsing de moeda a partir de string BR:** documentado em F-01. **Não existe um único teste** para nenhum dos três parsers (F-22).

**Correção:** alinhar via **Migration A** (CHECKs) + os ajustes de Zod já descritos em F-01, mais:
```ts
// documento.ts
chave_acesso_nf: z.string().trim()
  .regex(/^\d{44}$/u, 'Chave de acesso da NF-e deve ter exatamente 44 dígitos')
  .optional(),
// categoria.ts
nome: z.string().trim().min(2).max(80),   // + normalização de espaços internos
```

**Esforço:** 1h30.

---

### F-26 — BAIXO · `mensagens_whats` e `confirmacoes_pendentes` fora da auditoria e sem soft-delete

**Local:** `20260907160000_audit_triggers.sql:15-21` (lista de exclusões) e `:90`.

O comentário justifica a exclusão como "system-received, tem próprio status tracking". Na prática, `mensagens_whats.status` é **mutável por qualquer admin/gestor/financeiro** via `rejeitarPendencia` (F-08) e pelo classificador, sem trilha. Não há como responder "quem rejeitou esta mensagem e quando?" — `resposta_bruta='rejeitado via painel'` não guarda o autor.

Além disso, nenhuma das duas tem `deleted_at`: um `DELETE` real (possível via service_role) apaga a mensagem e cascateia as confirmações **sem deixar rastro nenhum**.

**Correção (opcional, incluída como bloco separado na Migration C):** anexar `audit_log_trigger()` a `confirmacoes_pendentes` e a `mensagens_whats` — atentando que o `diff` de INSERT vai carregar `texto_bruto` e `dados_extraidos`, o que reforça a necessidade da máscara e do endurecimento de leitura do F-06/F-16.

**Esforço:** 1h.

---

### F-27 — BAIXO · `fornecedor_apelidos` sem UNIQUE e busca de conflito sem índice utilizável

**Local:** `lib/data/apelidos.ts:24-35`; `20260903100200:43-51`.

```ts
.ilike('apelido', apelido.trim())    // sem % → comparação exata case-insensitive
```

Existe `idx_apelidos_texto ON fornecedor_apelidos(lower(apelido))`, mas `ILIKE` **não usa** esse índice funcional (o planner só o usaria com `lower(apelido) = lower($1)`). Resultado: Seq Scan a cada checagem de conflito de apelido — barato hoje, e trivial de corrigir.

E, sem UNIQUE `(fornecedor_id, lower(apelido))`, o padrão "IF NOT EXISTS → INSERT" da RPC de merge (linhas 101-108) e do fluxo de apelidos pode duplicar sob concorrência (F-17.2).

**Correção:**
```ts
// apelidos.ts — usar o índice funcional
const { data } = await supabase
  .from('fornecedor_apelidos')
  .select('fornecedor_id, apelido')
  .eq('apelido', apelido.trim())        // com o índice de Migration A em (lower(apelido))
  .limit(1).maybeSingle();
```
(ou, melhor, uma RPC `find_apelido_conflict(p_apelido text)` que faça `WHERE lower(apelido) = lower(p_apelido)`).
UNIQUE em **Migration D**.

**Esforço:** 45 min.

---

### F-28 — BAIXO · Índices trigram ausentes para as buscas `ILIKE '%termo%'`

**Local:** `obras.ts:29`, `fornecedores.ts:36`, `pagamentos.ts:46`, `documentos.ts:36`.

Todas as buscas da UI usam `.or('col.ilike.%q%')`. Um `LIKE` com wildcard **à esquerda** não usa B-tree: é sempre Seq Scan + avaliação de padrão linha a linha, agravado pelo `.or()` (2-3 colunas por linha).

**Cenário concreto:** o gestor digita "cimento" no filtro de `/pagamentos` com 50k linhas. O Postgres varre a tabela inteira aplicando `descricao ILIKE '%cimento%' OR observacoes ILIKE '%cimento%'` em cada linha — e ainda devolve **todos** os resultados sem `LIMIT` (F-09). A busca, que deveria ser instantânea, vira a operação mais cara do sistema.

`sanitizeSearchQuery` (`lib/util/search.ts:16`) remove `, ( ) \ % * :`, o que fecha a injeção de filtro do PostgREST ✅ — mas não muda o custo.

**Correção:** **Migration A** habilita `pg_trgm` e cria índices GIN `gin_trgm_ops`. Com trigram, `%cimento%` vira busca por índice (o termo tem ≥ 3 caracteres; termos com 1-2 chars continuam em seq scan — vale adicionar `if (q.length < 3) skip` na camada de dados).

**Esforço:** 30 min (migration) + 30 min (guard de 3 chars).

---

### F-29 — BAIXO · `documentos.pagamento_id ON DELETE SET NULL` órfãna documento fiscal

**Local:** `20260903100300:52`.

O app só faz soft-delete de pagamentos, então hoje não dispara. Mas o cron sweeper (`api/cron/sweep-pending-documentos/route.ts:40-45`) já executa `DELETE` real em `documentos` com service_role, e o rollback de `createDocumento` também. Se algum dia um `DELETE` real chegar a `pagamentos` (limpeza, script de manutenção, LGPD), a nota fiscal correspondente **sobrevive com `pagamento_id = NULL`**, virando um documento sem vínculo financeiro — pior do que ter o delete bloqueado.

**Correção:** trocar para `ON DELETE RESTRICT`, coerente com `pagamentos.obra_id`. Incluído na **Migration A**.

**Esforço:** 20 min.

---

### F-30 — BAIXO · Cadeia de FK impede deletar usuário, e o faz devagar

**Local:** `20260903100100:3` (`profiles.user_id → auth.users ON DELETE CASCADE`) + `20260903100300:37` (`pagamentos.criado_por_user_id → profiles`, sem ON DELETE) + `20260907140000:7` (idem em `documentos`).

Deletar um usuário no dashboard do Supabase → CASCADE tenta apagar o profile → FK `NO ACTION` de `pagamentos`/`documentos` bloqueia com `23503`, após Seq Scan (F-19). O bloqueio é **desejável** (preserva a autoria financeira), mas é acidental, lento e produz uma mensagem incompreensível.

**Correção:** tornar a intenção explícita e rápida:
```sql
-- Migration A
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_criado_por_user_id_fkey;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_criado_por_user_id_fkey
  FOREIGN KEY (criado_por_user_id) REFERENCES profiles(user_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_pagamentos_criado_por ON pagamentos(criado_por_user_id)
  WHERE criado_por_user_id IS NOT NULL;
```
E documentar que o offboarding é sempre por arquivamento + ban (F-05), nunca por delete.

**Esforço:** 30 min.

---

### F-31 — BAIXO · `createPagamento` pode falhar **depois** de gravar o pagamento

**Local:** `apps/web/app/(app)/pagamentos/actions.ts:62-77`.

```ts
if (parsed.data.status_pagto === 'aguardando') {
  const [obraRes, fornRes] = await Promise.all([...]);
  await sendPagamentoAguardandoEmail({...});     // <-- FORA de try/catch
}
```

O comentário nas linhas 60-61 afirma "best-effort — nunca throw", e `sendOne` de fato captura tudo (`send-email.tsx:65-76`). Mas **antes** de `sendOne` roda `getRecipientsByPapel` → `serviceRoleClient()`, que **lança** `new Error('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausente')` (`notificacoes.ts:21`), e `render(<PagamentoAguardandoEmail/>)`, que pode lançar em erro de template.

**Cenário concreto:** um deploy de preview na Vercel esquece de configurar `SUPABASE_SERVICE_ROLE_KEY`. O gestor cria um pagamento `aguardando`: o `INSERT` **é commitado**, e em seguida a action lança → o usuário vê a tela de erro 500 do Next. Ele conclui que o lançamento falhou e cadastra de novo → **pagamento duplicado**, agora criado por ação humana e sem nenhum guard (não há chave única em pagamentos manuais).

Note o contraste: o `dispatchEvento` logo abaixo (linhas 80-92) **está** dentro de try/catch.

**Correção:**
```ts
if (parsed.data.status_pagto === 'aguardando') {
  try {
    const [obraRes, fornRes] = await Promise.all([...]);
    await sendPagamentoAguardandoEmail({...});
  } catch (e) {
    console.error('[createPagamento] notificação falhou', e);   // pagamento já está salvo
  }
}
```
Aplicar o mesmo cuidado em `createDocumento` (já usa try/catch ✅) e em `classify-and-persist.ts:151-184` (já usa ✅).

**Esforço:** 20 min.

---

### F-32 — INFO · `packages/db/src/types.ts` está sincronizado

Comparação manual tabela-a-tabela contra as 20 migrations: **as 14 tabelas de `public` estão presentes e completas**, incluindo as colunas adicionadas nas migrations tardias (`profiles.deleted_at`, `email_prefs`, `timezone`; `documentos.criado_por_user_id`; toda a `webhooks_outbound`), os 11 ENUMs e as 3 funções (`has_role`, `increment_webhook_execution`, `merge_fornecedores_atomic`). `pagamentos.valor` está tipado como `number` (coerente com a serialização do PostgREST — origem do F-15, não do arquivo de tipos).

Higiene de tipos no código de dados: **zero** ocorrências de `any`, `as any`, `as unknown as`, `@ts-ignore` ou `@ts-expect-error` em `apps/web/lib` e `apps/web/app`. Os únicos `!` (non-null assertion) em caminho de dados estão em `lib/services/import-pagamentos.ts:176-183` — e são justamente o ponto onde o servidor confia no payload do cliente (**F-02**). `pnpm -r typecheck` passa nos dois pacotes.

Duas observações menores: `profiles.Relationships` está vazio (o gerador não enxerga a FK para `auth.users`, o que é normal), e `contexto: (args.contexto ?? null) as never` em `notificacoes.ts:93` é um cast de conveniência para o tipo `Json` — inofensivo.

---

## 4. Migrations recomendadas

Todas idempotentes (`IF NOT EXISTS` / `DROP ... IF EXISTS` / `CREATE OR REPLACE`). Aplicar na ordem A → H. **Rodar as queries de pré-checagem antes dos `ALTER ... ADD CONSTRAINT`** — dados legados que violem um CHECK abortam a migration.

### Migration A — Índices, CHECKs e correções de modelagem

`supabase/migrations/20260909100000_indices_checks_integridade.sql`

```sql
-- ============================================================================
-- Migration A — Auditoria 2026-09-09 (Opus 5)
-- Cobre: F-10, F-14, F-18, F-19, F-20, F-25, F-28, F-29, F-30
--
-- PRÉ-CHECAGEM (rodar antes; todas devem retornar 0):
--   SELECT count(*) FROM pagamentos WHERE valor <= 0 AND deleted_at IS NULL;
--   SELECT count(*) FROM obras WHERE orcamento < 0;
--   SELECT count(*) FROM obras WHERE data_inicio IS NOT NULL
--     AND data_prevista_fim IS NOT NULL AND data_prevista_fim < data_inicio;
--   SELECT count(*) FROM mensagens_whats WHERE confianca_ia < 0 OR confianca_ia > 1;
--   SELECT count(*) FROM documentos WHERE tamanho_bytes IS NOT NULL AND tamanho_bytes <= 0;
--   SELECT count(*) FROM webhooks_outbound WHERE url !~* '^https?://';
-- Se alguma retornar > 0, corrigir os dados antes (ou aplicar o CHECK como NOT VALID).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Extensão de busca textual (F-28)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 2) Índices para as queries do painel e dos relatórios (F-10)
--    idx_pagamentos_obra_data tem obra_id como coluna líder e NÃO serve a
--    getSerieMensal / getMesData / getGastoPorCategoria / sumPagamentosBy.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pagamentos_data_ativos
  ON pagamentos (data_pagamento DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_status_data
  ON pagamentos (status_pagto, data_pagamento DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_created_at
  ON pagamentos (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_created_at
  ON documentos (created_at DESC)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3) FKs sem índice (F-19)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_fornecedores_categoria
  ON fornecedores (categoria_id) WHERE categoria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_categoria
  ON pagamentos (categoria_id) WHERE categoria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_criado_por
  ON pagamentos (criado_por_user_id) WHERE criado_por_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msgs_autorizado
  ON mensagens_whats (autorizado_id) WHERE autorizado_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msgs_pagamento
  ON mensagens_whats (pagamento_id) WHERE pagamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msgs_documento
  ON mensagens_whats (documento_id) WHERE documento_id IS NOT NULL;

-- CASCADE sem índice: DELETE em mensagens_whats fazia seq scan aqui
CREATE INDEX IF NOT EXISTS idx_confirmacoes_mensagem
  ON confirmacoes_pendentes (mensagem_id);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_abertas
  ON confirmacoes_pendentes (created_at DESC) WHERE resolvida = false;

CREATE INDEX IF NOT EXISTS idx_webhooks_criado_por
  ON webhooks_outbound (criado_por_user_id) WHERE criado_por_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at
  ON notificacoes_email (created_at DESC);

-- ---------------------------------------------------------------------------
-- 4) Índices trigram para as buscas ILIKE '%termo%' (F-28)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_obras_nome_trgm
  ON obras USING GIN (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_obras_cliente_trgm
  ON obras USING GIN (cliente gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_fornecedores_nome_trgm
  ON fornecedores USING GIN (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_fornecedores_razao_trgm
  ON fornecedores USING GIN (razao_social gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_fornecedores_documento_trgm
  ON fornecedores USING GIN (documento gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pagamentos_descricao_trgm
  ON pagamentos USING GIN (descricao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pagamentos_observacoes_trgm
  ON pagamentos USING GIN (observacoes gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_documentos_nome_trgm
  ON documentos USING GIN (nome_arquivo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documentos_numero_nf_trgm
  ON documentos USING GIN (numero_nf gin_trgm_ops);

-- Índice funcional utilizável por lower(apelido) = lower($1)  (F-27)
CREATE INDEX IF NOT EXISTS idx_apelidos_lower
  ON fornecedor_apelidos (lower(apelido));

-- ---------------------------------------------------------------------------
-- 5) CHECK constraints (F-18, F-25)
-- ---------------------------------------------------------------------------

-- valor > 0 (hoje >= 0 permite pagamento de R$ 0,00)
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_valor_check;
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_valor_positivo;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_valor_positivo
  CHECK (valor > 0);

ALTER TABLE obras DROP CONSTRAINT IF EXISTS obras_orcamento_nao_negativo;
ALTER TABLE obras ADD CONSTRAINT obras_orcamento_nao_negativo
  CHECK (orcamento IS NULL OR orcamento >= 0);

ALTER TABLE obras DROP CONSTRAINT IF EXISTS obras_datas_coerentes;
ALTER TABLE obras ADD CONSTRAINT obras_datas_coerentes
  CHECK (data_inicio IS NULL OR data_prevista_fim IS NULL
         OR data_prevista_fim >= data_inicio);

ALTER TABLE mensagens_whats DROP CONSTRAINT IF EXISTS msgs_confianca_range;
ALTER TABLE mensagens_whats ADD CONSTRAINT msgs_confianca_range
  CHECK (confianca_ia IS NULL OR (confianca_ia >= 0 AND confianca_ia <= 1));

ALTER TABLE mensagens_whats DROP CONSTRAINT IF EXISTS msgs_tentativas_nao_negativo;
ALTER TABLE mensagens_whats ADD CONSTRAINT msgs_tentativas_nao_negativo
  CHECK (tentativas_reprocessamento >= 0);

ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_tamanho_positivo;
ALTER TABLE documentos ADD CONSTRAINT documentos_tamanho_positivo
  CHECK (tamanho_bytes IS NULL OR tamanho_bytes > 0);

-- NF-e: chave de acesso tem exatamente 44 dígitos
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_chave_nf_formato;
ALTER TABLE documentos ADD CONSTRAINT documentos_chave_nf_formato
  CHECK (chave_acesso_nf IS NULL OR chave_acesso_nf ~ '^[0-9]{44}$') NOT VALID;
-- NOT VALID: não bloqueia linhas legadas. Depois de higienizar:
--   ALTER TABLE documentos VALIDATE CONSTRAINT documentos_chave_nf_formato;

ALTER TABLE fornecedor_apelidos DROP CONSTRAINT IF EXISTS apelidos_vezes_visto_nao_negativo;
ALTER TABLE fornecedor_apelidos ADD CONSTRAINT apelidos_vezes_visto_nao_negativo
  CHECK (vezes_visto >= 0);

-- Webhooks: URL e eventos válidos, status HTTP plausível
ALTER TABLE webhooks_outbound DROP CONSTRAINT IF EXISTS webhooks_url_https;
ALTER TABLE webhooks_outbound ADD CONSTRAINT webhooks_url_https
  CHECK (url ~* '^https://') NOT VALID;

ALTER TABLE webhooks_outbound DROP CONSTRAINT IF EXISTS webhooks_eventos_validos;
ALTER TABLE webhooks_outbound ADD CONSTRAINT webhooks_eventos_validos
  CHECK (eventos <@ ARRAY[
    'pagamento_created','pagamento_updated','confirmacao_pendente_created',
    'documento_created','obra_created','obra_archived'
  ]::text[]);

ALTER TABLE webhooks_outbound DROP CONSTRAINT IF EXISTS webhooks_status_http;
ALTER TABLE webhooks_outbound ADD CONSTRAINT webhooks_status_http
  CHECK (ultima_execucao_status IS NULL
         OR (ultima_execucao_status >= 0 AND ultima_execucao_status <= 599));

ALTER TABLE webhooks_outbound DROP CONSTRAINT IF EXISTS webhooks_total_nao_negativo;
ALTER TABLE webhooks_outbound ADD CONSTRAINT webhooks_total_nao_negativo
  CHECK (total_execucoes >= 0);

-- ---------------------------------------------------------------------------
-- 6) Fuso horário do default de data_pagamento (F-14)
--    current_date no Supabase = data UTC. Às 21h BRT já é "amanhã".
-- ---------------------------------------------------------------------------
ALTER TABLE pagamentos
  ALTER COLUMN data_pagamento
  SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);

-- ---------------------------------------------------------------------------
-- 7) ON DELETE explícito nas FKs de autoria e de documento fiscal (F-29, F-30)
-- ---------------------------------------------------------------------------
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_criado_por_user_id_fkey;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_criado_por_user_id_fkey
  FOREIGN KEY (criado_por_user_id) REFERENCES profiles(user_id) ON DELETE RESTRICT;

ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_criado_por_user_id_fkey;
ALTER TABLE documentos ADD CONSTRAINT documentos_criado_por_user_id_fkey
  FOREIGN KEY (criado_por_user_id) REFERENCES profiles(user_id) ON DELETE RESTRICT;

-- Documento fiscal não deve sobreviver órfão a um DELETE de pagamento
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_pagamento_id_fkey;
ALTER TABLE documentos ADD CONSTRAINT documentos_pagamento_id_fkey
  FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 8) Preservar o status da obra antes do arquivamento (F-20)
-- ---------------------------------------------------------------------------
ALTER TABLE obras ADD COLUMN IF NOT EXISTS status_antes_arquivo obra_status;
COMMENT ON COLUMN obras.status_antes_arquivo IS
  'Audit F-20: status vigente no momento do arquivamento; restaurado por restoreObra.';

COMMIT;

ANALYZE pagamentos;
ANALYZE documentos;
ANALYZE fornecedores;
ANALYZE obras;
```

---

### Migration B — `has_role()` respeita soft-delete

`supabase/migrations/20260909100100_has_role_soft_delete.sql`

```sql
-- ============================================================================
-- Migration B — F-05
-- has_role() ignorava profiles.deleted_at: um usuário arquivado mantinha
-- TODAS as permissões de escrita da RLS e podia simplesmente logar de novo.
-- Esta migration fecha a RLS de uma vez para todas as tabelas.
--
-- IMPORTANTE: aplicar junto com o ban no GoTrue em archiveUsuarioAdmin
--   await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
-- e com o filtro deleted_at nos assertAdmin()/assertAdminOrGestor().
--
-- PRÉ-CHECAGEM (usuários que perderão acesso ao aplicar):
--   SELECT user_id, nome, papel FROM profiles WHERE deleted_at IS NOT NULL;
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION has_role(roles papel_usuario[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND papel = ANY(roles)
      AND deleted_at IS NULL          -- <<< F-05
  );
$$;

COMMENT ON FUNCTION has_role(papel_usuario[]) IS
  'Audit F-05: exige profile ativo (deleted_at IS NULL). Usuário arquivado perde toda escrita via RLS.';

-- Endurecimento de superfície: nenhum papel precisa chamar has_role diretamente.
REVOKE ALL ON FUNCTION has_role(papel_usuario[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION has_role(papel_usuario[]) TO authenticated, service_role;

-- Leitura também deve excluir arquivados nas tabelas de negócio.
-- (SELECT hoje é `auth.uid() IS NOT NULL` — um arquivado que logasse de novo
--  ainda enxergaria tudo.)
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'autorizados','categorias','obras','fornecedores','fornecedor_apelidos',
    'pagamentos','documentos','mensagens_whats','confirmacoes_pendentes'
  ]::TEXT[])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I;', t, t);
    EXECUTE format($f$
      CREATE POLICY %I_select ON %I FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
      ));
    $f$, t, t);
  END LOOP;
END $$;

-- Evita que o default do Postgres (EXECUTE para PUBLIC) volte a valer em
-- funções criadas por migrations futuras.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;
```

---

### Migration C — `audit_log` append-only, com autor e sem dados sensíveis

`supabase/migrations/20260909100200_audit_log_hardening.sql`

```sql
-- ============================================================================
-- Migration C — F-06, F-16, F-26
--  (a) autoria em operações service_role, via GUC app.audit_actor
--  (b) append-only: UPDATE/DELETE bloqueados por trigger + REVOKE
--  (c) índice em created_at (a query principal ordena por ele)
--  (d) máscara de colunas sensíveis no diff (webhooks_outbound.secret)
--  (e) leitura de linhas de webhooks_outbound restrita a admin
-- ============================================================================

BEGIN;

-- (c) índice de tempo
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entidade_created
  ON audit_log (entidade, created_at DESC);

-- (a) setter do ator para caminhos service_role
CREATE OR REPLACE FUNCTION set_audit_actor(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.audit_actor', COALESCE(p_user_id::text, ''), true); -- local à transação
END;
$$;
REVOKE ALL ON FUNCTION set_audit_actor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_audit_actor(UUID) TO service_role;

-- (a)+(d) trigger de auditoria com fallback de ator e máscara
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entidade TEXT := TG_TABLE_NAME;
  v_acao TEXT;
  v_entidade_id UUID;
  v_diff JSONB;
  v_user UUID;
  v_actor_txt TEXT;
  v_old JSONB;
  v_new JSONB;
  v_changed_before JSONB;
  v_changed_after JSONB;
  -- F-06: colunas que NUNCA devem ir para o audit_log
  v_mascarar TEXT[] := ARRAY['secret'];
BEGIN
  BEGIN v_user := auth.uid(); EXCEPTION WHEN OTHERS THEN v_user := NULL; END;

  -- Fallback: ator informado pelo backend antes de operar com service_role
  IF v_user IS NULL THEN
    v_actor_txt := current_setting('app.audit_actor', true);
    IF v_actor_txt IS NOT NULL AND v_actor_txt <> '' THEN
      BEGIN v_user := v_actor_txt::uuid; EXCEPTION WHEN OTHERS THEN v_user := NULL; END;
    END IF;
  END IF;

  IF (TG_OP = 'INSERT') THEN
    v_acao := 'insert';
    v_entidade_id := NEW.id;
    v_new := to_jsonb(NEW) - 'updated_at' - v_mascarar;
    v_diff := jsonb_build_object('after', v_new);

  ELSIF (TG_OP = 'UPDATE') THEN
    v_acao := 'update';
    v_entidade_id := NEW.id;
    v_old := to_jsonb(OLD) - v_mascarar;
    v_new := to_jsonb(NEW) - v_mascarar;
    SELECT jsonb_object_agg(key, v_old -> key), jsonb_object_agg(key, v_new -> key)
      INTO v_changed_before, v_changed_after
      FROM jsonb_object_keys(v_old) AS key
     WHERE key <> 'updated_at'
       AND (v_old -> key) IS DISTINCT FROM (v_new -> key);

    -- Registra que houve troca de secret, sem gravar o valor
    IF TG_TABLE_NAME = 'webhooks_outbound'
       AND (to_jsonb(OLD) ->> 'secret') IS DISTINCT FROM (to_jsonb(NEW) ->> 'secret') THEN
      v_changed_before := COALESCE(v_changed_before, '{}'::jsonb)
                          || jsonb_build_object('secret', '***rotacionado***');
      v_changed_after  := COALESCE(v_changed_after, '{}'::jsonb)
                          || jsonb_build_object('secret', '***rotacionado***');
    END IF;

    IF v_changed_before IS NULL OR v_changed_before = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
    v_diff := jsonb_build_object('before', v_changed_before, 'after', v_changed_after);

  ELSIF (TG_OP = 'DELETE') THEN
    v_acao := 'delete';
    v_entidade_id := OLD.id;
    v_diff := jsonb_build_object('before', to_jsonb(OLD) - 'updated_at' - v_mascarar);
  END IF;

  INSERT INTO audit_log (user_id, entidade, entidade_id, acao, diff)
  VALUES (v_user, v_entidade, v_entidade_id, v_acao, v_diff);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- (b) append-only
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é append-only: % não é permitido', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role;
GRANT SELECT ON audit_log TO authenticated;

-- (e) linhas de webhooks_outbound só para admin (mesmo com o secret mascarado,
--     url e eventos da integração não são de gestor)
DROP POLICY IF EXISTS audit_admin_gestor_select ON audit_log;
CREATE POLICY audit_admin_gestor_select ON audit_log
  FOR SELECT TO authenticated
  USING (
    (entidade <> 'webhooks_outbound' AND has_role(ARRAY['admin','gestor']::papel_usuario[]))
    OR has_role(ARRAY['admin']::papel_usuario[])
  );

-- (F-26, opcional) trilha para o fluxo WhatsApp
DROP TRIGGER IF EXISTS trg_audit_confirmacoes_pendentes ON confirmacoes_pendentes;
CREATE TRIGGER trg_audit_confirmacoes_pendentes
  AFTER INSERT OR UPDATE OR DELETE ON confirmacoes_pendentes
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

COMMIT;
```

---

### Migration D — Constraints de unicidade que faltam

`supabase/migrations/20260909100300_unique_constraints.sql`

```sql
-- ============================================================================
-- Migration D — F-04, F-17.2, F-27
--
-- PRÉ-CHECAGEM (limpar duplicatas antes; ambas devem retornar 0):
--   SELECT mensagem_id, count(*) FROM confirmacoes_pendentes
--    WHERE resolvida = false GROUP BY 1 HAVING count(*) > 1;
--   SELECT fornecedor_id, lower(apelido), count(*) FROM fornecedor_apelidos
--    GROUP BY 1,2 HAVING count(*) > 1;
--
-- Limpeza sugerida (mantém a linha mais antiga de cada grupo):
--   DELETE FROM confirmacoes_pendentes c USING confirmacoes_pendentes c2
--    WHERE c.mensagem_id = c2.mensagem_id AND c.resolvida = false
--      AND c2.resolvida = false AND c.created_at > c2.created_at;
--   DELETE FROM fornecedor_apelidos a USING fornecedor_apelidos a2
--    WHERE a.fornecedor_id = a2.fornecedor_id
--      AND lower(a.apelido) = lower(a2.apelido) AND a.created_at > a2.created_at;
-- ============================================================================

BEGIN;

-- F-04: no máximo UMA pendência aberta por mensagem.
-- Parcial: pendências resolvidas podem coexistir (histórico).
CREATE UNIQUE INDEX IF NOT EXISTS idx_confirmacoes_uma_aberta_por_msg
  ON confirmacoes_pendentes (mensagem_id)
  WHERE resolvida = false;

COMMENT ON INDEX idx_confirmacoes_uma_aberta_por_msg IS
  'Audit F-04: impede pendência duplicada quando classifyAndPersist roda 2x na mesma mensagem.';

-- F-17.2 / F-27: apelido único por fornecedor, case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS idx_apelidos_unico_por_fornecedor
  ON fornecedor_apelidos (fornecedor_id, lower(apelido));

COMMENT ON INDEX idx_apelidos_unico_por_fornecedor IS
  'Audit F-17: substitui o padrão IF NOT EXISTS→INSERT da RPC de merge por ON CONFLICT.';

-- Categoria: o UNIQUE global em nome impede recriar uma categoria arquivada.
-- Troca por unique parcial entre as ativas (case-insensitive).
DROP INDEX IF EXISTS idx_categorias_nome_ativas;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_nome_ativas
  ON categorias (lower(nome)) WHERE deleted_at IS NULL;
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nome_key;

COMMIT;
```

---

### Migration E — Índice de hash de documento tolerante a rascunho

`supabase/migrations/20260909100400_documentos_hash_pending.sql`

```sql
-- ============================================================================
-- Migration E — F-11
-- O UNIQUE em hash_sha256 inclui as linhas com storage_path='pending'
-- (rascunhos de upload que falharam). Isso trava a reanexação do MESMO
-- arquivo até o cron sweeper rodar (1x/dia, 03:00 UTC).
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_documentos_hash;
CREATE UNIQUE INDEX idx_documentos_hash
  ON documentos (hash_sha256)
  WHERE hash_sha256 IS NOT NULL
    AND deleted_at IS NULL
    AND storage_path <> 'pending';

COMMENT ON INDEX idx_documentos_hash IS
  'Audit F-11: exclui rascunhos pending para não travar o retry de upload.';

-- Índice de apoio ao cron sweeper (hoje faz seq scan por storage_path)
CREATE INDEX IF NOT EXISTS idx_documentos_pending
  ON documentos (created_at)
  WHERE storage_path = 'pending';

COMMIT;
```

---

### Migration F — Idempotência do import CSV

`supabase/migrations/20260909100500_import_batch_id.sql`

```sql
-- ============================================================================
-- Migration F — F-02
-- commitImport não tem chave de deduplicação: duplo clique no botão
-- "Importar" insere o lote inteiro duas vezes.
-- ============================================================================

BEGIN;

ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS import_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS import_row_hash TEXT;

COMMENT ON COLUMN pagamentos.import_batch_id IS
  'Audit F-02: sha256 do CSV importado. NULL para lançamentos manuais/WhatsApp.';
COMMENT ON COLUMN pagamentos.import_row_hash IS
  'Audit F-02: sha256 da linha do CSV. Com import_batch_id forma a chave de idempotência.';

-- Mesma linha do mesmo lote nunca entra duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagamentos_import_dedup
  ON pagamentos (import_batch_id, import_row_hash)
  WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_import_batch
  ON pagamentos (import_batch_id)
  WHERE import_batch_id IS NOT NULL;

COMMIT;
```

> No TypeScript: `commitImport` calcula `batchId = sha256(csvText)` e `rowHash = sha256(linha)` e trata `23505` como "linha já importada" (contabiliza em `skipped`, não em `failed`). Isso torna a reimportação do mesmo arquivo um no-op seguro.

---

### Migration G — `confirmar_pendencia_atomic`

`supabase/migrations/20260909100600_confirmar_pendencia_rpc.sql`

```sql
-- ============================================================================
-- Migration G — F-12 (e reforça F-04, F-08)
-- Hoje confirmarPendencia faz 3 mutações separadas, as duas últimas sem
-- checagem de erro. Falha no meio deixa pagamento criado + pendência aberta.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION confirmar_pendencia_atomic(
  p_confirmacao_id UUID,
  p_user_id        UUID,
  p_data_fallback  DATE DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
)
RETURNS TABLE (pagamento_id UUID, ja_existia BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mensagem_id UUID;
  v_resolvida   BOOLEAN;
  v_status      msg_status;
  v_de          JSONB;
  v_pag_id      UUID;
  v_ja          BOOLEAN := false;
BEGIN
  -- 1) Trava a confirmação (serializa duplo-submit)
  SELECT mensagem_id, resolvida INTO v_mensagem_id, v_resolvida
  FROM confirmacoes_pendentes WHERE id = p_confirmacao_id FOR UPDATE;

  IF v_mensagem_id IS NULL THEN
    RAISE EXCEPTION 'Confirmação não encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- 2) Trava a mensagem e lê os dados extraídos
  SELECT status, dados_extraidos INTO v_status, v_de
  FROM mensagens_whats WHERE id = v_mensagem_id FOR UPDATE;

  IF v_de IS NULL OR (v_de ->> 'valor') IS NULL OR (v_de ->> 'obra_id') IS NULL THEN
    RAISE EXCEPTION 'Faltam dados obrigatórios (valor e obra)' USING ERRCODE = '23502';
  END IF;

  -- 3) Idempotência: reaproveita o pagamento já criado para esta mensagem
  SELECT id INTO v_pag_id FROM pagamentos WHERE criado_via_msg_id = v_mensagem_id;

  IF v_pag_id IS NOT NULL THEN
    v_ja := true;
  ELSE
    INSERT INTO pagamentos (
      obra_id, fornecedor_id, valor, data_pagamento, origem, status_pagto,
      descricao, criado_via_msg_id, criado_por_user_id
    ) VALUES (
      (v_de ->> 'obra_id')::uuid,
      NULLIF(v_de ->> 'fornecedor_id', '')::uuid,
      (v_de ->> 'valor')::numeric,
      COALESCE(NULLIF(v_de ->> 'data_pagamento', '')::date, p_data_fallback),
      'whatsapp', 'confirmado',
      NULLIF(v_de ->> 'descricao', ''),
      v_mensagem_id,
      p_user_id
    )
    RETURNING id INTO v_pag_id;
  END IF;

  -- 4) Mensagem
  UPDATE mensagens_whats
     SET status = 'confirmada', pagamento_id = v_pag_id
   WHERE id = v_mensagem_id;

  -- 5) TODAS as pendências abertas da mensagem (F-04)
  UPDATE confirmacoes_pendentes
     SET resolvida = true,
         respondida_em = now(),
         resposta_bruta = 'confirmado via painel'
   WHERE mensagem_id = v_mensagem_id AND resolvida = false;

  RETURN QUERY SELECT v_pag_id, v_ja;
END;
$$;

COMMENT ON FUNCTION confirmar_pendencia_atomic(UUID, UUID, DATE) IS
  'Audit F-12: pendência → pagamento em transação única, idempotente por criado_via_msg_id.';

REVOKE ALL ON FUNCTION confirmar_pendencia_atomic(UUID, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirmar_pendencia_atomic(UUID, UUID, DATE) TO service_role;

COMMIT;
```

---

### Migration H — Agregações no banco (KPIs e séries)

`supabase/migrations/20260909100700_agregacoes_rpc.sql`

```sql
-- ============================================================================
-- Migration H — F-09, F-15
-- Hoje o painel carrega a tabela INTEIRA de pagamentos (2x por load) e soma
-- em double no Node. Estas RPCs somam em numeric no Postgres e trafegam
-- dezenas de linhas em vez de dezenas de milhares.
-- ============================================================================

BEGIN;

-- Série mensal de gastos (substitui getSerieMensal + o trend de getKpisResumo)
CREATE OR REPLACE FUNCTION serie_mensal_pagamentos(
  p_meses INTEGER DEFAULT 12,
  p_status pagamento_status DEFAULT 'confirmado'
)
RETURNS TABLE (mes TEXT, total NUMERIC, quantidade BIGINT)
LANGUAGE sql
SECURITY INVOKER            -- respeita a RLS do chamador
STABLE
SET search_path = public
AS $$
  WITH meses AS (
    SELECT to_char(d, 'YYYY-MM') AS mes
    FROM generate_series(
      date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date)
        - ((p_meses - 1) || ' months')::interval,
      date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date),
      '1 month'
    ) AS d
  )
  SELECT m.mes,
         COALESCE(SUM(p.valor), 0)::numeric AS total,
         COUNT(p.id)                        AS quantidade
    FROM meses m
    LEFT JOIN pagamentos p
      ON to_char(p.data_pagamento, 'YYYY-MM') = m.mes
     AND p.deleted_at IS NULL
     AND p.status_pagto = p_status
   GROUP BY m.mes
   ORDER BY m.mes;
$$;

-- Totais agregados para os KPIs (substitui as 2 queries full-table)
CREATE OR REPLACE FUNCTION kpis_pagamentos()
RETURNS TABLE (
  obras_ativas       BIGINT,
  gasto_mes          NUMERIC,
  qtd_mes            BIGINT,
  gasto_mes_anterior NUMERIC,
  gasto_total        NUMERIC,
  pendencias         BIGINT
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  WITH hoje AS (
    SELECT date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date AS ini_mes
  )
  SELECT
    (SELECT count(*) FROM obras WHERE deleted_at IS NULL),
    (SELECT COALESCE(SUM(valor), 0) FROM pagamentos, hoje
      WHERE deleted_at IS NULL AND status_pagto = 'confirmado'
        AND data_pagamento >= hoje.ini_mes
        AND data_pagamento <  hoje.ini_mes + interval '1 month'),
    (SELECT count(*) FROM pagamentos, hoje
      WHERE deleted_at IS NULL AND status_pagto = 'confirmado'
        AND data_pagamento >= hoje.ini_mes
        AND data_pagamento <  hoje.ini_mes + interval '1 month'),
    (SELECT COALESCE(SUM(valor), 0) FROM pagamentos, hoje
      WHERE deleted_at IS NULL AND status_pagto = 'confirmado'
        AND data_pagamento >= hoje.ini_mes - interval '1 month'
        AND data_pagamento <  hoje.ini_mes),
    (SELECT COALESCE(SUM(valor), 0) FROM pagamentos
      WHERE deleted_at IS NULL AND status_pagto = 'confirmado'),
    (SELECT count(*) FROM confirmacoes_pendentes WHERE resolvida = false);
$$;

-- Gasto por categoria (substitui o fetch full-table de getGastoPorCategoria)
CREATE OR REPLACE FUNCTION gasto_por_categoria(p_meses INTEGER DEFAULT 3)
RETURNS TABLE (categoria_nome TEXT, cor TEXT, total NUMERIC, quantidade BIGINT)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(c.nome, 'Sem categoria'),
         COALESCE(c.cor, '#A1A1A1'),
         COALESCE(SUM(p.valor), 0)::numeric,
         COUNT(p.id)
    FROM pagamentos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
   WHERE p.deleted_at IS NULL
     AND p.status_pagto = 'confirmado'
     AND p.data_pagamento >= (date_trunc('month',
           (now() AT TIME ZONE 'America/Sao_Paulo')::date)
           - ((p_meses - 1) || ' months')::interval)::date
   GROUP BY 1, 2
   ORDER BY 3 DESC;
$$;

-- SECURITY INVOKER: a RLS do usuário continua valendo, então authenticated pode chamar.
GRANT EXECUTE ON FUNCTION serie_mensal_pagamentos(INTEGER, pagamento_status) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION kpis_pagamentos() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION gasto_por_categoria(INTEGER) TO authenticated, service_role;

COMMIT;
```

> Após aplicar, regenerar os tipos: `pnpm db:types`.

---

## 5. Tabela final priorizada

| # | Finding | Sev. | Área | Local principal | Esforço | Migration |
|---|---|---|---|---|---|---|
| **F-01** | Parser pt-BR: `"1.500"` → R$ 1,50 (erro de 1000×) | 🔴 Crítico | Correção de dados | `lib/schemas/pagamento.ts:16-19`, `import-pagamento.ts:18-29`, `obra.ts:26-31` | 3h | A |
| **F-02** | Import CSV não idempotente + servidor confia no payload do cliente (service_role) | 🔴 Crítico | Transacionalidade / integridade | `config/importar/actions.ts:40-48`, `import-pagamentos.ts:160-207` | 5h | F |
| **F-05** | Usuário arquivado mantém acesso total (`has_role` ignora `deleted_at`) | 🟠 Alto | Modelagem / RLS | `20260903100500:17-23`, `middleware.ts:43`, `usuarios.ts:181-199` | 3h | B |
| **F-07** | UPDATE barrado por RLS retorna "sucesso" — 19 actions | 🟠 Alto | Server actions | `pagamentos/actions.ts:148-157` e 18 outras | 4h | — |
| **F-03** | Redelivery UAZAPI regride mensagem confirmada e apaga `dados_extraidos` | 🟠 Alto | Race / integridade | `api/webhooks/uazapi/route.ts:68-86` | 1h30 | — |
| **F-06** | Secret HMAC vaza na URL e no `audit_log` (legível por gestor) | 🟠 Alto | Vazamento de dados | `config/webhooks/actions.ts:97,200`, `20260907160000:49,103` | 3h | C |
| **F-08** | `rejeitarPendencia`: sem auth e `mensagem_id` do cliente (IDOR) | 🟠 Alto | Server actions | `pendentes/actions.ts:147-174` | 2h | — |
| **F-04** | `confirmacoes_pendentes` duplicadas e insolúveis pela UI | 🟠 Alto | Race / integridade | `classify-and-persist.ts:134-137` | 2h | D |
| **F-09** | Zero paginação — quebra entre 30k e 60k pagamentos | 🟠 Alto | Performance | 14 funções em `lib/data/**` | 8h | H |
| **F-10** | Índice de data inutilizável (`obra_id` é coluna líder) → seq scan no painel | 🟠 Alto | Performance | `20260903100300:44` vs `painel.ts:238` | 15 min | A |
| **F-11** | Rollback de upload negado pela RLS → documento travado até 24h | 🟠 Alto | Transacionalidade | `documentos/actions.ts:110,123` | 2h30 | E |
| **F-13** | Painel soma só `confirmado`, relatórios somam tudo → totais divergentes | 🟡 Médio | Correção de dados | `reports.ts:50,153,268,369` vs `painel.ts:110` | 3h | — |
| **F-12** | `confirmarPendencia`: 3 mutações não atômicas, 2 sem checar erro | 🟡 Médio | Transacionalidade | `pendentes/actions.ts:75-144` | 4h | G |
| **F-16** | `audit_log`: autor nulo em service_role, mutável, sem índice de tempo | 🟡 Médio | Auditoria | `20260907160000:38-44,78`, `20260903100400` | 5h | C |
| **F-14** | Fuso: `current_date` UTC e janelas `Z` nos relatórios | 🟡 Médio | Correção de dados | `20260903100300:34`, `reports.ts:372-380`, `classify-and-persist.ts:94` | 2h30 | A |
| **F-15** | Somas monetárias em float IEEE-754 (9 pontos) | 🟡 Médio | Correção de dados | `reports.ts:92,300,435`, `painel.ts:147,252,295` | 2h | H |
| **F-22** | Zero testes unitários; `vitest` não instalado (`pnpm -r test` falha) | 🟡 Médio | Qualidade | `apps/web/package.json` | 1h + 8h | — |
| **F-18** | Faltam CHECKs (valor>0, datas coerentes, confiança 0..1, eventos, url) | 🟡 Médio | Modelagem | todas as migrations DDL | 1h | A |
| **F-19** | 7 FKs sem índice (incl. `confirmacoes_pendentes.mensagem_id` CASCADE) | 🟡 Médio | Performance | `20260903100200/300`, `20260907190000` | 15 min | A |
| **F-17** | RPCs OK (não expostas via PostgREST); deadlock e `IF NOT EXISTS→INSERT` | 🟡 Médio | Race | `20260908120000:45-108` | 1h30 | D |
| **F-23** | `listUsers(perPage:1000)` no caminho quente e em busca unitária | 🟡 Médio | Performance | `usuarios.ts:67,107-110`, `notificacoes.ts:55` | 2h | — |
| **F-20** | `restoreObra` força `status='ativa'` (perde `concluida`) | 🟡 Médio | Correção de dados | `obras/actions.ts:147-160` | 1h30 | A |
| **F-21** | `atualizarCategoria` zera cor/ícone em update parcial | 🟡 Médio | Server actions | `config/categorias/actions.ts:85-89` | 20 min | — |
| **F-28** | Buscas `ILIKE '%x%'` sem índice trigram (4 telas) | 🟢 Baixo | Performance | `obras.ts:29`, `fornecedores.ts:36`, `pagamentos.ts:46`, `documentos.ts:36` | 1h | A |
| **F-25** | Divergências Zod × banco (valor≥0 vs >0, chave NF-e 44 díg., url http) | 🟢 Baixo | Validação | `lib/schemas/**` | 1h30 | A |
| **F-24** | Taxonomia de erros sem 22P02/22003/40001/40P01/57014/PGRST202/204 | 🟢 Baixo | Consistência de erro | `lib/schemas/errors.ts:15-24` | 45 min | — |
| **F-27** | `fornecedor_apelidos` sem UNIQUE; `ilike` não usa o índice funcional | 🟢 Baixo | Modelagem | `apelidos.ts:24-35`, `20260903100200:43-51` | 45 min | A, D |
| **F-31** | `createPagamento` pode lançar **depois** do INSERT (e-mail fora de try) | 🟢 Baixo | Server actions | `pagamentos/actions.ts:62-77` | 20 min | — |
| **F-26** | `mensagens_whats`/`confirmacoes_pendentes` sem auditoria nem soft-delete | 🟢 Baixo | Auditoria | `20260907160000:15-21` | 1h | C |
| **F-29** | `documentos.pagamento_id SET NULL` órfãna NF em hard delete | 🟢 Baixo | Modelagem | `20260903100300:52` | 20 min | A |
| **F-30** | FK de autoria sem `ON DELETE` explícito e sem índice | 🟢 Baixo | Modelagem | `20260903100300:37`, `20260907140000:7` | 30 min | A |
| **F-32** | ℹ️ `types.ts` sincronizado; typecheck passa; zero `any`/`@ts-ignore` | ℹ️ Info | Types | `packages/db/src/types.ts` | — | — |

**Total estimado:** ~63h de correção (≈8 dias-desenvolvedor), das quais **~24h cobrem os 8 findings de severidade crítica/alta**.

**Ordem de execução sugerida:**
1. **Dia 1** — Migrations A + B + D + E (baixo risco, alto retorno: F-10, F-19, F-28 resolvem a performance; F-05 fecha o buraco de acesso; F-04/F-11 param a corrupção em curso).
2. **Dia 2** — F-01 + F-22 (setup do vitest e a suíte de tabela do parser de moeda — o teste precisa vir junto com a correção).
3. **Dia 3** — F-02 (Migration F + refatoração do commitImport) e F-03.
4. **Dia 4** — F-07 (helper `assertAffected` nas 19 actions) + F-08 + F-21 + F-31.
5. **Dia 5-6** — F-06 + F-16 (Migration C) + F-13 + F-14 + F-15.
6. **Dia 7-8** — F-09 + Migration H (paginação e agregações) + F-12 (Migration G) + F-23 + F-24.
