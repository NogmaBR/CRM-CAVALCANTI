import 'server-only';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Database } from '@nogma/db';
import { rowsToObjects, parseCsv, type ParsedCsv } from '@/lib/util/csv-parser';
import { ImportPagamentoRowSchema, type ImportPagamentoRow } from '@/lib/schemas/import-pagamento';

/**
 * Service pra import de pagamentos via CSV.
 *
 * 2 fases:
 *   1. previewImport(csv, criadoPor) — valida + tenta matching de
 *      obras/fornecedores/categorias por nome. NÃO insere. Retorna
 *      preview com erros por linha (+ counts).
 *   2. commitImport(rows, criadoPor) — recebe rows JÁ validadas + com
 *      IDs resolvidos, faz batch insert em pagamentos.
 *
 * Uso via server actions da /config/importar page.
 */

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL ausente');
  return createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export interface PreviewRow {
  linha: number; // linha original no CSV (1-based, header = 1)
  raw: Record<string, string>;
  data: ImportPagamentoRow | null;
  errors: string[]; // erros de validação Zod OU matching FK
  matched: {
    obra_id: string | null;
    obra_nome: string | null;
    fornecedor_id: string | null;
    fornecedor_nome: string | null;
    categoria_id: string | null;
    categoria_nome: string | null;
  };
}

export interface PreviewResult {
  headers: string[];
  rows: PreviewRow[];
  summary: {
    total: number;
    ok: number;
    erro: number;
  };
}

/**
 * Fase 1: parse + valida + tenta matching. Zero writes.
 */
/**
 * Resolve uma leva de linhas cruas do CSV: valida com Zod e casa
 * obra/fornecedor/categoria por nome contra o banco.
 *
 * Extraída de `previewImport` porque `commitImport` precisa rodar exatamente
 * o mesmo caminho (finding M-1 da auditoria 2026-09-09): antes o commit
 * confiava nos IDs que voltavam do client, então bastava adulterar o payload
 * do round-trip pra lançar pagamentos numa obra diferente da que estava no
 * CSV. Agora o nome no arquivo é a única fonte de verdade, dos dois lados.
 */
async function resolverLinhas(
  objects: Array<Record<string, string>>,
): Promise<PreviewRow[]> {
  const supabase = serviceRoleClient();

  // Batched lookup de obras/fornecedores/categorias (uma query cada)
  const [obrasR, fornsR, catsR] = await Promise.all([
    supabase.from('obras').select('id, nome').is('deleted_at', null),
    supabase.from('fornecedores').select('id, nome').is('deleted_at', null),
    supabase.from('categorias').select('id, nome').is('deleted_at', null),
  ]);

  const obraByNome = new Map((obrasR.data ?? []).map((o) => [normalize(o.nome), o]));
  const fornByNome = new Map((fornsR.data ?? []).map((f) => [normalize(f.nome), f]));
  const catByNome = new Map((catsR.data ?? []).map((c) => [normalize(c.nome), c]));

  return objects.map((raw, idx) => {
    const linha = idx + 2; // +1 pra 1-based, +1 pro header
    const parsed = ImportPagamentoRowSchema.safeParse(raw);
    const errors: string[] = [];
    let data: ImportPagamentoRow | null = null;

    if (!parsed.success) {
      for (const iss of parsed.error.issues) {
        errors.push(`${iss.path.join('.') || 'campo'}: ${iss.message}`);
      }
    } else {
      data = parsed.data;
    }

    const matched: PreviewRow['matched'] = {
      obra_id: null,
      obra_nome: null,
      fornecedor_id: null,
      fornecedor_nome: null,
      categoria_id: null,
      categoria_nome: null,
    };

    if (data) {
      const obra = obraByNome.get(normalize(data.obra));
      if (obra) {
        matched.obra_id = obra.id;
        matched.obra_nome = obra.nome;
      } else {
        errors.push(`obra: não encontrada ("${data.obra}"). Cadastre em /obras antes de importar.`);
      }

      if (data.fornecedor) {
        const forn = fornByNome.get(normalize(data.fornecedor));
        if (forn) {
          matched.fornecedor_id = forn.id;
          matched.fornecedor_nome = forn.nome;
        } else {
          // Fornecedor opcional — não bloqueia, mas alerta
          errors.push(`fornecedor: não encontrado ("${data.fornecedor}"). Será importado sem fornecedor.`);
          matched.fornecedor_nome = data.fornecedor;
        }
      }

      if (data.categoria) {
        const cat = catByNome.get(normalize(data.categoria));
        if (cat) {
          matched.categoria_id = cat.id;
          matched.categoria_nome = cat.nome;
        } else {
          errors.push(`categoria: não encontrada ("${data.categoria}"). Será importado sem categoria.`);
          matched.categoria_nome = data.categoria;
        }
      }
    }

    return { linha, raw, data, errors, matched };
  });
}

