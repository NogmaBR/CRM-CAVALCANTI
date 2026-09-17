import { logger } from '@/lib/log';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';

const log = logger('memoria-curta');

type Client = SupabaseClient<Database>;

/**
 * Memória curta do agente: o que se falou neste chat nas últimas horas.
 *
 * Sem ela cada mensagem é a primeira. "E no INOX?" depois de "quanto gastei
 * na Garibaldi" não faz sentido; "esse é da Garibaldi" depois de uma foto
 * não resolve a foto. Com ela o modelo recebe as últimas trocas como
 * contexto — e o classificador recebe a obra de que se estava falando.
 *
 * Duas fontes, porque as respostas do agente não ficam em `mensagens_whats`:
 *
 *   - `mensagens_whats` — o que a pessoa mandou (texto ou transcrição), com
 *     o que o CRM fez (`classificacao`).
 *   - `ai_conversations` → `ai_messages` — perguntas e respostas do
 *     assistente, do mesmo autorizado.
 *
 * Tudo best-effort: falha de leitura → memória vazia, nunca erro.
 */

export const JANELA_HORAS = 2;
export const MAX_TROCAS = 6;

export interface Troca {
  papel: 'pessoa' | 'agente';
  texto: string;
  quando: string;
}

export interface FiltroMemoria {
  chatId: string | null;
  telefone: string;
  autorizadoId: string;
  agora?: Date;
}

/** Corta e limpa um texto para caber no prompt. */
function curto(s: string | null | undefined, max = 240): string {
  const t = String(s ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export async function conversaRecente(supabase: Client, f: FiltroMemoria): Promise<Troca[]> {
  const agora = f.agora ?? new Date();
  const desde = new Date(agora.getTime() - JANELA_HORAS * 3600_000).toISOString();

  try {
    let q = supabase
      .from('mensagens_whats')
      .select('texto_bruto, texto_transcrito, classificacao, recebida_em, created_at')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(MAX_TROCAS);
    // Num grupo, o que vale é o chat; no privado, o telefone.
    q = f.chatId ? q.eq('chat_id', f.chatId) : q.eq('telefone_from', f.telefone);

    const [msgs, conversas] = await Promise.all([
      q,
      supabase
        .from('ai_conversations')
        .select('id, created_at')
        .eq('autorizado_id', f.autorizadoId)
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(MAX_TROCAS),
    ]);

    const trocas: Troca[] = [];
    for (const m of msgs.data ?? []) {
      const texto = curto(m.texto_bruto || m.texto_transcrito);
      if (!texto) continue;
      trocas.push({ papel: 'pessoa', texto, quando: m.created_at ?? '' });
      if (m.classificacao) {
        trocas.push({
          papel: 'agente',
          texto: `(entendi como: ${m.classificacao})`,
          quando: m.created_at ?? '',
        });
      }
    }

    const ids = (conversas.data ?? []).map((c) => c.id);
    if (ids.length > 0) {
      const { data: mensagens } = await supabase
        .from('ai_messages')
        .select('papel, conteudo, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(MAX_TROCAS * 2);
      for (const m of mensagens ?? []) {
        trocas.push({
          papel: m.papel === 'usuario' ? 'pessoa' : 'agente',
          texto: curto(m.conteudo),
          quando: m.created_at ?? '',
        });
      }
    }

    // Mais antiga primeiro, para o modelo ler em ordem.
    trocas.sort((a, b) => a.quando.localeCompare(b.quando));
    return trocas.slice(-MAX_TROCAS * 2);
  } catch (err) {
    log.aviso('memoria_falhou', { err });
    return [];
  }
}

/** Texto pronto para o prompt; vazio quando não há nada. */
export function formatarConversa(trocas: readonly Troca[]): string {
  if (trocas.length === 0) return '';
  return trocas.map((t) => `${t.papel === 'pessoa' ? 'Pessoa' : 'Agente'}: ${t.texto}`).join('\n');
}

/**
 * A obra de que se estava falando: a última que apareceu nas mensagens
 * classificadas deste chat (`dados_extraidos.obra_id`) ou em uma ação
 * executada de criar obra, nas últimas horas. É o default do classificador
 * quando a mensagem não cita obra — "vou mandar os documentos aqui" depois
 * de "cria a obra X" arquiva em X sem perguntar a cada foto.
 */
export async function obraRecente(
  supabase: Client,
  f: FiltroMemoria,
): Promise<{ id: string; nome: string } | null> {
  const agora = f.agora ?? new Date();
  const desde = new Date(agora.getTime() - JANELA_HORAS * 3600_000).toISOString();
  try {
    let q = supabase
      .from('mensagens_whats')
      .select('dados_extraidos, created_at')
      .gte('created_at', desde)
      .not('dados_extraidos', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    q = f.chatId ? q.eq('chat_id', f.chatId) : q.eq('telefone_from', f.telefone);
    const { data } = await q;

    let obraId: string | null = null;
    let quando = '';
    for (const m of data ?? []) {
      const d = m.dados_extraidos as { obra_id?: unknown } | null;
      if (d && typeof d.obra_id === 'string') {
        obraId = d.obra_id;
        quando = m.created_at ?? '';
        break;
      }
    }

    // Ação de criar obra executada há pouco vence se for mais nova.
    const { data: acoes } = await supabase
      .from('confirmacoes_pendentes')
      .select('acao, respondida_em, resultado, tipo')
      .eq('tipo', 'acao')
      .eq('resultado', 'executada')
      .gte('respondida_em', desde)
      .order('respondida_em', { ascending: false })
      .limit(5);
    let nomeCriada: string | null = null;
    for (const a of acoes ?? []) {
      const acao = a.acao as { tipo?: unknown; dados?: { nome?: unknown } } | null;
      if (acao?.tipo === 'criar_obra' && typeof acao.dados?.nome === 'string') {
        if (!quando || (a.respondida_em ?? '') > quando) nomeCriada = acao.dados.nome;
        break;
      }
    }

    if (nomeCriada) {
      const { data: obra } = await supabase
        .from('obras')
        .select('id, nome')
        .eq('nome', nomeCriada)
        .is('deleted_at', null)
        .limit(1);
      if (obra?.[0]) return { id: obra[0].id, nome: obra[0].nome };
    }
    if (obraId) {
      const { data: obra } = await supabase
        .from('obras')
        .select('id, nome')
        .eq('id', obraId)
        .is('deleted_at', null)
        .limit(1);
      if (obra?.[0]) return { id: obra[0].id, nome: obra[0].nome };
    }
    return null;
  } catch (err) {
    log.aviso('obra_recente_falhou', { err });
    return null;
  }
}
