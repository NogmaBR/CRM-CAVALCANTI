# Acervo do OneDrive e agente no grupo do WhatsApp — desenho

> Data: 2026-09-15. Decisões tomadas com o usuário nesta data:
> (1) o acervo chega por **ZIP baixado do link** pelo usuário; (2) **nada toca
> produção antes da demo de 16/09** — branch e PR ficam prontos, migration e
> import só na quarta à tarde; (3) documento e registro que não são pagamento
> são **arquivados e avisados**, com pergunta só quando a obra é ambígua.
> Pagamento continua exigindo "SIM" — é o núcleo do contrato e não muda.

## 1. O problema

O cliente (Fernando Cavalcanti) mandou o link do OneDrive da construtora. A
pasta `Cavalcanti Construções/_OBRAS ATIVAS_` tem uma subpasta por obra
(`Aguirre`, `Caminho do meio E&J`, `Garibaldi`, `Inox Piratini` prontas; as
outras "a ponto de finalizar"; `Oncotrata` vem depois, ele pediu para segurar).
Dentro de cada obra, o único padrão fixo é `Documentação` e `NFs/Pagamentos`;
o resto varia: `Proposta`, `Projeto`, `Projeto Aprovado`, `Cronograma`,
`Fotos`, `Orçamentos` (o "Controle Financeiro" é o próprio CRM).

Além do acervo, o agente vai viver num **grupo de WhatsApp** com o Cavalcanti
e o gerente dele. No grupo chega de tudo: foto, PDF de comprovante, áudio,
texto — sobre pagamento, mas também sobre contrato, proposta, andamento da
obra. Hoje o CRM:

- **não conhece grupo**: o schema do webhook só tem `from`; mensagem de grupo
  seria ignorada (o `chatid` do grupo não está em `autorizados`) ou respondida
  no privado;
- **trata toda mensagem como pagamento**: o classificador só tem
  `pagamento_completo / pagamento_parcial / documento_apenas /
  nao_identificado`. Um áudio "hoje a laje da Garibaldi ficou pronta" vira
  `nao_identificado` e uma pendência boba no painel;
- **tem zero documentos**: os 80 pagamentos estão "sem nota" porque as notas
  estão no OneDrive.

O que já existe e este desenho aproveita, sem inventar em paralelo:

| Já existe | Onde | Uso aqui |
|---|---|---|
| `obras.onedrive_folder_id`, `documentos.onedrive_file_id` | migrations iniciais | vínculo com a pasta/arquivo de origem |
| `documentos.hash_sha256` com índice único parcial | `20260903100300` | dedupe do import e do WhatsApp de graça |
| `knowledge_documents.origem = 'documento'` reservado | `20260910230000` | indexar o texto dos arquivos no RAG |
| Pipeline de chunk + embedding + `buscar_conhecimento` | `lib/rag/*`, `lib/ia/embeddings.ts` | o assistente responde "tem cronograma da Aguirre?" |
| Classificador com mídia (`midiaStoragePath`) e download injetável | `lib/ia/anthropic-classifier.ts` | extrair dados da nota importada |
| `anexarMidiaComoDocumento` | `lib/services/anexar-midia.ts` | mesmo caminho de escrita para documento vindo do grupo |
| Fluxo de pendência com janela de 24 h | `lib/services/confirmacoes.ts` | pergunta "de qual obra?" reaproveita a mecânica |

Estado do banco em 2026-09-15 (consultado): 10 obras ativas, todas com
`apelidos = {}` e `onedrive_folder_id` na convenção antiga (`PAGAMENTOS/<x>/`).
Casamento com o Drive: `Caminho do meio E&J` → `Casa EJ`; `Inox Piratini` →
`INOX Piratini`; `Garibaldi` → `Garibaldi` (mas `G&C Aura Legano` também aponta
para `PAGAMENTOS/Garibaldi/` — o import corrige); **`Aguirre` não existe** e
será criada pelo import.

## 2. Escopo — três blocos, uma branch, um PR

Branch `feat/acervo-onedrive-e-agente-grupo`. Uma migration só
(`20260915120000_acervo_e_grupo.sql`), porque os três blocos compartilham
`documentos.categoria` e `registros_obra`. Ordem de construção: A → B → C.

