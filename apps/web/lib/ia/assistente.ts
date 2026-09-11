import 'server-only';
import { logger } from '@/lib/log';
import { buscar, fontesDe, montarContexto } from '@/lib/rag/busca';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ContentBlockParam,
  Message,
  MessageCreateParamsNonStreaming,
  MessageParam,
} from '@anthropic-ai/sdk/resources/messages/messages';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FERRAMENTAS_DE_OBRA } from './ferramentas/obras';
import { type Ferramenta, executarFerramenta, paraAnthropic } from './ferramentas/registro';
import {
  SEM_CONTEXTO,
  SEM_EMBEDDINGS,
  SEM_RESPOSTA,
  SISTEMA,
  VERSAO,
  montarPrompt,
} from './prompts/assistente-obra';

const log = logger('assistente');

/**
 * O assistente de obra: pergunta em português, resposta fundamentada.
 *
 * Junta três coisas da Fase 4:
 *
 *   - a **busca por significado** (`lib/rag`), que traz trechos de lançamentos
 *     parecidos com a pergunta;
 *   - as **ferramentas** (`./ferramentas`), que respondem agregados — totais,
 *     períodos, rankings — que nenhum trecho contém;
 *   - o **modelo**, que decide se precisa de ferramenta, chama, e redige.
 *
 * ## A ordem: busca primeiro, modelo depois, ferramentas quando ele pedir
 *
 * A busca roda antes e o resultado vai no prompt. O modelo não decide o que
 * procurar por semelhança; ele recebe o que foi encontrado. O que ele decide
 * é se a pergunta pede um agregado — e aí pede uma ferramenta pelo nome.
 *
 * ## O laço tem teto
 *
 * `MAX_RODADAS` chamadas ao modelo por pergunta. Ferramenta que falha devolve
 * o erro ao modelo (que normalmente responde "não consegui"), nunca lança. Se
 * o teto estourar, a resposta é um texto fixo — não um erro no WhatsApp.
 *
 * ## Sem embeddings, ainda funciona
 *
 * Antes desta versão o assistente exigia embeddings. Com ferramentas, "quanto
 * gastei em setembro" responde só com a chave da Anthropic: a busca devolve
 * zero trechos e a ferramenta faz a soma. É o caminho mais provável no
 * primeiro dia em produção.
 */

type Client = SupabaseClient<Database>;

const MODELO_PADRAO = 'claude-opus-5';
const MAX_TOKENS = 1024;
/** Chamadas ao modelo por pergunta. Quatro dá "ferramenta → outra → redigir" com folga. */
const MAX_RODADAS = 4;

export interface PerguntaAoAssistente {
  pergunta: string;
  canal: 'whatsapp' | 'painel';
  autorizadoId?: string | null;
  userId?: string | null;
  obraId?: string | null;
}

export interface ChamadaDeFerramenta {
  ferramenta: string;
  argumentos: unknown;
  resultado: unknown;
  ok: boolean;
  erro: string | null;
  duracao_ms: number;
}

export interface RespostaDoAssistente {
  texto: string;
  fontes: ReturnType<typeof fontesDe>;
  usouModelo: boolean;
  ferramentas: ChamadaDeFerramenta[];
  conversationId?: string;
}

/** O pedaço do cliente da Anthropic que este módulo usa. Injetável em teste. */
export interface ClienteDeMensagens {
  create(params: MessageCreateParamsNonStreaming): Promise<Message>;
}

export interface DependenciasDoAssistente {
  /** Substitui `new Anthropic(...)`. Se vier, o modelo é considerado disponível. */
  criarCliente?: () => ClienteDeMensagens;
  /** Substitui a allowlist padrão. */
  ferramentas?: readonly Ferramenta[];
  /** Data de hoje (AAAA-MM-DD), para o modelo resolver "este mês" em datas. */
  hoje?: () => string;
}

export function assistenteDisponivel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && (process.env.IA_PROVIDER ?? 'mock') !== 'mock';
}

