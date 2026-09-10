import 'server-only';
import { type Evento, entidadeDoEvento } from '@/lib/events/tipos';
import { AUTOMACOES, buscarAutomacao } from './registry';
import { type Automacao, type Client, type ContextoExecucao, ehAgendada } from './tipos';

/**
 * Motor de automações.
 *
 * Recebe um evento, descobre quais regras o assinam, e para cada uma: checa se
 * está ligada, avalia a condição, executa a ação e **registra o que aconteceu**
 * — inclusive quando não fez nada.
 *
 * ## Invariantes
 *
 * 1. **Uma regra nunca derruba outra.** Cada uma roda em seu próprio try/catch.
 * 2. **Uma regra nunca derruba quem emitiu.** Falha vira linha de log.
 * 3. **Toda avaliação vira log**, inclusive `pulada`. Automação silenciosa é
 *    impossível de depurar, e "por que não disparou?" é a pergunta mais comum.
 * 4. **Regra desligada não gera log.** Senão o log vira ruído de regras que o
 *    gestor desligou de propósito.
 */

interface OpcoesExecucao {
  simular: boolean;
  /** Quando true, ignora `apenasAgendada` — usado pelo cron. */
  permitirLentas?: boolean;
}

export async function executarAutomacoes(
  supabase: Client,
  evento: Evento,
  opcoes: OpcoesExecucao,
): Promise<void> {
  const candidatas = AUTOMACOES.filter((a) => a.gatilhos.includes(evento.nome));
  if (candidatas.length === 0) return;

  const habilitadas = await carregarHabilitadas(
    supabase,
    candidatas.map((a) => a.chave),
  );

  for (const automacao of candidatas) {
    const estado = habilitadas.get(automacao.chave);

    // Regra sem linha no banco nasce desligada. É proposital: uma automação
    // que começa a agir sozinha no deploy é exatamente o que não se quer de
    // um sistema que manda mensagem para cliente.
    if (!estado?.ativo) continue;

    // Sem fila, ação lenta no meio da request atrasa o usuário. Estas ficam
    // para o cron.
    if (automacao.apenasAgendada && !opcoes.permitirLentas) continue;

    await rodarUma(supabase, automacao, evento, estado.config, opcoes.simular);
  }
}

/**
 * Roda uma automação e registra o desfecho. Nunca lança.
 */
async function rodarUma(
  supabase: Client,
  automacao: Automacao,
  evento: Evento,
  config: Record<string, unknown>,
  simular: boolean,
): Promise<void> {
  const inicio = Date.now();
  const entidadeId = entidadeDoEvento(evento);

  const ctx: ContextoExecucao = {
    supabase,
    evento,
    config: { ...(automacao.configPadrao ?? {}), ...config },
    simular,
  };

  try {
    const veredito = await automacao.condicao(ctx);

    if (!veredito.passa) {
      await registrar(supabase, {
        regra_chave: automacao.chave,
        evento: evento.nome,
        status: 'pulada',
        motivo: veredito.motivo,
        entidade_id: entidadeId,
        payload: evento.payload,
        duracao_ms: Date.now() - inicio,
      });
      return;
    }

    if (simular) {
      await registrar(supabase, {
        regra_chave: automacao.chave,
        evento: evento.nome,
        status: 'simulada',
        motivo: 'Condição passou; ação não executada (simulação).',
        entidade_id: entidadeId,
        payload: evento.payload,
        duracao_ms: Date.now() - inicio,
      });
      return;
    }

    // Idempotência ANTES da ação, não depois.
    //
    // O índice único em `automation_executions` é a rede de segurança, mas
    // ele só dispara no INSERT do log — que acontece depois da ação. Confiar
    // só nele significaria mandar a segunda mensagem para o fornecedor e
    // então descobrir que era duplicada. Esta checagem é a que de fato
    // protege; o índice cobre a corrida entre duas execuções simultâneas.
    if (entidadeId && (await jaAgiuHoje(supabase, automacao.chave, entidadeId))) {
      await registrar(supabase, {
        regra_chave: automacao.chave,
        evento: evento.nome,
        status: 'pulada',
        motivo: 'Esta regra já agiu sobre esta entidade hoje (idempotência).',
        entidade_id: entidadeId,
        payload: evento.payload,
        duracao_ms: Date.now() - inicio,
      });
      return;
    }

    const { resumo } = await automacao.acao(ctx);

    await registrar(supabase, {
      regra_chave: automacao.chave,
      evento: evento.nome,
      status: 'sucesso',
      motivo: resumo,
      entidade_id: entidadeId,
      payload: evento.payload,
      duracao_ms: Date.now() - inicio,
    });
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    console.error(`[automacao:${automacao.chave}] falhou:`, motivo);
    await registrar(supabase, {
      regra_chave: automacao.chave,
      evento: evento.nome,
      status: 'falha',
      motivo: motivo.slice(0, 500),
      entidade_id: entidadeId,
      payload: evento.payload,
      duracao_ms: Date.now() - inicio,
    });
  }
}

