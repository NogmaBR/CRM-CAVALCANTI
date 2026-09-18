# Semáforo de completude, mais gráficos e o plano master de melhorias

**Data:** 2026-09-18 · **Branch:** `feat/semaforo-completude-e-painel-premium` · **Sem migration.**

## 1. O que o usuário pediu (em uma frase cada)

1. **Em toda tela, mostrar o que está faltando** — comprovante no pagamento, contrato na obra,
   telefone no fornecedor — em **vermelho** quando falta muito, **amarelo** quando falta pouco,
   **verde** quando está tudo completo. Sempre dizendo *o quê* falta e *onde* resolver.
2. **Mais gráficos** (círculos, barras, anéis) onde ajudarem o Cavalcanti a enxergar, entender
   e se localizar.
3. **Um plano master** de tudo que deixa o CRM mais nítido, mais interativo, mais organizado e
   mais responsivo — e executar o que cabe agora.

## 2. Semáforo de completude

### 2.1 O conceito

Cada entidade (pagamento, obra, fornecedor, documento) recebe uma **avaliação pura** — uma
função sem banco em `lib/completude/regras.ts` — que devolve:

```ts
interface Falta {
  chave: string;                      // estável, vai para teste e para o title
  gravidade: 'critica' | 'importante' | 'leve';
  texto: string;                      // frase inteira: "Sem comprovante ou nota fiscal"
  curto: string;                      // rótulo do badge: "Sem comprovante"
  acao?: { rotulo: string; href: string }; // "Anexar" → /documentos/novo?pagamento_id=…
}
interface Completude {
  nivel: 'completo' | 'parcial' | 'critico';
  faltas: Falta[];       // ordenadas: crítica → importante → leve
  itensOk: number;       // quantos pontos da checklist estão ok
  itensTotal: number;
}
```

**Regra do nível** (a mesma para todas as entidades):

| Nível | Quando |
|---|---|
| 🔴 `critico` | há **uma falta crítica**, ou **duas ou mais importantes** |
| 🟡 `parcial` | qualquer outra falta |
| 🟢 `completo` | nenhuma falta |

Falta *leve* nunca deixa vermelho: só pesa no "N de M itens".

### 2.2 As regras por entidade

**Pagamento** (contexto: `temDocumento` — documento vivo ligado ao `pagamento_id`)

| Chave | Gravidade | Quando | Ação |
|---|---|---|---|
| `comprovante` | crítica | sem documento vivo e status ≠ recusado | Anexar → `/documentos/novo?pagamento_id=` |
| `erro` | crítica | `status_pagto = erro` | Revisar → editar |
| `aprovacao` | importante | `status_pagto = aguardando` | Aprovar → editar |
| `fornecedor` | importante | `fornecedor_id` nulo | Preencher → editar |
| `categoria` | importante | `categoria_id` nulo ("sem etapa") | Preencher → editar |
| `descricao` | leve | `descricao` vazia | Preencher → editar |

**Obra** (contexto: `gasto`, `pagamentos`, `pagamentosSemDocumento`, `docsPorPasta`, `hoje`)

| Chave | Gravidade | Quando | Ação |
|---|---|---|---|
| `contrato` | crítica | `valor_contrato` nulo | Informar → editar |
| `prazo_vencido` | crítica | ativa e `data_prevista_fim` < hoje | Atualizar prazo → editar |
| `acima_do_contrato` | crítica | `gasto > valor_contrato` | Ver pagamentos |
| `comprovantes` | importante | N pagamentos sem documento (N > 0) | Ver quais → `/pagamentos?obra_id=…&situacao=pendente` |
| `cliente` | importante | `cliente` nulo | Preencher |
| `data_inicio` | importante | nula | Preencher |
| `data_prevista_fim` | importante | nula e obra ativa | Preencher |
| `endereco` | importante | sem rua/cidade | Preencher |
| `documentacao` | importante | pasta Documentação vazia | Enviar → `/documentos/novo?obra_id=` |
| `fotos` | leve | nenhuma foto | Pedir no grupo |
| `projeto` | leve | sem Projeto nem Projeto aprovado | Enviar |
| `tipo` | leve | `tipo` nulo | Preencher |
| `orcamento` | leve | `orcamento` nulo | Preencher |

Obra arquivada/concluída: só `contrato` e `comprovantes` (o resto é histórico).

**Fornecedor**

| Chave | Gravidade | Quando |
|---|---|---|
| `documento` | importante | sem CNPJ/CPF |
| `telefone` | importante | sem telefone (a cobrança de nota por WhatsApp não funciona) |
| `categoria` | leve | sem categoria |
| `email` | leve | sem e-mail |
| `razao_social` | leve | sem razão social |

**Documento**

| Chave | Gravidade | Quando |
|---|---|---|
| `obra` | importante | `obra_id` nulo (não aparece em pasta nenhuma) |
| `pagamento` | importante | tipo nota_fiscal/comprovante sem `pagamento_id` |
| `fornecedor` | leve | nota_fiscal sem fornecedor |
| `numero_nf` | leve | nota_fiscal sem número |

### 2.3 Onde aparece

