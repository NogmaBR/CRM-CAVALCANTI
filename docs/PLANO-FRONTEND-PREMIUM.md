# Plano de front-end premium — revisão de 2026-09-12

> Auditoria visual feita com screenshots reais do app rodando localmente
> (1440×900 e 390×844, temas claro, preto e petróleo), página por página,
> mais leitura do CSS e dos componentes. Cada item abaixo foi visto na tela,
> não deduzido. O que está marcado ✅ foi feito no PR desta revisão.

## O que foi encontrado

### Bugs que impedem uso (prioridade máxima)

| # | Onde | O que acontece | Estado |
|---|---|---|---|
| 1 | Celular, toda página de lista | O botão principal ("Nova Obra", "Novo Pagamento", "Editar", "Arquivar") **some abaixo de 900px**. Não dá para criar nem editar nada no celular. | ✅ ações viram uma linha abaixo do título |
| 2 | Desktop | A sidebar é invisível: só uma faixa de 14px na borda esquerda revela o menu. Quem não sabe, não acha. | ✅ trilho de ícones sempre visível; expande no hover e recolhe ao sair (o pedido do briefing continua valendo) |
| 3 | Login no celular | Duas colunas espremidas a 390px. | ✅ empilha; painel de pitch vira cabeçalho compacto |
| 4 | `/qualquer-coisa` | 404 padrão do Next em inglês. O `not-found` do grupo `(app)` só vale para `notFound()`. | ✅ `app/not-found.tsx` global, em português, com a cara do app |
| 5 | Erro, 404, conta arquivada | Botões usam a classe `nos-btn`, que não existe. Aparecem como texto solto. | ✅ `ng-btn` + layout centrado com ícone |
| 6 | WhatsApp no celular | Rola horizontalmente (`min-width:160px` na coluna da direita). | ✅ |
| 7 | CSS inteiro | 74 usos de `--surface-1`, `--surface-2`, `--border` e `--text-strong`, **nenhum definido**. Cards e cabeçalhos de tabela ficam transparentes. | ✅ aliases nos tokens, por tema |

### Qualidade percebida

| # | Onde | O que acontece | Estado |
|---|---|---|---|
| 8 | Painel, KPIs | Sem cartão; a legenda aparece duas vezes (como delta e como caption); a sparkline sobrepõe o texto. | ✅ cartão com ícone, delta só quando há variação real, sparkline em linha própria |
| 9 | Painel, gráficos | Barras lime `#CCFF00` fixas: no tema claro (azul Cavalcanti) o contraste é ruim e a marca é outra. | ✅ cor por tema via token `--chart-1` |
| 10 | Texto | Dezenas de strings sem acento ("Visao geral da operacao", "Analises", "Proxima", "nao identificada", "Historico de alteracoes"). | ✅ |
| 11 | Busca e sino no topo | Decorativos: a busca não busca, o sino não notifica. | ✅ paleta ⌘K real (navegação + busca em obras, fornecedores e pagamentos) e sino com contagem de pendências |
| 12 | Tabelas no celular | Rolagem horizontal com colunas cortadas. | ✅ linhas viram cartões empilhados com rótulo por célula |
| 13 | Formulários | `select` e `textarea` com altura e borda diferentes do `Input` (34px vs 44px). | ✅ mesma métrica do `Input` |
| 14 | Toggle de tema | Ícone inicial errado no primeiro paint (estado começa em `black`). Toaster fixo em `dark`. | ✅ tema vem do servidor para os dois |
| 15 | Auditoria | "Ver registro →" quebra em duas linhas; filtros apertados no celular. | ✅ |
| 16 | Celular | Sem navegação de um toque: tudo pelo hambúrguer. | ✅ barra inferior com 5 destinos + safe-area |
| 17 | Marca | Sidebar sempre petróleo (Nogma) mesmo no tema claro, cujo accent é o azul do cliente. | ✅ `--sidebar-bg` por tema: azul-marinho no claro, preto no preto, petróleo no petróleo |
| 18 | Viewport | Sem `viewport-fit=cover` nem `theme-color` por tema. | ✅ |
| 19 | Estados vazios | Texto solto ("Nenhum documento encontrado…"). | ✅ ícone, frase e botão de ação |
| 20 | Perfil | Prévia de tema marca "Preto" mesmo com o app claro (o cookie manda, o perfil não sincroniza). | ✅ salvar o tema no perfil grava o cookie também |

## O que **não** mudou de propósito

- **Vocabulário de status** (`Pendente/Aprovado/Recusado`) e a métrica de confiança da IA
  escondida: decisões do cliente, ver `CLAUDE.md` §6.
- **Ordem das etapas do WhatsApp** e qualquer coisa fora de `app/`, `components/`, `styles/`.
- **Sidebar que recolhe ao tirar o mouse**: pedido do briefing. O que mudou é que agora
  existe um trilho visível com os ícones; só os rótulos somem.

## Como conferir

```bash
pnpm --filter web typecheck
pnpm --filter web exec vitest run
pnpm --filter web build
```

E no navegador: `/painel`, `/obras`, `/pagamentos`, `/pendentes` em 390px e 1440px, nos três
temas (botão de tema no topo). No celular, a barra inferior leva a Painel, Obras, Pagamentos,
Pendentes e Menu; `⌘K` (ou `Ctrl K`) abre a busca no desktop, e a lupa no celular.
