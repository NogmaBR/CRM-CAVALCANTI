# Ver a mídia dentro do CRM — plano de implementação

> **Para agentes:** executar com `superpowers:executing-plans`, tarefa a tarefa. Marcar os `- [ ]`.

**Objetivo:** tudo que o Cavalcanti (ou a equipe) manda no WhatsApp — foto, PDF, áudio, vídeo,
planilha, Word — é guardado no CRM **e pode ser visto ali mesmo**, no site, sem sair para o
Supabase: a foto abre grande, o PDF abre na página, o áudio toca, o vídeo roda.

**Arquitetura:** uma rota autenticada (`/api/arquivos/<origem>/<id>`) resolve a linha pela sessão
do usuário (RLS decide quem vê), gera uma URL assinada curta pelo service role e responde 302.
Um componente único (`VisualizadorDeArquivo`) escolhe como mostrar pelo MIME. Miniaturas são
geradas sob demanda com `sharp` e guardadas no Storage (`miniaturas/…`) — sem migration, sem cron.
Na ingestão, o WhatsApp passa a arquivar qualquer tipo de arquivo (só executáveis ficam de fora),
com nome legível.

**Stack:** Next.js 16 App Router (route handler + server components), Supabase Storage (signed
URL, bucket `documents`), `sharp` 0.35 (já vem com o Next; entra em `package.json` do `apps/web`
porque o pnpm não deixa importar dependência transitiva), Vitest.

## Restrições globais

- Repo público: nenhum segredo em arquivo versionado.
- `X-Frame-Options: DENY` vale para toda rota do app → o arquivo **nunca** é servido pelo
  nosso domínio (streaming); sempre 302 para a URL assinada. Um `<iframe>` de PDF apontando
  para a rota funciona porque o documento final é do Supabase.
- Rota `/api/arquivos/**` **não** entra na lista pública do middleware: exige sessão; sem
  sessão o middleware manda para `/login` (o `<img>` só quebra, não vaza nada).
- Escrita em produção (migration) é ação do usuário com `!`.
- Verificar com `pnpm --filter web typecheck`, `vitest run`, `build` antes de abrir o PR.

---

## Diagnóstico (2026-09-16)

| Onde | Hoje | Falta |
|---|---|---|
| `/documentos/[id]` | metadados + botão Download (redirect 60 s para o Supabase) | ver o arquivo na página; texto extraído; origem |
| `/documentos` (lista/agrupado) | nome + tipo | miniatura |
| `/pendentes` | `Anexo: image/jpeg` | a foto da nota ao lado da pergunta |
| `/whatsapp` | `image/jpeg` | miniatura + abrir |
| `/pagamentos/[id]` | nada sobre documento | os comprovantes/NFs ligados, com miniatura |
| `/obras/[id]` (acervo) | cartões de pasta com contagem | faixa "últimas fotos"; áudio do diário tocável |
| Ingestão WhatsApp | jpeg/png/webp/pdf viram documento; nome `midia.jpeg` | vídeo, figurinha, xlsx/docx/qualquer arquivo; nome legível; `msg_tipo` para vídeo/arquivo |

---

## Tarefa 1 — Rota de arquivo: `/api/arquivos/[origem]/[id]`

**Arquivos**
- Criar `apps/web/lib/arquivos/resolver.ts` — puro: decide `{ path, mime, nome }` a partir da linha.
- Criar `apps/web/lib/arquivos/miniatura.ts` — `gerarMiniatura(bytes, mime) → Buffer | null` (sharp, 480 px, JPEG q80; só `image/*`).
- Criar `apps/web/app/api/arquivos/[origem]/[id]/route.ts`.
- Testes: `lib/arquivos/resolver.test.ts`, `app/api/arquivos/[origem]/[id]/route.test.ts`.
- Modificar `apps/web/package.json` (dep `sharp`), `lib/storage/documents.ts` (`getSignedUrl` com `{ download?: string }`, `existeObjeto`).

**Contrato**
- `GET /api/arquivos/documento/<uuid>` → 302 para URL assinada (300 s) do `documentos.storage_path`.
- `GET /api/arquivos/mensagem/<uuid>` → idem para `mensagens_whats.midia_storage_path`.
- `GET /api/arquivos/registro/<uuid>` → idem para `registros_obra.midia_storage_path`.
- `?baixar=1` → URL assinada com `download=<nome_arquivo>` (Content-Disposition attachment).
- `?miniatura=1` → só imagem: gera/lê `miniaturas/<origem>/<id>.jpg` e 302 para ela; para
  não-imagem responde 302 para o original (o `<img>` não vai pedir; é defesa).
- 404 quando a linha não existe **ou a RLS não deixa ver** (mesma resposta — não vazar existência).
- 404 quando `storage_path` é `pending`/null.
- `Cache-Control: private, no-store` no 302.

