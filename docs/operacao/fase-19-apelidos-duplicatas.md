# Fase 19 — Apelidos + Auto-detect Duplicatas

Estado: **shipada em prod**. Duas features complementares:

1. **Apelidos** em `/fornecedores/[id]` — user gerencia nomes alternativos
2. **`/fornecedores/duplicatas`** — sistema sugere fusões, admin confirma merge

## Apelidos (`/fornecedores/[id]#apelidos`)

**Uso:** o classifier IA (Fase 8) recebe texto de WhatsApp tipo "paguei
R\$ 1.200 na CDT" — precisa bater "CDT" com fornecedor canônico "Casa
das Tintas Ltda". Apelidos armazenam essas variações.

**Schema (existente desde Fase 3):**
- `fornecedor_apelidos (id, fornecedor_id FK CASCADE, apelido, criado_por_ia BOOLEAN, vezes_visto INT, created_at)`
- Index em `fornecedor_id` e `lower(apelido)`

**UI:**
- Seção "Apelidos" no detail page do fornecedor
- Lista de pills:
  - Nome do apelido
  - Badge "IA" (ícone Sparkles) se `criado_por_ia = true`
  - Contador `visto Nx` (`vezes_visto` — incrementado pelo classifier
    a cada match)
  - Botão X pra remover
- Form inline pra adicionar:
  - Input text + botão "Adicionar"
  - Zod validação: trim + min 2 + max 100

**Server actions:**
- `adicionarApelido(fd)` — check conflict (evita apelido usado por
  outro fornecedor), INSERT, 23505 handling amigável
- `removerApelido(fd)` — DELETE por id

## Auto-detect Duplicatas (`/fornecedores/duplicatas`)

**Algoritmo:**

1. Query all fornecedores ativos (RLS filtra deleted_at)
2. Comparação O(n²) — pra n=200, ~50ms
3. Two match strategies:
   - **Match forte** (score 1.0): mesmo `documento` normalizado (só dígitos)
   - **Match fraco** (score ≥ 0.9): Jaro-Winkler similarity no nome
     normalizado (lowercase + strip diacritics + strip sufixos jurídicos
     "Ltda", "S.A.", "EIREL", "ME", "EPP" + collapse spaces)

**Jaro-Winkler**: implementação zero-dep em `lib/services/detect-duplicates.ts`.
Range 0-1. Winkler boost pra prefixos comuns até 4 chars (weight 0.1).

**Scale:**
- n=100 → ~5k comparações → ~10ms
- n=500 → ~125k → ~150ms
- n=1000 → ~500k → ~600ms
- n=5000+ → considerar `pgtrgm` index + query SQL nativa

**UI:**
- Admin/gestor only (notFound se não)
- Empty state se nenhuma duplicata
- Cards agrupados por par:
  - Score badge (100% = success/verde; 90-99% = warning/amarelo)
  - Motivo em badge ("Documento idêntico" ou "Nomes muito similares")
  - Fornecedor A e B side-by-side com links pros detail pages
  - 2 botões: "Manter A · arquivar B" ou "Manter B · arquivar A"

**Confirmação:** `window.confirm` nativo antes de submit — "Vai fundir.
Pagamentos e documentos serão movidos. Continuar?"

## Merge (fusão)

**Fluxo `mergeFornecedores({keepId, dropId})` em `lib/services/merge-fornecedores.ts`:**

1. Fetch drop pra pegar nome (será convertido em apelido)
2. UPDATE pagamentos SET fornecedor_id = keep WHERE fornecedor_id = drop
3. UPDATE documentos SET fornecedor_id = keep WHERE fornecedor_id = drop
4. Move apelidos existentes do drop → keep (com check de duplicata
   via `.ilike()` — evita 23505; deleta órfão se já existe)
5. INSERT `drop.nome` como novo apelido do keep (se não existir já)
6. Soft-delete drop (`deleted_at = now()`)

**Retorna** `{ ok, pagamentos_movidos, documentos_movidos, apelidos_movidos, drop_nome, error? }`

