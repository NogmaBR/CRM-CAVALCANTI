import type { Evento, NomeEvento } from '@/lib/events/tipos';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Contrato de uma automação.
 *
 * Uma automação é a tripla **gatilho → condição → ação**, que é exatamente o
 * que um nó de workflow visual faz — só que aqui com tipo, teste e histórico
 * no Git.
 *
 * A separação entre condição e ação não é cosmética: é ela que permite
 * registrar `pulada` com o motivo. Quando o cliente perguntar "por que não
 * cobraram o fornecedor?", a resposta quase sempre está na condição, e sem
 * essa separação ela não existiria em lugar nenhum.
 */

export type Client = SupabaseClient<Database>;

/** Resultado de uma condição. O motivo é obrigatório quando barra. */
export type ResultadoCondicao = { passa: true } | { passa: false; motivo: string };

export interface ContextoExecucao {
  supabase: Client;
  evento: Evento;
  /** Parâmetros vindos de `automation_rules.config`, já validados. */
  config: Record<string, unknown>;
  /** Em simulação, ações não devem causar efeito externo. */
  simular: boolean;
}

export interface Automacao {
  /** Casa com `automation_rules.chave`. Imutável: é chave em banco e em log. */
  chave: string;

  /** Uma linha, em português, para o painel. */
  descricao: string;

  /**
   * Eventos que disparam esta regra. Vazio significa que ela só roda agendada.
   */
  gatilhos: NomeEvento[];

  /**
   * Marca regras cuja ação faz I/O lento (WhatsApp, LLM). Enquanto não houver
   * fila, elas **não** rodam no evento — só no cron — para não pendurar a
   * request do usuário. Na Fase 3 esta flag deixa de importar.
   */
  apenasAgendada?: boolean;

  /**
   * A ação sai do sistema e alcança alguém de fora — manda WhatsApp, e-mail,
   * chama API de terceiro.
   *
   * Existe para o painel poder avisar antes de ligar. É declarado e não
   * inferido de `apenasAgendada` porque as duas coisas são diferentes: uma
   * regra pode ser lenta sem falar com ninguém (uma varredura pesada), e uma
   * regra rápida pode mandar mensagem. Confundir as duas faria o aviso
   * aparecer na tela errada — ou, pior, não aparecer na certa.
   */
  efeitoExterno?: boolean;

  /** Valores default quando `automation_rules.config` estiver vazio. */
  configPadrao?: Record<string, unknown>;

  /** Decide se age. Sem efeito colateral aqui — só leitura. */
  condicao(ctx: ContextoExecucao): Promise<ResultadoCondicao>;

  /** Age. Só é chamada quando a condição passou. */
  acao(ctx: ContextoExecucao): Promise<{ resumo: string }>;
}

/**
 * Automação que roda por tempo, não por evento.
 *
 * O `varrer` produz um evento sintético por entidade encontrada — assim a
 * regra agendada e a regra por evento compartilham exatamente o mesmo
 * caminho de condição, ação e log.
 */
export interface AutomacaoAgendada extends Automacao {
  varrer(ctx: Omit<ContextoExecucao, 'evento'>): Promise<Evento[]>;
}

export function ehAgendada(a: Automacao): a is AutomacaoAgendada {
  return typeof (a as AutomacaoAgendada).varrer === 'function';
}
