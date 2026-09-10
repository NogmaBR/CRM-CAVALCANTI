# O que veio do protótipo do Cavalcanti para o CRM

> Fonte: `Cavalcanti enegenharia/` (protótipo React/Vite mostrado e aprovado
> pelo cliente), inventariado em
> `docs/recuperacao/2026-09-09/inventario-prototipo-cavalcanti.md`.
> Este documento registra o que foi **portado** e, mais importante, o que foi
> **deliberadamente não portado** e por quê.

O protótipo tem 40 arquivos de código e 8 páginas. A comparação item a item
contra o CRM real mostrou que quase tudo já existia — o que faltava era um
punhado de features que o cliente viu funcionando e passou a esperar.

---

## Portado

### 1. Planilha do cliente, com link compartilhável — o item nº 1 do inventário

A página que substitui o Excel que o gestor monta à mão e manda por WhatsApp.
É a **única tela do produto que o cliente final abre**, então virou a maior
peça desta rodada.

| Peça | Onde |
|---|---|
| Página pública read-only | `app/planilha/[token]/page.tsx` |
| Leitura por token (service role) | `lib/data/planilha.ts` |
| Geração/revogação de link | `app/(app)/obras/actions.ts` |
| Painel de gestão do link | `app/(app)/obras/[id]/compartilhar-planilha.tsx` |
| Schema + RLS + RPC de acesso | `supabase/migrations/20260909150000_*.sql` |

Colunas conforme o protótipo — Data · Descrição · Fornecedor · Categoria ·
Valor · NF · Comprovante · **Saldo acumulado** — com `tfoot` de total geral e
uma segunda tabela de subtotais por categoria.

**Decisões de segurança**, porque o link dá acesso a dado financeiro sem login:

- token de 32 bytes de `randomBytes` (CSPRNG), 64 chars hex — o link circula
  por WhatsApp e pode parar em lugar que não controlamos;
- formato validado por regex **antes** de ir ao banco: sondagem não vira query;
- token inexistente, revogado e expirado devolvem o mesmo 404, pra página não
  virar oráculo de tokens;
- escopo de uma obra só — nada de outra obra, fornecedor ou telefone;
- revogação é soft, preservando "quem teve acesso a essa obra em março?";
- `robots: noindex` herdado do layout raiz, já que a URL contém a credencial.

O protótipo tinha três botões: *Copiar Link*, *Excel*, *PDF*. O "Copiar Link"
lá não fazia nada — aqui funciona, com fallback pra `window.prompt` quando o
clipboard está bloqueado. O "PDF" virou `window.print()` com CSS de impressão
de verdade (A4 paisagem, `thead` repetido a cada página, cores preservadas),
em vez de uma dependência de geração de PDF.

### 2. Comandos de texto do bot

`resumo`, `pendências`, `quanto gastei na obra X` e `ajuda`, respondidos
direto no WhatsApp. O gestor consulta o CRM sem abrir o CRM.

- Reconhecimento: `lib/whatsapp/comandos.ts` (função pura, 23 testes)
- Execução: `lib/services/comandos-whatsapp.ts`

Entra no fluxo **depois** da checagem de resposta a pendência e **antes** da
classificação. A ordem importa: um "sim" em aberto vence tudo, mas
"pendências" é pergunta e não pode virar lançamento.

O risco aqui é o espelho do parser de "SIM": se um lançamento real for lido
como comando, **o pagamento não é registrado** — o bot responde um resumo e o
gasto some. Por isso o limite de 8 palavras e a bateria de testes que verifica
que "paguei 1200 de areia pro Zé" continua sendo lançamento.

### 3. Semáforo de dias nas pendências

Alinhado aos limiares que o cliente validou: **acima de 3 dias** âmbar,
**acima de 7** vermelho. (Eu tinha usado 15 na rodada anterior, sem base.)

### 4. Barra de consumo do orçamento

Em `/obras/[id]` e na planilha pública. Âmbar em 80%, vermelho ao estourar —
leitura instantânea de risco, repetida nos dois lugares como no protótipo.

### 5. Banner de alertas no painel

Montado do que já é consultado em outras telas: confirmações aguardando e
pagamentos sem nota há mais de 7 dias. **Só aparece quando há algo** — banner
permanente vira ruído e para de ser lido.

### 6. Documentos agrupados por fornecedor ou por obra

Responde "onde está a NF do Votorantim de janeiro?", que a tabela plana
ordenada por data não responde. Accordion com contadores "N NFs · M
comprovantes" e busca única cobrindo arquivo, nº da NF, fornecedor e obra.

Implementado com `<details>`/`<summary>` nativos: funciona sem JavaScript,
acessibilidade de teclado sai de graça e a página segue toda no servidor.

---

## Deliberadamente NÃO portado

**StatCard "Taxa de Acerto" da IA** (item 13 do inventário). O briefing de
alinhamento pede explicitamente *"remover métrica de confiança da IA da
interface"*. O inventário sugeriu promover a métrica a KPI — seria andar na
direção contrária do que o cliente pediu.

**Bugs do protótipo**, listados na seção "não portar" do inventário e que aqui
não existem: `trend={12}` hard-coded, `MONTH_LABELS` fixo, gráfico cortando em
8 obras quando o cliente tem 10, delete sem confirmação, modal sem `Esc`.

**Convenção de pastas OneDrive** (item 5). Continua valendo como hábito do
cliente, mas o CRM guarda no Supabase Storage — replicar a nomenclatura só faz
sentido se e quando existir sincronia com o OneDrive de verdade.

---

## Verificação

```
pnpm --filter web typecheck        # limpo
pnpm --filter web exec vitest run  # 159 testes, 7 arquivos
pnpm --filter web build            # compila, /planilha/[token] registrada
```

## Pendente de ação manual

Aplicar a migration `20260909150000_planilha_compartilhada.sql` em produção —
sem ela a tela da obra quebra ao listar links.