- **Bloco A — Acervo.** Migration, importador do ZIP, extração de texto,
  conciliação com os pagamentos, indexação no RAG.
- **Bloco B — Agente no grupo.** Grupo no webhook e na autorização, dois tipos
  novos no classificador (`documento_obra`, `registro_obra`), arquivamento
  automático com aviso, pergunta numerada quando a obra é ambígua.
- **Bloco C — Painel.** Pastas por categoria e diário na tela da obra, filtro
  por categoria em `/documentos`, grupos em `/config/autorizados`.

**Fora de escopo (registrado para não voltar como "esqueceram"):**
sincronia servidor→OneDrive por Microsoft Graph (exige app no Entra da Nogma,
ação humana — o importador é a sincronia enquanto isso); Oncotrata; vídeo
(fica como hoje: metadado); escrever de volta no OneDrive.

## 3. Modelo de dados (migration `20260915120000_acervo_e_grupo.sql`)

```sql
CREATE TYPE doc_categoria AS ENUM (
  'documentacao', 'nfs_pagamentos', 'proposta', 'projeto', 'projeto_aprovado',
  'cronograma', 'fotos', 'orcamentos', 'outro');
CREATE TYPE doc_origem AS ENUM ('painel', 'whatsapp', 'onedrive');

ALTER TABLE documentos
  ADD COLUMN categoria doc_categoria NOT NULL DEFAULT 'outro',
  ADD COLUMN origem doc_origem NOT NULL DEFAULT 'painel',
  ADD COLUMN caminho_origem TEXT,          -- caminho relativo dentro de _OBRAS ATIVAS_
  ADD COLUMN origem_modificado_em TIMESTAMPTZ,
  ADD COLUMN texto_extraido TEXT,
  ADD COLUMN texto_extraido_em TIMESTAMPTZ,
  ADD COLUMN conciliado_em TIMESTAMPTZ;    -- quando a conciliação já olhou este doc
-- índices: (obra_id, categoria) parcial; único em caminho_origem para origem='onedrive'
-- fila da extração: parcial em (created_at) WHERE texto_extraido_em IS NULL AND deleted_at IS NULL
```

`tipo anexo_tipo` continua existindo (nota_fiscal/comprovante/contrato/outro):
é o que o documento **é**; `categoria` é a **pasta** onde ele mora. Uma NF
mora em `nfs_pagamentos`; um contrato em `documentacao`.

```sql
CREATE TABLE registros_obra (          -- o diário de obra
  id UUID PK, obra_id UUID NOT NULL REFERENCES obras(id),
  texto TEXT NOT NULL,                 -- transcrição ou texto, como veio
  resumo TEXT,                         -- uma linha, do modelo (null no mock)
  data_registro DATE NOT NULL,         -- hojeBR() no momento do registro
  origem doc_origem NOT NULL DEFAULT 'whatsapp',
  mensagem_id UUID REFERENCES mensagens_whats(id) ON DELETE SET NULL,
  autor_autorizado_id UUID REFERENCES autorizados(id) ON DELETE SET NULL,
  autor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  midia_storage_path TEXT, midia_mime TEXT,
  created_at, updated_at, deleted_at);
-- índice (obra_id, data_registro DESC) parcial; RLS TO authenticated com
-- (select has_role(...)) no padrão de 20260912150000; audit trigger igual às demais.

CREATE TABLE whatsapp_grupos (
  id UUID PK, chat_id TEXT UNIQUE NOT NULL,   -- '1203…@g.us'
  nome TEXT NOT NULL, ativo BOOLEAN NOT NULL DEFAULT true,
  obra_id UUID REFERENCES obras(id) ON DELETE SET NULL,  -- grupo dedicado a uma obra
  created_at, updated_at, deleted_at);

ALTER TABLE mensagens_whats
  ADD COLUMN chat_id TEXT,                     -- destino da resposta (grupo ou privado)
  ADD COLUMN grupo_id UUID REFERENCES whatsapp_grupos(id) ON DELETE SET NULL,
  ADD COLUMN registro_id UUID REFERENCES registros_obra(id) ON DELETE SET NULL;

ALTER TABLE confirmacoes_pendentes
  ADD COLUMN tipo TEXT NOT NULL DEFAULT 'pagamento'
    CHECK (tipo IN ('pagamento', 'obra_documento', 'obra_registro')),
  ADD COLUMN opcoes JSONB,                     -- [{n:1, obra_id, nome}, …]
  ADD COLUMN chat_id TEXT;

-- knowledge_documents.origem passa a aceitar 'registro'
```