**Reversibilidade:** drop fica no banco com deleted_at. Rollback manual:
- UNARCHIVE drop
- REVERT pagamentos+documentos (não temos histórico do fornecedor_id anterior)

Recomendação: **não desfazer merge**. Se errou, criar novo fornecedor
com nome correto e mover manualmente.

**Segurança:**
- Assert admin/gestor no server action antes de chamar service
- Zod UUID validation em keepId + dropId
- Service usa service_role (bypass RLS) — necessário pra move batch cross-table

## Impacto no classifier IA (Fase 8)

Quando implementado:
- Classifier procura fornecedor por nome:
  1. `fornecedores WHERE lower(nome) = lower(input)`
  2. Se não achar: `fornecedor_apelidos WHERE lower(apelido) = lower(input)` → retorna o fornecedor
  3. Se achar via apelido, incrementa `vezes_visto` (pra ranking futuro)
  4. Se nenhum: cria novo fornecedor com `origem = 'auto_detectado'` OU rota pra `confirmacoes_pendentes`

Isso já está preparado no `mock-classifier.ts` (usa `fornecedores.apelidos`
JSONB antigo — deprecated; melhor migrar pra table `fornecedor_apelidos`).

## Extensões futuras (Fase 19.x)

- **Fase 19.1 — pgtrgm SQL**: se scale > 5k fornecedores, mover detect
  pra `WHERE similarity(nome, ?) > 0.8` com index GIN pgtrgm
- **Bulk apelidos**: input textarea que aceita várias linhas (uma por
  apelido) + INSERT em batch
- **Merge N-way**: hoje só 2-por-vez; extension pra selecionar 3+ e
  fundir tudo num só (keep é o primeiro)
- **Confidence display**: mostrar por quê Jaro-Winkler bateu (highlight
  chars comuns) — melhora confiança do admin
- **Auto-merge threshold**: pra score = 1.0 (documento igual), cron
  faz merge automático diário (com log/audit)
- **Suggest apelido do drop pre-merge**: preview "vai adicionar 'Casa
  Tintas Ltda' como apelido de 'Casa das Tintas'"
- **Undo merge (30s)**: cookie com últimoMerge → botão "desfazer"
  reverte via service inverse
- **Score threshold configurável** por admin (hoje hardcoded 0.9)
- **Merge history log**: nova tabela `merges_realizados` pra auditoria
  além do audit_log genérico

## Testar

**Apelidos:**
1. `/fornecedores/{id}` — role até Apelidos
2. Adicionar "CDT" → aparece pill
3. Adicionar "CDT" de novo → erro "já existe"
4. Adicionar "CDT" em outro fornecedor → erro "usado por outro"
5. Remover pill → some

**Duplicatas:**
1. Criar 2 fornecedores com nomes similares ("Casa das Tintas Ltda" +
   "Casa Tintas") em `/fornecedores/novo`
2. `/fornecedores/duplicatas` → aparece card com score 90%+
3. "Manter A · arquivar B" → confirm dialog → banner "Fornecedores
   fundidos: 0 pagamentos + 0 documentos movidos"
4. B some da lista `/fornecedores` (arquivado)
5. A ganha "Casa Tintas" como apelido (checar `/fornecedores/{A.id}#apelidos`)

## Segurança

- Apelidos: RLS profiles cobre (leitura autenticada, mutation admin/gestor/financeiro)
- Merge: admin/gestor only via assertAdminOrGestor no server action
- Service role pra move batch cross-table (necessário — cross-RLS)
- Zod validate UUIDs (previne SQL injection via input arbitrário)

## Rollback

**Apelidos:** DELETE from `fornecedor_apelidos WHERE apelido = 'X'`
via SQL admin.

**Merge:** DIFÍCIL reverter — pagamentos+documentos foram movidos e
não há trace do fornecedor_id anterior. Se realmente precisar:
1. UNARCHIVE drop: `UPDATE fornecedores SET deleted_at=NULL WHERE id=<drop>`
2. Manualmente mover pagamentos+documentos de volta (não há automático)

Recomendação: **não desfazer merges**; se errou, criar novo fornecedor
correto e re-mover.