- [ ] 1.1 Escrever `resolver.test.ts`: `origem` inválida → null; `documento` com `storage_path='pending'` → null; mensagem sem mídia → null; ok devolve `{path, mime, nome}`.
- [ ] 1.2 Implementar `resolver.ts` (`ORIGENS = ['documento','mensagem','registro']`, `resolverArquivo(origem, linha)`).
- [ ] 1.3 Implementar `miniatura.ts` com `sharp` (import dinâmico para não pesar o bundle da rota que não precisa).
- [ ] 1.4 Escrever `route.test.ts` (padrão de `app/api/queue/consume/route.test.ts`): 404 sem linha; 302 com `Location` assinada; `?baixar=1` passa `download`; `?miniatura=1` em imagem chama gerar + subir uma vez e reaproveita na segunda.
- [ ] 1.5 Implementar a rota: `pareceUuid`, `createClient()` (sessão) para a linha, `getSignedUrl` (service) para a URL.
- [ ] 1.6 `pnpm --filter web exec vitest run lib/arquivos app/api/arquivos` verde. Commit `feat(arquivos): rota autenticada que entrega documento, mídia de mensagem e áudio de registro`.

## Tarefa 2 — `VisualizadorDeArquivo` e `Miniatura`

**Arquivos**
- Criar `apps/web/lib/arquivos/tipo-visual.ts` — puro: `tipoVisual(mime) → 'imagem'|'pdf'|'video'|'audio'|'outro'` (+ teste).
- Criar `apps/web/components/arquivos/visualizador.tsx` (server) e `lightbox.tsx` (client, `<dialog>`).
- Criar `apps/web/components/arquivos/miniatura.tsx` (server) — `<img loading="lazy">` para imagem, ícone por tipo para o resto.
- Criar `apps/web/components/arquivos/arquivos.css` — tokens do tema, responsivo (iframe 70vh desktop / 60vh mobile).

**Comportamento**
- imagem: `<img>` até 100% da largura; clique abre `Lightbox` (tela cheia, fecha com Esc/clique fora; sem lib).
- pdf: `<iframe title=… src="<rota>#toolbar=1">`; embaixo, link "Abrir em nova aba" e "Baixar" (nem todo celular renderiza PDF em iframe — o link é o fallback).
- video: `<video controls preload="metadata" playsInline>`.
- audio: `<audio controls preload="none">`.
- outro (xlsx/docx/…): cartão com ícone, nome, tamanho, botão Baixar; se houver `texto_extraido`, primeiro trecho em `<details>`.