/**
 * Executa as regras agendadas. Chamado pelo cron, não por evento.
 *
 * Cada regra varre o banco atrás das entidades que se aplicam e produz eventos
 * sintéticos — que então passam pelo mesmo caminho das regras por evento.
 * Isso é o que garante que uma regra agendada e uma por evento se comportem e
 * se registrem igual.
 */
export async function executarAgendadas(
  supabase: Client,
  opcoes: { simular: boolean; apenas?: string },
): Promise<{ regra: string; avaliadas: number }[]> {
  const agendadas = AUTOMACOES.filter(ehAgendada).filter(
    (a) => !opcoes.apenas || a.chave === opcoes.apenas,
  );

  const habilitadas = await carregarHabilitadas(
    supabase,
    agendadas.map((a) => a.chave),
  );

  const relatorio: { regra: string; avaliadas: number }[] = [];

  for (const automacao of agendadas) {
    const estado = habilitadas.get(automacao.chave);
    if (!estado?.ativo) continue;

    const config = { ...(automacao.configPadrao ?? {}), ...estado.config };

    let eventos: Evento[] = [];
    try {
      eventos = await automacao.varrer({ supabase, config, simular: opcoes.simular });
    } catch (err) {
      console.error(`[automacao:${automacao.chave}] varredura falhou:`, err);
      await registrar(supabase, {
        regra_chave: automacao.chave,
        evento: 'varredura',
        status: 'falha',
        motivo: err instanceof Error ? err.message.slice(0, 500) : String(err),
        entidade_id: null,
        payload: null,
        duracao_ms: 0,
      });
      continue;
    }

    for (const evento of eventos) {
      await rodarUma(supabase, automacao, evento, estado.config, opcoes.simular);
    }

    relatorio.push({ regra: automacao.chave, avaliadas: eventos.length });
  }

  return relatorio;
}

// ---------------------------------------------------------------------------
// Estado das regras
// ---------------------------------------------------------------------------

interface EstadoRegra {
  ativo: boolean;
  config: Record<string, unknown>;
}

async function carregarHabilitadas(
  supabase: Client,
  chaves: string[],
): Promise<Map<string, EstadoRegra>> {
  const mapa = new Map<string, EstadoRegra>();
  if (chaves.length === 0) return mapa;

  const { data, error } = await supabase
    .from('automation_rules')
    .select('chave, ativo, config')
    .in('chave', chaves);

  if (error) {
    // Falha fechada: sem conseguir ler o estado, não age. O contrário seria
    // rodar automação com config default numa hora em que o banco está ruim.
    console.error('[automacoes] não foi possível ler as regras:', error.message);
    return mapa;
  }

  for (const linha of data ?? []) {
    mapa.set(linha.chave, {
      ativo: linha.ativo,
      config: (linha.config as Record<string, unknown>) ?? {},
    });
  }

  return mapa;
}

/**
 * Esta regra já agiu com sucesso sobre esta entidade hoje?
 *
 * A janela é o dia corrente **em UTC**, casando com o índice único parcial da
 * migration. UTC explícito, e não a meia-noite local: em produção o runtime é
 * UTC, mas na máquina de quem desenvolve é BRT, e aí a trava do JS e a do
 * índice discordariam em três horas por dia.
 *
 * Serve ao caso concreto de uma regra de cobrança diária: mesmo que o cron
 * rode duas vezes (retry, deploy no meio da execução), o fornecedor recebe
 * uma mensagem só.
 */
async function jaAgiuHoje(supabase: Client, chave: string, entidadeId: string): Promise<boolean> {
  const inicioDoDia = new Date();
  inicioDoDia.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('automation_executions')
    .select('*', { count: 'exact', head: true })
    .eq('regra_chave', chave)
    .eq('entidade_id', entidadeId)
    .eq('status', 'sucesso')
    .gte('created_at', inicioDoDia.toISOString());

  if (error) {
    // Falha fechada: sem conseguir confirmar que ainda não agiu, não age.
    // Deixar de mandar uma cobrança é recuperável; mandar duas, não.
    console.error('[automacoes] checagem de idempotência falhou:', error.message);
    return true;
  }

  return (count ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

interface LinhaLog {
  regra_chave: string;
  evento: string;
  status: 'sucesso' | 'pulada' | 'falha' | 'simulada';
  motivo: string | null;
  entidade_id: string | null;
  payload: unknown;
  duracao_ms: number;
}

async function registrar(supabase: Client, linha: LinhaLog): Promise<void> {
  const { error } = await supabase.from('automation_executions').insert({
    regra_chave: linha.regra_chave,
    evento: linha.evento,
    status: linha.status,
    motivo: linha.motivo,
    entidade_id: linha.entidade_id,
    payload: linha.payload as never,
    duracao_ms: linha.duracao_ms,
  });

  if (error) {
    // 23505 = trava de idempotência: esta regra já agiu sobre esta entidade
    // hoje. Não é erro — é a trava funcionando, e o log da primeira vez já
    // está lá.
    if (error.code === '23505') return;
    console.error('[automacoes] falha ao gravar log de execução:', error.message);
  }
}

export { buscarAutomacao };
