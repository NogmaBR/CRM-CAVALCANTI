-- ============================================================================
-- Higiene apontada pelos advisors da Supabase (2026-09-10, auditoria pós-merge)
-- ============================================================================
--
-- Três coisas, todas sem mudança de comportamento para o app:
--
-- 1. search_path fixo em duas funções (`set_updated_at`, `fila_valida`).
--    Função sem search_path fixo resolve nomes pelo search_path de QUEM CHAMA,
--    o que abre a porta para uma tabela homônima num schema do chamador. É o
--    lint `function_search_path_mutable`.
--
-- 2. Revogar EXECUTE de `anon`/`authenticated` nas duas funções de trigger
--    SECURITY DEFINER (`audit_log_trigger`, `handle_new_user`). Elas eram
--    chamáveis por qualquer sessão via `/rest/v1/rpc/...`. Trigger dispara
--    independentemente do EXECUTE do usuário que fez o INSERT — o privilégio é
--    checado na criação do trigger, não no disparo — então revogar não afeta
--    nenhum fluxo. `has_role` fica como está: as policies de RLS a chamam no
--    contexto do usuário, e revogar quebraria a autorização inteira.
--
-- 3. Índice em nove chaves estrangeiras sem índice. Com 80 pagamentos não faz
--    diferença; com 8.000, um DELETE em `categorias` ou um JOIN por
--    `criado_por_user_id` vira varredura. Os nomes das colunas são lidos do
--    catálogo (pg_constraint), não digitados — para não indexar coluna errada.
--
-- Tudo idempotente: pode rodar duas vezes.
-- ============================================================================

-- 1. search_path ------------------------------------------------------------
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('set_updated_at', 'fila_valida')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', f.assinatura);
  END LOOP;
END $$;

-- 2. EXECUTE nas funções de trigger -----------------------------------------
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('audit_log_trigger', 'handle_new_user')
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, public', f.assinatura);
  END LOOP;
END $$;

-- 3. Índices nas FKs --------------------------------------------------------
DO $$
DECLARE
  c RECORD;
  colunas TEXT;
  nome_idx TEXT;
BEGIN
  FOR c IN
    SELECT con.conname, con.conrelid::regclass AS tabela, con.conkey, con.conrelid
    FROM pg_constraint con
    WHERE con.contype = 'f'
      AND con.connamespace = 'public'::regnamespace
      AND con.conname IN (
        'confirmacoes_pendentes_pagamento_id_fkey',
        'fornecedores_categoria_id_fkey',
        'fk_msgs_documento',
        'fk_msgs_pagamento',
        'mensagens_whats_autorizado_id_fkey',
        'obra_compartilhamentos_criado_por_user_id_fkey',
        'pagamentos_categoria_id_fkey',
        'pagamentos_criado_por_user_id_fkey',
        'webhooks_outbound_criado_por_user_id_fkey'
      )
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
      INTO colunas
    FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum;

    nome_idx := left('idx_fk_' || replace(c.conname, '_fkey', ''), 63);

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)', nome_idx, c.tabela, colunas);
  END LOOP;
END $$;