- [ ] 2.1 Teste de `tipoVisual`: `image/jpeg`→imagem, `application/pdf`→pdf, `video/mp4`→video, `audio/ogg; codecs=opus`→audio, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`→outro, `null`→outro.
- [ ] 2.2 Implementar `tipo-visual.ts`, `visualizador.tsx`, `lightbox.tsx`, `miniatura.tsx`, `arquivos.css`.
- [ ] 2.3 Commit `feat(arquivos): visualizador único (imagem, PDF, vídeo, áudio) e miniatura`.

## Tarefa 3 — Telas

- [ ] 3.1 `/documentos/[id]`: visualizador no topo (antes da grade); seção "Texto lido" (`<details>`, 2.000 chars); "Origem" (`DOC_ORIGEM_LABEL`, `caminho_origem`); botões Abrir / Baixar via rota (o `downloadDocumento` antigo continua para compatibilidade, mas o botão passa a usar `?baixar=1`). Remover a linha "Storage path" (é interno).
- [ ] 3.2 `/documentos` agrupado (`documentos-agrupados.tsx`): item de imagem mostra `Miniatura` (72 px); pasta `fotos` vira grade de miniaturas (3–6 colunas). Tabela (`documentos-table.tsx`): coluna do nome ganha miniatura 40 px.
- [ ] 3.3 `/pendentes`: quando `item.midia_storage_path` (conferir o que `listPendentes` devolve — acrescentar `mensagem_id` se faltar), mostra `Miniatura` 120 px linkando para `/api/arquivos/mensagem/<id>` (nova aba) e, para PDF, o ícone com "Abrir PDF".
- [ ] 3.4 `/whatsapp`: no item, a miniatura no lugar do MIME; clique abre em nova aba.
- [ ] 3.5 `/pagamentos/[id]`: seção "Documentos" — `listDocumentos({ pagamentoId })` (criar se não existir) com miniatura + nome + link para `/documentos/<id>`; se vazio, "Nenhum documento ligado" com link para anexar. Também "Mensagem de origem" quando `origem='whatsapp'` (mensagem com `pagamento_id`), com a mídia.
- [ ] 3.6 `/obras/[id]`: faixa "Últimas fotos" (até 8 miniaturas, `listDocumentos({ obraId, categoria:'fotos', limite: 8 })`) acima das pastas; diário: registro com `midia_mime` audio ganha `<audio>` via `/api/arquivos/registro/<id>`.
- [ ] 3.7 `pnpm --filter web typecheck` + `biome check --fix` só nos arquivos tocados + typecheck de novo. Commit `feat(ui): mídia visível em documentos, pendentes, whatsapp, pagamento e obra`.

## Tarefa 4 — Ingestão WhatsApp completa

**Arquivos**
- Criar `supabase/migrations/20260916200000_msg_tipo_video_arquivo.sql`:
  `ALTER TYPE public.msg_tipo ADD VALUE IF NOT EXISTS 'video'; ALTER TYPE public.msg_tipo ADD VALUE IF NOT EXISTS 'arquivo';` (sem usar o valor na mesma transação — regra da §8).
- `packages/db/src/types.ts`: enum `msg_tipo` ganha `'video' | 'arquivo'`.
- `lib/schemas/uazapi.ts`: `mapTipoToDb(tipo, mime?)` — `video`→`video`, `sticker`→`imagem`, `document`→`pdf` só se mime for PDF, senão `arquivo`. Teste.
- `lib/services/inbound-whatsapp.ts`: `nomeArquivo` vira `lib/whatsapp/nome-arquivo.ts` (puro, testado): declarado sanitizado > `AAAA-MM-DD_HHhMM_<tipo>_<remetente>.<ext>` (`foto`, `video`, `audio`, `documento`), remetente = `autorizado.nome` slug. `materializarMidia` recebe `remetente`.
- `lib/services/arquivar.ts`: `MIMES_DOCUMENTO` → `mimeArquivavel(mime)` em `lib/arquivos/mime-arquivavel.ts` (puro, testado): recusa executável/script/html (`application/x-msdownload`, `application/x-sh`, `application/x-executable`, `application/javascript`, `text/html`, `application/x-dosexec`) e vazio; aceita o resto.
- `lib/ia/classificador-comum.ts` (`montarSaida`): anexo forçado a `documento_obra` com categoria `fotos` para `image/*` **e `video/*`**; `outro` para o resto. Prompt cita vídeo.
- `lib/status-labels.ts` (ou onde estiver o rótulo de `msg_tipo`): rótulos para `video` e `arquivo`.
- `scripts/limpar-testes-whatsapp.mjs`: nada muda (apaga por caminho).

- [ ] 4.1 Testes: `mapTipoToDb('video')==='video'`, `('document','application/pdf')==='pdf'`, `('document','application/vnd…sheet')==='arquivo'`, `('sticker')==='imagem'`; `nomeArquivo` com/sem declarado; `mimeArquivavel` aceita `video/mp4`, `application/vnd…sheet`, recusa `application/x-msdownload`.
- [ ] 4.2 Implementar. Rodar a suíte inteira.
- [ ] 4.3 Commit `feat(whatsapp): vídeo, figurinha e qualquer arquivo viram documento; nome legível`.

## Tarefa 5 — Verificação, PR e docs

- [ ] 5.1 Os três comandos da §5 do CLAUDE.md verdes.
- [ ] 5.2 PR para `main`; usuário mergeia; esperar READY + 1 min.
- [ ] 5.3 Usuário aplica a migration com `!`: `node --env-file=.env.local scripts/apply-migration.mjs 20260916200000_msg_tipo_video_arquivo.sql`; conferir `SELECT unnest(enum_range(NULL::msg_tipo))`.
- [ ] 5.4 Prova em produção: abrir `/documentos/<id de uma NF>` (PDF na página), `/documentos?obra_id=…&categoria=fotos` (grade), `/pagamentos/<id com documento>`; mandar no grupo Teste uma foto, um PDF, um vídeo curto e um áudio; ver cada um no CRM; `limpar-testes-whatsapp.mjs` depois.
- [ ] 5.5 Atualizar `CLAUDE.md` §7/§8, `docs/SO-FALTA-VOCE.md` (migration + como conferir), memória.

## Auto-revisão

- Cobertura: todas as linhas do diagnóstico têm tarefa (1–4).
- Consistência de nomes: `resolverArquivo`, `tipoVisual`, `gerarMiniatura`, `mimeArquivavel`, `nomeArquivo`, `mapTipoToDb(tipo, mime?)`, rota `/api/arquivos/[origem]/[id]` com `?baixar=1|?miniatura=1` — usados igual em todas as tarefas.
- Fora de escopo, de propósito: miniatura de PDF (exigiria renderizar página com canvas), transformação de imagem do Supabase (plano Pro), planilha pública compartilhada.