/**
 * Extrai os `[n]` citados no texto. Vem do texto, não de um campo à parte:
 * assim não há como o modelo citar [3] no corpo e declarar só [1].
 */
export function extrairCitacoes(texto: string): number[] {
  const vistos = new Set<number>();
  for (const m of texto.matchAll(/\[(\d{1,2})\]/gu)) {
    const n = Number(m[1]);
    if (n > 0) vistos.add(n);
  }
  return [...vistos].sort((a, b) => a - b);
}

export async function perguntar(
  supabase: Client,
  entrada: PerguntaAoAssistente,
  deps: DependenciasDoAssistente = {},
): Promise<RespostaDoAssistente> {
  const ferramentas = deps.ferramentas ?? FERRAMENTAS_DE_OBRA;
  const modeloDisponivel = deps.criarCliente ? true : assistenteDisponivel();

  // 1. Busca por semelhança. Pode não estar configurada; isso já não impede
  //    a resposta — só tira o contexto.
  const busca = await buscar(supabase, entrada.pergunta, { obraId: entrada.obraId ?? null });
  const trechos = busca.ok ? busca.trechos : [];
  if (!busca.ok && busca.motivo === 'erro') {
    log.erro('busca_falhou', { motivo: busca.motivo, detalhe: busca.detalhe });
  }
  const fontes = fontesDe(trechos);

  // 2. Sem modelo: devolve o que a busca achou, ou explica o que falta.
  if (!modeloDisponivel) {
    if (trechos.length > 0) {
      const lista = trechos
        .slice(0, 3)
        .map((t, i) => `[${i + 1}] ${t.conteudo}`)
        .join('\n');
      return {
        texto: `Encontrei estes registros:\n\n${lista}`,
        fontes,
        usouModelo: false,
        ferramentas: [],
      };
    }
    const texto = !busca.ok && busca.motivo === 'sem_embeddings' ? SEM_EMBEDDINGS : SEM_CONTEXTO;
    return { texto, fontes: [], usouModelo: false, ferramentas: [] };
  }

  // 3. Modelo, com ferramentas.
  const contexto =
    trechos.length > 0 ? montarContexto(trechos) : '(nenhum lançamento parecido encontrado)';
  const hoje = deps.hoje ? deps.hoje() : new Date().toISOString().slice(0, 10);
  const client = deps.criarCliente
    ? deps.criarCliente()
    : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages;

  const mensagens: MessageParam[] = [
    { role: 'user', content: montarPrompt(entrada.pergunta, contexto, hoje) },
  ];
  const chamadas: ChamadaDeFerramenta[] = [];
  let tokensEntrada = 0;
  let tokensSaida = 0;
  let texto = '';
  let concluiu = false;

  try {
    for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
      const resposta = await client.create({
        model: process.env.IA_MODEL ?? MODELO_PADRAO,
        max_tokens: MAX_TOKENS,
        system: SISTEMA,
        // `effort: low`: a tarefa é decidir entre "tenho no contexto",
        // "preciso de uma ferramenta" e "não sei" — e redigir curto. Esforço
        // alto compraria latência no WhatsApp sem comprar precisão.
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        tools: paraAnthropic(ferramentas),
        messages: mensagens,
      });

      tokensEntrada += resposta.usage?.input_tokens ?? 0;
      tokensSaida += resposta.usage?.output_tokens ?? 0;

      const usos = resposta.content.filter((b) => b.type === 'tool_use');

      if (resposta.stop_reason !== 'tool_use' || usos.length === 0) {
        texto = resposta.content
          .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        concluiu = true;
        break;
      }

      // O conteúdo inteiro volta como mensagem do assistente — inclusive os
      // blocos de raciocínio, que a API exige de volta quando há tool_use.
      mensagens.push({ role: 'assistant', content: resposta.content as ContentBlockParam[] });

      const resultados: ContentBlockParam[] = [];
      for (const uso of usos) {
        const r = await executarFerramenta(supabase, ferramentas, uso.name, uso.input);
        const registro: ChamadaDeFerramenta = {
          ferramenta: uso.name,
          argumentos: uso.input,
          resultado: r.ok ? r.resultado : null,
          ok: r.ok,
          erro: r.ok ? null : r.erro,
          duracao_ms: r.duracao_ms,
        };
        chamadas.push(registro);
        log[r.ok ? 'info' : 'aviso']('ferramenta', {
          ferramenta: uso.name,
          ok: r.ok,
          erro: registro.erro,
          duracao_ms: r.duracao_ms,
        });
        resultados.push({
          type: 'tool_result',
          tool_use_id: uso.id,
          content: JSON.stringify(r.ok ? r.resultado : { ok: false, erro: r.erro }),
          is_error: !r.ok,
        });
      }
      mensagens.push({ role: 'user', content: resultados });
    }
  } catch (err) {
    log.erro('modelo_falhou', { err, rodadas: chamadas.length });
    return { texto: SEM_CONTEXTO, fontes, usouModelo: false, ferramentas: chamadas };
  }

  if (!concluiu || !texto) {
    // Estourou o teto de rodadas, ou o modelo devolveu só ferramentas e
    // nenhum texto. Texto fixo: melhor que silêncio, e melhor que inventar.
    log.aviso('sem_texto_final', { concluiu, rodadas: chamadas.length });
    texto = SEM_RESPOSTA;
  }

  const citadas = extrairCitacoes(texto);
  // Só as fontes que ele de fato citou. Registrar todas as encontradas daria a
  // impressão de que todas sustentaram a resposta.
  const fontesUsadas = fontes.filter((f) => citadas.includes(f.ref));

  const conversationId = await registrar(supabase, entrada, texto, fontesUsadas, chamadas, {
    tokensEntrada,
    tokensSaida,
  });

  return { texto, fontes: fontesUsadas, usouModelo: true, ferramentas: chamadas, conversationId };
}

