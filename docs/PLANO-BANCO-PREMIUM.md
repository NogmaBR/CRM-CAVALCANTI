# Plano do banco de dados — revisão de 2026-09-12

> Feita com o inventário real de produção (25 tabelas, 55 policies, 26 funções, 80
> índices, 3 crons, 4 filas, advisors da Supabase, `pg_stat_statements`) e dois
> revisores independentes lendo as 37 migrations e todo o TypeScript que fala com o
> banco. Cada item foi confirmado no catálogo ou no código antes de entrar aqui.
> ✅ = feito nesta revisão (migration `20260912150000_revisao_banco.sql`, PR #21, **já
> aplicada e conferida em produção**, + código). ⏭ = próximo passo, com o porquê.

## O que o inventário mostrou (antes)

| Sinal | Valor | O que significava |
|---|---|---|
| Advisor `auth_rls_initplan` | 11 tabelas | `auth.uid()`/`has_role()` avaliados **por linha** em cada consulta |
| Advisor `multiple_permissive_policies` | 13 | `profiles` e `automation_rules` com policies sobrepostas |
| Privilégio `TRUNCATE` para `authenticated` | 24 tabelas | TRUNCATE não passa pela RLS |
| `cron.job_run_details` | 2.719 linhas em 2 dias, sem purga | 1.440 linhas/dia para sempre |
| `purgar_automation_executions` | existia, zero chamadores | log de automação sem retenção |
| `schema_migrations` | 16 de 37 registradas | `supabase db push` reaplicaria 21 migrations |
| Bucket `documents` | sem `audio/*` | o áudio do WhatsApp subia, era recusado e o erro engolido |
| Auditoria | 7 tabelas | mudança de papel, regra ligada e link público **invisíveis** |
| `resolvida`, `status_pagto`, `ativo`, `status` | nullable | NULL escapa de todo filtro e do índice único |
| `data_pagamento` default | `current_date` (UTC) | entre 21h e 0h o default era amanhã |

## Feito nesta revisão

### Banco (migration, 14 blocos)

- ✅ **58 policies reescritas** com `(select auth.uid())` / `(select has_role(...))` e
  `TO authenticated`. Advisor `auth_rls_initplan`: 11 → 0. `multiple_permissive_policies`:
  13 → 0 (`profiles` com uma policy por comando; `automation_rules` idem).
- ✅ `has_role()` marcada `STABLE`, sem EXECUTE para `PUBLIC`/`anon`.
- ✅ Privilégios de `authenticated`: TRUNCATE/REFERENCES/TRIGGER revogados de todas as
  tabelas (e do default); tabelas só de leitura perdem escrita; `rate_limits` e
  `whatsapp_respostas` só `service_role`.
- ✅ Auditoria cobre agora `profiles`, `automation_rules`, `obra_compartilhamentos` e a
  resolução de `confirmacoes_pendentes`; o trigger aceita chave `user_id` e esconde
  `token` além de `secret`.
- ✅ Manutenção no `pg_cron`: `manutencao-cron-historico` (7 dias), `manutencao-automacoes`
  (90 dias), `manutencao-filas` (arquivo pgmq, 30 dias).
- ✅ `schema_migrations` completo (38 registros) e `scripts/apply-migration.mjs` passa a
  registrar cada aplicação e ganhou `--ensaio` (transação + rollback).
- ✅ Bucket aceita áudio. Link da planilha legível só por admin/gestor. Acesso a link
  vencido não conta.
- ✅ `autorizados.telefone_norm` (só dígitos, gerada) com índice único parcial; categoria
  única só entre vivas; `NOT NULL` em `resolvida`, `status_pagto`, `ativo`, `status`,
  `created_at`; default de `data_pagamento` em Brasília; FKs para `profiles` com
  `ON DELETE SET NULL`; trigger que impede pagamento novo em obra arquivada.
- ✅ Índices parciais que seguem o filtro real (`deleted_at IS NULL`) e as ordenações
  por `created_at`; 3 índices redundantes removidos.

### Código (PR desta revisão)

- ✅ Ligar/desligar automação não apaga mais a configuração salva.
- ✅ Confirmar/recusar pendência confere erro **e linhas afetadas** em cada escrita: um
  papel sem permissão não recebe mais "Pendência recusada" com nada mudado.
