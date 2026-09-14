-- Busca global da paleta ⌘K numa viagem só (design review gstack 2026-09-12, M12).
--
-- Antes /api/busca fazia três consultas em paralelo (obras, fornecedores,
-- pagamentos); com as funções da Vercel em iad1 e o banco em sa-east-1, cada
-- ida custa ~400 ms, e a paleta ficava em "Buscando…" por mais de um segundo.
--
-- SECURITY INVOKER de propósito: a função roda com a sessão de quem chama e a
-- RLS de cada tabela continua decidindo o que aparece. Nada de service_role.
-- Os curingas do ILIKE (\ % _) são escapados aqui, não no cliente.

CREATE OR REPLACE FUNCTION public.busca_global(p_termo text, p_limite integer DEFAULT 5)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH termo AS (
    SELECT '%' || replace(replace(replace(left(coalesce(p_termo, ''), 60), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS padrao,
           greatest(1, least(coalesce(p_limite, 5), 20)) AS limite
  ),
  obras_q AS (
    SELECT jsonb_build_object('id', o.id, 'nome', o.nome, 'cliente', o.cliente) AS j
    FROM obras o, termo t
    WHERE o.deleted_at IS NULL
      AND (o.nome ILIKE t.padrao ESCAPE '\' OR o.cliente ILIKE t.padrao ESCAPE '\')
    ORDER BY o.nome
    LIMIT (SELECT limite FROM termo)
  ),
  forn_q AS (
    SELECT jsonb_build_object('id', f.id, 'nome', f.nome, 'categoria', c.nome) AS j
    FROM fornecedores f
    LEFT JOIN categorias c ON c.id = f.categoria_id
    , termo t
    WHERE f.deleted_at IS NULL
      AND (f.nome ILIKE t.padrao ESCAPE '\' OR f.razao_social ILIKE t.padrao ESCAPE '\')
    ORDER BY f.nome
    LIMIT (SELECT limite FROM termo)
  ),
  pag_q AS (
    SELECT jsonb_build_object(
             'id', p.id, 'descricao', p.descricao, 'valor', p.valor,
             'data', p.data_pagamento, 'obra', o.nome) AS j
    FROM pagamentos p
    LEFT JOIN obras o ON o.id = p.obra_id
    , termo t
    WHERE p.deleted_at IS NULL
      AND (p.descricao ILIKE t.padrao ESCAPE '\' OR p.observacoes ILIKE t.padrao ESCAPE '\')
    ORDER BY p.data_pagamento DESC
    LIMIT (SELECT limite FROM termo)
  )
  SELECT jsonb_build_object(
    'obras',        coalesce((SELECT jsonb_agg(j) FROM obras_q), '[]'::jsonb),
    'fornecedores', coalesce((SELECT jsonb_agg(j) FROM forn_q), '[]'::jsonb),
    'pagamentos',   coalesce((SELECT jsonb_agg(j) FROM pag_q), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.busca_global(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.busca_global(text, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.busca_global(text, integer) IS
  'Paleta ⌘K: obras, fornecedores e pagamentos que casam com o termo, numa viagem. SECURITY INVOKER: respeita a RLS de quem chama.';