Dados (não vão na migration; vão no importador e num script de seed
`scripts/seed-apelidos-obras.mjs`, porque são dados do cliente): apelidos das
10 obras (`Garibaldi`, `EJ`, `E&J`, `Caminho do Meio`, `Inox`, `Piratini`,
`Rotterdam`, `K&C`, `WRB`, `NSIY 4`, `NSIY 7`, `Reservas`, `Faihome`, `Aura`,
`Legano`), criação de `Aguirre`, correção do `onedrive_folder_id` para o
caminho novo (`_OBRAS ATIVAS_/<pasta>`).

## 4. Bloco A — Acervo

### 4.1 Importador `scripts/importar-onedrive.mjs`

```
node --env-file=.env.local scripts/importar-onedrive.mjs <zip-ou-pasta> [--ensaio] [--criar-obras] [--processar]
```

Sem dependência nova na raiz: ZIP lido com `node:zlib`/leitor próprio ou
extraído antes pelo usuário — o script aceita **pasta ou ZIP** (ZIP é extraído
para o scratchpad do sistema, nunca para dentro do repo: o repositório é
público e os arquivos têm nome de cliente). Escrita no Supabase por REST
(PostgREST e Storage) com a service role, no padrão dos outros scripts.

Para cada arquivo em `_OBRAS ATIVAS_/<obra>/<subpasta>/…`:

1. **Obra**: casa `<obra>` contra `obras.nome`, `obras.apelidos` e
   `obras.onedrive_folder_id`, ignorando acento, caixa, `&`/`e`, espaços.
   Não casou: com `--criar-obras` cria (status `ativa`, orçamento 0, nome =
   pasta); sem, lista no relatório e pula. Mapa fixo de exceções no topo do
   script (`'caminho do meio e&j' → 'Casa EJ'`, etc.) para o que a heurística
   não pega.
2. **Categoria**: primeira subpasta, normalizada (`nfs`, `nf's`, `notas`,
   `pagamentos`, `comprovantes` → `nfs_pagamentos`; `documentacao`,
   `documentos`, `contratos` → `documentacao`; `projeto aprovado` antes de
   `projeto`; `fotos`, `imagens` → `fotos`; `orcamento(s)` → `orcamentos`;
   `proposta(s)`; `cronograma`). Arquivo solto na raiz da obra ou pasta
   desconhecida → `outro`, com o caminho preservado em `caminho_origem`.
3. **Tipo de arquivo**: só sobe o que o CRM sabe abrir — PDF, JPEG, PNG, WEBP,
   XLSX/XLS/DOCX (guardados, sem extração) — conferindo magic bytes como o
   upload do painel. `.DS_Store`, `Thumbs.db`, `desktop.ini`, `~$…` são
   ignorados. Outros tipos entram no relatório como "não suportado".
4. **Dedupe**: `sha256` do conteúdo. Já existe com o mesmo hash → atualiza
   `caminho_origem`/`origem_modificado_em` se mudou e segue. Mesmo
   `caminho_origem` com hash diferente → arquivo foi substituído no Drive:
   o antigo recebe `deleted_at`, o novo entra.
5. **Storage**: `documents/<obra_id>/<documento_id>/<nome>` — o mesmo
   `makeStoragePath` do app, para a tela de documentos e a URL assinada
   funcionarem sem caso especial.
6. **Removidos**: ao final, documento com `origem='onedrive'` de uma obra que
   foi varrida e cujo `caminho_origem` não apareceu → `deleted_at` (o Drive é
   a fonte da verdade para o que veio dele). Só para obras presentes no ZIP —
   um ZIP parcial não apaga o acervo das outras.
7. **`tipo`**: heurística pelo nome (`nf`, `nota`, `danfe` → `nota_fiscal`;
   `comprovante`, `pix`, `ted`, `boleto` → `comprovante`; `contrato` →
   `contrato`; senão `outro`). A conciliação refina depois.

