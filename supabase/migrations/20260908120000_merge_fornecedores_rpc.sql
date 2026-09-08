-- Fase QA hardening (audit BUG-01): merge_fornecedores sem transação
--
-- O service TypeScript atual faz 5 operações sequenciais (UPDATE pagamentos,
-- UPDATE documentos, mover apelidos, INSERT novo apelido, soft-delete drop).
-- Se qualquer uma falhar no meio, dados ficam parcialmente movidos —
-- pagamentos migrados mas apelidos não, ou fornecedor drop ainda ativo
-- porém sem pagamentos ligados a ele.
--
-- Esta RPC executa TUDO em uma transação Postgres. Falhas causam rollback
-- automático de todas as mudanças. Retorna contadores pro UI.
--
-- Assinatura:
--   SELECT * FROM merge_fornecedores_atomic('keep-uuid', 'drop-uuid');
--   → pagamentos_movidos INT, documentos_movidos INT, apelidos_movidos INT,
--     drop_nome TEXT

CREATE OR REPLACE FUNCTION merge_fornecedores_atomic(
  p_keep_id UUID,
  p_drop_id UUID
)
RETURNS TABLE (
  pagamentos_movidos INTEGER,
  documentos_movidos INTEGER,
  apelidos_movidos INTEGER,
  drop_nome TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drop_nome TEXT;
  v_pagamentos_count INTEGER;
  v_documentos_count INTEGER;
  v_apelidos_count INTEGER := 0;
  v_apelido RECORD;
BEGIN
  -- Validação básica
  IF p_keep_id = p_drop_id THEN
    RAISE EXCEPTION 'keep_id não pode ser igual a drop_id';
  END IF;

  -- Fetch drop pra pegar nome + validar existência (row-lock pra evitar
  -- race com outra merge concorrente)
  SELECT nome INTO v_drop_nome
  FROM fornecedores
  WHERE id = p_drop_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_drop_nome IS NULL THEN
    RAISE EXCEPTION 'Fornecedor drop não encontrado ou já arquivado';
  END IF;

  -- Valida keep existe e não está arquivado
  PERFORM 1 FROM fornecedores
  WHERE id = p_keep_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fornecedor keep não encontrado ou arquivado';
  END IF;

  -- 1) Move pagamentos
  WITH moved AS (
    UPDATE pagamentos
    SET fornecedor_id = p_keep_id
    WHERE fornecedor_id = p_drop_id
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_pagamentos_count FROM moved;

  -- 2) Move documentos
  WITH moved AS (
    UPDATE documentos
    SET fornecedor_id = p_keep_id
    WHERE fornecedor_id = p_drop_id
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_documentos_count FROM moved;

  -- 3) Move apelidos (loop pra tratar dedup case-insensitive)
  FOR v_apelido IN
    SELECT id, apelido FROM fornecedor_apelidos WHERE fornecedor_id = p_drop_id
  LOOP
    IF EXISTS (
      SELECT 1 FROM fornecedor_apelidos
      WHERE fornecedor_id = p_keep_id
        AND lower(apelido) = lower(v_apelido.apelido)
    ) THEN
      -- Duplicata → deleta apelido órfão
      DELETE FROM fornecedor_apelidos WHERE id = v_apelido.id;
    ELSE
      UPDATE fornecedor_apelidos
      SET fornecedor_id = p_keep_id
      WHERE id = v_apelido.id;
      v_apelidos_count := v_apelidos_count + 1;
    END IF;
  END LOOP;

  -- 4) INSERT drop.nome como novo apelido em keep (se não existir)
  IF NOT EXISTS (
    SELECT 1 FROM fornecedor_apelidos
    WHERE fornecedor_id = p_keep_id
      AND lower(apelido) = lower(v_drop_nome)
  ) THEN
    INSERT INTO fornecedor_apelidos (fornecedor_id, apelido, criado_por_ia)
    VALUES (p_keep_id, v_drop_nome, false);
  END IF;

  -- 5) Soft-delete drop
  UPDATE fornecedores
  SET deleted_at = now()
  WHERE id = p_drop_id;

  RETURN QUERY SELECT
    v_pagamentos_count,
    v_documentos_count,
    v_apelidos_count,
    v_drop_nome;
END;
$$;

COMMENT ON FUNCTION merge_fornecedores_atomic(UUID, UUID) IS
  'Audit BUG-01: merge atômico de 2 fornecedores em transação plpgsql única.';

REVOKE ALL ON FUNCTION merge_fornecedores_atomic(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_fornecedores_atomic(UUID, UUID) TO service_role;
