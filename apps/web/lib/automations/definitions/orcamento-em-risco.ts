import 'server-only';
import type { Evento } from '@/lib/events/tipos';
import type { AutomacaoAgendada, ContextoExecucao, ResultadoCondicao } from '../tipos';

/**
 * Avisa quando uma obra cruza o limiar de consumo do orçamento.
 *
 * Serve para provar que o motor funciona com uma ação **interna** — que só
 * grava no banco — e não só com envio de WhatsApp. Isso importa porque o
 * sistema hoje não tem credencial de WhatsApp; sem uma automação assim, nada
 * seria demonstrável até o UAZAPI existir.
 *
 * A ação registra uma notificação. Quando houver canal (WhatsApp, e-mail,
 * push), basta trocar a ação — condição, log e idempotência continuam iguais.
 */

const LIMIAR_PADRAO = 80;

export const orcamentoEmRisco: AutomacaoAgendada = {
  chave: 'orcamento-em-risco',
  descricao: 'Registra alerta quando o gasto de uma obra passa do limiar do orçamento.',
  gatilhos: ['obra.orcamento_em_risco', 'pagamento.criado'],
  configPadrao: { limiar_percentual: LIMIAR_PADRAO },

  async varrer({ supabase, config }): Promise<Evento[]> {
    const limiar = numero(config.limiar_percentual, LIMIAR_PADRAO);

    const { data: obras, error } = await supabase
      .from('obras')
      .select('id, nome, orcamento')
      .is('deleted_at', null)
      .eq('status', 'ativa')
      .not('orcamento', 'is', null);

    if (error) throw new Error(`Varredura falhou: ${error.message}`);

    const eventos: Evento[] = [];

    for (const obra of obras ?? []) {
      const orcamento = Number(obra.orcamento);
      if (!orcamento || orcamento <= 0) continue;

      const { data: pagamentos } = await supabase
        .from('pagamentos')
        .select('valor')
        .eq('obra_id', obra.id)
        .is('deleted_at', null)
        .in('status_pagto', ['confirmado', 'aguardando']);

      const total = (pagamentos ?? []).reduce((a, p) => a + Number(p.valor), 0);
      const percentual = Math.round((total / orcamento) * 100);

      if (percentual >= limiar) {
        eventos.push({
          nome: 'obra.orcamento_em_risco',
          payload: { obraId: obra.id, percentual, totalGasto: total },
          em: new Date().toISOString(),
          userId: null,
        });
      }
    }

    return eventos;
  },

  async condicao(ctx: ContextoExecucao): Promise<ResultadoCondicao> {
    const payload = ctx.evento.payload as { obraId?: string; percentual?: number };
    const limiar = numero(ctx.config.limiar_percentual, LIMIAR_PADRAO);

    // O gatilho `pagamento.criado` não carrega percentual — nesse caminho a
    // regra não decide nada e deixa para a varredura agendada, que tem o
    // número. Barrar aqui é mais barato que recalcular a cada pagamento.
    if (typeof payload.percentual !== 'number') {
      return { passa: false, motivo: 'Evento sem percentual; avaliação fica para a varredura.' };
    }

    if (payload.percentual < limiar) {
      return {
        passa: false,
        motivo: `Consumo em ${payload.percentual}%, abaixo do limiar de ${limiar}%.`,
      };
    }

    return { passa: true };
  },

  async acao(ctx: ContextoExecucao): Promise<{ resumo: string }> {
    const { obraId, percentual, totalGasto } = ctx.evento.payload as {
      obraId: string;
      percentual: number;
      totalGasto: number;
    };

    const { data: obra } = await ctx.supabase
      .from('obras')
      .select('nome')
      .eq('id', obraId)
      .maybeSingle();

    const nome = obra?.nome ?? obraId;
    const valorBr = totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const resumo = `Obra "${nome}" em ${percentual}% do orçamento (${valorBr}).`;

    if (ctx.simular) {
      return { resumo: `[simulado] ${resumo}` };
    }

    // A ação real é registrar. O log de execução é, por ora, o próprio canal
    // de notificação: a linha fica em `automation_executions` com este resumo.
    // Ainda não existe tela para ele — consulta é por SQL até a Fase 2 ganhar
    // painel. Trocar isto por um envio real é substituir estas linhas.
    return { resumo };
  },
};

function numero(v: unknown, padrao: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : padrao;
}
