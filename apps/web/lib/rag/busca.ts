import 'server-only';
import { gerarEmbedding, paraLiteralVetor } from '@/lib/ia/embeddings';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Busca por significado na base de conhecimento.
 *
 * ## Não achar nada é resposta
 *
 * O corte de similaridade existe para que a busca possa dizer "não sei". Sem
 * ele, `ORDER BY distância LIMIT 6` sempre devolve seis trechos — os seis
 * menos ruins, ainda que nenhum tenha a ver com a pergunta. O modelo então
 * responde com base neles, e o resultado é uma invenção com fonte citada, que
 * é pior que um "não encontrei".
 */

type Client = SupabaseClient<Database>;

export interface Trecho {
  chunkId: string;
  documentoId: string;
  origem: string;
  origemId: string;
  obraId: string | null;
  titulo: string;
  conteudo: string;
  similaridade: number;
}

export type ResultadoBusca =
  | { ok: true; trechos: Trecho[] }
  | { ok: false; motivo: 'sem_embeddings' | 'erro'; detalhe?: string };

export interface OpcoesBusca {
  limite?: number;
  obraId?: string | null;
  /**
   * Piso de similaridade. 0.25 é conservador para `text-embedding-3-small`:
   * baixo o bastante para não descartar paráfrase, alto o bastante para
   * descartar o que só compartilha o idioma.
   */
  similaridadeMinima?: number;
}

export async function buscar(
  supabase: Client,
  pergunta: string,
  opcoes: OpcoesBusca = {},
): Promise<ResultadoBusca> {
  const emb = await gerarEmbedding(pergunta);

  if (!emb.ok) {
    if (emb.motivo === 'desativado' || emb.motivo === 'sem_chave') {
      return { ok: false, motivo: 'sem_embeddings', detalhe: emb.detalhe };
    }
    return { ok: false, motivo: 'erro', detalhe: `${emb.motivo}: ${emb.detalhe ?? ''}` };
  }

  const { data, error } = await supabase.rpc('buscar_conhecimento', {
    p_embedding: paraLiteralVetor(emb.vetor),
    p_limite: opcoes.limite ?? 6,
    p_obra_id: opcoes.obraId ?? undefined,
    p_similaridade_minima: opcoes.similaridadeMinima ?? 0.25,
  });

  if (error) {
    return { ok: false, motivo: 'erro', detalhe: error.message };
  }

  const trechos: Trecho[] = (data ?? []).map((t) => ({
    chunkId: t.chunk_id,
    documentoId: t.documento_id,
    origem: t.origem,
    origemId: t.origem_id,
    obraId: t.obra_id,
    titulo: t.titulo,
    conteudo: t.conteudo,
    similaridade: t.similaridade,
  }));

  return { ok: true, trechos };
}

/**
 * Monta o contexto que vai no prompt.
 *
 * Cada trecho recebe um número — `[1]`, `[2]` — e é por esse número que o
 * modelo cita. Pedir para ele repetir o título por extenso convida a
 * reescrever o título, e um título reescrito não casa mais com nada na hora de
 * conferir de onde a informação veio.
 */
export function montarContexto(trechos: Trecho[]): string {
  if (trechos.length === 0) return '(nenhum registro encontrado)';

  return trechos.map((t, i) => `[${i + 1}] ${t.titulo}\n${t.conteudo}`).join('\n\n');
}

/** As fontes, no formato que vai para `ai_messages.fontes`. */
export function fontesDe(trechos: Trecho[]): Array<{
  ref: number;
  origem: string;
  origemId: string;
  titulo: string;
  similaridade: number;
}> {
  return trechos.map((t, i) => ({
    ref: i + 1,
    origem: t.origem,
    origemId: t.origemId,
    titulo: t.titulo,
    similaridade: Math.round(t.similaridade * 100) / 100,
  }));
}
