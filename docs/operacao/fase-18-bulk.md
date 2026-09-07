# Fase 18 — Bulk Operations

Estado: **shipada em prod**. Duas features:

1. **`/config/importar`** — admin faz upload de CSV com pagamentos,
   sistema valida linha por linha, mostra preview com erros, admin
   confirma → batch insert.
2. **Bulk archive em `/obras`** — user seleciona múltiplas obras via
   checkbox, arquiva em lote.

## CSV Import (`/config/importar`)

**Fluxo:**

```
1. Admin abre /config/importar
2. Baixa template CSV (link data URL — sem API route)
3. Preenche em Excel/Sheets → salva como CSV
4. Upload → FileReader lê local → server action previewImportCsv
5. Server valida (Zod + matching FK) → retorna PreviewResult
6. UI mostra tabela com summary (total/ok/erro) + linhas com erros
7. Admin clica "Confirmar import" → server action commitImportCsv
8. Batch insert em chunks de 100 → banner com "N inseridos"
```

**Colunas do CSV (headers case-insensitive):**

| Coluna | Obrigatório | Formato |
|---|---|---|
| obra | Sim | nome (case-insensitive matching) |
| fornecedor | Não | nome (opcional; se ausente ou não encontrado, importa sem) |
| categoria | Não | nome (idem) |
| valor | Sim | pt-BR `1.234,56` ou `R$ 1.234,56` ou EN `1234.56` |
| data_pagamento | Sim | `DD/MM/AAAA` ou ISO `AAAA-MM-DD` |
| origem | Não | whatsapp\|manual\|importado (default: importado) |
| status_pagto | Não | confirmado\|aguardando\|erro (default: confirmado) |
| descricao | Não | texto livre |
| observacoes | Não | texto livre |

**Template built-in** em `lib/schemas/import-pagamento.ts` (CSV_TEMPLATE
const) — inclui header + linha exemplo.

**Parser CSV** — zero dependência, ~120 linhas em
`lib/util/csv-parser.ts`. Suporta:
- Auto-detect separador (vírgula vs ponto-vírgula — comum no Excel BR)
- BOM UTF-8 (padrão do Excel)
- Campos quoted com escape `""`
- Newline dentro de quoted
- CRLF/LF line endings

**Validação por linha** (`lib/schemas/import-pagamento.ts`):
- Zod schema com transforms (valor pt-BR/EN, data BR/ISO)
- Matching por nome normalizado (lowercase + strip diacritics + collapse spaces)
- Obra não-encontrada → **bloqueia linha** (não importa)
- Fornecedor/categoria não-encontrados → **warning**, importa sem FK

**Matching pattern:**
```ts
normalize('Casa das Tintas') === normalize('CASA DAS  TINTAS  ')
// true — case, spaces, diacritics ignorados
```

**Batch insert** (`lib/services/import-pagamentos.ts`):
- Chunks de 100 rows (evita timeout serverless + payload muito grande)
- Idempotência: **NÃO** — reimportar mesmo CSV cria duplicatas.
  Import é 1-time bulk. Pra dedup: usar `numero_nf` unique constraint
  (não temos ainda em pagamentos — só em documentos)

## Bulk archive obras (`/obras`)

**Fluxo:**

```
1. User acessa /obras
2. Checkbox aparece na primeira coluna da tabela
3. Selecionar 1+ obras (obras arquivadas têm checkbox desabilitado)
4. Action bar sticky-top aparece: "{N} selecionada(s) [Arquivar] [Cancelar]"
5. Click "Arquivar" → window.confirm nativo
6. Confirm → bulkArchiveObras(fd) com ids JSON.stringify
7. Server valida (max 100, array de UUIDs), UPDATE .in(ids).is('deleted_at', null)
   — idempotente (não re-arquiva)
8. Redirect com ?success=X obra(s) arquivada(s)
```

**Server action** (`app/(app)/obras/actions.ts` — nova
`bulkArchiveObras`):
- Recebe `ids` como JSON string no FormData
- Zod-lite validation inline (parse + isArray + length 1-100)
- `.update({deleted_at: now, status: 'arquivada'}).in('id', ids).is('deleted_at', null)`
  — filter garantindo idempotência
- revalidatePath('/obras') + revalidatePath('/painel')

**UI** (`obras-table.tsx` reescrito pra inlinar TanStack Table):
- `useState<Record<string, boolean>>({})` pra rowSelection
- Coluna checkbox no início (helper IndeterminateCheckbox com useRef+useEffect
  pois Nogma Checkbox não expõe forwardRef)
- Action bar `position: sticky; top: 0; z-index: 20` aparece só se hasSelection
- `enableRowSelection: (row) => row.original.deleted_at == null` — arquivadas disabled
- `getRowId: (row) => row.id` — usa UUID (não index)

## Segurança

- Ambos require admin: `/config/importar` via `notFound()` se não-admin;
  `bulkArchiveObras` protegido por RLS ativa (admin/gestor ALL em obras)
- Server actions usam service_role só onde necessário (import chunks) —
  bulk archive usa createClient normal (RLS enforce)
- Import: sem SQL injection (Zod normaliza tipos, Postgres client escapa)
- Limite 100 rows/chunk import + max 100 IDs bulk archive (defensive
  contra abuse)

## Extensões futuras (Fase 18.x)

- **CSV export de pagamentos** — inverso do import, com filtros
- **Import de outras entidades** — fornecedores.csv, obras.csv, categorias.csv
  (mesmo pattern, cada um com seu Zod)
- **Dedup automático no import** — hash SHA-256 da linha inteira, index
  unique em `pagamentos.hash_row` (novo campo). Reimport ignora
  duplicatas em vez de duplicar
- **Preview inline com editar** — user corrige erros na própria tabela
  antes de confirmar (versão avançada; hoje precisa re-editar CSV)
- **Import async com fila** — CSVs muito grandes (10k+) processam em
  background job, notifica por email quando pronto
- **Bulk actions em outras listas** — pagamentos (archive/rejeitar),
  fornecedores (archive), documentos (archive)
- **Bulk edit** — selecionar N + trocar categoria/status em batch
- **Undo bulk** — janela de 30s pra desfazer última bulk operation
  (usa cookie + reverse operation)
- **Export XLSX** com formatação (linhas coloridas, cell formulas) via
  `exceljs` — melhor pro contador vs CSV puro

## Testar

**CSV import** (autenticado como admin):
1. `/config/importar`
2. Baixar template
3. Editar (colar obra existente no banco — ex: "Residencial Alpha")
4. Upload
5. Preview mostra 1 linha OK
6. Confirmar → banner "1 inserido"
7. `/pagamentos` mostra novo pagamento com `origem='importado'`

**Bulk archive** (qualquer papel com permissão de archive):
1. `/obras`
2. Marcar checkbox em 2-3 obras ativas
3. Action bar sticky aparece no topo
4. "Arquivar" → confirm dialog nativo
5. OK → banner "3 obra(s) arquivada(s)"
6. Filtro `?status=arquivada` mostra as arquivadas

## Rollback

Import: se linhas erradas foram importadas, filtrar por origem='importado' +
data_pagamento range no `/pagamentos` e arquivar em batch (Fase 18.x)
OU editar/deletar manualmente 1 a 1.

Bulk archive: arquivadas ficam com `deleted_at != null`. Restaurar
individual via `/obras/{id}` → botão Restaurar. Bulk restore =
extensão futura.