/**
 * Fase 1: parse + valida + tenta matching. Zero writes.
 */
export async function previewImport(csvText: string): Promise<PreviewResult> {
  const parsed: ParsedCsv = parseCsv(csvText);
  const objects = rowsToObjects(parsed);
  const rows = await resolverLinhas(objects);

  const ok = rows.filter((r) => r.data != null && r.matched.obra_id != null).length;
  return {
    headers: parsed.headers,
    rows,
    summary: { total: rows.length, ok, erro: rows.length - ok },
  };
}

/**
 * Fase 2: batch insert. Recebe rows já validadas (só com obra_id não-null).
 * Retorna count inserido + erros do DB.
 *
 * Idempotência: NÃO — csv reimportado insere duplicatas. Import é 1-time
 * bulk. Pra dedup use SHA-256 hash da linha OU numero_nf unique (não
 * temos ainda em pagamentos, só em documentos).
 */
export async function commitImport(
  previewRows: PreviewRow[],
  criadoPorUserId: string | null,
): Promise<{ inserted: number; failed: number; errors: string[] }> {
  const supabase = serviceRoleClient();

  // Finding M-1: reprocessamos as linhas cruas do zero. Tudo que o client
  // mandou além de `raw` (os IDs casados, o valor já parseado, o status) é
  // descartado — `commitImport` roda com service_role e bypassa RLS, então
  // aceitar ID vindo do browser era o mesmo que deixar o browser escolher em
  // qual obra lançar o pagamento.
  const rowsRevalidadas = await resolverLinhas(previewRows.map((r) => r.raw));

  const insertable = rowsRevalidadas.filter(
    (r) =>
      r.data != null &&
      r.matched.obra_id != null &&
      !r.errors.some((e) => e.startsWith('obra:') || e.startsWith('valor:') || e.startsWith('data_pagamento:')),
  );

  if (insertable.length === 0) return { inserted: 0, failed: 0, errors: ['Nenhuma linha válida pra importar'] };

  const rows = insertable.map((r) => ({
    obra_id: r.matched.obra_id!,
    fornecedor_id: r.matched.fornecedor_id ?? null,
    categoria_id: r.matched.categoria_id ?? null,
    valor: r.data!.valor,
    data_pagamento: r.data!.data_pagamento,
    origem: r.data!.origem,
    status_pagto: r.data!.status_pagto,
    descricao: r.data!.descricao ?? null,
    observacoes: r.data!.observacoes ?? null,
    criado_por_user_id: criadoPorUserId,
  }));

  // Batch em chunks de 100 pra evitar timeout / payload muito grande
  const CHUNK = 100;
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await supabase.from('pagamentos').insert(chunk).select('id');
    if (error) {
      errors.push(`Chunk ${i}-${i + chunk.length}: ${error.message}`);
    } else {
      inserted += data?.length ?? 0;
    }
  }

  return {
    inserted,
    failed: rows.length - inserted,
    errors,
  };
}