1. **Badge `Semaforo`** (`components/completude/semaforo.tsx`): pílula com bolinha colorida e
   rótulo — "Completo", "Sem comprovante", "Faltam 3". `title` lista todas as faltas.
   - Coluna **Situação** nas tabelas de pagamentos, obras, fornecedores e documentos.
   - Filtro **Situação: Todos · Com pendência · Completos** (`?situacao=`) em pagamentos, obras
     e fornecedores — em memória, a listagem já carrega tudo.
2. **`PainelDeCompletude`** no topo das quatro telas de detalhe: borda colorida à esquerda,
   frase grande ("Faltam 2 itens para ficar completo" / "Tudo completo"), anel com "N de M", e a
   **checklist**: ✓ para o que está ok, ✗ vermelho/amarelo para o que falta, com o botão da ação.
3. **Campo faltante em vermelho no lugar**: `Row` ganha `falta={{ texto, href }}` e mostra
   "— sem fornecedor —" em `--danger` com o link "Preencher". A seção Documentos do pagamento vira
   um aviso vermelho com botão "Anexar comprovante ou NF" quando não há documento.
4. **Painel › Visão geral**: cartão **"Saúde do cadastro"** — quatro barras empilhadas
   (obras, pagamentos, fornecedores, documentos) verde/amarelo/vermelho, com a leitura e link para
   cada lista filtrada em "Com pendência".
5. **Painel › Alertas**: dois alertas novos, `prazo_vencido` e `acima_do_contrato` (alta).

### 2.4 Dados

`lib/data/completude.ts` (server): `pagamentosComDocumento()` (Set de ids com documento vivo),
`contextoDasObras()` (por obra: gasto, pagamentos, sem documento, docs por pasta),
`completudeDoPagamento(p)`, `completudeDaObra(o)`, `resumoDeCompletude()` para o painel.
Todas as contas ficam nas funções puras; o data layer só busca e monta o contexto.

## 3. Gráficos novos

Infra: `components/graficos/` passa a abrigar o que hoje está em `app/(app)/painel/charts/` e
`painel/cartao.tsx` (com `cartao.css` extraído de `empresario.css`), porque obra e fornecedor
também vão usar. Regras do dataviz continuam: um eixo, `--chart-1` para uma série,
`--serie-1..4` por obra, frase de leitura e tabela em todo cartão.

| Onde | Gráfico | Pergunta que responde |
|---|---|---|
| **Obra › detalhe** | 4 tiles (Contrato, Gasto, Recebido, Resultado) no topo | Como está o dinheiro desta obra |
| | **Barra de progresso dupla** contrato × gasto × recebido | "Recebeu 60%, gastou 45% do contrato" |
| | **Linha do tempo do prazo** início → previsto, com hoje marcado, e leitura "gastou 45% em 33% do prazo" | Ritmo: gasto corre na frente do prazo? |
| | Barras mensais (12 meses) da obra | Quando esta obra gastou mais |
| | Donut por etapa da obra | Para onde o dinheiro desta obra foi |
| | Anel de completude | Quanto do cadastro está feito |
| **Fornecedor › detalhe** | 3 tiles (Total pago no ano, Pagamentos, Último) + barras mensais + barras por obra | Quanto e onde este fornecedor recebeu |
| **Pagamentos › lista** | Cartão de resumo com barra empilhada por status + contador vermelho "sem comprovante" | O que está aprovado/pendente/sem nota no filtro atual |
| **Painel › Visão geral** | Saúde do cadastro (barras empilhadas) | O que falta preencher, por tipo |
| **Painel › Por obra** | Coluna de prazo (barra de progresso) na tabela | Qual obra está atrasada |

## 4. Plano master — o que entra agora e o que fica de backlog

**Agora (este PR):** §2 inteira; §3 inteira; `Row` com falta; filtros de situação; alertas novos;
CSS responsivo dos componentes novos (grid `auto-fit`, tiles em 1 coluna abaixo de 720 px, tabela
vira cartão como já é).

**Backlog recomendado (não entra, vale registrar em `TODOS.md`):**

1. **Cronograma físico** — etapas da obra com % concluído (medição), comparado ao % financeiro.
   Exige tabela nova (`etapas_obra`) e entrada pelo WhatsApp ("laje 100%").
2. **Orçamento por etapa** — orçado × realizado por categoria (hoje o orçamento é um número só).
3. **Anexar comprovante direto na tela do pagamento** (upload inline) em vez de ir a `/documentos/novo`.
4. **Notificação diária no WhatsApp do gestor** com o semáforo: "3 pagamentos sem nota, 1 obra com
   prazo vencido" — reaproveita o motor de automações.
5. **PWA / atalho no celular** com ícone e tela cheia.
6. **Exportar a checklist de completude em PDF** junto com o relatório da obra.

## 5. Testes e prova

- `lib/completude/regras.test.ts`: cada regra, a regra do nível, a ordenação e os limites
  (recusado sem comprovante não é falta; obra concluída só contrato e comprovantes).
- `lib/financeiro/agregacoes.test.ts`: alertas `prazo_vencido` e `acima_do_contrato`; `ritmoDaObra`.
- Os três comandos da §5 do CLAUDE.md + biome nos arquivos tocados.
- Captura local contra produção (`next start` + sessão por magic link) das telas: obra, pagamento,
  fornecedor, documento, listas e painel — desktop e 390 px.
