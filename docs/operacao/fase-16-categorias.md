# Fase 16 — Sistema de Categorias

Estado: **shipada em prod**. Admin gerencia lista de categorias contábeis
em `/config/categorias` — cria, edita, arquiva, restaura.

## O que existe

- **8 categorias seed** já no banco desde Fase 3 (Material, Mão de obra,
  Aluguel, etc — ver migration `20260903100100`)
- **`/config/categorias`** — list com filter tabs (Ativas / Arquivadas),
  cada linha mostra cor pill + nome + contagem de pagamentos + total R\$
  vinculado
- **Create / Edit forms** com Zod validation + 8-cor palette Nogma
  (radio-cards HTML puro com CSS `:has()`)
- **Archive / Restore** soft-delete (`deleted_at` timestamp)
- **RLS admin ALL** já cobre — só admin acessa `/config/categorias`
  (page + actions checam via `notFound()` + `assertAdmin()`)

## Fluxo

```
1. Admin acessa /config/categorias
2. listCategoriasComContagem() traz cats + qtd_pagamentos + total_valor
   (batched — evita N+1)
3. Filter tabs client-side (ativas vs arquivadas)
4. Cria nova em /config/categorias/nova (form Zod: nome min 2, cor
   whitelist, ícone opcional)
5. Edita em /config/categorias/[id]/editar (bloqueado se arquivada)
6. Arquivar: soft-delete → pagamentos existentes com categoria_id
   continuam OK (FK não bloqueia). Filtro Ativos esconde.
7. Restaurar: deleted_at = null → volta pra filtro Ativos.
```

## Contagem de uso

Antes de arquivar, admin vê:
- **N pagamentos vinculados** (só ativos — arquivados não contam)
- **R\$ Total** (soma dos valores)

Serve pra decidir: "essa categoria tá em uso? arquivar vai só sumir
da lista de escolhas em novos pagamentos, não quebra os existentes."

## Cores permitidas

Whitelist 8 opções da paleta Nogma DS (`lib/schemas/categoria.ts#CATEGORIA_CORES`):

| Cor | Uso sugerido |
|---|---|
| Petróleo `#0C4651` | Base neutra Nogma |
| Lime `#CCFF00` | Categoria destaque (raramente) |
| Verde `#2FA36B` | Positivo (receita, ganho) |
| Vermelho `#D6483B` | Crítico (multa, retrabalho) |
| Amarelo `#E8A317` | Atenção (fiança, provisório) |
| Petróleo médio `#196E7C` | Categoria secundária |
| Cinza escuro `#565B5B` | Neutro comum |
| Cinza claro `#A1A1A1` | Baixa importância |

Restringir é intencional — evita usuário escolher cor com contrast ruim
que quebra badges em light/dark themes.

## Impacto em outras fases

**Fase 4 (Obras)**: nenhum — obras não referenciam categorias.

**Fase 5 (Pagamentos)**: cada pagamento pode ter `categoria_id`
(nullable). Se admin arquivar categoria em uso, o pagamento mantém FK
(soft-delete não cascateia). Ao editar pagamento, o select mostra apenas
categorias ativas — o valor "arquivado" fica preso até user trocar.

**Fase 9 (Relatórios)**: relatórios agrupam por categoria pelo nome.
Se categoria for arquivada, ainda aparece nos relatórios históricos
(pega nome via JOIN, não depende de status).

**Fase 11 (Auditoria)**: trigger `audit_log_trigger()` captura INSERT/
UPDATE/DELETE em categorias (já wired na migration da Fase 11).

## Extensões futuras (Fase 16.x)

- **Reordenação drag-and-drop**: adicionar coluna `ordem` INTEGER +
  reorder UI. Hoje ordem = alfabética por nome.
- **Categorias hierárquicas**: `parent_id UUID REFERENCES categorias(id)`
  pra sub-categorias (ex: Material > Cimento, Material > Aço)
- **Ícone visual real**: hoje campo `icone` é livre; validar contra
  set enum de ícones lucide-react ou usar biblioteca de picker
- **Import CSV de categorias**: pra migração de sistemas antigos
- **Regras automáticas**: "pagamentos com fornecedor X → categoria Y
  automaticamente" (auto-tagging)
- **Merge categorias**: admin combina 2 categorias em 1 (move todos os
  pagamentos + arquiva a duplicada)
- **Cor customizada**: input color picker além da whitelist (com aviso
  de contrast)
- **Icone real na tabela**: renderizar `<Icon name={c.icone} />` no
  place holder de cor pill

## Segurança

- Admin check em pages via `notFound()` (não redirect — info leak
  prevention, matches pattern Fase 13)
- `assertAdmin()` em cada server action (defense in depth vs RLS)
- Zod schemas whitelisting valores (cor + tamanho nome)
- Unique constraint em `nome` → 23505 handling amigável em português
- Trigger audit_log_trigger captura mudanças (Fase 11)

## Rollback

Categorias não podem ser deletadas hard (pagamentos referenciam via
FK ON DELETE SET NULL — hard delete perde metadata). Rollback = arquivar.

Se precisar remover feature:
- `/config/categorias` rotas continuam funcionais mesmo se sidebar
  perder o link — não há dependência externa
- Categorias seed permanecem no banco (não deletar a menos que substitua)
