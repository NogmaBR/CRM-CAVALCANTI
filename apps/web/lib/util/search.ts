/**
 * PostgREST filter strings (`.or('col.ilike.%foo%')`) interpretam certos
 * caracteres como metacharacters:
 *   - `,` `(` `)` — separadores/agrupadores de OR/AND expressions
 *   - `\` — escape
 *   - `%` `*` — wildcards de LIKE/ILIKE (podem coagir scan aberto)
 *   - `:` — separador de operator
 *
 * Este helper strippa todos, evitando filter injection sem tentar escapar
 * (para UI de search, dropar chars é aceitável — user vê "resultado
 * limpo").
 *
 * Exportado pra reuso em obras/fornecedores/pagamentos/futuras CRUDs.
 */
export function sanitizeSearchQuery(raw: string): string {
  return raw.replace(/[,()\\%*:]/gu, ' ').trim();
}
