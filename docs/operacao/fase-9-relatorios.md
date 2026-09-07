# Fase 9 — Relatórios PDF/CSV

Estado: **shipada em prod** (commit `1fedaa2`, deploy READY).

## O que existe

**Rota UI:** `/relatorios` (auth required, dark theme Nogma)
Grade de 4 cards, cada um com filtros próprios + 2 botões (baixar
PDF / baixar CSV):

1. **Relatório da Obra** — obra_id obrigatório; exporta obra + todos
   pagamentos + documentos + consolidados por categoria/fornecedor.
2. **Fechamento Mensal** — ano/mês; exporta pagamentos do mês com
   breakdown por obra, categoria e origem (manual/whatsapp/importado).
3. **Histórico do Fornecedor** — fornecedor_id + date range opcional;
   exporta histórico com ticket médio, primeira/última compra e
   consolidado por obra.
4. **Atividade Recente** — date range obrigatório; timeline unificada
   de pagamentos + documentos criados no período.

**Rota API:** `GET /api/exports/[tipo]?format=pdf|csv&...`

| tipo | params obrigatórios | params opcionais |
|---|---|---|
| `obra-completa` | `obra_id` (uuid) | — |
| `mes` | `ano` (int), `mes` (int 1-12) | — |
| `fornecedor` | `fornecedor_id` (uuid) | `from` (YYYY-MM-DD), `to` |
| `atividade` | `from`, `to` | — |

Query `format` opcional (default `pdf`). Resposta com
`Content-Disposition: attachment` + filename descritivo em UTF-8
(RFC 5987 `filename*`).

**Runtime:** `nodejs` (não edge — `@react-pdf/renderer` precisa Node
para gerar Buffer).

**Auth:** `createClient()` + `auth.getUser()` — RLS ativa em todas as
queries. Se sem user → 401 direto.

## Como testar

**Local (dev server rodando):**

```powershell
# Autenticado no browser primeiro (login → cookie session)
# Abre http://localhost:3000/relatorios, seleciona filtros, clica Baixar

# Ou (com cookie de sessão exportado):
curl -sS -o test.pdf "http://localhost:3000/api/exports/mes?format=pdf&ano=2026&mes=9" `
  -H "cookie: sb-<...>=..."
```

**Prod:** mesma coisa em `https://crm-cavalcanti.vercel.app/relatorios`.

## Stack técnica

- **PDF:** `@react-pdf/renderer` (JSX declarativo, Node-only, ~1.5-3s
  render para relatório de ~50 pagamentos)
- **CSV:** string generation manual com BOM UTF-8 + CRLF + escape
  RFC 4180 (double-quote wrap)
- **UI:** React 19 server component + client component com useState
  para URLs reativos

## Arquivos-chave

- `apps/web/lib/data/reports.ts` — 4 aggregation queries com
  batched lookups (evita N+1 em obras/fornecedores/categorias)
- `apps/web/lib/reports/pdf/theme.ts` — Nogma DS tokens (cores + spacing
  + fontSizes) espelhados de `styles/tokens/colors.css`
- `apps/web/lib/reports/pdf/primitives.tsx` — `NogmaDoc`, `NogmaHeader`
  fixed, `NogmaFooter` com `pageNumber/totalPages`, `Section`,
  `KpiGrid`+`KpiCard`, `ReportTitle` + helpers `formatBRL`, `formatDate`
- `apps/web/lib/reports/pdf/{obra-completa,mes,fornecedor,atividade}.tsx`
  — 4 templates, cada um exporta `renderXxxPdf(data): ReactElement`
- `apps/web/lib/reports/csv.ts` — `toCsv(rows)` genérico + 4 funções
  `xxxToCsv(data)` que estruturam header + seções
- `apps/web/app/api/exports/[tipo]/route.ts` — Route Handler dinâmico
- `apps/web/app/(app)/relatorios/{page.tsx,relatorios-forms.tsx,relatorios.css}`

## Extensões futuras (Fase 9.x)

- **Preview inline:** trocar `<a target="_blank">` por `<iframe>` embed
  com `#toolbar=0` para preview antes de baixar
- **Bulk export:** ZIP de múltiplas obras / múltiplos meses
- **Agendamento:** cron Vercel que dispara relatório mensal automático
  para email cadastrado (usa `notificacoes_email` que já existe no
  schema, faltaria Resend/SES + template)
- **XLSX:** trocar CSV puro por xlsx com `exceljs` — Excel abre CSV
  com problema em números BRL (aspas, vírgula decimal); XLSX seria
  mais robusto para contador
- **Filtros extra:** obra pode filtrar por range de data + status;
  fornecedor pode filtrar por categoria
- **Assinatura digital:** PDFs com assinatura fiscal (ICP-Brasil A1)
  para valor legal — requer certificado + biblioteca extra
- **Charts:** gráficos de barras/pizza no PDF via `@react-pdf/renderer`
  suporta `<Svg>` — hoje não incluído porque simplifica manutenção

## Notas de performance

- Um relatório de obra com 500 pagamentos + 200 documentos renderiza
  em ~4-6 segundos em cold start Vercel serverless. Se ficar acima
  disso, considerar mover pra background job (Inngest / Vercel Queue)
  e enviar link por email quando pronto.
- Memória: cada render carrega ~50MB de fontes Helvetica. Múltiplos
  concurrent renders num único container podem estourar 512MB do
  plano Hobby. Para volume alto, upgrade para Pro (3GB RAM) ou
  cache PDFs em Storage por hash dos filtros (~30d TTL).

## Segurança

- RLS ativa em toda query — usuário só recebe dados que já teria via
  UI regular. Nenhum bypass de RLS.
- Filename gerado via slugify (NFD + remove diacritics + non-alphanum
  → hífen) — não expõe caracteres perigosos no `Content-Disposition`.
- `?format=` restrito a `pdf|csv` — inválido → 400 (não interpola).
- Params UUID validados por Zod — inválido → 400 (não roda query).

## Custo estimado

- Vercel Hobby (função serverless): incluído no plano — cada exec conta
  no limite mensal de 100k requests
- Storage/DB: nenhum incremento (não cacheado, streaming direto)
- Nenhuma dep externa paga