`--ensaio` faz tudo menos escrever e imprime o relatório: por obra, quantos
arquivos por categoria, o que seria criado/atualizado/apagado/ignorado.
Reexecutar é sincronizar. O relatório nunca imprime credencial.

`--processar` chama `POST /api/cron/acervo` (com `CRON_SECRET`) ao terminar,
para não esperar o cron do dia.

### 4.2 Extração de texto — `lib/acervo/extrair-texto.ts`

Roda no app (não no script), porque o mesmo código serve o documento que
chega pelo grupo. Para cada `documentos` com `texto_extraido_em IS NULL`:

- **PDF**: `pdf-parse` (dependência nova em `apps/web`). Texto vazio (PDF
  escaneado) → cai no caso da imagem.
- **Imagem ou PDF sem texto**: só com `IA_PROVIDER=anthropic`; manda o
  arquivo como bloco `image`/`document` (reaproveita `montarConteudo` do
  classificador) e pede transcrição fiel do conteúdo. Sem chave: marca
  `texto_extraido_em = now()` com `texto_extraido = NULL` e segue — o mock não
  finge que leu.
- **XLSX/DOCX**: sem extração nesta rodada (`texto_extraido_em` marcado).
- Limite: 8 MB por arquivo, 40 documentos por invocação (`maxDuration = 60`),
  laço até esvaziar como em `/api/queue/consume`.

Depois da extração o documento vira `knowledge_documents` com
`origem='documento'`, `titulo = "<obra> › <categoria> › <nome>"`, conteúdo =
texto extraído (ou só o título + nome quando não há texto — ainda assim o
assistente acha "existe cronograma da Aguirre"). Chunk e embedding pelo
pipeline atual; `sincronizarDocumentos` ganha a fonte `documento`.

### 4.3 Conciliação — `lib/acervo/conciliar.ts`

Só para `categoria='nfs_pagamentos'` com texto extraído e
`pagamento_id IS NULL` e `conciliado_em IS NULL`:

1. Passa o texto (e o arquivo, quando há chave) pelo classificador atual com o
   contexto de obras/fornecedores → `valor`, `data_pagamento`,
   `fornecedor_id`, `numero_nf`, `tipo_documento`.
2. Candidatos: `pagamentos` da **mesma obra**, `deleted_at IS NULL`, `valor`
   igual (tolerância R$ 0,01), `data_pagamento` dentro de ±7 dias da data
   extraída (ou sem filtro de data se não extraiu). Um candidato → vincula
   (`documentos.pagamento_id`, `tipo`, `numero_nf`, `fornecedor_id` se vazio
   no pagamento) e registra `audit_log`. Zero ou mais de um → não vincula;
   marca `conciliado_em = now()` e o documento aparece na seção "Documentos
   sem pagamento" de `/pendentes` (Bloco C) para o gestor ligar à mão.
3. Nunca cria pagamento. O acervo é passado; criar lançamento é decisão humana.

### 4.4 Rota `POST /api/cron/acervo`

Bearer `CRON_SECRET` (`bearerConfere`), `maxDuration = 60`, entra na lista de
rotas públicas do middleware, registrada em `apps/web/vercel.json` às
03:40 UTC (junto das manutenções). Ordem: extrair → indexar → conciliar.
Devolve contagens. Teste de rota no padrão de `route.test.ts`.

## 5. Bloco B — Agente no grupo

### 5.1 Payload e autorização

`UazapiInboundSchema` ganha `chatId`, `isGroup`, `sender`, `senderName`
(opcionais). Novo `lib/webhooks/adaptar-uazapi.ts` traduz a forma real do
provider v2 (`message.messageid`, `message.chatid`, `message.sender`,
`message.isGroup`, `message.messageType`, `message.text`/`content`,
`message.fileURL`/`mediaType`) para a canônica **antes** do Zod, sem quebrar
as fixtures atuais. Como não há credencial UAZAPI, o adaptador é escrito
pela documentação e **marcado para conferir com o primeiro payload real** —
o `formaDoPayload` já loga a forma quando o Zod recusa.