- ✅ Rollback de upload de documento com service role (antes a linha órfã bloqueava o
  reenvio do mesmo arquivo por até 24h).
- ✅ Painel: mês civil de Brasília e mesma definição de "gasto" do resto do sistema
  (`STATUS_QUE_CONTAM`). Decisão pendente desde a revisão anterior, fechada.
- ✅ Cortes de "dias sem documento" em data civil de Brasília (4 lugares); relatório de
  atividade com janela `-03:00`.
- ✅ Tela de pendentes e ferramenta da IA usam a RPC `pagamentos_sem_documento`
  (a heurística em JS escondia pendências novas).
- ✅ Fechamento mensal lança erro em vez de virar PDF de R$ 0,00.
- ✅ Mensagens cruas do Postgres/Storage não vão mais para o usuário nem para
  `mensagens_whats.erro_msg`; 7 `console.error` viraram log estruturado.
- ✅ Contagem por categoria segue `STATUS_QUE_CONTAM`; revalidações que faltavam;
  arquivamento em massa só aceita uuids.

Verificado depois de aplicar: advisors (segurança 3 intencionais + HIBP; performance só
`unused_index` e a tabela de lixo), `/api/health` 200 `problemas: []`, as 12 telas do app
abrindo contra a produção sem erro, 274 testes, typecheck, lint e build.

## Próximos passos (em ordem de valor)

1. ⏭ **Token da planilha como hash** (`sha256(token)` no banco, token mostrado uma vez,
   como o secret do webhook). Hoje está em claro e legível por admin/gestor. Exige
   mudar a tela da obra e a página pública. ~2h.
2. ⏭ **Retenção de dados pessoais**: `mensagens_whats`, `ai_messages`, `audit_log`
   crescem para sempre. Decidir prazo com o cliente (sugestão: 365 dias após
   resolução) e criar `purgar_mensagens_whats()` no cron. Decisão de produto.
3. ⏭ **`exigirLinhas()` nas actions de arquivar/restaurar** (obras, pagamentos,
   fornecedores, documentos, categorias, webhooks): mesmo padrão aplicado às
   pendências — hoje um papel `leitura` recebe "arquivado" sem nada mudar. ~1h.
4. ⏭ **Paginação e agregação no banco**: listagens sem `.range()` e somas em JS
   (`sumPagamentosBy`, painel, categorias). Invisível com 80 pagamentos; com o histórico
   do ERP (milhares) não será. RPC `pagamentos_por_mes` + `.range()` nas tabelas. ~3h.
5. ⏭ **`search_path = ''` nas 20 funções SECURITY DEFINER** com nomes qualificados
   (`public.profiles`). Padrão recomendado pela Supabase; hoje é `public`, seguro
   enquanto ninguém não confiável cria objeto em `public`. ~1h, migration só.
6. ⏭ **Autoria nas RPCs de service_role** (`merge_fornecedores_atomic`): o audit_log
   registra sem `user_id`. Passar `p_ator` e gravar via `set_config`. ~1h.
7. ⏭ **Zod em `dados_extraidos`** antes de virar pagamento (saída do LLM entra no
   INSERT com `!`). ~1h.
8. ⏭ Service role onde a sessão bastaria (`detect-duplicates`, `import-pagamentos`,
   `usuarios.ts`): perde a RLS como segunda barreira. ~1h.
9. ⏭ `configSchema` Zod por automação; tipar `Json` sem `as never`; `getUsuario` sem
   listar todos; webhooks recebendo telefone sem máscara (LGPD, decisão de produto).
10. ⏭ **Só você**: `DROP TABLE public."pagamentos.csv"` (lixo do import manual),
    `notificacoes_email` e `lembretes_agendados` (tabelas mortas, zero referências no
    código), HIBP no Auth (exige Pro), e a planilha de retenção do item 2.

## Como conferir

```bash
node --env-file=.env.local scripts/apply-migration.mjs <arquivo.sql> --ensaio   # ensaio
node --env-file=.env.local scripts/checar-integracoes.mjs
```

Catálogo: `pg_policies` (55 → 58, todas `TO authenticated`), `cron.job` (6 jobs),
`supabase_migrations.schema_migrations` (38), `storage.buckets.allowed_mime_types` (10).