/**
 * Grava pergunta, resposta e as chamadas de ferramenta.
 *
 * Best-effort: se a memória falhar, a pessoa ainda recebe a resposta. Perder
 * o registro é ruim; engolir a resposta por causa disso é pior.
 */
async function registrar(
  supabase: Client,
  entrada: PerguntaAoAssistente,
  resposta: string,
  fontes: ReturnType<typeof fontesDe>,
  chamadas: ChamadaDeFerramenta[],
  uso: { tokensEntrada: number; tokensSaida: number },
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

    await supabase.from('ai_messages').insert({
      conversation_id: conversa.id,
      papel: 'usuario',
      conteudo: entrada.pergunta,
    });

    const { data: msg, error: erroMsg } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversa.id,
        papel: 'assistente',
        conteudo: resposta,
        // A versão do prompt entra junto: é o que responde "com qual texto
        // isso foi gerado?" quando uma resposta antiga parecer estranha.
        fontes: { prompt_versao: VERSAO, refs: fontes } as never,
        tokens_entrada: uso.tokensEntrada,
        tokens_saida: uso.tokensSaida,
      })
      .select('id')
      .single();

    if (erroMsg || !msg) {
      log.erro('registrar_resposta_falhou', { erro: erroMsg?.message });
      return conversa.id;
    }

    if (chamadas.length > 0) {
      const { error: erroTools } = await supabase.from('ai_tool_calls').insert(
        chamadas.map((c) => ({
          message_id: msg.id,
          ferramenta: c.ferramenta,
          argumentos: c.argumentos as never,
          resultado: c.resultado as never,
          ok: c.ok,
          erro: c.erro,
          duracao_ms: c.duracao_ms,
        })),
      );
      if (erroTools) log.erro('registrar_ferramentas_falhou', { erro: erroTools.message });
    }

    return conversa.id;
  } catch (err) {
    log.erro('registrar_conversa_falhou', { err });
    return undefined;
  }
}
