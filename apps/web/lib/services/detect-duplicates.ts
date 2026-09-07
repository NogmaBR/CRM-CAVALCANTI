import 'server-only';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Database } from '@nogma/db';

/**
 * Detecção de duplicatas entre fornecedores.
 *
 * Estratégia:
 *  1. Query TODOS os fornecedores ativos (com documento se tiver)
 *  2. Match forte: mesmo `documento` (CNPJ/CPF) — score 1.0
 *  3. Match fraco: Jaro-Winkler similarity no nome normalizado >= threshold
 *
 * Retorna pares [{a, b, score, motivo}] com dedup (não repete (a,b) e (b,a)).
 * Ordenado por score DESC.
 *
 * Custo: O(n²) — pra n=200 fornecedores ~20k comparações, ~50ms.
 * Se scale > 5k considerar: pgtrgm index + query SQL similar.
 */

function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE env ausente');
  return createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/\bltda\b|\bs\.?a\.?\b|\beireli\b|\bme\b|\bepp\b/gu, '')
    .replace(/[^\w\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Jaro-Winkler similarity — retorna 0..1 (1 = idênticas).
 * Implementação padrão sem deps. Boost pra prefixos comuns (Winkler).
 */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDist = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches += 1;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k += 1;
    if (a[i] !== b[k]) transpositions += 1;
    k += 1;
  }
  transpositions /= 2;

  const jaro = (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;

  // Winkler boost: comum prefix até 4 chars, weight 0.1
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i += 1) {
    if (a[i] === b[i]) prefix += 1;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

export interface DuplicateCandidate {
  a: { id: string; nome: string; documento: string | null };
  b: { id: string; nome: string; documento: string | null };
  score: number;
  motivo: 'documento_igual' | 'nome_similar';
}

const NAME_THRESHOLD = 0.9; // matches quase-idênticos

export async function detectDuplicateFornecedores(): Promise<DuplicateCandidate[]> {
  const supabase = serviceRoleClient();
  const { data, error } = await supabase
    .from('fornecedores')
    .select('id, nome, documento')
    .is('deleted_at', null);
  if (error || !data) return [];

  const results: DuplicateCandidate[] = [];
  const forns = data.map((f) => ({ ...f, _norm: normalize(f.nome) }));

  for (let i = 0; i < forns.length; i += 1) {
    for (let j = i + 1; j < forns.length; j += 1) {
      const a = forns[i]!;
      const b = forns[j]!;

      // Match forte: mesmo documento normalizado (só dígitos)
      if (a.documento && b.documento) {
        const aDoc = a.documento.replace(/\D+/gu, '');
        const bDoc = b.documento.replace(/\D+/gu, '');
        if (aDoc.length > 0 && aDoc === bDoc) {
          results.push({
            a: { id: a.id, nome: a.nome, documento: a.documento },
            b: { id: b.id, nome: b.nome, documento: b.documento },
            score: 1.0,
            motivo: 'documento_igual',
          });
          continue;
        }
      }

      // Match fraco: nome similar
      const sim = jaroWinkler(a._norm, b._norm);
      if (sim >= NAME_THRESHOLD) {
        results.push({
          a: { id: a.id, nome: a.nome, documento: a.documento },
          b: { id: b.id, nome: b.nome, documento: b.documento },
          score: sim,
          motivo: 'nome_similar',
        });
      }
    }
  }

  return results.sort((x, y) => y.score - x.score);
}
