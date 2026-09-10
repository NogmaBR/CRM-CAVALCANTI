import 'server-only';
import { logger } from '@/lib/log';
import { buscar, fontesDe, montarContexto } from '@/lib/rag/busca';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
// `zod/v4` pelo mesmo motivo do classificador: o helper do SDK exige os tipos
// do Zod 4 e o resto do projeto está no Zod 3.
import { z } from 'zod/v4';
import {
  SEM_CONTEXTO,
  SEM_EMBEDDINGS,
  SISTEMA,
  VERSAO,
  montarPrompt,
} from './prompts/assistente-obra';

const log = logger('assistente');

/**
 * O assistente de obra: pergunta em português, resposta fundamentada.
 *
 * Junta as duas metades da Fase 4 — a busca por significado
 * (`lib/rag`) e o modelo. A ordem importa e é o oposto da intuição: **busca
 * primeiro, modelo depois**. O modelo nunca decide o que procurar; ele recebe
 * o que foi encontrado e escreve em cima disso.
 *
 * ## Três caminhos, e dois não chamam o modelo
 *
 *   sem embeddings  → texto fixo. A busca não está configurada.
 *   sem trechos     → texto fixo. Não achou nada acima do corte.
 *   com trechos     → chama o modelo.
 *
 * Os dois primeiros são economia e segurança ao mesmo tempo: pagar por uma
 * chamada cujo resultado já se sabe é desperdício, e pedir ao modelo que diga
 * "não encontrei" é convidá-lo a responder de memória.
 */

type Client = SupabaseClient<Database>;

const MODELO_PADRAO = 'claude-opus-5';
const MAX_TOKENS = 1024;

const SaidaSchema = z.object({
  resposta: z.string().describe('A resposta, curta, para ler no celular.'),
  fontes_citadas: z
    .array(z.number().int())
    .describe('Os números entre colchetes usados na resposta. Vazio se nenhum coube.'),
});

export interface PerguntaAoAssistente {
  pergunta: string;
  canal: 'whatsapp' | 'painel';
  autorizadoId?: string | null;
  userId?: string | null;
  obraId?: string | null;
}

export interface RespostaDoAssistente {
  texto: string;
  fontes: ReturnType<typeof fontesDe>;
  usouModelo: boolean;
  conversationId?: string;
}

export function assistenteDisponivel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && (process.env.IA_PROVIDER ?? 'mock') !== 'mock';
}

export async function perguntar(
  supabase: Client,
  entrada: PerguntaAoAssistente,
): Promise<RespostaDoAssistente> {
  const busca = await buscar(supabase, entrada.pergunta, { obraId: entrada.obraId ?? null });

  if (!busca.ok) {
    if (busca.motivo === 'sem_embeddings') {
      return { texto: SEM_EMBEDDINGS, fontes: [], usouModelo: false };
    }
    log.erro('busca_falhou', { motivo: busca.motivo, detalhe: busca.detalhe });
    return { texto: SEM_CONTEXTO, fontes: [], usouModelo: false };
  }

  if (busca.trechos.length === 0) {
    return { texto: SEM_CONTEXTO, fontes: [], usouModelo: false };
  }

  const fontes = fontesDe(busca.trechos);

  if (!assistenteDisponivel()) {
    // Há contexto, mas não há modelo para redigir. Em vez de silêncio,
    // devolve o que foi encontrado — é menos elegante e mais útil que "não
    // configurado", e deixa o fluxo demonstrável sem chave da Anthropic.
    const lista = busca.trechos
      .slice(0, 3)
      .map((t, i) => `[${i + 1}] ${t.conteudo}`)
      .join('\n');
    return {
      texto: `Encontrei estes registros:\n\n${lista}`,
      fontes,
      usouModelo: false,
    };
  }

  const contexto = montarContexto(busca.trechos);

  let texto: string;
  let citadas: number[] = [];
  let tokensEntrada: number | null = null;
  let tokensSaida: number | null = null;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resposta = await client.messages.parse({
      model: process.env.IA_MODEL ?? MODELO_PADRAO,
      max_tokens: MAX_TOKENS,
      system: SISTEMA,
      // `effort: low` de propósito: a tarefa é redigir a partir de um contexto
      // que já contém a resposta, não deduzir. Esforço alto aqui compraria
      // latência sem comprar precisão — e isto responde no WhatsApp, onde a
      // espera é sentida.
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'low',
        format: zodOutputFormat(SaidaSchema),
      },
      messages: [{ role: 'user', content: montarPrompt(entrada.pergunta, contexto) }],
    });

    const saida = resposta.parsed_output;
    if (!saida) {
      log.erro('sem_parsed_output', { stop_reason: resposta.stop_reason });
      return { texto: SEM_CONTEXTO, fontes, usouModelo: false };
    }

    texto = saida.resposta.trim();
    citadas = saida.fontes_citadas;
    tokensEntrada = resposta.usage?.input_tokens ?? null;
    tokensSaida = resposta.usage?.output_tokens ?? null;
  } catch (err) {
    log.erro('modelo_falhou', { err });
    return { texto: SEM_CONTEXTO, fontes, usouModelo: false };
  }

  // Guardamos só as fontes que ele de fato citou. Registrar as seis
  // encontradas daria a impressão de que todas sustentaram a resposta, e
  // "de onde saiu isso?" voltaria a não ter resposta exata.
  const fontesUsadas = citadas.length > 0 ? fontes.filter((f) => citadas.includes(f.ref)) : fontes;

  const conversationId = await registrar(supabase, entrada, texto, fontesUsadas, {
    tokensEntrada,
    tokensSaida,
  });

  return { texto, fontes: fontesUsadas, usouModelo: true, conversationId };
}

/**
 * Grava pergunta e resposta.
 *
 * Best-effort: se a memória falhar, a pessoa ainda recebe a resposta. Perder o
 * registro é ruim; engolir a resposta por causa disso é pior.
 */
async function registrar(
  supabase: Client,
  entrada: PerguntaAoAssistente,
  resposta: string,
  fontes: ReturnType<typeof fontesDe>,
  uso: { tokensEntrada: number | null; tokensSaida: number | null },
): Promise<string | undefined> {
  try {
    const { data: conversa, error } = await supabase
      .from('ai_conversations')
      .insert({
        canal: entrada.canal,
        autorizado_id: entrada.autorizadoId ?? null,
        user_id: entrada.userId ?? null,
        obra_id: entrada.obraId ?? null,
      })
      .select('id')
      .single();

    if (error || !conversa) {
      log.erro('abrir_conversa_falhou', { erro: error?.message });
      return undefined;
    }

    await supabase.from('ai_messages').insert([
      {
        conversation_id: conversa.id,
        papel: 'usuario',
        conteudo: entrada.pergunta,
      },
      {
        conversation_id: conversa.id,
        papel: 'assistente',
        conteudo: resposta,
        // A versão do prompt entra junto: é o que responde "com qual texto
        // isso foi gerado?" quando uma resposta antiga parecer estranha.
        fontes: { prompt_versao: VERSAO, refs: fontes } as never,
        tokens_entrada: uso.tokensEntrada,
        tokens_saida: uso.tokensSaida,
      },
    ]);

    return conversa.id;
  } catch (err) {
    log.erro('registrar_conversa_falhou', { err });
    return undefined;
  }
}