Em `processarInbound`:

- `remetente = normalizeTelefone(sender ?? from)`; `destino = chatId ?? from`.
  Toda resposta (`enviarTexto`) vai para `destino`. Pendência continua indexada
  por `remetente` (quem responde "1" ou "SIM" é a pessoa, não o grupo).
- Autorização, falha fechada e silenciosa como hoje: `remetente` em
  `autorizados` **e**, se `isGroup`, `chat_id` em `whatsapp_grupos` com
  `ativo`. Grupo desconhecido → `ignorada_grupo_nao_autorizado`, com
  `log.aviso` trazendo o `chat_id` (é assim que o gestor descobre o id para
  cadastrar: a tela mostra a dica).
- `mensagens_whats.chat_id` e `grupo_id` gravados.
- Rate limit por `remetente` (já é assim; em grupo o `from` seria o grupo, o
  que juntaria todo mundo num balde — por isso a chave é o remetente).

### 5.2 Classificador: dois tipos novos

`ClassifierKind` += `documento_obra | registro_obra`. `ClassifierOutput.extracted`
+= `categoria?: DocCategoria`, `resumo?: string` (uma linha para o diário).

- **Mock** (`IA_PROVIDER=mock`), heurística determinística e testada:
  mídia sem valor em R$ → `documento_obra`, categoria por palavra-chave na
  legenda/nome (`foto` → fotos; `proposta`, `orçamento`, `cronograma`,
  `projeto` → respectivas; `contrato` → documentacao; PDF sem pista → `outro`;
  imagem sem pista → `fotos`); texto/áudio sem valor, sem pergunta, com 4+
  palavras → `registro_obra`; senão como hoje.
- **Anthropic**: prompt e `SaidaSchema` ganham os dois `kind`, `categoria`
  (enum) e `resumo`. Regra escrita no prompt: **pagamento vence** — se há
  valor e parece pagamento, é pagamento; `documento_obra` é para arquivo que
  não é nota nem comprovante de um pagamento; `registro_obra` é informação
  do dia a dia sem valor a lançar.
- Obra: casa por `nome`/`apelidos` (o contexto passa a incluir `apelidos`,
  que `classifyAndPersist` hoje não manda) e, em grupo com `obra_id`
  dedicado, o default é a obra do grupo.

### 5.3 Persistência e resposta (`classifyAndPersist`)

| kind | obra resolvida | ação | resposta no grupo |
|---|---|---|---|
| `documento_obra` | sim | cria `documentos` (`origem='whatsapp'`, categoria, tipo, `caminho_origem = null`), liga `mensagens_whats.documento_id`, fila de extração pega depois | `📁 Garibaldi › Fotos ✔` |
| `documento_obra` | não | grava mídia, abre pendência `obra_documento` com `opcoes` = obras ativas numeradas (máx. 10) | `De qual obra é esse arquivo?\n1) Aguirre\n2) Garibaldi …\nResponda com o número.` |
| `registro_obra` | sim | cria `registros_obra` (texto = transcrição/texto, `resumo`, mídia do áudio), liga `mensagens_whats.registro_id`, indexa no RAG (`origem='registro'`) | `📝 Anotado em Garibaldi ✔` |
| `registro_obra` | não | mesma pendência, tipo `obra_registro` | mesma pergunta |
| pagamento_* | — | **como hoje**, sem mudança | pergunta + SIM |

Resposta à pendência de obra: `interpretarEscolha(texto, opcoes)` em
`lib/whatsapp/escolha.ts` — aceita `1`, `1)`, `um`, o nome ou apelido da obra
escrito por extenso; qualquer outra coisa é `outro` (conservador, como
`interpretarResposta`). Vale a janela de 24 h. Mensagem de mídia sem
pendência de obra e sem obra: fica `erro` com frase humana, como hoje.

`aplicarConfirmacao` ganha `tipo`: `pagamento` é o caminho atual intocado;
`obra_documento`/`obra_registro` executam o arquivamento com a obra escolhida.
Mesma idempotência em camadas (pré-checagem + 23505 no índice de pendência
única por mensagem).

### 5.4 O que NÃO muda

