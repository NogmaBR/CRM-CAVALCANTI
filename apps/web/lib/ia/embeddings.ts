import 'server-only';

/**
 * Embeddings — transformar texto em vetor para busca por significado.
 *
 * Provider escolhido por env (`IA_EMBEDDINGS_PROVIDER`):
 *   - `none` (default): não gera nada. A indexação registra o texto e deixa o
 *     embedding nulo; a busca não encontra. Sem chave, o sistema não falha
 *     nem gasta — só não responde por semelhança.
 *   - `openai`: `text-embedding-3-small`. É o provider da conta que o cliente
 *     já vai abrir para a transcrição; a Anthropic não oferece embeddings,
 *     então não há branch equivalente para ela aqui.
 *
 * ## A dimensão é fixa, e isso é de propósito
 *
 * 1536 está gravado na coluna `knowledge_chunks.embedding` e aqui. Trocar de
 * modelo para um de dimensão diferente exige migration e reindexação completa
 * — vetores de tamanhos diferentes não se comparam.
 *
 * Deixar a dimensão configurável pareceria flexível e produziria um banco com
 * metade dos vetores incomparáveis com a outra metade, sem nenhum erro no
 * caminho. Por isso o modelo é validado contra a dimensão esperada.
 */

export const DIMENSOES = 1536;

/** Modelos conhecidos e a dimensão que cada um produz. */
const DIMENSAO_POR_MODELO: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
};

const MODELO_PADRAO = 'text-embedding-3-small';

/** Teto por requisição. Acima disso a API recusa, e o corte é nosso. */
const MAX_TEXTOS_POR_LOTE = 96;

export type ResultadoEmbedding =
  | { ok: true; vetores: number[][]; modelo: string }
  | {
      ok: false;
      motivo: 'desativado' | 'sem_chave' | 'dimensao' | 'api' | 'excecao';
      detalhe?: string;
    };

export function embeddingsAtivo(): boolean {
  return (process.env.IA_EMBEDDINGS_PROVIDER ?? 'none') !== 'none';
}

function modeloConfigurado(): string {
  return process.env.OPENAI_EMBEDDINGS_MODEL ?? MODELO_PADRAO;
}

/**
 * Gera embeddings para vários textos de uma vez.
 *
 * Em lote, e não um a um, porque cada chamada tem latência de rede fixa: 80
 * pagamentos viram uma requisição em vez de oitenta.
 */
export async function gerarEmbeddings(textos: string[]): Promise<ResultadoEmbedding> {
  const provider = process.env.IA_EMBEDDINGS_PROVIDER ?? 'none';

  if (provider === 'none') {
    return { ok: false, motivo: 'desativado' };
  }

  if (provider !== 'openai') {
    return {
      ok: false,
      motivo: 'excecao',
      detalhe: `IA_EMBEDDINGS_PROVIDER desconhecido: ${provider}. Suportados: none, openai`,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, motivo: 'sem_chave' };
  }

  const modelo = modeloConfigurado();
  const dimensaoDoModelo = DIMENSAO_POR_MODELO[modelo];

  // Falha antes de gastar: um modelo de 3072 gravado numa coluna de 1536 não
  // dá erro de tipo no Postgres — dá erro de *dimensão* no INSERT, depois de
  // a chamada já ter sido cobrada. Melhor recusar aqui.
  if (dimensaoDoModelo != null && dimensaoDoModelo !== DIMENSOES) {
    return {
      ok: false,
      motivo: 'dimensao',
      detalhe: `"${modelo}" produz ${dimensaoDoModelo} dimensões; a base espera ${DIMENSOES}. Trocar exige migration e reindexação.`,
    };
  }

  const limpos = textos.map((t) => t.trim()).filter((t) => t.length > 0);
  if (limpos.length === 0) {
    return { ok: true, vetores: [], modelo };
  }

  if (limpos.length > MAX_TEXTOS_POR_LOTE) {
    return {
      ok: false,
      motivo: 'excecao',
      detalhe: `${limpos.length} textos num lote; o teto é ${MAX_TEXTOS_POR_LOTE}.`,
    };
  }

  try {
    const resposta = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: modelo, input: limpos }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.text();
      return {
        ok: false,
        motivo: 'api',
        detalhe: `HTTP ${resposta.status}: ${corpo.slice(0, 200)}`,
      };
    }

    const json = (await resposta.json()) as {
      data?: Array<{ embedding: number[]; index: number }>;
    };

    const dados = json.data ?? [];
    if (dados.length !== limpos.length) {
      return {
        ok: false,
        motivo: 'api',
        detalhe: `Pedi ${limpos.length} embeddings e vieram ${dados.length}.`,
      };
    }

    // A API devolve `index`; ordenar por ele garante que o vetor n
    // corresponde ao texto n. Confiar na ordem de chegada casaria o embedding
    // errado com o trecho errado — e a busca ficaria sutilmente errada, sem
    // nunca dar erro.
    const vetores = [...dados].sort((a, b) => a.index - b.index).map((d) => d.embedding);

    const forasDePadrao = vetores.filter((v) => v.length !== DIMENSOES).length;
    if (forasDePadrao > 0) {
      return {
        ok: false,
        motivo: 'dimensao',
        detalhe: `${forasDePadrao} vetor(es) com dimensão diferente de ${DIMENSOES}.`,
      };
    }

    return { ok: true, vetores, modelo };
  } catch (err) {
    return {
      ok: false,
      motivo: 'excecao',
      detalhe: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Um texto só. Atalho para a busca, que sempre embeda a pergunta sozinha. */
export async function gerarEmbedding(
  texto: string,
): Promise<{ ok: true; vetor: number[] } | { ok: false; motivo: string; detalhe?: string }> {
  const r = await gerarEmbeddings([texto]);
  if (!r.ok) return { ok: false, motivo: r.motivo, detalhe: r.detalhe };

  const vetor = r.vetores[0];
  if (!vetor) return { ok: false, motivo: 'api', detalhe: 'nenhum vetor devolvido' };

  return { ok: true, vetor };
}

/**
 * Formato que o Postgres aceita para `vector`.
 *
 * A RPC recebe TEXT porque o PostgREST serializa em JSON — mandar um array de
 * 1536 floats como parâmetro tipado falharia na API mesmo funcionando em SQL.
 */
export function paraLiteralVetor(vetor: number[]): string {
  return `[${vetor.join(',')}]`;
}

export const MAX_LOTE = MAX_TEXTOS_POR_LOTE;
