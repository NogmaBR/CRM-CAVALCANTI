# Fase 17 — Dashboard advanced

Estado: **shipada em prod**. `/painel` agora tem 4 KPIs + 3 charts +
timeline atividade — **tudo com dados reais** (zero mocks).

## O que mudou

**Antes (Fases 6 + 7):**
- 4 KPIs com dados reais (obras count, gasto mês, total, mensagens)
- Sparklines com arrays MOCK (`MOCK_TREND_OBRAS`, `MOCK_TREND_GASTO`, ...)
- Activity feed 100% MOCK (4 items hardcoded)
- Emoji `👋` no greeting (violava convenção)

**Depois (Fase 17):**
- 4 KPIs com dados reais + **sparklines reais** (8 meses de histórico
  agregado por query)
- Delta % vs mês anterior calculado em tempo real
- **Bar chart** (Recharts) — pagamentos por mês, últimos 12 meses
- **Donut chart** (Recharts) — gasto por categoria, últimos 3 meses,
  top 5 + "Outros"
- **Area chart** (Recharts) — total acumulado por mês (running sum)
- **Activity feed real** — pagamentos + documentos + mensagens criados
  nas últimas 48h, ordenado por timestamp desc
- Sem emoji

## Data layer (`lib/data/painel.ts`)

**4 fns tipadas, batched, cache=none:**

| Função | Retorna | Uso |
|---|---|---|
| `getKpisResumo()` | `KpisResumo` (4 KPIs com trend8m + delta_pct) | Sparklines |
| `getSerieMensal(12)` | `SerieMensalPoint[]` últimos 12m | Bar chart |
| `getGastoPorCategoria(5)` | `CategoriaGasto[]` top 5 + Outros | Donut |
| `getAtividadeRecente(10)` | `AtividadeItem[]` últimas 48h | Timeline |

Helpers exportados:
- `relativeTime(iso)` — "agora / 5min / 2h / ontem" pt-BR

**Performance:**
- Máximo 4 queries em paralelo (Promise.all)
- Nenhuma agregação em Postgres — cálculo em memória (dataset é small pra MVP)
- Se ficar lento com volume grande: materialized view refreshed hourly

## Charts (Recharts client wrappers)

**Localização:** `apps/web/app/(app)/painel/charts/`

**Padrão comum:**
- Todos `'use client'` no topo
- Recebem `data` prop já formatada (server component agrega)
- ResponsiveContainer 300px altura
- Tooltip customizado pt-BR
- Axis ticks com `var(--text-secondary)` (funciona em light/dark)

**Cores por chart (paleta Nogma DS):**
- Bar mensal: fill `#CCFF00` (lime — destaque)
- Donut: usa `data[i].cor` de cada categoria (natural)
- Area acumulado: stroke `#0C4651` (petroleum) + gradient fill

**Bundle impact:** Recharts adiciona ~180KB gzipped no chunk client
de `/painel`. Tree-shaking mantém só o que importa. Aceitável pra
dashboard que carrega 1x/sessão.

## Deltas mensais

Cada KPI que tem sentido comparar mostra `delta_pct`:
- Gasto mês: `+15.3%` vs mês anterior (verde se ↓, vermelho se ↑
  — dependendo do contexto — hoje sempre "up" pra gasto)
- Outros KPIs (obras ativas, pendências): sem delta (caption estático)

`delta_pct === null` quando mês anterior = 0 (evita divisão) — fallback
mostra caption fixa.

## Timeline atividade

Unificada de 3 fontes das últimas 48h:
- **Pagamentos** criados → link pra `/pagamentos/{id}`
- **Documentos** anexados → link pra `/documentos/{id}`
- **Mensagens** WhatsApp recebidas → link pra `/whatsapp`

Ordena por timestamp desc, limit 10. Se vazio: "Nenhuma atividade nas
últimas 48h."

**Ícone por tipo:** Building2 (obra... na verdade pagamento), FileText
(documento), MessageSquare (mensagem).

## Impacto em outras fases

- **Nada quebra** — apenas adiciona. Componentes `Stat` e `Sparkline`
  continuam funcionando idênticos.
- **Fase 11 (Auditoria)** — activity feed não usa audit_log (ainda);
  usa pagamentos+documentos+mensagens direto. Migração pra audit_log
  como source unificada é extensão futura.

## Extensões futuras (Fase 17.x)

- **Filtro por obra**: dropdown "todas obras" | "obra X" que filtra
  todos os charts + KPIs
- **Range de datas**: date picker "últimos 30d / 90d / 12m / customizado"
- **Comparativo YoY**: sobrepor série do ano anterior no bar chart
- **Drill-down** clicando numa barra: navegar pra `/pagamentos?data_from=X&data_to=Y`
- **Charts adicionais**:
  - Cash flow previsto vs realizado (área stacked)
  - Top 10 fornecedores (bar horizontal)
  - Heatmap dia-da-semana × hora (padrão de uso do WhatsApp)
- **Real-time updates**: Supabase Realtime subscribe em pagamentos +
  documentos → refresh charts sem reload. Aumenta complexidade
  (state client-side); vale se user costuma deixar painel aberto.
- **Export PDF do painel**: reusa Fase 9 primitives + snapshot dos
  charts (via `html2canvas` ou puppeteer serverless)
- **Alertas configuráveis**: "notificar quando gasto do mês > R\$ X"
  (integra Fase 10)
- **Materialized view** pra agregações: se dataset crescer >100k
  pagamentos, mover `getKpisResumo` pra VIEW MATERIALIZED refreshed
  hourly via cron (padrão Fase 7.5)

## Testar

Autenticado:
1. Abrir `/painel`
2. Ver 4 KPIs com sparklines (últimos 8 meses de dados reais)
3. Rolar até seção "Análises" — deve ter 3 charts:
   - Bar 12 meses (talvez vazio se ainda não tem pagamentos)
   - Donut categoria (mostra "Sem categorias com dados" se vazio)
   - Area acumulado (linha plana em 0 se vazio)
4. Timeline atividade mostra últimas 48h (mensagens de teste do Fase 8
   Foundation podem aparecer aqui)

## Segurança

- `getKpisResumo` etc usam `createClient()` — RLS ativa
- Nenhum dado exposto sem auth (page inteira é auth-protected)
- Charts renderizam server-side inicialmente → sem exposição de raw data
  no HTML (Recharts SSR)

## Rollback

Se precisar reverter (Recharts causando bundle bloat, etc):
1. `git revert <commit-fase-17>`
2. `pnpm --filter web remove recharts`
3. `pnpm install`

Sparklines + activity voltam pra MOCK (sem dados reais, mas página
continua funcional).