Ordem das etapas de `processarInbound` (autorização → dedupe → mídia/áudio →
resposta a pendência → comando → pergunta → classificação); o parser de SIM;
`IA_AUTO_APROVAR=false`; nada de métrica de confiança na UI.

## 6. Bloco C — Painel

- **`/obras/[id]`**: seção "Pastas" com um cartão por categoria presente
  (contagem, ícone), clicando lista os documentos daquela pasta; seção
  "Diário" com os `registros_obra` mais recentes (data, autor, resumo ou
  texto, link para a mensagem). Segue `TelaDeEstado`/`EmptyState`, tokens do
  tema, `DataTable` com `data-label`.
- **`/documentos`**: filtro por categoria na toolbar e coluna "Pasta";
  formulário de upload ganha o campo categoria (default `outro`).
- **`/pendentes`**: seção "Documentos sem pagamento" (NFs importadas que a
  conciliação não casou), com botão para vincular a um pagamento da obra.
- **`/config/autorizados`**: seção "Grupos" (chat_id, nome, ativo, obra
  dedicada), com a dica em vermelho: "mensagem de grupo não cadastrado é
  ignorada; o id aparece no log como `ignorada_grupo_nao_autorizado`".
- Busca ⌘K: `busca_global` inclui `categoria` no rótulo do documento.
- `lib/status-labels.ts` ganha `CATEGORIA_LABELS` (rótulo e ícone por
  categoria) — fonte única para as três telas e para a resposta do bot.

## 7. Erros e degradação

| Situação | Comportamento |
|---|---|
| ZIP com pasta que não é obra | relatório, pula; nada é criado sem `--criar-obras` |
| Arquivo > 20 MB ou tipo desconhecido | relatório "ignorado", não sobe |
| Sem `ANTHROPIC_API_KEY` | PDF com texto é indexado; imagem/scan fica sem texto; conciliação só roda para docs com texto |
| Sem `OPENAI_API_KEY` (embeddings) | `knowledge_documents` criados, embedding pendente — igual ao que já acontece com pagamentos |
| Grupo não cadastrado | ignorado em silêncio, id no log |
| Remetente autorizado, grupo ok, obra ambígua | pergunta numerada, 24 h |
| Resposta "3" sem pendência aberta | mensagem comum → classificação → provavelmente `nao_identificado`, como hoje |
| Conciliação acha 2 pagamentos iguais | não vincula; aparece em `/pendentes` |
| Extração estoura tempo | laço com teto; o resto fica para a próxima invocação (índice parcial de pendentes) |

## 8. Testes

- `scripts/importar-onedrive.test.mjs` (node:test, sem rede): mapeamento
  pasta→obra e subpasta→categoria, normalização de nomes, dedupe por hash,
  detecção de substituído/removido, filtro de arquivos-lixo — sobre uma
  árvore fake em memória.
- `lib/acervo/*.test.ts`: extração com PDF de texto (fixture pequena) e PDF
  vazio; conciliação com 0/1/2 candidatos e com tolerância de data.
- `lib/webhooks/adaptar-uazapi.test.ts`: forma v2 → canônica, fixtures atuais
  intactas.
- `lib/whatsapp/escolha.test.ts`: número, ordinal, nome, apelido, ruído.
- `lib/ia/mock-classifier.test.ts`: os dois tipos novos e a regra "pagamento
  vence".
- `lib/services/inbound-whatsapp.test.ts`: grupo não cadastrado ignorado,
  resposta vai para `chatId`, arquivamento com obra do grupo, pendência de
  obra resolvida por "2".
- `app/api/cron/acervo/route.test.ts`: 401 sem bearer, JSON com bearer.
- Os três comandos da §5 do `CLAUDE.md` antes de dizer que está pronto.

## 9. Ações humanas (vão para `docs/SO-FALTA-VOCE.md`)

1. Baixar o ZIP do link e me dizer o caminho.
2. Na quarta à tarde: aplicar a migration (`--ensaio` antes), rodar o
   importador com `--ensaio`, conferir o relatório, rodar de verdade.
3. Cadastrar o grupo em `/config/autorizados` (o id aparece no log na
   primeira mensagem).
4. As mesmas credenciais de sempre: UAZAPI, `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY` (transcrição + embeddings).
